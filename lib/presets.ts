import {
  EnhancementSettings,
  PresetCategory,
  PresetName,
  SongAnalysis,
} from "./types";

export interface MasteringPresetConfig {
  name: PresetName;
  category: PresetCategory;
  label: string;
  description: string;
  subDb: number;
  bassDb: number;
  warmthDb: number;
  clarityDb: number;
  airDb: number;
  compAmount: number;
  harmonicDrive: number;
  stereoWidth: number;
}

export const PRESET_CATEGORIES: Array<{ id: PresetCategory; label: string }> = [
  { id: "smart", label: "Smart" },
  { id: "bass", label: "Bass & Club" },
  { id: "warmth", label: "Warmth & Feel" },
  { id: "clarity", label: "Clarity & Vocal" },
  { id: "genre", label: "Genre & Space" },
];

export const PRESET_CONFIGS: Record<PresetName, MasteringPresetConfig> = {
  // ── Smart & Adaptive (5) ──
  auto: {
    name: "auto",
    category: "smart",
    label: "Auto Vibe Master",
    description: "Adapts EQ, sub punch, warmth, and stereo space to your track's acoustic profile",
    subDb: 1.6,
    bassDb: 1.8,
    warmthDb: 0.2,
    clarityDb: 1.5,
    airDb: 1.8,
    compAmount: 0.45,
    harmonicDrive: 0.14,
    stereoWidth: 1.15,
  },
  "smart-beat": {
    name: "smart-beat",
    category: "smart",
    label: "Smart Beat Engine",
    description: "Locks onto beat transients with tight kick slam and crisp hi-hat snap",
    subDb: 2.8,
    bassDb: 3.2,
    warmthDb: -0.6,
    clarityDb: 1.8,
    airDb: 2.4,
    compAmount: 0.58,
    harmonicDrive: 0.16,
    stereoWidth: 1.2,
  },
  "vibe-max": {
    name: "vibe-max",
    category: "smart",
    label: "Full Song Vibe",
    description: "Lush wide stereo, deep bass foundation, silky mids, and energetic sheen",
    subDb: 2.4,
    bassDb: 2.6,
    warmthDb: 0.8,
    clarityDb: 2.0,
    airDb: 2.6,
    compAmount: 0.52,
    harmonicDrive: 0.2,
    stereoWidth: 1.28,
  },
  "dynamic-lift": {
    name: "dynamic-lift",
    category: "smart",
    label: "Dynamic Optimizer",
    description: "Lifts quiet passages cleanly while keeping loud drops punchy and controlled",
    subDb: 1.4,
    bassDb: 1.5,
    warmthDb: 0.6,
    clarityDb: 2.2,
    airDb: 1.6,
    compAmount: 0.62,
    harmonicDrive: 0.12,
    stereoWidth: 1.16,
  },
  "studio-ref": {
    name: "studio-ref",
    category: "smart",
    label: "Studio Reference",
    description: "Surgical phase-coherent mastering polish with balanced transient response",
    subDb: 0.6,
    bassDb: 0.8,
    warmthDb: -0.4,
    clarityDb: 1.2,
    airDb: 1.4,
    compAmount: 0.32,
    harmonicDrive: 0.08,
    stereoWidth: 1.08,
  },

  // ── Bass & Club (5) ──
  "deep-bass": {
    name: "deep-bass",
    category: "bass",
    label: "Deep Sub Bass",
    description: "Heavy 52 Hz sub-octave floor paired with clean top-end articulation",
    subDb: 4.8,
    bassDb: 3.5,
    warmthDb: -0.8,
    clarityDb: 1.0,
    airDb: 1.8,
    compAmount: 0.56,
    harmonicDrive: 0.18,
    stereoWidth: 1.15,
  },
  "club-drop": {
    name: "club-drop",
    category: "bass",
    label: "Club Drop",
    description: "Massive festival kick impact, scooped boxiness, and explosive drop presence",
    subDb: 5.2,
    bassDb: 4.4,
    warmthDb: -1.6,
    clarityDb: 2.2,
    airDb: 3.0,
    compAmount: 0.68,
    harmonicDrive: 0.22,
    stereoWidth: 1.32,
  },
  "808-slam": {
    name: "808-slam",
    category: "bass",
    label: "808 Punch",
    description: "Harmonic sub warmth that makes 808s audible even on laptop/phone speakers",
    subDb: 4.2,
    bassDb: 4.8,
    warmthDb: 0.4,
    clarityDb: 1.4,
    airDb: 1.5,
    compAmount: 0.6,
    harmonicDrive: 0.28,
    stereoWidth: 1.12,
  },
  "car-audio": {
    name: "car-audio",
    category: "bass",
    label: "Car System Boost",
    description: "Rich chest-thumping low punch and crisp treble built for cabin acoustics",
    subDb: 4.0,
    bassDb: 3.8,
    warmthDb: -1.2,
    clarityDb: 2.0,
    airDb: 2.6,
    compAmount: 0.54,
    harmonicDrive: 0.16,
    stereoWidth: 1.24,
  },
  festival: {
    name: "festival",
    category: "bass",
    label: "Festival Arena",
    description: "Maximum spatial width with stadium sub energy and shimmering highs",
    subDb: 4.5,
    bassDb: 3.2,
    warmthDb: -0.5,
    clarityDb: 2.4,
    airDb: 3.4,
    compAmount: 0.64,
    harmonicDrive: 0.2,
    stereoWidth: 1.42,
  },

  // ── Warmth & Feel (5) ──
  "warm-analog": {
    name: "warm-analog",
    category: "warmth",
    label: "Warm Analog Tape",
    description: "Silky tape harmonic saturation and rounded low-end fullness",
    subDb: 2.0,
    bassDb: 2.6,
    warmthDb: 2.2,
    clarityDb: 0.4,
    airDb: -1.0,
    compAmount: 0.44,
    harmonicDrive: 0.26,
    stereoWidth: 1.1,
  },
  "lofi-chill": {
    name: "lofi-chill",
    category: "warmth",
    label: "Lo-Fi Chill",
    description: "Cozy rolled-off air, dusty mid warmth, and pillowy bass groove",
    subDb: 1.5,
    bassDb: 2.4,
    warmthDb: 2.8,
    clarityDb: -0.8,
    airDb: -3.2,
    compAmount: 0.48,
    harmonicDrive: 0.3,
    stereoWidth: 1.04,
  },
  "vinyl-soul": {
    name: "vinyl-soul",
    category: "warmth",
    label: "Vinyl Soul",
    description: "Musical midrange glue and smooth vintage harmonic character",
    subDb: 1.2,
    bassDb: 2.0,
    warmthDb: 1.8,
    clarityDb: 1.0,
    airDb: -0.6,
    compAmount: 0.42,
    harmonicDrive: 0.24,
    stereoWidth: 1.08,
  },
  midnight: {
    name: "midnight",
    category: "warmth",
    label: "Midnight Drive",
    description: "Deep late-night sub glow, moody highs, and immersive stereo drift",
    subDb: 3.2,
    bassDb: 2.2,
    warmthDb: 1.4,
    clarityDb: 0.6,
    airDb: -0.8,
    compAmount: 0.46,
    harmonicDrive: 0.2,
    stereoWidth: 1.34,
  },
  "acoustic-wood": {
    name: "acoustic-wood",
    category: "warmth",
    label: "Acoustic Natural",
    description: "Preserves natural guitar/piano resonance with gentle room breath",
    subDb: 0.4,
    bassDb: 1.0,
    warmthDb: 1.6,
    clarityDb: 1.8,
    airDb: 1.4,
    compAmount: 0.28,
    harmonicDrive: 0.1,
    stereoWidth: 1.14,
  },

  // ── Clarity & Vocals (5) ──
  "vocal-focus": {
    name: "vocal-focus",
    category: "clarity",
    label: "Vocal Spotlight",
    description: "Brings lead vocals front-and-center while clearing low-mid mud",
    subDb: -0.5,
    bassDb: 0.2,
    warmthDb: -1.4,
    clarityDb: 3.8,
    airDb: 2.4,
    compAmount: 0.46,
    harmonicDrive: 0.12,
    stereoWidth: 1.06,
  },
  "crisp-air": {
    name: "crisp-air",
    category: "clarity",
    label: "Crisp Air",
    description: "Lifts sparkle, hi-hats, and breathy detail for muffled tracks",
    subDb: 0.8,
    bassDb: 1.0,
    warmthDb: -0.6,
    clarityDb: 2.2,
    airDb: 4.4,
    compAmount: 0.36,
    harmonicDrive: 0.1,
    stereoWidth: 1.22,
  },
  "hd-detail": {
    name: "hd-detail",
    category: "clarity",
    label: "HD Clarity",
    description: "Tightens low-mid masking and sharpens transient micro-detail",
    subDb: 1.2,
    bassDb: 1.4,
    warmthDb: -1.8,
    clarityDb: 3.2,
    airDb: 3.4,
    compAmount: 0.42,
    harmonicDrive: 0.12,
    stereoWidth: 1.2,
  },
  "podcast-clear": {
    name: "podcast-clear",
    category: "clarity",
    label: "Lyric & Voice",
    description: "Focused vocal articulation with controlled bass and smooth limiting",
    subDb: -2.0,
    bassDb: -0.8,
    warmthDb: -1.2,
    clarityDb: 4.2,
    airDb: 2.0,
    compAmount: 0.55,
    harmonicDrive: 0.08,
    stereoWidth: 0.96,
  },
  "bright-pop": {
    name: "bright-pop",
    category: "clarity",
    label: "Modern Pop Polish",
    description: "Radio-ready punch, glossy top shimmer, and tight bass groove",
    subDb: 2.0,
    bassDb: 2.4,
    warmthDb: -0.8,
    clarityDb: 2.6,
    airDb: 3.2,
    compAmount: 0.54,
    harmonicDrive: 0.16,
    stereoWidth: 1.26,
  },

  // ── Genre & Space (5) ──
  "edm-pump": {
    name: "edm-pump",
    category: "genre",
    label: "EDM Groove Pump",
    description: "High-energy bass/air smile curve with tight pumping glue compression",
    subDb: 4.0,
    bassDb: 3.4,
    warmthDb: -1.5,
    clarityDb: 2.0,
    airDb: 3.5,
    compAmount: 0.7,
    harmonicDrive: 0.18,
    stereoWidth: 1.36,
  },
  "hiphop-bounce": {
    name: "hiphop-bounce",
    category: "genre",
    label: "Hip-Hop Bounce",
    description: "Heavy sub bounce, crisp snare crack, and clear vocal pocket",
    subDb: 4.4,
    bassDb: 3.6,
    warmthDb: -0.4,
    clarityDb: 2.4,
    airDb: 2.2,
    compAmount: 0.56,
    harmonicDrive: 0.2,
    stereoWidth: 1.16,
  },
  "rock-drive": {
    name: "rock-drive",
    category: "genre",
    label: "Rock Drive",
    description: "Punchy guitar bite, warm drum body, and analog drive energy",
    subDb: 1.4,
    bassDb: 2.4,
    warmthDb: 1.2,
    clarityDb: 2.8,
    airDb: 1.8,
    compAmount: 0.52,
    harmonicDrive: 0.24,
    stereoWidth: 1.22,
  },
  cinematic: {
    name: "cinematic",
    category: "genre",
    label: "Cinematic Wide",
    description: "Expansive M/S stereo soundstage with deep orchestral sub weight",
    subDb: 3.0,
    bassDb: 1.8,
    warmthDb: 1.0,
    clarityDb: 1.6,
    airDb: 2.6,
    compAmount: 0.36,
    harmonicDrive: 0.14,
    stereoWidth: 1.48,
  },
  flat: {
    name: "flat",
    category: "genre",
    label: "Pure Transparent",
    description: "Zero EQ curve, unity stereo width, and clean peak protection",
    subDb: 0,
    bassDb: 0,
    warmthDb: 0,
    clarityDb: 0,
    airDb: 0,
    compAmount: 0,
    harmonicDrive: 0,
    stereoWidth: 1.0,
  },
};

