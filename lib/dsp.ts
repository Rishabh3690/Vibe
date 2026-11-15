import {
  BoosterLevel,
  EnhancementSettings,
  OutputDeviceProfile,
  SongAnalysis,
} from "./types";
import {
  computeAutoEnhancementForAnalysis,
  normalizePresetName,
  PRESET_CONFIGS,
} from "./presets";

export interface MasteringSlotNodes {
  context: AudioContext;
  inputGain: GainNode;
  dcBlocker: BiquadFilterNode;
  headroomPreTrim: GainNode;
  normalizeGain: GainNode;

  // 5-band phase-coherent mastering EQ + Beat Impact Resonator + surgical anti-harshness filter
  subEQ: BiquadFilterNode;
  beatImpactEQ: BiquadFilterNode;
  bassEQ: BiquadFilterNode;
  warmthEQ: BiquadFilterNode;
  clarityEQ: BiquadFilterNode;
  deHarshEQ: BiquadFilterNode;
  airEQ: BiquadFilterNode;

  // Band-isolated upper-harmonic exciter (>900 Hz, pre-attenuated so it NEVER clips or muddies bass)
  exciterHighpass: BiquadFilterNode;
  exciterPrePad: GainNode;
  harmonicShaper: WaveShaperNode;
  harmonicWetGain: GainNode;
  harmonicDryGain: GainNode;
  harmonicMix: GainNode;

  // Stage 1: Upward / Glue program dynamics compressor
  compressor: DynamicsCompressorNode;

  // Frequency-Selective Mid/Side Stereo Matrix with 120 Hz Mono Bass Lock
  sideHighpass: BiquadFilterNode;
  sideWidthGainPos: GainNode;
  sideWidthGainNeg: GainNode;

  // Level-matched A/B bypass (wet = enhanced, dry = clean original)
  abWetGain: GainNode;
  abDryGain: GainNode;
  abMixOutput: GainNode;

  // Stage 2: Distortion-Free 4-Level (100% / 200% / 250% / 400%) Psychoacoustic Maximizer + True Lookahead Limiter
  loudnessBoostGain: GainNode;
  limiter: DynamicsCompressorNode;
  ceilingTrim: GainNode;
  slotGain: GainNode;
}

export interface DoubleChainAudioGraph {
  context: AudioContext;
  slotA: MasteringSlotNodes;
  slotB: MasteringSlotNodes;
  masterAnalyser: AnalyserNode;
  masterGain: GainNode;
}

export const BOOSTER_LEVEL_INFO: Array<{
  level: BoosterLevel;
  label: string;
  badge: string;
  desc: string;
}> = [
  {
    level: 100,
    label: "100% Normal",
    badge: "100%",
    desc: "Reference studio master level with EBU R128 normalization",
  },
  {
    level: 200,
    label: "200% Boost",
    badge: "200%",
    desc: "2× perceived loudness via Fletcher-Munson presence + clean lookahead limiting",
  },
  {
    level: 250,
    label: "250% Hyper",
    badge: "250%",
    desc: "2.5× high-density club punch with upward micro-dynamics & anti-mud protection",
  },
  {
    level: 400,
    label: "400% Max",
    badge: "400%",
    desc: "4× maximum psychoacoustic power with dual-stage limiting & -3.1 dB anti-harshness",
  },
];

export const OUTPUT_PROFILE_INFO: Record<
  OutputDeviceProfile,
  {
    label: string;
    shortDesc: string;
    hpCutoffHz: number;
    subDeltaDb: number;
    bassFreqHz: number;
    bassDeltaDb: number;
    clarityDeltaDb: number;
    widthScale: number;
  }
