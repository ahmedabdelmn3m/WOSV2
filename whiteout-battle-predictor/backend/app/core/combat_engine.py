"""
WHITEOUT SURVIVAL — Battle Predictor
Combat Engine v1.0

Modular, formula-driven simulation engine.
All formulas are isolated here — never in UI or API layers.
"""

from dataclasses import dataclass, field
from typing import Optional
import math


# ── DATA STRUCTURES ──────────────────────────────────────────────────────────

@dataclass
class TroopStats:
    atk: float = 0
    atk_pct: float = 0      # percent bonus (e.g. 35 = 35%)
    def_: float = 0
    def_pct: float = 0
    hp: float = 0
    hp_pct: float = 0
    leth: float = 0
    leth_pct: float = 0


@dataclass
class ArmyStats:
    infantry: TroopStats = field(default_factory=TroopStats)
    lancer: TroopStats = field(default_factory=TroopStats)
    marksman: TroopStats = field(default_factory=TroopStats)


@dataclass
class RoundLog:
    round_num: int
    user_hp: dict     # {infantry: float, lancer: float, marksman: float}
    enemy_hp: dict


@dataclass
class BattleResult:
    win_probability: float          # 0–100
    winner: str                     # "user" | "enemy"
    rounds_fought: int
    user_losses_pct: dict           # {infantry: %, lancer: %, marksman: %}
    enemy_losses_pct: dict
    biggest_advantage: str          # e.g. "Infantry ATK"
    biggest_weakness: str
    recommended_formation: dict     # {infantry: %, lancer: %, marksman: %}
    user_damage_score: float
    enemy_damage_score: float
    user_defense_score: float
    enemy_defense_score: float
    round_log: list[RoundLog]


@dataclass
class OptimizerUpgrade:
    troop: str
    stat: str
    boost_amount: float
    efficiency: float               # win% gain per 1000 stat points
    label: str


@dataclass
class OptimizerResult:
    target_pct: int
    already_achieved: bool
    current_win_pct: float
    upgrades: list[OptimizerUpgrade]


# ── CORE FORMULAS ─────────────────────────────────────────────────────────────

def calc_damage(atk: float, atk_pct: float, leth: float, leth_pct: float) -> float:
    """
    DAMAGE = (Attack × (1 + Attack%) × Lethality × (1 + Lethality%)) / 100
    """
    return (atk * (1 + atk_pct / 100) * leth * (1 + leth_pct / 100)) / 100


def calc_defense(def_: float, def_pct: float, hp: float, hp_pct: float) -> float:
    """
    DEFENSE = (Defense × (1 + Defense%) × Health × (1 + Health%)) / 100
    """
    return (def_ * (1 + def_pct / 100) * hp * (1 + hp_pct / 100)) / 100


def calc_effective_damage(raw_dmg: float, enemy_defense: float) -> float:
    """Damage mitigation via defense (30% absorption rate)."""
    return max(0.0, raw_dmg - enemy_defense * 0.30)


# ── TYPE ADVANTAGE MATRIX ────────────────────────────────────────────────────
# Infantry beats Marksman
# Marksman beats Lancer
# Lancer beats Infantry

TYPE_ADVANTAGE = {
    "infantry": "lancer",
    "lancer": "marksman",
    "marksman": "infantry",
}
ADVANTAGE_BONUS = 0.15  # 15% bonus damage against countered type


# ── SIMULATION ENGINE ─────────────────────────────────────────────────────────

