"""
WHITEOUT SURVIVAL — Combat Engine Unit Tests
Run: pytest tests/test_combat_engine.py -v
"""

import sys
sys.path.insert(0, "..")

from app.core.combat_engine import (
    TroopStats, ArmyStats, BattleSimulator, ReverseOptimizer,
    calc_damage, calc_defense, calc_effective_damage
)


def make_army(mult=1.0) -> ArmyStats:
    return ArmyStats(
        infantry=TroopStats(
            atk=2800*mult, atk_pct=35, def_=3200*mult, def_pct=30,
            hp=4500*mult, hp_pct=40, leth=2200*mult, leth_pct=25
        ),
        lancer=TroopStats(
            atk=3200*mult, atk_pct=30, def_=2800*mult, def_pct=35,
            hp=4000*mult, hp_pct=35, leth=2600*mult, leth_pct=30
        ),
        marksman=TroopStats(
            atk=3600*mult, atk_pct=40, def_=2200*mult, def_pct=25,
            hp=3500*mult, hp_pct=30, leth=3000*mult, leth_pct=35
        ),
    )


class TestCoreFormulas:
    def test_damage_formula_basic(self):
        dmg = calc_damage(atk=1000, atk_pct=0, leth=1000, leth_pct=0)
        assert dmg == 10000.0

    def test_damage_with_bonuses(self):
        dmg = calc_damage(atk=1000, atk_pct=100, leth=1000, leth_pct=100)
        # (1000 * 2 * 1000 * 2) / 100 = 40000
        assert dmg == 40000.0

    def test_defense_formula_basic(self):
        def_ = calc_defense(def_=1000, def_pct=0, hp=1000, hp_pct=0)
        assert def_ == 10000.0

    def test_damage_always_positive(self):
        dmg = calc_damage(0, 0, 0, 0)
        assert dmg >= 0

    def test_effective_damage_mitigation(self):
        eff = calc_effective_damage(1000, 500)
        assert eff == 850.0  # 1000 - 500*0.3 = 850

    def test_effective_damage_floor(self):
        eff = calc_effective_damage(10, 10000)
        assert eff == 0.0


class TestBattleSimulator:
    sim = BattleSimulator()

    def test_stronger_army_wins(self):
        user = make_army(mult=1.5)  # 50% stronger
        enemy = make_army(mult=1.0)
        result = self.sim.simulate(user, enemy)
        assert result.winner == "user"
        assert result.win_probability > 50

    def test_weaker_army_loses(self):
        user = make_army(mult=0.7)
        enemy = make_army(mult=1.0)
        result = self.sim.simulate(user, enemy)
        assert result.winner == "enemy"
        assert result.win_probability < 50

    def test_equal_armies_near_50pct(self):
        user = make_army(mult=1.0)
        enemy = make_army(mult=1.0)
        result = self.sim.simulate(user, enemy)
        assert 40 <= result.win_probability <= 60

    def test_win_pct_clamped(self):
        # Massively stronger
        user = make_army(mult=10.0)
        enemy = make_army(mult=1.0)
        result = self.sim.simulate(user, enemy)
        assert result.win_probability <= 97
        assert result.win_probability >= 3

    def test_rounds_bounded(self):
        user = make_army()
        enemy = make_army()
        result = self.sim.simulate(user, enemy)
        assert result.rounds_fought <= 20

    def test_losses_percentage_range(self):
        user = make_army()
        enemy = make_army()
        result = self.sim.simulate(user, enemy)
        for troop in ["infantry", "lancer", "marksman"]:
            assert 0 <= result.user_losses_pct[troop] <= 100
            assert 0 <= result.enemy_losses_pct[troop] <= 100

    def test_formation_sums_100(self):
        user = make_army()
        enemy = make_army()
        result = self.sim.simulate(user, enemy)
        total = sum(result.recommended_formation.values())
        assert total == 100

    def test_result_has_all_fields(self):
        user = make_army()
        enemy = make_army()
        result = self.sim.simulate(user, enemy)
        assert result.biggest_advantage != ""
        assert result.biggest_weakness != ""
        assert result.win_probability is not None
        assert result.winner in ("user", "enemy")


class TestReverseOptimizer:
    opt = ReverseOptimizer()

    def test_already_achieved(self):
        user = make_army(mult=2.0)
        enemy = make_army(mult=1.0)
        results = self.opt.optimize(user, enemy, targets=[75])
        assert results[0].already_achieved is True

    def test_upgrades_returned(self):
        user = make_army(mult=0.9)
        enemy = make_army(mult=1.0)
        results = self.opt.optimize(user, enemy, targets=[75])
        r = results[0]
        if not r.already_achieved:
            assert len(r.upgrades) > 0
            assert all(u.boost_amount > 0 for u in r.upgrades)

    def test_upgrades_sorted_by_efficiency(self):
        user = make_army(mult=0.85)
        enemy = make_army(mult=1.0)
        results = self.opt.optimize(user, enemy, targets=[75])
        r = results[0]
        if not r.already_achieved and len(r.upgrades) > 1:
            effs = [u.efficiency for u in r.upgrades]
            assert effs == sorted(effs, reverse=True)

    def test_multiple_targets(self):
        user = make_army(mult=0.8)
        enemy = make_army(mult=1.0)
        results = self.opt.optimize(user, enemy, targets=[75, 85, 95])
        assert len(results) == 3
        assert {r.target_pct for r in results} == {75, 85, 95}
