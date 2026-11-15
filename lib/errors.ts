import {
  AppSettings,
  BarStyleMode,
  BoosterLevel,
  DynamicPart,
  EnhancementSettings,
  FeelingMood,
  GroundingSource,
  OptimalDspProfile,
  OutputDeviceProfile,
  Playlist,
  PresetName,
  QualityFlag,
  SectionLabel,
  SongAnalysis,
  TrackSection,
  VibeCurvePoint,
} from "./types";
import { normalizePresetName, PRESET_LIST } from "./presets";

export const VALID_PRESETS = new Set<PresetName>(PRESET_LIST);

export const BOOSTER_LEVELS: BoosterLevel[] = [100, 200, 250, 400];

const VALID_FEELINGS = new Set<FeelingMood>([
  "euphoric",
  "bass-heavy",
  "warm-chill",
  "electric",
  "cinematic",
  "bright-pop",
]);

const VALID_BAR_STYLES = new Set<BarStyleMode>([
  "auto-feel",
  "beat-surge",
  "mirror-wave",
  "peak-meter",
]);

const VALID_OUTPUT_PROFILES = new Set<OutputDeviceProfile>([
  "headphones",
  "speakers",
  "car",
  "club",
  "studio",
]);

const VALID_SECTION_LABELS = new Set<SectionLabel>([
  "intro",
  "verse",
  "chorus",
  "drop",
  "bridge",
  "outro",
  "instrumental",
]);

const VALID_QUALITY_FLAGS = new Set<QualityFlag>(["dc_offset", "clipping"]);

export const DEFAULT_ENHANCEMENT: EnhancementSettings = {
  enabled: true,
  abBypassOriginal: false,
  preset: "auto",
  outputProfile: "headphones",
  subDb: 1.8,
  bassDb: 2.0,
  warmthDb: 0.2,
  clarityDb: 1.6,
  airDb: 1.9,
  compAmount: 0.42,
  harmonicDrive: 0.0,
  stereoWidth: 1.15,
  beatImpact: 0.65,
  normalizeLoudness: true,
  loudnessPercent: 100,
  smartVibeAdapt: true,
  monoBassBelow120Hz: true,
  psychoacousticContour: true,
  upwardMicrolift: true,
};

export const DEFAULT_SETTINGS: AppSettings = {
  visualsEnabled: true,
  barStyle: "mirror-wave",
  enhancement: { ...DEFAULT_ENHANCEMENT },
  playlists: [],
  upNextQueue: [],
  activePlaylistId: null,
};

export function createDefaultSections(duration = 180): TrackSection[] {
  const safeDur = Number.isFinite(duration) && duration > 0 ? duration : 180;
  const labels: SectionLabel[] = ["intro", "verse", "chorus", "verse", "outro"];
  const step = safeDur / 5;
  return labels.map((label, idx) => ({
    start: Number((idx * step).toFixed(2)),
    end: Number(((idx + 1) * step).toFixed(2)),
    label,
    energy:
      label === "chorus"
        ? 0.78
        : label === "intro" || label === "outro"
        ? 0.34
        : 0.55,
  }));
}

export const DEFAULT_ANALYSIS: SongAnalysis = {
  bpm: 120,
  bpmConfidence: 0.5,
  beatTimestamps: [],
  peakDropTimeSec: 32,
  timeSignature: "4/4",
  key: "Unknown",
  lufs: -14,
  lra: 7.5,
  truePeak: -1.0,
  energy: 0.55,
  crestFactorDb: 10.5,
  beatPunchScore: 0.55,
  subWeightScore: 0.58,
  vocalClarityScore: 0.64,
  spectralCentroidHz: 1850,
  stereoCorrelation: 0.85,
  transientDensity: 2.8,
  mudRatio: 0.22,
  harshnessRatio: 0.16,
  dynamicHealthScore: 84,
  smartTechniquesApplied: [
    "120 Hz Sub-Bass Mono Phase Lock",
    "64 Hz Sub-Harmonic Beat Impact Slam",
    "Fletcher-Munson Equal-Loudness Contour",
    "Upward Micro-Detail Lift",
    "Two-Stage Zero-Clip Lookahead Limiter",
  ],
  loudnessCurve: [],
  loudParts: [],
  quietParts: [],
  vibeCurve: [],
  subEnergyRatio: 0.25,
  lowMidEnergyRatio: 0.25,
  highMidEnergyRatio: 0.28,
  highEnergyRatio: 0.22,
  hasVocals: true,
  sections: createDefaultSections(180),
  qualityFlags: [],
  recommendedPreset: "auto",
  feelingMood: "euphoric",
  feelingColor: "#14B8A6",
  analysisEngine: "local-dsp",
  apiAnalyzed: false,
  apiAnalyzing: false,
  apiError: null,
};