class BattleSimulator:
    """
    Round-based battle simulator.
    Each round: damage exchange → troop reduction → recalculate.
    Stops when one side reaches 0 OR max_rounds reached.
    """

    MAX_ROUNDS = 20
    HP_DECAY_FACTOR = 0.80   # per-round HP drain scaling

    def __init__(self, max_rounds: int = MAX_ROUNDS):
        self.max_rounds = max_rounds

    def simulate(self, user: ArmyStats, enemy: ArmyStats) -> BattleResult:
        troops = ["infantry", "lancer", "marksman"]

        # Pre-calculate static scores
        user_dmg = {t: calc_damage(*self._dmg_args(user, t)) for t in troops}
        enemy_dmg = {t: calc_damage(*self._dmg_args(enemy, t)) for t in troops}
        user_def = {t: calc_defense(*self._def_args(user, t)) for t in troops}
        enemy_def = {t: calc_defense(*self._def_args(enemy, t)) for t in troops}

        # HP pools start at 100 (percentage-based simulation)
        user_hp = {t: 100.0 for t in troops}
        enemy_hp = {t: 100.0 for t in troops}
        round_log = []

        for round_num in range(1, self.max_rounds + 1):
            u_alive = [t for t in troops if user_hp[t] > 0]
            e_alive = [t for t in troops if enemy_hp[t] > 0]

            if not u_alive or not e_alive:
                break

            # User attacks enemy
            for t in u_alive:
                live_targets = [x for x in e_alive if enemy_hp[x] > 0]
                if not live_targets:
                    continue
                preferred = TYPE_ADVANTAGE[t]
                target = preferred if preferred in live_targets else live_targets[0]
                dmg = calc_effective_damage(user_dmg[t], enemy_def[target])
                if target == preferred:
                    dmg *= (1 + ADVANTAGE_BONUS)
                enemy_hp[target] = max(0.0, enemy_hp[target] - dmg * self.HP_DECAY_FACTOR / round_num)

            # Enemy attacks user
            for t in e_alive:
                live_targets = [x for x in u_alive if user_hp[x] > 0]
                if not live_targets:
                    continue
                preferred = TYPE_ADVANTAGE[t]
                target = preferred if preferred in live_targets else live_targets[0]
                dmg = calc_effective_damage(enemy_dmg[t], user_def[target])
                if target == preferred:
                    dmg *= (1 + ADVANTAGE_BONUS)
                user_hp[target] = max(0.0, user_hp[target] - dmg * self.HP_DECAY_FACTOR / round_num)

            round_log.append(RoundLog(
                round_num=round_num,
                user_hp=dict(user_hp),
                enemy_hp=dict(enemy_hp)
            ))

        # ── WIN PROBABILITY CALCULATION ──────────────────────────────────────
        u_dmg_total = sum(user_dmg.values())
        e_dmg_total = sum(enemy_dmg.values())
        u_def_total = sum(user_def.values())
        e_def_total = sum(enemy_def.values())

        raw_ratio = (u_dmg_total + u_def_total) / max(e_dmg_total + e_def_total, 0.001)
        u_hp_avg = sum(user_hp.values()) / 3
        e_hp_avg = sum(enemy_hp.values()) / 3

        win_pct = 50 + (raw_ratio - 1) * 40 + (u_hp_avg - e_hp_avg) * 0.3
        win_pct = max(3.0, min(97.0, round(win_pct, 1)))

        # ── STRENGTH ANALYSIS ────────────────────────────────────────────────
        biggest_adv, adv_diff = "", -float("inf")
        biggest_weak, weak_diff = "", float("inf")

        stat_pairs = [
            ("atk", "atk_pct"),
            ("def_", "def_pct"),
            ("hp", "hp_pct"),
            ("leth", "leth_pct"),
        ]
        stat_labels = {"atk": "ATK", "def_": "DEF", "hp": "HP", "leth": "LETH"}
        troop_labels = {"infantry": "Infantry", "lancer": "Lancer", "marksman": "Marksman"}

        for troop in troops:
            u_t = getattr(user, troop)
            e_t = getattr(enemy, troop)
            for base, pct_key in stat_pairs:
                u_val = getattr(u_t, base) * (1 + getattr(u_t, pct_key) / 100)
                e_val = getattr(e_t, base) * (1 + getattr(e_t, pct_key) / 100)
                diff = u_val - e_val
                label = f"{troop_labels[troop]} {stat_labels[base]}"
                if diff > adv_diff:
                    adv_diff, biggest_adv = diff, label
                if diff < weak_diff:
                    weak_diff, biggest_weak = diff, label

        # ── RECOMMENDED FORMATION ────────────────────────────────────────────
        total_score = sum(user_dmg[t] + user_def[t] for t in troops) or 1
        formation = {t: round((user_dmg[t] + user_def[t]) / total_score * 100) for t in troops}
        remainder = 100 - sum(formation.values())
        formation["marksman"] += remainder  # absorb rounding error

        return BattleResult(
            win_probability=win_pct,
            winner="user" if win_pct >= 50 else "enemy",
            rounds_fought=len(round_log),
            user_losses_pct={t: round(max(0, 100 - user_hp[t])) for t in troops},
            enemy_losses_pct={t: round(max(0, 100 - enemy_hp[t])) for t in troops},
            biggest_advantage=biggest_adv,
            biggest_weakness=biggest_weak,
            recommended_formation=formation,
            user_damage_score=u_dmg_total,
            enemy_damage_score=e_dmg_total,
            user_defense_score=u_def_total,
            enemy_defense_score=e_def_total,
            round_log=round_log,
        )

    def _dmg_args(self, army: ArmyStats, troop: str):
        t = getattr(army, troop)
        return t.atk, t.atk_pct, t.leth, t.leth_pct

    def _def_args(self, army: ArmyStats, troop: str):
        t = getattr(army, troop)
        return t.def_, t.def_pct, t.hp, t.hp_pct


