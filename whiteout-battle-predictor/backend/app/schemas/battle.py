"""
WHITEOUT SURVIVAL — API Schemas (Pydantic v2)
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── TROOP STATS ───────────────────────────────────────────────────────────────

class TroopStatsSchema(BaseModel):
    atk: float = Field(ge=0, description="Base attack value")
    atk_pct: float = Field(ge=0, description="Attack percentage bonus")
    def_: float = Field(ge=0, alias="def", description="Base defense value")
    def_pct: float = Field(ge=0, description="Defense percentage bonus")
    hp: float = Field(ge=0, description="Base health value")
    hp_pct: float = Field(ge=0, description="Health percentage bonus")
    leth: float = Field(ge=0, description="Base lethality value")
    leth_pct: float = Field(ge=0, description="Lethality percentage bonus")

    class Config:
        populate_by_name = True


class ArmyStatsSchema(BaseModel):
    infantry: TroopStatsSchema
    lancer: TroopStatsSchema
    marksman: TroopStatsSchema


# ── BATTLE REQUEST / RESPONSE ─────────────────────────────────────────────────

class BattleRequest(BaseModel):
    user_stats: ArmyStatsSchema
    enemy_stats: ArmyStatsSchema
    preset_id: Optional[str] = None
    scout_id: Optional[str] = None


class BattleResponse(BaseModel):
    prediction_id: str
    win_probability: float
    predicted_winner: str           # "user" | "enemy"
    rounds_fought: int
    user_losses_pct: dict
    enemy_losses_pct: dict
    biggest_advantage: str
    biggest_weakness: str
    recommended_formation: dict     # {infantry: %, lancer: %, marksman: %}
    user_damage_score: float
    enemy_damage_score: float
    user_defense_score: float
    enemy_defense_score: float
    timestamp: str


# ── OPTIMIZER ─────────────────────────────────────────────────────────────────

class OptimizeRequest(BaseModel):
    user_stats: ArmyStatsSchema
    enemy_stats: ArmyStatsSchema
    targets: Optional[list[int]] = [75, 85, 95]


class OptimizeResponse(BaseModel):
    results: list[dict]


# ── PRESETS ───────────────────────────────────────────────────────────────────

class PresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    stats: dict                   # Full army stats JSON
    is_active: bool = False


class PresetResponse(BaseModel):
    id: str
    name: str
    stats: dict
    is_active: bool
    created_at: datetime


# ── FEEDBACK ─────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    prediction_id: str
    predicted_winner: str
    actual_winner: str            # "user" | "enemy"
    win_probability_at_prediction: float
    loss_accuracy_rating: Optional[int] = Field(None, ge=1, le=5)


class FeedbackResponse(BaseModel):
    id: str
    correct: bool
    created_at: datetime