export function clampRange(
  val: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

export function clampStereoWidth(val: unknown): number {
  return Number(clampRange(val, 0, 1.6, 1.15).toFixed(2));
}

export function clampEqDb(
  val: unknown,
  fallback = 0,
  min = -6,
  max = 8
): number {
  return Number(clampRange(val, min, max, fallback).toFixed(1));
}

export function normalizeBarStyle(raw: unknown): BarStyleMode {
  void raw;
  return "mirror-wave";
}

export function normalizeOutputProfile(raw: unknown): OutputDeviceProfile {
  return typeof raw === "string" &&
    VALID_OUTPUT_PROFILES.has(raw as OutputDeviceProfile)
    ? (raw as OutputDeviceProfile)
    : "headphones";
}

export function normalizePlaylists(raw: unknown): Playlist[] {
  if (!Array.isArray(raw)) return [];
  const out: Playlist[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Partial<Playlist>;
    if (typeof p.id === "string" && p.id.trim() && typeof p.name === "string") {
      const trackIds = Array.isArray(p.trackIds)
        ? Array.from(
            new Set(
              p.trackIds.filter(
                (id): id is string => typeof id === "string" && id.trim().length > 0
              )
            )
          )
        : [];
      out.push({
        id: p.id.trim(),
        name: p.name.trim() || "Untitled Playlist",
        trackIds,
        createdAt:
          typeof p.createdAt === "number" && Number.isFinite(p.createdAt)
            ? p.createdAt
            : Date.now(),
      });
    }
  }
  return out;
}

export function normalizeEnhancement(
  raw?: Partial<EnhancementSettings> | null
): EnhancementSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_ENHANCEMENT };
  }
  const preset = normalizePresetName(raw.preset);

  return {
    enabled:
      typeof raw.enabled === "boolean"
        ? raw.enabled
        : DEFAULT_ENHANCEMENT.enabled,
    abBypassOriginal:
      typeof raw.abBypassOriginal === "boolean" ? raw.abBypassOriginal : false,
    preset,
    outputProfile: normalizeOutputProfile(raw.outputProfile),
    subDb: clampEqDb(raw.subDb, DEFAULT_ENHANCEMENT.subDb, -4, 8),
    bassDb: clampEqDb(raw.bassDb, DEFAULT_ENHANCEMENT.bassDb, -6, 8),
    warmthDb: clampEqDb(raw.warmthDb, DEFAULT_ENHANCEMENT.warmthDb, -6, 6),
    clarityDb: clampEqDb(raw.clarityDb, DEFAULT_ENHANCEMENT.clarityDb, -6, 8),
    airDb: clampEqDb(raw.airDb, DEFAULT_ENHANCEMENT.airDb, -6, 8),
    compAmount: Number(
      clampRange(raw.compAmount, 0, 1, DEFAULT_ENHANCEMENT.compAmount).toFixed(2)
    ),
    harmonicDrive: Number(
      clampRange(
        raw.harmonicDrive,
        0,
        1,
        DEFAULT_ENHANCEMENT.harmonicDrive
      ).toFixed(2)
    ),
    stereoWidth: clampStereoWidth(raw.stereoWidth),
    beatImpact: Number(
      clampRange(raw.beatImpact, 0, 1, DEFAULT_ENHANCEMENT.beatImpact).toFixed(2)
    ),
    normalizeLoudness:
      typeof raw.normalizeLoudness === "boolean"
        ? raw.normalizeLoudness
        : DEFAULT_ENHANCEMENT.normalizeLoudness,
    loudnessPercent: Math.round(
      clampRange(
        raw.loudnessPercent,
        100,
        400,
        DEFAULT_ENHANCEMENT.loudnessPercent
      )
    ),
    smartVibeAdapt:
      typeof raw.smartVibeAdapt === "boolean"
        ? raw.smartVibeAdapt
        : DEFAULT_ENHANCEMENT.smartVibeAdapt,
    monoBassBelow120Hz:
      typeof raw.monoBassBelow120Hz === "boolean"
        ? raw.monoBassBelow120Hz
        : DEFAULT_ENHANCEMENT.monoBassBelow120Hz,
    psychoacousticContour:
      typeof raw.psychoacousticContour === "boolean"
        ? raw.psychoacousticContour
        : DEFAULT_ENHANCEMENT.psychoacousticContour,
    upwardMicrolift:
      typeof raw.upwardMicrolift === "boolean"
        ? raw.upwardMicrolift
        : DEFAULT_ENHANCEMENT.upwardMicrolift,
  };
}