> = {
  headphones: {
    label: "Headphones",
    shortDesc: "Deep sub extension + natural crossfeed air",
    hpCutoffHz: 22,
    subDeltaDb: 0.6,
    bassFreqHz: 92,
    bassDeltaDb: 0.4,
    clarityDeltaDb: 0.2,
    widthScale: 1.04,
  },
  speakers: {
    label: "Laptop / Phone",
    shortDesc: "68 Hz cone protection + 128 Hz missing-fundamental bass",
    hpCutoffHz: 68,
    subDeltaDb: -2.5,
    bassFreqHz: 128,
    bassDeltaDb: 2.4,
    clarityDeltaDb: 1.4,
    widthScale: 1.12,
  },
  car: {
    label: "Car System",
    shortDesc: "Tight 60 Hz cabin thump + anti-road-noise vocal lift",
    hpCutoffHz: 30,
    subDeltaDb: 1.2,
    bassFreqHz: 88,
    bassDeltaDb: 1.0,
    clarityDeltaDb: 1.1,
    widthScale: 1.06,
  },
  club: {
    label: "Club PA",
    shortDesc: "Phase-locked mono sub slam + high-headroom dynamics",
    hpCutoffHz: 26,
    subDeltaDb: 1.8,
    bassFreqHz: 95,
    bassDeltaDb: 1.4,
    clarityDeltaDb: 0.6,
    widthScale: 1.0,
  },
  studio: {
    label: "Studio Neutral",
    shortDesc: "Linear reference response with zero device coloration",
    hpCutoffHz: 20,
    subDeltaDb: 0,
    bassFreqHz: 95,
    bassDeltaDb: 0,
    clarityDeltaDb: 0,
    widthScale: 1.0,
  },
};

/**
 * Computes safe EBU R128 loudness normalization linear multiplier.
 * Strictly capped in [0.55, 1.85] and peak-protected so tracks never clip.
 */
export function computeSafeMakeupGain(
  analysis: SongAnalysis | null | undefined,
  normalizeLoudness: boolean
): number {
  if (!normalizeLoudness || !analysis) return 1.0;
  const lufs = Number.isFinite(analysis.lufs) ? analysis.lufs : -14;
  const truePeak = Number.isFinite(analysis.truePeak) ? analysis.truePeak : -1;

  const deltaDb = -14 - lufs;
  const headroomDb = -1.0 - truePeak;
  const safeDb = Math.max(
    -5.0,
    Math.min(5.2, deltaDb, headroomDb > 0 ? headroomDb + 1.5 : deltaDb)
  );
  const linear = Math.pow(10, safeDb / 20);
  return Math.max(0.55, Math.min(1.85, Number.isFinite(linear) ? linear : 1.0));
}

/**
 * Computes the nominal 100%..400% loudness boost ratio (1.0x at 100%, 2.0x at 200%, 2.5x at 250%, 4.0x at 400%).
 * Actual DSP gain is governed by computePsychoacousticLoudnessPlan so even 400% NEVER clips or breaks the song.
 */
export function computeLoudnessBoostGain(
  loudnessPercent: number,
  enabled: boolean,
  abBypassOriginal: boolean
): number {
  if (!enabled || abBypassOriginal) return 1.0;
  const pct = Number.isFinite(loudnessPercent)
    ? Math.max(100, Math.min(400, loudnessPercent))
    : 100;
  return Number((pct / 100).toFixed(3));
}

/**
 * Computes distortion-free psychoacoustic parameters for the 4-Level Audio Booster:
 * - Level 1: 100% Normal (1.0x reference)
 * - Level 2: 200% Boost (2x perceived loudness)
 * - Level 3: 250% Hyper (2.5x high-density club loudness)
 * - Level 4: 400% Max (4x psychoacoustic loudness via upward density + Fletcher-Munson + anti-harshness)
 */
