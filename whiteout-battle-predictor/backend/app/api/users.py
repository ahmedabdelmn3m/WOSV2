"""
WHITEOUT SURVIVAL — Users API Router
Minimal user management for MVP.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
from datetime import datetime

router = APIRouter()

user_store = {}


class UserCreate(BaseModel):
    username: str
    email: str = None


@router.post("/")
def create_user(user: UserCreate):
    uid = str(uuid.uuid4())
    entry = {
        "id": uid,
        "username": user.username,
        "email": user.email,
        "created_at": datetime.utcnow().isoformat()
    }
    user_store[uid] = entry
    return entry


@router.get("/{user_id}")
def get_user(user_id: str):
    if user_id not in user_store:
        raise HTTPException(status_code=404, detail="User not found")
    return user_store[user_id]