function normalizeDynamicParts(raw: unknown, duration: number): DynamicPart[] {
  if (!Array.isArray(raw)) return [];
  const safeDur = Number.isFinite(duration) && duration > 0 ? duration : 180;
  const out: DynamicPart[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Partial<DynamicPart>;
    if (
      typeof p.start === "number" &&
      typeof p.end === "number" &&
      Number.isFinite(p.start) &&
      Number.isFinite(p.end) &&
      p.end > p.start
    ) {
      out.push({
        start: Math.max(0, Number(p.start.toFixed(2))),
        end: Math.min(safeDur, Number(p.end.toFixed(2))),
        avgDb: Number(clampRange(p.avgDb, -70, 0, -18).toFixed(1)),
        peakDb: Number(clampRange(p.peakDb, -70, 0, -12).toFixed(1)),
        intensity: Number(clampRange(p.intensity, 0, 1, 0.5).toFixed(3)),
        label:
          typeof p.label === "string" && p.label.trim()
            ? p.label.trim()
            : "Segment",
      });
    }
  }
  return out;
}

function normalizeSections(raw: unknown, duration: number): TrackSection[] {
  const safeDur = Number.isFinite(duration) && duration > 0 ? duration : 180;
  if (!Array.isArray(raw) || raw.length === 0) {
    return createDefaultSections(safeDur);
  }
  const out: TrackSection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Partial<TrackSection>;
    if (
      typeof s.start === "number" &&
      typeof s.end === "number" &&
      Number.isFinite(s.start) &&
      Number.isFinite(s.end) &&
      s.end > s.start
    ) {
      const label: SectionLabel =
        s.label && VALID_SECTION_LABELS.has(s.label) ? s.label : "verse";
      out.push({
        start: Math.max(0, Number(s.start.toFixed(2))),
        end: Math.min(safeDur, Number(s.end.toFixed(2))),
        label,
        energy: Number(clampRange(s.energy, 0, 1, 0.5).toFixed(3)),
        ...(typeof s.description === "string" && s.description.trim()
          ? { description: s.description.trim() }
          : {}),
      });
    }
  }
  return out.length > 0 ? out : createDefaultSections(safeDur);
}

function normalizeVibeCurve(raw: unknown): VibeCurvePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: VibeCurvePoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const v = item as Partial<VibeCurvePoint>;
    if (typeof v.t === "number" && Number.isFinite(v.t) && v.t >= 0) {
      out.push({
        t: Number(v.t.toFixed(2)),
        energy: Number(clampRange(v.energy, 0, 1, 0.5).toFixed(3)),
        bassLiftDb: Number(clampRange(v.bassLiftDb, -2, 4, 0.8).toFixed(2)),
        clarityLiftDb: Number(
          clampRange(v.clarityLiftDb, -2, 4, 0.6).toFixed(2)
        ),
        widthBoost: Number(clampRange(v.widthBoost, 0, 0.25, 0.06).toFixed(3)),
      });
    }
  }
  return out.slice(0, 900);
}

function normalizeOptimalProfile(
  raw: unknown
): OptimalDspProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Partial<OptimalDspProfile>;
  return {
    subDb: clampEqDb(p.subDb, 1.6, -4, 8),
    bassDb: clampEqDb(p.bassDb, 1.8, -6, 8),
    warmthDb: clampEqDb(p.warmthDb, 0.2, -6, 6),
    clarityDb: clampEqDb(p.clarityDb, 1.5, -6, 8),
    airDb: clampEqDb(p.airDb, 1.8, -6, 8),
    compAmount: Number(clampRange(p.compAmount, 0, 1, 0.45).toFixed(2)),
    harmonicDrive: Number(clampRange(p.harmonicDrive, 0, 1, 0.14).toFixed(2)),
    stereoWidth: clampStereoWidth(p.stereoWidth),
    beatImpact: Number(clampRange(p.beatImpact, 0, 1, 0.68).toFixed(2)),
  };
}

function normalizeGroundingSources(raw: unknown): GroundingSource[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: GroundingSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const g = item as Partial<GroundingSource>;
    if (
      typeof g.uri === "string" &&
      /^https?:\/\//i.test(g.uri.trim()) &&
      !seen.has(g.uri.trim())
    ) {
      seen.add(g.uri.trim());
      out.push({
        uri: g.uri.trim(),
        title:
          typeof g.title === "string" && g.title.trim()
            ? g.title.trim()
            : g.uri.trim(),
      });
    }
  }
  return out.slice(0, 12);
}