export function computePsychoacousticLoudnessPlan(
  loudnessPercent: number,
  analysis: SongAnalysis | null | undefined,
  psychoacousticContour = true
): {
  driveRatio: number; // 0.0 (100%) to 1.0 (400%)
  logDrive: number; // 0.0 (100%), 0.5 (200%), 0.661 (250%), 1.0 (400%)
  safePreLimiterGain: number;
  upwardDensityDb: number;
  fletcherBassLiftDb: number;
  fletcherPresenceLiftDb: number;
  deMudCutDb: number;
  deHarshCutDb: number;
  limiterThresholdDb: number;
} {
  const pct = Number.isFinite(loudnessPercent)
    ? Math.max(100, Math.min(400, loudnessPercent))
    : 100;
  const driveRatio = (pct - 100) / 300;
  const logDrive = Math.max(0, Math.min(1, Math.log2(pct / 100) / 2));

  const lufs = analysis && Number.isFinite(analysis.lufs) ? analysis.lufs : -14;
  const crest =
    analysis && Number.isFinite(analysis.crestFactorDb)
      ? analysis.crestFactorDb
      : 11;
  const mudRatio =
    analysis && Number.isFinite(analysis.mudRatio)
      ? analysis.mudRatio
      : analysis?.lowMidEnergyRatio ?? 0.24;
  const harshRatio =
    analysis && Number.isFinite(analysis.harshnessRatio)
      ? analysis.harshnessRatio
      : 0.16;

  // Scale linear drive smartly so already-brickwalled tracks rely on upward density & psychoacoustic presence
  // instead of slamming the limiter, while dynamic tracks get up to +7.8 dB clean pre-limiter lift.
  const headroomFactor =
    lufs > -8.5 && crest < 8.5 ? 0.64 : lufs > -11 ? 0.8 : 0.96;
  const targetBoostDb = logDrive * 8.1 * headroomFactor;
  const safePreLimiterGain = Number(
    Math.pow(10, targetBoostDb / 20).toFixed(3)
  );

  // Upward RMS density lift (raises quiet/mid-level body without pushing 0 dBFS peaks)
  const upwardDensityDb = Number((logDrive * 4.2).toFixed(2));

  const contourScale = psychoacousticContour ? 1.0 : 0.28;
  const fletcherBassLiftDb = Number(
    (logDrive * 2.7 * contourScale).toFixed(2)
  );
  const fletcherPresenceLiftDb = Number(
    (logDrive * 3.2 * contourScale).toFixed(2)
  );

  // Automatic de-mudding at 260 Hz & de-harshing at 4.1 kHz prevents ear fatigue at 200%, 250%, and 400%
  const baseMudCut = mudRatio > 0.27 ? (mudRatio - 0.25) * -9.0 : 0;
  const deMudCutDb = Number(
    Math.max(-3.6, baseMudCut - logDrive * 2.1 * contourScale).toFixed(2)
  );

  const baseHarshCut = harshRatio > 0.2 ? (harshRatio - 0.18) * -10.0 : 0;
  const deHarshCutDb = Number(
    Math.max(-4.2, baseHarshCut - logDrive * 2.9 * contourScale).toFixed(2)
  );

  const limiterThresholdDb = Number((-1.0 - logDrive * 1.1).toFixed(2));

  return {
    driveRatio,
    logDrive,
    safePreLimiterGain,
    upwardDensityDb,
    fletcherBassLiftDb,
    fletcherPresenceLiftDb,
    deMudCutDb,
    deHarshCutDb,
    limiterThresholdDb,
  };
}

export interface TransparentGainStagePlan {
  preTrimDb: number;
  preTrimLinear: number;
  postEqMakeupLinear: number;
  totalBoosterLinear: number;
  headroomMarginDb: number;
}

/**
 * Clean, transparent gain-staging algorithm:
 * Calculates exact positive EQ energy accumulation across low/mid/high bands and attenuates
 * headroomPreTrim proportionally so internal filter cascades, M/S matrix, and dynamics nodes
 * operate in their linear 32-bit float region with zero intermodulation or clipping distortion.
 */
