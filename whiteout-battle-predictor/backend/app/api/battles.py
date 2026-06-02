"""
WHITEOUT SURVIVAL — Battles API Router
Handles simulation and reverse optimization endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.combat_engine import (
    ArmyStats, TroopStats, BattleSimulator, ReverseOptimizer
)
from app.schemas.battle import (
    ArmyStatsSchema, BattleRequest, BattleResponse,
    OptimizeRequest, OptimizeResponse
)
import uuid
from datetime import datetime

router = APIRouter()
simulator = BattleSimulator()
optimizer = ReverseOptimizer()


def schema_to_army(schema: ArmyStatsSchema) -> ArmyStats:
    """Convert Pydantic schema to engine dataclass."""
    def to_troop(t) -> TroopStats:
        return TroopStats(
            atk=t.atk, atk_pct=t.atk_pct,
            def_=t.def_, def_pct=t.def_pct,
            hp=t.hp, hp_pct=t.hp_pct,
            leth=t.leth, leth_pct=t.leth_pct
        )
    return ArmyStats(
        infantry=to_troop(schema.infantry),
        lancer=to_troop(schema.lancer),
        marksman=to_troop(schema.marksman),
    )


@router.post("/simulate", response_model=BattleResponse)
def simulate_battle(request: BattleRequest):
    """
    Run a full round-based battle simulation.
    Returns win probability, losses, formation recommendations.
    """
    try:
        user_army = schema_to_army(request.user_stats)
        enemy_army = schema_to_army(request.enemy_stats)
        result = simulator.simulate(user_army, enemy_army)

        return BattleResponse(
            prediction_id=str(uuid.uuid4()),
            win_probability=result.win_probability,
            predicted_winner=result.winner,
            rounds_fought=result.rounds_fought,
            user_losses_pct=result.user_losses_pct,
            enemy_losses_pct=result.enemy_losses_pct,
            biggest_advantage=result.biggest_advantage,
            biggest_weakness=result.biggest_weakness,
            recommended_formation=result.recommended_formation,
            user_damage_score=round(result.user_damage_score, 2),
            enemy_damage_score=round(result.enemy_damage_score, 2),
            user_defense_score=round(result.user_defense_score, 2),
            enemy_defense_score=round(result.enemy_defense_score, 2),
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize", response_model=OptimizeResponse)
def optimize_stats(request: OptimizeRequest):
    """
    Reverse optimizer: find what stat upgrades are needed
    to reach target win percentages (75%, 85%, 95%).
    """
    try:
        user_army = schema_to_army(request.user_stats)
        enemy_army = schema_to_army(request.enemy_stats)
        targets = request.targets or [75, 85, 95]
        results = optimizer.optimize(user_army, enemy_army, targets)

        return OptimizeResponse(
            results=[
                {
                    "target_pct": r.target_pct,
                    "already_achieved": r.already_achieved,
                    "current_win_pct": r.current_win_pct,
                    "upgrades": [
                        {
                            "troop": u.troop,
                            "stat": u.stat,
                            "boost_amount": u.boost_amount,
                            "efficiency": u.efficiency,
                            "label": u.label
                        }
                        for u in r.upgrades
                    ]
                }
                for r in results
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