export const PRESET_LIST: PresetName[] = Object.keys(
  PRESET_CONFIGS
) as PresetName[];

const LEGACY_PRESET_MAP: Record<string, PresetName> = {
  bass: "deep-bass",
  vocal: "vocal-focus",
  warm: "warm-analog",
  bright: "crisp-air",
};

export function normalizePresetName(raw?: string | null): PresetName {
  if (!raw) return "auto";
  if (raw in PRESET_CONFIGS) return raw as PresetName;
  if (raw in LEGACY_PRESET_MAP) return LEGACY_PRESET_MAP[raw];
  return "auto";
}

/**
 * Computes content-aware mastering settings for a song based on its acoustic
 * balance, beat punch, and Python optimalProfile. Stays within musical bounds.
 */
export function computeAutoEnhancementForAnalysis(
  analysis?: SongAnalysis | null
): MasteringPresetConfig {
  if (!analysis) return PRESET_CONFIGS.auto;

  if (analysis.optimalProfile) {
    const p = analysis.optimalProfile;
    return {
      ...PRESET_CONFIGS.auto,
      subDb: Number(Math.max(-4, Math.min(8, p.subDb)).toFixed(1)),
      bassDb: Number(Math.max(-6, Math.min(8, p.bassDb)).toFixed(1)),
      warmthDb: Number(Math.max(-6, Math.min(6, p.warmthDb)).toFixed(1)),
      clarityDb: Number(Math.max(-6, Math.min(8, p.clarityDb)).toFixed(1)),
      airDb: Number(Math.max(-6, Math.min(8, p.airDb)).toFixed(1)),
      compAmount: Number(Math.max(0, Math.min(1, p.compAmount)).toFixed(2)),
      harmonicDrive: Number(Math.max(0, Math.min(1, p.harmonicDrive)).toFixed(2)),
      stereoWidth: Number(Math.max(0.8, Math.min(1.5, p.stereoWidth)).toFixed(2)),
    };
  }

  const sub = analysis.subEnergyRatio ?? 0.25;
  const lowMid = analysis.lowMidEnergyRatio ?? 0.25;
  const highMid = analysis.highMidEnergyRatio ?? 0.25;
  const high = analysis.highEnergyRatio ?? 0.25;
  const lra = analysis.lra ?? 8;
  const punch = analysis.beatPunchScore ?? 0.5;

  const subDb = sub < 0.16 ? 3.6 : sub < 0.24 ? 2.2 : sub > 0.38 ? 0.2 : 1.6;
  const bassDb = sub < 0.2 ? 2.8 : punch > 0.55 ? 2.4 : 1.6;
  const warmthDb = lowMid > 0.34 ? -1.0 : lowMid < 0.18 ? 1.2 : 0.2;
  const clarityDb =
    analysis.hasVocals && highMid < 0.24 ? 2.6 : highMid < 0.2 ? 2.0 : 1.2;
  const airDb =
    high < 0.12 ? 3.2 : high < 0.2 ? 2.0 : high > 0.34 ? 0.0 : 1.4;
  const compAmount = lra > 11 ? 0.58 : lra > 6 ? 0.44 : 0.3;
  const harmonicDrive = punch > 0.5 ? 0.18 : 0.14;
  const stereoWidth = analysis.energy > 0.68 ? 1.22 : 1.14;

  return {
    ...PRESET_CONFIGS.auto,
    subDb: Number(subDb.toFixed(1)),
    bassDb: Number(bassDb.toFixed(1)),
    warmthDb: Number(warmthDb.toFixed(1)),
    clarityDb: Number(clarityDb.toFixed(1)),
    airDb: Number(airDb.toFixed(1)),
    compAmount: Number(compAmount.toFixed(2)),
    harmonicDrive: Number(harmonicDrive.toFixed(2)),
    stereoWidth: Number(stereoWidth.toFixed(2)),
  };
}

export function buildPresetEnhancement(
  preset: PresetName,
  current: EnhancementSettings,
  analysis?: SongAnalysis | null
): EnhancementSettings {
  const safePreset = normalizePresetName(preset);
  const cfg =
    safePreset === "auto"
      ? computeAutoEnhancementForAnalysis(analysis)
      : PRESET_CONFIGS[safePreset];

  return {
    ...current,
    preset: safePreset,
    subDb: cfg.subDb,
    bassDb: cfg.bassDb,
    warmthDb: cfg.warmthDb,
    clarityDb: cfg.clarityDb,
    airDb: cfg.airDb,
    compAmount: cfg.compAmount,
    harmonicDrive: cfg.harmonicDrive,
    stereoWidth: cfg.stereoWidth,
  };
}