export function computeTransparentGainStaging(params: {
  subDb: number;
  beatImpactDb: number;
  bassDb: number;
  warmthDb: number;
  clarityDb: number;
  airDb: number;
  upwardDetailDb: number;
  safePreLimiterGain: number;
  isEnhanced: boolean;
}): TransparentGainStagePlan {
  if (!params.isEnhanced) {
    return {
      preTrimDb: 0,
      preTrimLinear: 1.0,
      postEqMakeupLinear: 1.0,
      totalBoosterLinear: 1.0,
      headroomMarginDb: 0.35,
    };
  }

  const posSub = Math.max(0, params.subDb);
  const posImpact = Math.max(0, params.beatImpactDb);
  const posBass = Math.max(0, params.bassDb);
  const posWarmth = Math.max(0, params.warmthDb);
  const posClarity = Math.max(0, params.clarityDb);
  const posAir = Math.max(0, params.airDb);

  const lowBandPeakDb =
    posSub * 0.55 + posImpact * 0.5 + posBass * 0.65 + posWarmth * 0.35;
  const highBandPeakDb = posClarity * 0.55 + posAir * 0.45;
  const combinedEqPeakDb = Math.max(
    lowBandPeakDb,
    highBandPeakDb,
    (lowBandPeakDb + highBandPeakDb) * 0.58
  );

  // Attenuate input before EQ so the post-EQ peak stays within linear unity headroom
  const preTrimDb = Number(
    (-Math.min(8.5, combinedEqPeakDb * 0.58)).toFixed(2)
  );
  const preTrimLinear = Number(Math.pow(10, preTrimDb / 20).toFixed(4));

  // Gentle broadband compensation for narrow-band cuts/trims (never undoing peak protection)
  const gentleMakeupDb = Math.min(
    2.4,
    Math.abs(preTrimDb) * 0.28 + params.upwardDetailDb * 0.32
  );
  const postEqMakeupLinear = Number(
    Math.pow(10, gentleMakeupDb / 20).toFixed(4)
  );

  const totalBoosterLinear = Number(
    Math.min(2.35, params.safePreLimiterGain * postEqMakeupLinear).toFixed(4)
  );

  return {
    preTrimDb,
    preTrimLinear,
    postEqMakeupLinear,
    totalBoosterLinear,
    headroomMarginDb: 0.35,
  };
}

function makeGentleHarmonicCurve(): Float32Array<ArrayBuffer> {
  const n = 4096;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    // Ultra-gentle cubic soft saturation that stays linear for normal amplitudes
    curve[i] = x - (x * x * x) / 6;
  }
  return curve;
}

