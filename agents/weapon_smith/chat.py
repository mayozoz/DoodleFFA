"""ACP 0.3.0, stateless one-request sessions with persistent bounded deduplication."""
import hashlib
import json
import time
from uagents import Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement, ChatMessage, EndSessionContent, TextContent, chat_protocol_spec,
)
from smith import forge, describe

protocol = Protocol(spec=chat_protocol_spec)
_inflight = set()

@protocol.on_message(ChatMessage)
async def handle_message(ctx, sender, msg):
    await ctx.send(sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id))
    # Envelope session is retained automatically by ctx.send. No cross-session history.
    key = hashlib.sha256(f'{sender}:{ctx.session}:{msg.msg_id}'.encode()).hexdigest()
    records = ctx.storage.get('chat_requests') or {}
    now = time.time()
    records = {k: v for k, v in records.items() if now - v['at'] < 86400}
    if key in _inflight:
        return
    if key in records:
        if records[key].get('control'):
            return
        cached = records[key].get('reply')
        if cached:
            reply = ChatMessage.parse_obj(cached)
        else:
            # A process crash left a claim; explain recovery without repeating model spend.
            reply = ChatMessage(content=[TextContent(text='An earlier attempt was interrupted. Send a new request to retry.'), EndSessionContent()])
            records[key]['reply'] = json.loads(reply.json())
            ctx.storage.set('chat_requests', records)
        await ctx.send(sender, reply)
        return
    if len(records) >= 512:
        records.pop(next(iter(records)))
    records[key] = {'at': now}
    ctx.storage.set('chat_requests', records)
    _inflight.add(key)
    started = time.monotonic()
    status = 'unsupported'
    try:
        text = '\n'.join(item.text for item in msg.content if isinstance(item, TextContent)).strip()
        if text:
            result = await forge(text=text)
            response = describe(result)
            status = 'fallback' if result['issues'] else 'success'
        elif any(item.type == 'resource' for item in msg.content):
            response = 'Weapon Smith accepts text requests here. Describe the weapon and its mechanics.'
        else:
            records = ctx.storage.get('chat_requests') or {}
            records[key] = {'at': now, 'control': True}
            ctx.storage.set('chat_requests', records)
            return  # acknowledge start/end-only sessions without generating a weapon
    except Exception as err:
        status = type(err).__name__
        response = 'Weapon creation is unavailable or busy. Please send a new request to retry.'
    finally:
        _inflight.discard(key)
        ctx.logger.info(f'chat duration={time.monotonic() - started:.3f}s status={status}')
    reply = ChatMessage(content=[TextContent(text=response), EndSessionContent()])
    records = ctx.storage.get('chat_requests') or {}
    # Storage requires JSON serializable UUIDs/timestamps.
    if key not in records and len(records) >= 512:
        records.pop(next(iter(records)))
    records[key] = {'at': now, 'reply': json.loads(reply.json())}
    ctx.storage.set('chat_requests', records)
    await ctx.send(sender, reply)

@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx, sender, msg):
    pass
