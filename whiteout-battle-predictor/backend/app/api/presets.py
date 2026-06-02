"""
WHITEOUT SURVIVAL — Presets API Router
CRUD for user stat presets.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

router = APIRouter()

# In-memory for MVP — wire to PostgreSQL/Supabase in production
preset_store = {}


class PresetCreate(BaseModel):
    user_id: str
    name: str
    stats: dict
    is_active: bool = False


@router.post("/")
def create_preset(preset: PresetCreate):
    pid = str(uuid.uuid4())
    entry = {
        "id": pid,
        "user_id": preset.user_id,
        "name": preset.name,
        "stats": preset.stats,
        "is_active": preset.is_active,
        "created_at": datetime.utcnow().isoformat(),
    }
    preset_store[pid] = entry
    return entry


@router.get("/{user_id}")
def get_presets(user_id: str):
    return [p for p in preset_store.values() if p["user_id"] == user_id]


@router.put("/{preset_id}")
def update_preset(preset_id: str, update: dict):
    if preset_id not in preset_store:
        raise HTTPException(status_code=404, detail="Preset not found")
    preset_store[preset_id].update(update)
    return preset_store[preset_id]


@router.delete("/{preset_id}")
def delete_preset(preset_id: str):
    if preset_id not in preset_store:
        raise HTTPException(status_code=404, detail="Preset not found")
    del preset_store[preset_id]
    return {"deleted": preset_id}
