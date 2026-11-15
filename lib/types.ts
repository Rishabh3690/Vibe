export type PresetName =
  // Smart & Adaptive (5)
  | "auto"
  | "smart-beat"
  | "vibe-max"
  | "dynamic-lift"
  | "studio-ref"
  // Bass & Club (5)
  | "deep-bass"
  | "club-drop"
  | "808-slam"
  | "car-audio"
  | "festival"
  // Warmth & Feel (5)
  | "warm-analog"
  | "lofi-chill"
  | "vinyl-soul"
  | "midnight"
  | "acoustic-wood"
  // Clarity & Vocals (5)
  | "vocal-focus"
  | "crisp-air"
  | "hd-detail"
  | "podcast-clear"
  | "bright-pop"
  // Genre & Space (5)
  | "edm-pump"
  | "hiphop-bounce"
  | "rock-drive"
  | "cinematic"
  | "flat";

export type PresetCategory = "smart" | "bass" | "warmth" | "clarity" | "genre";

export type OutputDeviceProfile =
  | "headphones"
  | "speakers"
  | "car"
  | "club"
  | "studio";

export type BoosterLevel = 100 | 200 | 250 | 400;

export type AppView = "player" | "tracks";

export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

export type FeelingMood =
  | "euphoric"
  | "bass-heavy"
  | "warm-chill"
  | "electric"
  | "cinematic"
  | "bright-pop";

export type BarStyleMode =
  | "auto-feel"
  | "beat-surge"
  | "mirror-wave"
  | "peak-meter";

export type SectionLabel =
  | "intro"
  | "verse"
  | "chorus"
  | "drop"
  | "bridge"
  | "outro"
  | "instrumental";

export interface TrackSection {
  start: number;
  end: number;
  label: SectionLabel;
  energy: number;
  description?: string;
}

export interface DynamicPart {
  start: number;
  end: number;
  avgDb: number;
  peakDb: number;
  intensity: number;
  label: string;
}

export interface VibeCurvePoint {
  t: number;
  energy: number; // 0-1
  bassLiftDb: number;
  clarityLiftDb: number;
  widthBoost: number;
}

export interface OptimalDspProfile {
  subDb: number;
  bassDb: number;
  warmthDb: number;
  clarityDb: number;
  airDb: number;
  compAmount: number;
  harmonicDrive: number;
  stereoWidth: number;
  beatImpact?: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export type QualityFlag = "dc_offset" | "clipping";

export interface TrackMetadata {
  title: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  youtubeUrl?: string;
  youtubeTitle?: string;
  coverArtDataUrl?: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface SongAnalysis {
  // Acoustic & Psychoacoustic measurements (computed locally & refined by Python + Gemini)
  bpm: number;
  bpmConfidence: number;
  beatTimestamps: number[];
  peakDropTimeSec: number;
  timeSignature: string;
  key: string;
  lufs: number;
  lra: number;
  truePeak: number;
  energy: number;
  crestFactorDb: number;
  beatPunchScore: number;
  subWeightScore: number;
  vocalClarityScore: number;
  spectralCentroidHz: number;
  stereoCorrelation: number;
  transientDensity: number;
  mudRatio: number;
  harshnessRatio: number;
  dynamicHealthScore: number;
  smartTechniquesApplied: string[];
  loudnessCurve: number[];
  loudParts: DynamicPart[];
  quietParts: DynamicPart[];
  vibeCurve: VibeCurvePoint[];
  optimalProfile?: OptimalDspProfile;
  subEnergyRatio: number;
  lowMidEnergyRatio: number;
  highMidEnergyRatio: number;
  highEnergyRatio: number;
  hasVocals: boolean;
  sections: TrackSection[];
  qualityFlags: QualityFlag[];
  recommendedPreset: PresetName;
  feelingMood: FeelingMood;
  feelingColor: string;
  analysisEngine?: string;

  // Deep AI + Python + Google Search analysis (populated via /api/analyze-song)
  apiAnalyzed: boolean;
  apiAnalyzing?: boolean;
  apiError?: string | null;
  aiSummary?: string;
  beatAndRhythmNotes?: string;
  optimizationNotes?: string;
  enhancementReason?: string;
  groundingSources?: GroundingSource[];
}

export interface Track {
  id: string;
  name: string;
  blob: Blob;
  duration: number;
  createdAt: number;
  analysis: SongAnalysis;
  metadata: TrackMetadata;
  customEnhancement?: EnhancementSettings | null;
}

export interface EnhancementSettings {
  enabled: boolean;
  abBypassOriginal: boolean;
  preset: PresetName;
  outputProfile: OutputDeviceProfile;
  subDb: number; // -4 to +8 dB (52Hz sub lowshelf)
  bassDb: number; // -6 to +8 dB (95Hz kick/bass punch peaking)
  warmthDb: number; // -6 to +6 dB (260Hz body/warmth peaking)
  clarityDb: number; // -6 to +8 dB (2.2kHz vocal/presence peaking)
  airDb: number; // -6 to +8 dB (9.5kHz air highshelf)
  compAmount: number; // 0 to 1
  harmonicDrive: number; // 0 to 1 band-isolated upper harmonic exciter
  stereoWidth: number; // 0.0 to 1.6 M/S matrix width
  beatImpact: number; // 0 to 1 sub-harmonic transient kick slam enhancer
  normalizeLoudness: boolean;
  loudnessPercent: number; // 100 to 400 (4 levels: 100% Normal, 200% Boost, 250% Hyper, 400% Max)
  smartVibeAdapt: boolean; // real-time dynamic per-moment adaptation
  monoBassBelow120Hz: boolean; // keeps sub-bass <120Hz phase-coherent mono
  psychoacousticContour: boolean; // Fletcher-Munson contour + auto de-mud/de-harsh
  upwardMicrolift: boolean; // lifts quiet details without crushing peaks
}

export interface AppSettings {
  visualsEnabled: boolean;
  barStyle: BarStyleMode;
  enhancement: EnhancementSettings;
  playlists?: Playlist[];
  upNextQueue?: string[];
  activePlaylistId?: string | null;
}

export interface PlaybackSession {
  trackId: string;
  position: number;
  updatedAt: number;
}

export interface ABRepeatState {
  a: number | null;
  b: number | null;
  active: boolean;
}

export interface VisualizerLevels {
  bass: number;
  mid: number;
  high: number;
  energy: number;
  beatPulse: number;
}
