"""Local ACP handler/REST/adapter tests. No Agentverse or live model calls."""
import asyncio
import json
import logging
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import httpx
import chat
import smith
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement, ChatMessage, EndSessionContent, StartSessionContent, TextContent, chat_protocol_spec,
)

class Storage:
    def __init__(self): self.data = {}
    def get(self, key): return json.loads(json.dumps(self.data.get(key)))
    def set(self, key, value): self.data[key] = json.loads(json.dumps(value))

def context(storage=None):
    return SimpleNamespace(send=AsyncMock(), storage=storage or Storage(), session=uuid4(), logger=logging.getLogger('test'))

class SmithTests(unittest.IsolatedAsyncioTestCase):
    async def test_adapter_balances_and_repairs(self):
        fixture = json.loads((smith.ROOT / 'packages/spec/fixtures/thunder-mallet.json').read_text())
        valid = await smith.canonical_weapon(fixture)
        bad = await smith.canonical_weapon({'weapon': None})
        self.assertGreater(valid['weapon']['stats']['damagePerHit'], 0)
        self.assertEqual(bad['weapon']['spec']['name'], 'Mystery Stick')
        self.assertTrue(bad['issues'])

    async def test_protocol_ack_artifact_session_and_duplicate(self):
        self.assertEqual(chat_protocol_spec.version, '0.3.0')
        result = await smith.canonical_weapon({})
        ctx = context()
        msg = ChatMessage(content=[StartSessionContent(), TextContent(text='Forge an ice spear')])
        with patch('chat.forge', AsyncMock(return_value=result)) as forge:
            await chat.handle_message(ctx, 'sender', msg)
            await chat.handle_message(ctx, 'sender', msg)
            forge.assert_awaited_once_with(text='Forge an ice spear')
        ack, reply, duplicate_ack, duplicate_reply = [c.args[1] for c in ctx.send.await_args_list]
        self.assertIsInstance(ack, ChatAcknowledgement)
        self.assertEqual(ack.acknowledged_msg_id, msg.msg_id)
        self.assertIsInstance(reply.content[-1], EndSessionContent)
        self.assertIn('```json', reply.content[0].text)
        self.assertIn('not been inserted', reply.content[0].text)
        self.assertEqual(reply.msg_id, duplicate_reply.msg_id)
        self.assertEqual(duplicate_ack.acknowledged_msg_id, msg.msg_id)
        # New handler context/storage reload keeps idempotency across a process restart.
        restarted = context(ctx.storage); restarted.session = ctx.session
        with patch('chat.forge', AsyncMock()) as forge:
            await chat.handle_message(restarted, 'sender', msg)
            forge.assert_not_awaited()

    async def test_control_only_and_inflight_duplicates(self):
        ctx = context(); msg = ChatMessage(content=[EndSessionContent()])
        with patch('chat.forge', AsyncMock()) as forge:
            await chat.handle_message(ctx, 'sender', msg)
            await chat.handle_message(ctx, 'sender', msg)
            forge.assert_not_awaited()
        self.assertEqual(ctx.send.await_count, 2)
        entered, release = asyncio.Event(), asyncio.Event()
        result = await smith.canonical_weapon({})
        async def work(**kwargs): entered.set(); await release.wait(); return result
        msg = ChatMessage(content=[TextContent(text='fire sword')]); ctx = context()
        with patch('chat.forge', side_effect=work) as forge:
            task = asyncio.create_task(chat.handle_message(ctx, 'sender', msg))
            await entered.wait()
            await chat.handle_message(ctx, 'sender', msg)
            release.set(); await task
            self.assertEqual(forge.call_count, 1)
        self.assertEqual(ctx.send.await_count, 3)  # two acks, one completed reply

    async def test_interrupted_claim_does_not_repeat_model_call(self):
        import hashlib
        ctx = context(); msg = ChatMessage(content=[TextContent(text='test')])
        key = hashlib.sha256(f'sender:{ctx.session}:{msg.msg_id}'.encode()).hexdigest()
        import time
        ctx.storage.set('chat_requests', {key: {'at': time.time()}})
        with patch('chat.forge', AsyncMock()) as forge:
            await chat.handle_message(ctx, 'sender', msg)
            forge.assert_not_awaited()
        self.assertIn('interrupted', ctx.send.await_args_list[-1].args[1].content[0].text)

    async def test_sdk_chat_dispatch_and_envelope_session(self):
        from uagents import Agent
        from uagents.context import ExternalContext
        from uagents_core.identity import Identity
        include = Agent.include
        with patch.dict(os.environ, {'AGENT_SEED': 'local-test-only', 'AGENT_SHARED_SECRET': 'local-token'}), patch.object(Agent, 'include', lambda self, proto, publish_manifest=False: include(self, proto, publish_manifest=False)):
            import agent
        session = uuid4()
        sender = Identity.from_seed('local-client', 0).address
        msg = ChatMessage(content=[StartSessionContent(), TextContent(text='Make a spear')])
        result = await smith.canonical_weapon({})
        sent = []
        async def send(ctx, destination, payload, **kwargs):
            sent.append((ctx.session, destination, payload))
        with patch.object(ExternalContext, 'send', send), patch.object(agent.agent, '_storage', Storage()), patch('chat.forge', AsyncMock(return_value=result)):
            await agent.agent._process_single_message(ChatMessage.build_schema_digest(ChatMessage), sender, msg.json(), session)
            await asyncio.gather(*agent.agent._message_tasks)
        self.assertEqual(len(sent), 2)
        self.assertTrue(all(item[0] == session and item[1] == sender for item in sent))
        self.assertIsInstance(sent[0][2], ChatAcknowledgement)
        self.assertIsInstance(sent[1][2], ChatMessage)
        artifact = sent[1][2].content[0].text.split('```json\n')[1].split('\n```')[0]
        self.assertEqual(json.loads(artifact), result['weapon'])
        self.assertTrue(agent.agent.protocols)

    async def test_timeout_unavailability_and_nonblocking_concurrency(self):
        async def slow(*args): await asyncio.sleep(.1); return {}
        with patch('smith._forge', side_effect=slow), patch('smith.TIMEOUT_S', .01):
            with self.assertRaises(asyncio.TimeoutError): await smith.forge(text='test')
        self.assertEqual(smith._active, 0)
        with patch('chat.forge', AsyncMock(side_effect=httpx.ConnectError('private payload'))):
            ctx = context(); await chat.handle_message(ctx, 'sender', ChatMessage(content=[TextContent(text='test')]))
            self.assertIn('unavailable', ctx.send.await_args_list[-1].args[1].content[0].text)
            self.assertNotIn('private payload', ctx.send.await_args_list[-1].args[1].content[0].text)
        entered, release = asyncio.Event(), asyncio.Event()
        async def work(*args):
            if smith._active == 4: entered.set()
            await release.wait(); return {}
        with patch('smith._forge', side_effect=work):
            tasks = [asyncio.create_task(smith.forge(text='test')) for _ in range(4)]
            await asyncio.wait_for(entered.wait(), 1)
            with self.assertRaisesRegex(RuntimeError, 'busy'): await smith.forge(text='fifth')
            release.set(); await asyncio.gather(*tasks)
        self.assertEqual(smith._active, 0)

    async def test_rest_sdk_route_auth_and_contract(self):
        # Actual SDK ASGI routing and request models; model mocked.
        from uagents import Agent
        include = Agent.include
        with patch.dict(os.environ, {'AGENT_SEED': 'local-test-only', 'AGENT_SHARED_SECRET': 'local-token'}), patch.object(Agent, 'include', lambda self, proto, publish_manifest=False: include(self, proto, publish_manifest=False)):
            import agent
        transport = httpx.ASGITransport(app=agent.agent._server)
        result = await smith.canonical_weapon({})
        async with httpx.AsyncClient(transport=transport, base_url='http://local') as client:
            with patch('agent.forge', AsyncMock(return_value=result)) as forge:
                denied = await client.post('/spec', json={'token': 'wrong', 'png_base64': ''})
                self.assertEqual(denied.json()['error'], 'unauthorized'); forge.assert_not_awaited()
                response = await client.post('/spec', json={'token': 'local-token', 'png_base64': 'AQI=', 'features_json': '{}'})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(json.loads(response.json()['weapon_json']), result['weapon']['spec'])
                health = await client.get('/health'); self.assertTrue(health.json()['ok'])
            with patch('agent.forge', AsyncMock(side_effect=asyncio.TimeoutError)):
                response = await client.post('/spec', json={'token': 'local-token', 'png_base64': ''})
                self.assertEqual(response.json()['error'], 'TimeoutError')

if __name__ == '__main__': unittest.main()