export function normalizeAnalysis(
  raw?: Partial<SongAnalysis> | null,
  duration = 180
): SongAnalysis {
  const safeDur = Number.isFinite(duration) && duration > 0 ? duration : 180;
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_ANALYSIS,
      peakDropTimeSec: Number((safeDur * 0.28).toFixed(1)),
      beatTimestamps: [],
      loudnessCurve: [],
      loudParts: [],
      quietParts: [],
      vibeCurve: [],
      sections: createDefaultSections(safeDur),
      qualityFlags: [],
      groundingSources: [],
    };
  }

  const sub = clampRange(raw.subEnergyRatio, 0, 1, 0.25);
  const lowMid = clampRange(raw.lowMidEnergyRatio, 0, 1, 0.25);
  const highMid = clampRange(raw.highMidEnergyRatio, 0, 1, 0.25);
  const high = clampRange(raw.highEnergyRatio, 0, 1, 0.25);
  const sum = sub + lowMid + highMid + high;

  const normSub = sum > 0.001 ? Number((sub / sum).toFixed(4)) : 0.25;
  const normLowMid = sum > 0.001 ? Number((lowMid / sum).toFixed(4)) : 0.25;
  const normHighMid = sum > 0.001 ? Number((highMid / sum).toFixed(4)) : 0.25;
  const normHigh =
    sum > 0.001
      ? Number(Math.max(0, 1 - normSub - normLowMid - normHighMid).toFixed(4))
      : 0.25;

  const recommendedPreset = normalizePresetName(raw.recommendedPreset);

  const feelingMood: FeelingMood =
    typeof raw.feelingMood === "string" &&
    VALID_FEELINGS.has(raw.feelingMood as FeelingMood)
      ? (raw.feelingMood as FeelingMood)
      : "euphoric";

  const feelingColor =
    typeof raw.feelingColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(raw.feelingColor.trim())
      ? raw.feelingColor.trim()
      : "#14B8A6";

  const qualityFlags = Array.isArray(raw.qualityFlags)
    ? Array.from(
        new Set(
          raw.qualityFlags.filter((f): f is QualityFlag =>
            VALID_QUALITY_FLAGS.has(f)
          )
        )
      )
    : [];

  const smartTechniquesApplied =
    Array.isArray(raw.smartTechniquesApplied) &&
    raw.smartTechniquesApplied.length > 0
      ? raw.smartTechniquesApplied
          .filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0
          )
          .slice(0, 8)
      : DEFAULT_ANALYSIS.smartTechniquesApplied;

  const beatPunch = Number(
    clampRange(raw.beatPunchScore, 0, 1, 0.55).toFixed(3)
  );
  const subWeightScore = Number(
    clampRange(
      raw.subWeightScore,
      0.1,
      1,
      Math.min(1, normSub * 2.1 + beatPunch * 0.3)
    ).toFixed(2)
  );
  const vocalClarityScore = Number(
    clampRange(
      raw.vocalClarityScore,
      0.1,
      1,
      Math.min(1, normHighMid * 2.2 + normHigh * 0.4)
    ).toFixed(2)
  );

  return {
    bpm: Math.round(clampRange(raw.bpm, 40, 240, 120)),
    bpmConfidence: Number(clampRange(raw.bpmConfidence, 0, 1, 0.5).toFixed(3)),
    beatTimestamps: Array.isArray(raw.beatTimestamps)
      ? raw.beatTimestamps
          .filter((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)
          .slice(0, 600)
      : [],
    peakDropTimeSec: Number(
      clampRange(
        raw.peakDropTimeSec,
        0,
        Math.max(0.5, safeDur - 0.5),
        Math.min(safeDur * 0.3, Math.max(0, safeDur - 1))
      ).toFixed(1)
    ),
    timeSignature:
      typeof raw.timeSignature === "string" && raw.timeSignature.trim()
        ? raw.timeSignature.trim()
        : "4/4",
    key:
      typeof raw.key === "string" && raw.key.trim()
        ? raw.key.trim()
        : "Unknown",
    lufs: Number(clampRange(raw.lufs, -60, 0, -14).toFixed(1)),
    lra: Number(clampRange(raw.lra, 0, 30, 7.5).toFixed(1)),
    truePeak: Number(clampRange(raw.truePeak, -30, 0, -1.0).toFixed(1)),
    energy: Number(clampRange(raw.energy, 0, 1, 0.55).toFixed(3)),
    crestFactorDb: Number(
      clampRange(raw.crestFactorDb, 2, 28, 10.5).toFixed(2)
    ),
    beatPunchScore: beatPunch,
    subWeightScore,
    vocalClarityScore,
    spectralCentroidHz: Math.round(
      clampRange(raw.spectralCentroidHz, 200, 9000, 1850)
    ),
    stereoCorrelation: Number(
      clampRange(raw.stereoCorrelation, -1, 1, 0.85).toFixed(2)
    ),
    transientDensity: Number(
      clampRange(raw.transientDensity, 0.2, 16, 2.8).toFixed(2)
    ),
    mudRatio: Number(clampRange(raw.mudRatio, 0, 1, normLowMid).toFixed(3)),
    harshnessRatio: Number(
      clampRange(raw.harshnessRatio, 0, 1, normHigh * 0.7).toFixed(3)
    ),
    dynamicHealthScore: Math.round(
      clampRange(raw.dynamicHealthScore, 10, 100, 84)
    ),
    smartTechniquesApplied,
    loudnessCurve: Array.isArray(raw.loudnessCurve)
      ? raw.loudnessCurve
          .filter((n) => typeof n === "number" && Number.isFinite(n))
          .map((n) => Number(Math.max(0, Math.min(1, n)).toFixed(3)))
      : [],
    loudParts: normalizeDynamicParts(raw.loudParts, safeDur),
    quietParts: normalizeDynamicParts(raw.quietParts, safeDur),
    vibeCurve: normalizeVibeCurve(raw.vibeCurve),
    optimalProfile: normalizeOptimalProfile(raw.optimalProfile),
    subEnergyRatio: normSub,
    lowMidEnergyRatio: normLowMid,
    highMidEnergyRatio: normHighMid,
    highEnergyRatio: normHigh,
    hasVocals: typeof raw.hasVocals === "boolean" ? raw.hasVocals : true,
    sections: normalizeSections(raw.sections, safeDur),
    qualityFlags,
    recommendedPreset,
    feelingMood,
    feelingColor,
    analysisEngine:
      typeof raw.analysisEngine === "string" && raw.analysisEngine.trim()
        ? raw.analysisEngine.trim()
        : "local-dsp",
    apiAnalyzed: Boolean(raw.apiAnalyzed),
    apiAnalyzing: Boolean(raw.apiAnalyzing),
    apiError: typeof raw.apiError === "string" ? raw.apiError : null,
    aiSummary: typeof raw.aiSummary === "string" ? raw.aiSummary : undefined,
    beatAndRhythmNotes:
      typeof raw.beatAndRhythmNotes === "string"
        ? raw.beatAndRhythmNotes
        : undefined,
    optimizationNotes:
      typeof raw.optimizationNotes === "string"
        ? raw.optimizationNotes
        : undefined,
    enhancementReason:
      typeof raw.enhancementReason === "string"
        ? raw.enhancementReason
        : undefined,
    groundingSources: normalizeGroundingSources(raw.groundingSources),
  };
}

