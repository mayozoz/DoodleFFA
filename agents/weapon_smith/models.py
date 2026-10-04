"""Request/response models for the Weapon Smith REST endpoint.

The weapon goes back as a JSON *string* on purpose: the game validates and clamps it anyway,
so the agent doesn't need its own copy of every field's type.
"""

from uagents import Model


class SpecRequest(Model):
    token: str
    png_base64: str
    features_json: str = "{}"
    flavor: str = ""
    seed: int = 0


class SpecResponse(Model):
    weapon_json: str = ""
    error: str = ""
    prompt_version: str = ""
    seconds: float = 0.0


class Health(Model):
    ok: bool
    prompt_version: str
    address: str