# ── REVERSE OPTIMIZER ─────────────────────────────────────────────────────────

class ReverseOptimizer:
    """
    Solves backwards from target win% to find required stat upgrades.
    Ranks upgrades by efficiency (win% gain per 1000 stat points).
    """

    STEP_SIZES = {
        "atk": 200,
        "leth": 200,
        "def_": 300,
        "hp": 300,
        "atk_pct": 5,
        "def_pct": 5,
        "hp_pct": 5,
        "leth_pct": 5,
    }
    MAX_BOOST = 10000
    TARGETS = [75, 85, 95]

    def __init__(self):
        self.simulator = BattleSimulator()

    def optimize(self, user: ArmyStats, enemy: ArmyStats,
                 targets: list[int] = None) -> list[OptimizerResult]:
        if targets is None:
            targets = self.TARGETS

        current_result = self.simulator.simulate(user, enemy)
        current_pct = current_result.win_probability
        results = []

        for target_pct in targets:
            if current_pct >= target_pct:
                results.append(OptimizerResult(
                    target_pct=target_pct,
                    already_achieved=True,
                    current_win_pct=current_pct,
                    upgrades=[]
                ))
                continue

            upgrades = []
            troop_names = ["infantry", "lancer", "marksman"]

            for troop in troop_names:
                for stat_key, step in self.STEP_SIZES.items():
                    boost = 0
                    reached = False

                    while boost < self.MAX_BOOST and not reached:
                        boost += step
                        import copy
                        test_user = copy.deepcopy(user)
                        troop_obj = getattr(test_user, troop)
                        current_val = getattr(troop_obj, stat_key)
                        setattr(troop_obj, stat_key, current_val + boost)

                        test_result = self.simulator.simulate(test_user, enemy)
                        if test_result.win_probability >= target_pct:
                            reached = True

                    if reached and boost > 0:
                        efficiency = (target_pct - current_pct) / boost * 1000
                        stat_display = {
                            "atk": "Attack", "leth": "Lethality",
                            "def_": "Defense", "hp": "Health",
                            "atk_pct": "Attack%", "leth_pct": "Lethality%",
                            "def_pct": "Defense%", "hp_pct": "Health%"
                        }
                        troop_display = {
                            "infantry": "Infantry",
                            "lancer": "Lancer",
                            "marksman": "Marksman"
                        }
                        upgrades.append(OptimizerUpgrade(
                            troop=troop_display[troop],
                            stat=stat_display[stat_key],
                            boost_amount=boost,
                            efficiency=round(efficiency, 2),
                            label=f"+{int(boost):,} {troop_display[troop]} {stat_display[stat_key]}"
                        ))

            # Rank by efficiency (highest first)
            upgrades.sort(key=lambda u: u.efficiency, reverse=True)

            results.append(OptimizerResult(
                target_pct=target_pct,
                already_achieved=False,
                current_win_pct=current_pct,
                upgrades=upgrades[:8]  # Top 8 recommendations
            ))

        return results