export function sanitizeTrackName(rawName: string): string {
  const withoutExt = rawName.replace(/\.[^/.]+$/, "");
  const cleaned = withoutExt
    .replace(/[\\/\0<>:"|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sliced = cleaned.slice(0, 200).trim();
  return sliced || "Untitled Song";
}

const ALLOWED_AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "flac",
  "ogg",
  "m4a",
  "aac",
  "opus",
  "webm",
  "weba",
  "mp4",
  "aiff",
  "aif",
]);

export const LARGE_FILE_WARNING_BYTES = 100 * 1024 * 1024;

export function validateAudioFile(file: {
  name: string;
  type: string;
  size: number;
}): {
  valid: boolean;
  largeWarning: boolean;
  error?: string;
} {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return {
      valid: false,
      largeWarning: false,
      error: `"${file?.name || "File"}" is empty or unreadable.`,
    };
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const hasAudioMime = Boolean(file.type && file.type.startsWith("audio/"));
  const hasValidExt = ALLOWED_AUDIO_EXTENSIONS.has(ext);

  if (!hasAudioMime && !hasValidExt) {
    return {
      valid: false,
      largeWarning: false,
      error: `"${file.name}" is not a supported audio file.`,
    };
  }

  return {
    valid: true,
    largeWarning: file.size > LARGE_FILE_WARNING_BYTES,
  };
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name || "";
  const code = (err as { code?: number }).code;
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}