function createMasteringSlot(
  ctx: AudioContext,
  destination: AudioNode
): MasteringSlotNodes {
  const inputGain = ctx.createGain();
  inputGain.gain.value = 1.0;

  const dcBlocker = ctx.createBiquadFilter();
  dcBlocker.type = "highpass";
  dcBlocker.frequency.value = 22;
  dcBlocker.Q.value = 0.707;

  const headroomPreTrim = ctx.createGain();
  headroomPreTrim.gain.value = 0.85;

  const normalizeGain = ctx.createGain();
  normalizeGain.gain.value = 1.0;

  // 5-band mastering EQ + 64 Hz Sub-Harmonic Beat Impact Resonator + 4.1 kHz De-Harshing Filter
  const subEQ = ctx.createBiquadFilter();
  subEQ.type = "lowshelf";
  subEQ.frequency.value = 52;
  subEQ.gain.value = 0;

  const beatImpactEQ = ctx.createBiquadFilter();
  beatImpactEQ.type = "peaking";
  beatImpactEQ.frequency.value = 64;
  beatImpactEQ.Q.value = 1.05;
  beatImpactEQ.gain.value = 0;

  const bassEQ = ctx.createBiquadFilter();
  bassEQ.type = "peaking";
  bassEQ.frequency.value = 95;
  bassEQ.Q.value = 0.82;
  bassEQ.gain.value = 0;

  const warmthEQ = ctx.createBiquadFilter();
  warmthEQ.type = "peaking";
  warmthEQ.frequency.value = 260;
  warmthEQ.Q.value = 0.9;
  warmthEQ.gain.value = 0;

  const clarityEQ = ctx.createBiquadFilter();
  clarityEQ.type = "peaking";
  clarityEQ.frequency.value = 2200;
  clarityEQ.Q.value = 0.82;
  clarityEQ.gain.value = 0;

  const deHarshEQ = ctx.createBiquadFilter();
  deHarshEQ.type = "peaking";
  deHarshEQ.frequency.value = 4100;
  deHarshEQ.Q.value = 1.6;
  deHarshEQ.gain.value = 0;

  const airEQ = ctx.createBiquadFilter();
  airEQ.type = "highshelf";
  airEQ.frequency.value = 9500;
  airEQ.gain.value = 0;

  // Band-isolated upper-harmonic exciter (>1200 Hz + 0.20x pre-pad; bypassed at default 0.0 drive)
  const exciterHighpass = ctx.createBiquadFilter();
  exciterHighpass.type = "highpass";
  exciterHighpass.frequency.value = 1200;
  exciterHighpass.Q.value = 0.707;

  const exciterPrePad = ctx.createGain();
  exciterPrePad.gain.value = 0.2;

  const harmonicShaper = ctx.createWaveShaper();
  harmonicShaper.curve = makeGentleHarmonicCurve();
  harmonicShaper.oversample = "4x";

  const harmonicWetGain = ctx.createGain();
  const harmonicDryGain = ctx.createGain();
  const harmonicMix = ctx.createGain();
  harmonicWetGain.gain.value = 0.0;
  harmonicDryGain.gain.value = 1.0;

  // Stage 1: Transparent Program Glue Compressor (wide 24 dB soft knee, slow RMS release)
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 24;
  compressor.ratio.value = 1.5;
  compressor.attack.value = 0.024;
  compressor.release.value = 0.19;

  // Frequency-Selective Mid/Side Stereo Matrix with 120 Hz Mono Bass Lock
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  const lToMid = ctx.createGain();
  const rToMid = ctx.createGain();
  lToMid.gain.value = 0.5;
  rToMid.gain.value = 0.5;
  const midBus = ctx.createGain();

  const lToSide = ctx.createGain();
  const rToSide = ctx.createGain();
  lToSide.gain.value = 0.5;
  rToSide.gain.value = -0.5;
  const sideBus = ctx.createGain();

  const sideHighpass = ctx.createBiquadFilter();
  sideHighpass.type = "highpass";
  sideHighpass.frequency.value = 120;
  sideHighpass.Q.value = 0.707;

  const sideWidthGainPos = ctx.createGain();
  const sideWidthGainNeg = ctx.createGain();
  sideWidthGainPos.gain.value = 1.0;
  sideWidthGainNeg.gain.value = -1.0;
  const msOutput = ctx.createGain();

  // Master A/B Wet/Dry crossfade
  const abWetGain = ctx.createGain();
  const abDryGain = ctx.createGain();
  const abMixOutput = ctx.createGain();
  abWetGain.gain.value = 1.0;
  abDryGain.gain.value = 0.0;

  // Stage 2: Clean 32-bit float Loudness Maximizer + Soft-Knee Lookahead Limiter
  const loudnessBoostGain = ctx.createGain();
  loudnessBoostGain.gain.value = 1.0;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.0;
  limiter.knee.value = 6.0;
  limiter.ratio.value = 12.0;
  limiter.attack.value = 0.005;
  limiter.release.value = 0.14;

  // Post-limiter safety ceiling (-0.35 dBFS = 0.96) prevents inter-sample DAC clipping
  const ceilingTrim = ctx.createGain();
  ceilingTrim.gain.value = 0.96;

  const slotGain = ctx.createGain();
  slotGain.gain.value = 1.0;

  // Wire signal graph
  inputGain.connect(dcBlocker);
  dcBlocker.connect(normalizeGain);

  // Dry Original Path (bypass)
  normalizeGain.connect(abDryGain);
  abDryGain.connect(abMixOutput);

  // Enhanced Mastering Path
  normalizeGain.connect(headroomPreTrim);
  headroomPreTrim.connect(subEQ);
  subEQ.connect(beatImpactEQ);
  beatImpactEQ.connect(bassEQ);
  bassEQ.connect(warmthEQ);
  warmthEQ.connect(clarityEQ);
  clarityEQ.connect(deHarshEQ);
  deHarshEQ.connect(airEQ);

  // Band-isolated upper-harmonic exciter parallel path
  airEQ.connect(harmonicDryGain);
  harmonicDryGain.connect(harmonicMix);

  airEQ.connect(exciterHighpass);
  exciterHighpass.connect(exciterPrePad);
  exciterPrePad.connect(harmonicShaper);
  harmonicShaper.connect(harmonicWetGain);
  harmonicWetGain.connect(harmonicMix);

  harmonicMix.connect(compressor);
  compressor.connect(splitter);

  splitter.connect(lToMid, 0);
  splitter.connect(rToMid, 1);
  lToMid.connect(midBus);
  rToMid.connect(midBus);

  splitter.connect(lToSide, 0);
  splitter.connect(rToSide, 1);
  lToSide.connect(sideBus);
  rToSide.connect(sideBus);

  midBus.connect(merger, 0, 0);
  midBus.connect(merger, 0, 1);

  sideBus.connect(sideHighpass);
  sideHighpass.connect(sideWidthGainPos);
  sideWidthGainPos.connect(merger, 0, 0);

  sideHighpass.connect(sideWidthGainNeg);
  sideWidthGainNeg.connect(merger, 0, 1);

  merger.connect(msOutput);
  msOutput.connect(abWetGain);
  abWetGain.connect(abMixOutput);

  // Pure floating-point maximizer -> brickwall limiter -> safety ceiling -> output
  abMixOutput.connect(loudnessBoostGain);
  loudnessBoostGain.connect(limiter);
  limiter.connect(ceilingTrim);
  ceilingTrim.connect(slotGain);
  slotGain.connect(destination);

  return {
    context: ctx,
    inputGain,
    dcBlocker,
    headroomPreTrim,
    normalizeGain,
    subEQ,
    beatImpactEQ,
    bassEQ,
    warmthEQ,
    clarityEQ,
    deHarshEQ,
    airEQ,
    exciterHighpass,
    exciterPrePad,
    harmonicShaper,
    harmonicWetGain,
    harmonicDryGain,
    harmonicMix,
    compressor,
    sideHighpass,
    sideWidthGainPos,
    sideWidthGainNeg,
    abWetGain,
    abDryGain,
    abMixOutput,
    loudnessBoostGain,
    limiter,
    ceilingTrim,
    slotGain,
  };
}

