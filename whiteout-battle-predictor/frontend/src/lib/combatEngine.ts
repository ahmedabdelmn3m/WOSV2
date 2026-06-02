/**
 * WHITEOUT SURVIVAL — Frontend Combat Engine
 * Client-side simulation for instant results (<2s).
 * Mirrors backend engine exactly — same formulas.
 */

export interface TroopStats {
  atk: number;
  atkPct: number;
  def: number;
  defPct: number;
  hp: number;
  hpPct: number;
  leth: number;
  lethPct: number;
}

export interface ArmyStats {
  infantry: TroopStats;
  lancer: TroopStats;
  marksman: TroopStats;
}

export interface BattleResult {
  winProbability: number;
  winner: "user" | "enemy";
  roundsFought: number;
  userLossesPct: Record<string, number>;
  enemyLossesPct: Record<string, number>;
  biggestAdvantage: string;
  biggestWeakness: string;
  recommendedFormation: Record<string, number>;
  userDamageScore: number;
  enemyDamageScore: number;
  userDefenseScore: number;
  enemyDefenseScore: number;
}

export interface OptimizerUpgrade {
  troop: string;
  stat: string;
  boostAmount: number;
  efficiency: number;
  label: string;
}

export interface OptimizerTargetResult {
  targetPct: number;
  alreadyAchieved: boolean;
  currentWinPct: number;
  upgrades: OptimizerUpgrade[];
}

// ── CORE FORMULAS ─────────────────────────────────────────────────────────────

export function calcDamage(atk: number, atkPct: number, leth: number, lethPct: number): number {
  return (atk * (1 + atkPct / 100) * leth * (1 + lethPct / 100)) / 100;
}

export function calcDefense(def: number, defPct: number, hp: number, hpPct: number): number {
  return (def * (1 + defPct / 100) * hp * (1 + hpPct / 100)) / 100;
}

function effectiveDamage(raw: number, defense: number): number {
  return Math.max(0, raw - defense * 0.3);
}

// ── TYPE ADVANTAGE ────────────────────────────────────────────────────────────

const TYPE_ADVANTAGE: Record<string, string> = {
  infantry: "lancer",
  lancer: "marksman",
  marksman: "infantry",
};
const ADV_BONUS = 0.15;

// ── BATTLE SIMULATOR ─────────────────────────────────────────────────────────

