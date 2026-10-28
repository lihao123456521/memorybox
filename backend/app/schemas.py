from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    templateId: Literal["old-home", "station", "classroom"]
    year: str = Field(min_length=1, max_length=30)
    place: str = Field(min_length=1, max_length=120)
    importantPerson: str = Field(min_length=1, max_length=80)
    importantObject: str = Field(min_length=1, max_length=100)
    storyText: str = Field(min_length=1, max_length=5000)
    actualChoice: str = Field(min_length=1, max_length=1000)


class MemoryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    draft: Draft
    # Accepted for frontend compatibility; authoritative story is composed server-side.
    story: dict | None = None


class LetterCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    recipient: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=10000)
    branch: Literal["real", "imagined"]


class AssetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    prompt: str = Field(default="", max_length=2000)
    provider: Literal["local", "lux3d"] = "local"