export function createDoubleChainAudioGraph(
  ctx: AudioContext
): DoubleChainAudioGraph {
  const masterAnalyser = ctx.createAnalyser();
  masterAnalyser.fftSize = 2048;
  masterAnalyser.smoothingTimeConstant = 0.42;
  masterAnalyser.minDecibels = -78;
  masterAnalyser.maxDecibels = -14;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.9;

  masterAnalyser.connect(masterGain);
  masterGain.connect(ctx.destination);

  const slotA = createMasteringSlot(ctx, masterAnalyser);
  const slotB = createMasteringSlot(ctx, masterAnalyser);
  slotB.slotGain.gain.value = 0.0;

  return {
    context: ctx,
    slotA,
    slotB,
    masterAnalyser,
    masterGain,
  };
}

export function applyEnhancementToSlot(
  slot: MasteringSlotNodes,
  analysis: SongAnalysis | null | undefined,
  enhancement: EnhancementSettings,
  currentTimeSec?: number
): void {
  const ctx = slot.context;
  const now = ctx.currentTime;
  const rampEnd = now + 0.05;

  const isEnhanced = enhancement.enabled && !enhancement.abBypassOriginal;
  const deviceCfg =
    OUTPUT_PROFILE_INFO[enhancement.outputProfile || "headphones"] ||
    OUTPUT_PROFILE_INFO.headphones;

  // 1. Device-specific Sub-Cone Protection Highpass (e.g. 68 Hz on Laptop/Phone speakers)
  slot.dcBlocker.frequency.setTargetAtTime(
    isEnhanced ? deviceCfg.hpCutoffHz : 20,
    now,
    0.03
  );
  slot.bassEQ.frequency.setTargetAtTime(deviceCfg.bassFreqHz, now, 0.03);

  // 2. EBU R128 Baseline Loudness Normalization
  const normGain = computeSafeMakeupGain(
    analysis,
    enhancement.normalizeLoudness && enhancement.enabled
  );
  slot.normalizeGain.gain.cancelScheduledValues(now);
  slot.normalizeGain.gain.setValueAtTime(slot.normalizeGain.gain.value, now);
  slot.normalizeGain.gain.linearRampToValueAtTime(normGain, now + 0.06);

  const safePreset = normalizePresetName(enhancement.preset);
  const presetCfg =
    safePreset === "auto"
      ? computeAutoEnhancementForAnalysis(analysis)
      : PRESET_CONFIGS[safePreset];

  // 3. Dynamic per-moment smart adaptation across quiet & loud parts of the song
  let dynamicSubDelta = 0;
  let dynamicClarityDelta = 0;
  let dynamicWidthDelta = 0;
  let currentMomentEnergy = 0.55;

  if (
    isEnhanced &&
    enhancement.smartVibeAdapt &&
    typeof currentTimeSec === "number" &&
    analysis?.vibeCurve?.length
  ) {
    const curve = analysis.vibeCurve;
    let nearest = curve[0];
    let bestDist = Math.abs(nearest.t - currentTimeSec);
    for (let i = 1; i < curve.length; i++) {
      const d = Math.abs(curve[i].t - currentTimeSec);
      if (d < bestDist) {
        bestDist = d;
        nearest = curve[i];
      } else if (curve[i].t > currentTimeSec) {
        break;
      }
    }
    currentMomentEnergy = nearest.energy;
    dynamicSubDelta = (nearest.bassLiftDb - 0.8) * 0.55;
    dynamicClarityDelta = (nearest.clarityLiftDb - 0.7) * 0.55;
    dynamicWidthDelta = nearest.widthBoost * 0.45;
  }

  // 4. Psychoacoustic Loudness Plan (100%, 200%, 250%, 400% without clipping)
  const psychoPlan = computePsychoacousticLoudnessPlan(
    isEnhanced ? enhancement.loudnessPercent ?? 100 : 100,
    analysis,
    enhancement.psychoacousticContour ?? true
  );

  // 5. Beat Impact Sub-Harmonic Slam (64 Hz resonant thump + transient snap)
  const beatImpactAmt = Math.max(0, Math.min(1, enhancement.beatImpact ?? 0.65));
  const beatImpactDb = isEnhanced
    ? Number(
        (
          beatImpactAmt *
          (2.6 + currentMomentEnergy * 1.1) *
          (enhancement.outputProfile === "speakers" ? 0.35 : 1.0)
        ).toFixed(2)
      )
    : 0;
  slot.beatImpactEQ.gain.setTargetAtTime(beatImpactDb, now, 0.03);

  // Upward micro-detail lift boosts quiet moments gently so soft passages sound rich & full
  const upwardDetailDb =
    isEnhanced && (enhancement.upwardMicrolift ?? true)
      ? (1 - currentMomentEnergy) * 1.35 + psychoPlan.upwardDensityDb * 0.38
      : 0;

  const subDb = Math.max(
    -4,
    Math.min(
      6.5,
      (enhancement.subDb ?? presetCfg.subDb) +
        deviceCfg.subDeltaDb +
        dynamicSubDelta
    )
  );
  const bassDb = Math.max(
    -6,
    Math.min(
      6.8,
      (enhancement.bassDb ?? presetCfg.bassDb) +
        deviceCfg.bassDeltaDb +
        psychoPlan.fletcherBassLiftDb +
        beatImpactAmt * 1.1 +
        dynamicSubDelta * 0.45
    )
  );
  const warmthDb = Math.max(
    -6,
    Math.min(
      5,
      (enhancement.warmthDb ?? presetCfg.warmthDb) + psychoPlan.deMudCutDb
    )
  );
  const clarityDb = Math.max(
    -6,
    Math.min(
      6.8,
      (enhancement.clarityDb ?? presetCfg.clarityDb) +
        deviceCfg.clarityDeltaDb +
        psychoPlan.fletcherPresenceLiftDb +
        beatImpactAmt * 0.55 +
        dynamicClarityDelta +
        upwardDetailDb * 0.45
    )
  );
  const airDb = Math.max(
    -6,
    Math.min(6.5, (enhancement.airDb ?? presetCfg.airDb) + beatImpactAmt * 0.4)
  );

  // Automatic transparent gain-staging pre-trim prevents internal EQ & compressor overload
  const gainStage = computeTransparentGainStaging({
    subDb,
    beatImpactDb,
    bassDb,
    warmthDb,
    clarityDb,
    airDb,
    upwardDetailDb,
    safePreLimiterGain: psychoPlan.safePreLimiterGain,
    isEnhanced,
  });
  slot.headroomPreTrim.gain.setTargetAtTime(
    gainStage.preTrimLinear,
    now,
    0.035
  );

  slot.subEQ.gain.setTargetAtTime(subDb, now, 0.035);
  slot.bassEQ.gain.setTargetAtTime(bassDb, now, 0.035);
  slot.warmthEQ.gain.setTargetAtTime(warmthDb, now, 0.035);
  slot.clarityEQ.gain.setTargetAtTime(clarityDb, now, 0.035);
  slot.deHarshEQ.gain.setTargetAtTime(psychoPlan.deHarshCutDb, now, 0.035);
  slot.airEQ.gain.setTargetAtTime(airDb, now, 0.035);

  // 6. Band-isolated upper-harmonic exciter (bypassed when harmonicDrive <= 0.01 for zero THD)
  const rawDrive = enhancement.harmonicDrive ?? 0;
  const harmonicAmt =
    rawDrive <= 0.01 ? 0 : Math.max(0, Math.min(0.18, rawDrive * 0.45));
  slot.harmonicWetGain.gain.setTargetAtTime(harmonicAmt, now, 0.035);
  slot.harmonicDryGain.gain.setTargetAtTime(1 - harmonicAmt * 0.2, now, 0.035);

  // 7. Adaptive Transient-Preserving Compressor (wide knee + smooth release prevents bass flutter)
  const compAmt = Math.max(
    0,
    Math.min(1, enhancement.compAmount ?? presetCfg.compAmount)
  );
  const transientDensity = analysis?.transientDensity ?? 2.8;
  const adaptiveAttack =
    beatImpactAmt > 0.5 ||
    transientDensity > 3.2 ||
    (analysis?.beatPunchScore ?? 0.5) > 0.55
      ? 0.025
      : 0.018;
  const threshold =
    compAmt <= 0.02 ? -2 : -10 - compAmt * 9 - psychoPlan.logDrive * 2.8;
  const ratio = compAmt <= 0.02 ? 1.05 : 1.2 + compAmt * 1.1;
  slot.compressor.attack.setTargetAtTime(adaptiveAttack, now, 0.03);
  slot.compressor.threshold.setTargetAtTime(threshold, now, 0.03);
  slot.compressor.ratio.setTargetAtTime(ratio, now, 0.03);

  // 8. 120 Hz Mono Bass Lock + Stereo Width Matrix
  const monoBassOn = enhancement.monoBassBelow120Hz ?? true;
  slot.sideHighpass.frequency.setTargetAtTime(
    monoBassOn ? 120 : 22,
    now,
    0.03
  );

  const width = Math.max(
    0,
    Math.min(
      1.6,
      ((enhancement.stereoWidth ?? presetCfg.stereoWidth) + dynamicWidthDelta) *
        deviceCfg.widthScale
    )
  );
  slot.sideWidthGainPos.gain.cancelScheduledValues(now);
  slot.sideWidthGainNeg.gain.cancelScheduledValues(now);
  slot.sideWidthGainPos.gain.setValueAtTime(slot.sideWidthGainPos.gain.value, now);
  slot.sideWidthGainNeg.gain.setValueAtTime(slot.sideWidthGainNeg.gain.value, now);
  slot.sideWidthGainPos.gain.linearRampToValueAtTime(width, rampEnd);
  slot.sideWidthGainNeg.gain.linearRampToValueAtTime(-width, rampEnd);

  // 9. Smooth A/B Wet/Dry crossfade
  slot.abWetGain.gain.cancelScheduledValues(now);
  slot.abDryGain.gain.cancelScheduledValues(now);
  slot.abWetGain.gain.setValueAtTime(slot.abWetGain.gain.value, now);
  slot.abDryGain.gain.setValueAtTime(slot.abDryGain.gain.value, now);
  slot.abWetGain.gain.linearRampToValueAtTime(isEnhanced ? 1.0 : 0.0, rampEnd);
  slot.abDryGain.gain.linearRampToValueAtTime(isEnhanced ? 0.0 : 1.0, rampEnd);

  // 10. Transparent 4-Level Psychoacoustic Maximizer (100% / 200% / 250% / 400%)
  slot.limiter.threshold.setTargetAtTime(
    psychoPlan.limiterThresholdDb,
    now,
    0.03
  );
  slot.loudnessBoostGain.gain.cancelScheduledValues(now);
  slot.loudnessBoostGain.gain.setValueAtTime(
    slot.loudnessBoostGain.gain.value,
    now
  );
  slot.loudnessBoostGain.gain.linearRampToValueAtTime(
    gainStage.totalBoosterLinear,
    rampEnd
  );
}