export function simulateBattle(user: ArmyStats, enemy: ArmyStats, maxRounds = 20): BattleResult {
  const troops = ["infantry", "lancer", "marksman"] as const;

  const getDmg = (army: ArmyStats, t: keyof ArmyStats) =>
    calcDamage(army[t].atk, army[t].atkPct, army[t].leth, army[t].lethPct);
  const getDef = (army: ArmyStats, t: keyof ArmyStats) =>
    calcDefense(army[t].def, army[t].defPct, army[t].hp, army[t].hpPct);

  const userDmg = Object.fromEntries(troops.map(t => [t, getDmg(user, t)]));
  const enemyDmg = Object.fromEntries(troops.map(t => [t, getDmg(enemy, t)]));
  const userDef = Object.fromEntries(troops.map(t => [t, getDef(user, t)]));
  const enemyDef = Object.fromEntries(troops.map(t => [t, getDef(enemy, t)]));

  const userHP: Record<string, number> = { infantry: 100, lancer: 100, marksman: 100 };
  const enemyHP: Record<string, number> = { infantry: 100, lancer: 100, marksman: 100 };

  let round = 0;
  while (round < maxRounds) {
    round++;
    const uAlive = troops.filter(t => userHP[t] > 0);
    const eAlive = troops.filter(t => enemyHP[t] > 0);
    if (!uAlive.length || !eAlive.length) break;

    uAlive.forEach(t => {
      const live = eAlive.filter(x => enemyHP[x] > 0);
      if (!live.length) return;
      const preferred = TYPE_ADVANTAGE[t];
      const target = live.includes(preferred) ? preferred : live[0];
      let dmg = effectiveDamage(userDmg[t], enemyDef[target]);
      if (target === preferred) dmg *= (1 + ADV_BONUS);
      enemyHP[target] = Math.max(0, enemyHP[target] - (dmg * 0.8) / round);
    });

    eAlive.forEach(t => {
      const live = uAlive.filter(x => userHP[x] > 0);
      if (!live.length) return;
      const preferred = TYPE_ADVANTAGE[t];
      const target = live.includes(preferred) ? preferred : live[0];
      let dmg = effectiveDamage(enemyDmg[t], userDef[target]);
      if (target === preferred) dmg *= (1 + ADV_BONUS);
      userHP[target] = Math.max(0, userHP[target] - (dmg * 0.8) / round);
    });
  }

  const uDmgTotal = Object.values(userDmg).reduce((a, b) => a + b, 0);
  const eDmgTotal = Object.values(enemyDmg).reduce((a, b) => a + b, 0);
  const uDefTotal = Object.values(userDef).reduce((a, b) => a + b, 0);
  const eDefTotal = Object.values(enemyDef).reduce((a, b) => a + b, 0);

  const rawRatio = (uDmgTotal + uDefTotal) / Math.max(eDmgTotal + eDefTotal, 0.001);
  const uHpAvg = Object.values(userHP).reduce((a, b) => a + b, 0) / 3;
  const eHpAvg = Object.values(enemyHP).reduce((a, b) => a + b, 0) / 3;

  const winPct = Math.min(97, Math.max(3, Math.round(50 + (rawRatio - 1) * 40 + (uHpAvg - eHpAvg) * 0.3)));

  // Strength analysis
  const statMeta = [
    { base: "atk", pct: "atkPct", label: "ATK" },
    { base: "def", pct: "defPct", label: "DEF" },
    { base: "hp",  pct: "hpPct",  label: "HP" },
    { base: "leth",pct: "lethPct",label: "LETH" },
  ];
  const troopLabels: Record<string, string> = { infantry: "Infantry", lancer: "Lancer", marksman: "Marksman" };

  let biggestAdv = "", advDiff = -Infinity;
  let biggestWeak = "", weakDiff = Infinity;

  troops.forEach(t => {
    statMeta.forEach(({ base, pct, label }) => {
      const uVal = (user[t] as any)[base] * (1 + (user[t] as any)[pct] / 100);
      const eVal = (enemy[t] as any)[base] * (1 + (enemy[t] as any)[pct] / 100);
      const diff = uVal - eVal;
      const name = `${troopLabels[t]} ${label}`;
      if (diff > advDiff) { advDiff = diff; biggestAdv = name; }
      if (diff < weakDiff) { weakDiff = diff; biggestWeak = name; }
    });
  });

  const totalScore = troops.reduce((a, t) => a + userDmg[t] + userDef[t], 0) || 1;
  const formation = Object.fromEntries(
    troops.map(t => [t, Math.round((userDmg[t] + userDef[t]) / totalScore * 100)])
  );
  const remainder = 100 - Object.values(formation).reduce((a, b) => a + b, 0);
  formation.marksman += remainder;

  return {
    winProbability: winPct,
    winner: winPct >= 50 ? "user" : "enemy",
    roundsFought: round,
    userLossesPct: Object.fromEntries(troops.map(t => [t, Math.round(Math.max(0, 100 - userHP[t]))])),
    enemyLossesPct: Object.fromEntries(troops.map(t => [t, Math.round(Math.max(0, 100 - enemyHP[t]))])),
    biggestAdvantage: biggestAdv,
    biggestWeakness: biggestWeak,
    recommendedFormation: formation,
    userDamageScore: uDmgTotal,
    enemyDamageScore: eDmgTotal,
    userDefenseScore: uDefTotal,
    enemyDefenseScore: eDefTotal,
  };
}

// ── REVERSE OPTIMIZER ─────────────────────────────────────────────────────────

export function reverseOptimize(
  user: ArmyStats,
  enemy: ArmyStats,
  targets: number[] = [75, 85, 95]
): OptimizerTargetResult[] {
  const currentPct = simulateBattle(user, enemy).winProbability;

  return targets.map(targetPct => {
    if (currentPct >= targetPct) {
      return { targetPct, alreadyAchieved: true, currentWinPct: currentPct, upgrades: [] };
    }

    const troops = ["infantry", "lancer", "marksman"] as const;
    const statKeys = [
      { key: "atk", step: 200, label: "Attack" },
      { key: "leth", step: 200, label: "Lethality" },
      { key: "def", step: 300, label: "Defense" },
      { key: "hp", step: 300, label: "Health" },
      { key: "atkPct", step: 5, label: "Attack%" },
      { key: "lethPct", step: 5, label: "Lethality%" },
      { key: "defPct", step: 5, label: "Defense%" },
      { key: "hpPct", step: 5, label: "Health%" },
    ];
    const troopLabels: Record<string, string> = { infantry: "Infantry", lancer: "Lancer", marksman: "Marksman" };

    const upgrades: OptimizerUpgrade[] = [];

    troops.forEach(troop => {
      statKeys.forEach(({ key, step, label }) => {
        let boost = 0;
        let reached = false;
        while (boost < 10000 && !reached) {
          boost += step;
          const testUser: ArmyStats = JSON.parse(JSON.stringify(user));
          (testUser[troop] as any)[key] += boost;
          if (simulateBattle(testUser, enemy).winProbability >= targetPct) reached = true;
        }
        if (reached) {
          upgrades.push({
            troop: troopLabels[troop],
            stat: label,
            boostAmount: boost,
            efficiency: (targetPct - currentPct) / boost * 1000,
            label: `+${boost.toLocaleString()} ${troopLabels[troop]} ${label}`,
          });
        }
      });
    });

    upgrades.sort((a, b) => b.efficiency - a.efficiency);
    return { targetPct, alreadyAchieved: false, currentWinPct: currentPct, upgrades: upgrades.slice(0, 8) };
  });
}
