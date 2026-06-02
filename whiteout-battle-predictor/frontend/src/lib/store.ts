/**
 * WHITEOUT SURVIVAL — Global State Store (Zustand)
 * Manages presets, enemy scouts, predictions, and feedback.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArmyStats, BattleResult } from "./combatEngine";

export interface Preset {
  id: string;
  name: string;
  stats: ArmyStats;
  createdAt: number;
}

export interface FeedbackEntry {
  id: string;
  predictionId: string;
  predictedWinner: string;
  actualWinner: string;
  winProbability: number;
  correct: boolean;
  timestamp: number;
}

export interface PredictionRecord {
  id: string;
  presetId: string;
  result: BattleResult;
  timestamp: number;
}

interface AppState {
  // Presets
  presets: Preset[];
  activePresetId: string | null;

  // Enemy stats
  enemyStats: ArmyStats | null;

  // Predictions
  predictions: PredictionRecord[];
  currentPrediction: PredictionRecord | null;

  // Feedback
  feedbackLog: FeedbackEntry[];

  // Actions
  createPreset: (name: string, stats: ArmyStats) => Preset;
  updatePreset: (id: string, updates: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  setActivePreset: (id: string) => void;
  updatePresetStats: (troop: keyof ArmyStats, key: string, val: number) => void;

  setEnemyStats: (stats: ArmyStats) => void;
  updateEnemyStat: (troop: keyof ArmyStats, key: string, val: number) => void;

  savePrediction: (result: BattleResult, presetId: string) => PredictionRecord;
  setCurrentPrediction: (p: PredictionRecord | null) => void;

  submitFeedback: (predictionId: string, predictedWinner: string, actualWinner: string, winProbability: number) => void;
  clearFeedback: () => void;
}

const defaultTroop = (mult = 1) => ({
  atk: Math.round(2800 * mult),
  atkPct: 35,
  def: Math.round(3200 * mult),
  defPct: 30,
  hp: Math.round(4500 * mult),
  hpPct: 40,
  leth: Math.round(2200 * mult),
  lethPct: 25,
});

export const defaultArmyStats = (mult = 1): ArmyStats => ({
  infantry: defaultTroop(mult),
  lancer: { atk: Math.round(3200 * mult), atkPct: 30, def: Math.round(2800 * mult), defPct: 35, hp: Math.round(4000 * mult), hpPct: 35, leth: Math.round(2600 * mult), lethPct: 30 },
  marksman: { atk: Math.round(3600 * mult), atkPct: 40, def: Math.round(2200 * mult), defPct: 25, hp: Math.round(3500 * mult), hpPct: 30, leth: Math.round(3000 * mult), lethPct: 35 },
});

const initialPreset: Preset = {
  id: "p_default",
  name: "My Base",
  stats: defaultArmyStats(),
  createdAt: Date.now(),
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      presets: [initialPreset],
      activePresetId: initialPreset.id,
      enemyStats: defaultArmyStats(1.05),
      predictions: [],
      currentPrediction: null,
      feedbackLog: [],

      createPreset: (name, stats) => {
        const preset: Preset = { id: `p_${Date.now()}`, name, stats, createdAt: Date.now() };
        set(s => ({ presets: [...s.presets, preset], activePresetId: preset.id }));
        return preset;
      },

      updatePreset: (id, updates) =>
        set(s => ({ presets: s.presets.map(p => p.id === id ? { ...p, ...updates } : p) })),

      deletePreset: (id) => {
        const { presets, activePresetId } = get();
        if (presets.length <= 1) return;
        const remaining = presets.filter(p => p.id !== id);
        set({ presets: remaining, activePresetId: activePresetId === id ? remaining[0].id : activePresetId });
      },

      setActivePreset: (id) => set({ activePresetId: id }),

      updatePresetStats: (troop, key, val) => {
        const { presets, activePresetId } = get();
        set({
          presets: presets.map(p =>
            p.id !== activePresetId ? p : {
              ...p, stats: { ...p.stats, [troop]: { ...p.stats[troop], [key]: val } }
            }
          )
        });
      },

      setEnemyStats: (stats) => set({ enemyStats: stats }),

      updateEnemyStat: (troop, key, val) =>
        set(s => ({
          enemyStats: s.enemyStats ? {
            ...s.enemyStats,
            [troop]: { ...s.enemyStats[troop], [key]: val }
          } : null
        })),

      savePrediction: (result, presetId) => {
        const record: PredictionRecord = {
          id: `pred_${Date.now()}`,
          presetId,
          result,
          timestamp: Date.now(),
        };
        set(s => ({
          predictions: [...s.predictions, record].slice(-100),
          currentPrediction: record,
        }));
        return record;
      },

      setCurrentPrediction: (p) => set({ currentPrediction: p }),

      submitFeedback: (predictionId, predictedWinner, actualWinner, winProbability) => {
        const entry: FeedbackEntry = {
          id: `fb_${Date.now()}`,
          predictionId,
          predictedWinner,
          actualWinner,
          winProbability,
          correct: predictedWinner === actualWinner,
          timestamp: Date.now(),
        };
        set(s => ({ feedbackLog: [...s.feedbackLog, entry] }));
      },

      clearFeedback: () => set({ feedbackLog: [] }),
    }),
    {
      name: "whiteout-mvp-v1",
      partialize: (s) => ({
        presets: s.presets,
        activePresetId: s.activePresetId,
        enemyStats: s.enemyStats,
        predictions: s.predictions,
        feedbackLog: s.feedbackLog,
      }),
    }
  )
);
