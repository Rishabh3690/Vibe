import {
  DynamicPart,
  FeelingMood,
  OptimalDspProfile,
  PresetName,
  QualityFlag,
  SectionLabel,
  SongAnalysis,
  TrackSection,
  VibeCurvePoint,
} from "./types";
import { normalizeAnalysis } from "./errors";

export interface RawPcmInput {
  left: Float32Array;
  right?: Float32Array;
  sampleRate: number;
  duration: number;
}

/**
 * Computes integrated LUFS, loudness range (LRA), true peak dBTP, crest factor,
 * 1 Hz loudness curve, and internal loud & quiet regions for DSP optimization.
 */
export function analyzeLoudnessDynamics(
  mono: Float32Array,
  sampleRate: number,
  duration: number
): {
  lufs: number;
  lra: number;
  truePeak: number;
  crestFactorDb: number;
  loudnessCurve: number[];
  loudParts: DynamicPart[];
  quietParts: DynamicPart[];
  dcOffsetDetected: boolean;
  clippingDetected: boolean;
} {
  const n = mono.length;
  if (n === 0 || sampleRate <= 0) {
    return {
      lufs: -14,
      lra: 7,
      truePeak: -1,
      crestFactorDb: 10.5,
      loudnessCurve: [],
      loudParts: [],
      quietParts: [],
      dcOffsetDetected: false,
      clippingDetected: false,
    };
  }

  let peakAbs = 0;
  let sumAll = 0;
  let sumSqAll = 0;
  let clippedSamples = 0;
  for (let i = 0; i < n; i++) {
    const s = mono[i];
    const abs = Math.abs(s);
    if (abs > peakAbs) peakAbs = abs;
    if (abs >= 0.998) clippedSamples++;
    sumAll += s;
    sumSqAll += s * s;
  }

  const globalRms = Math.sqrt(sumSqAll / n);
  const crestFactorDb = Number(
    Math.max(
      2,
      Math.min(
        28,
        20 * Math.log10(Math.max(1e-5, peakAbs) / Math.max(1e-5, globalRms))
      )
    ).toFixed(2)
  );

  const dcMean = Math.abs(sumAll / n);
  const dcOffsetDetected = dcMean > 0.015;
  const clippingDetected = clippedSamples > Math.max(12, n * 0.0005);
  const truePeak = Number(
    Math.max(-30, Math.min(0, 20 * Math.log10(Math.max(1e-5, peakAbs)))).toFixed(1)
  );

  const totalSec = Math.max(1, duration || n / sampleRate);
  const numWindows = Math.max(1, Math.min(900, Math.round(totalSec)));
  const windowSamples = Math.max(1, Math.floor(n / numWindows));

  const windowDbs: number[] = [];
  const windowPeaksDb: number[] = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSamples;
    const end = w === numWindows - 1 ? n : Math.min(n, start + windowSamples);
    let sq = 0;
    let wPeak = 0;
    for (let i = start; i < end; i++) {
      const v = mono[i] - (dcOffsetDetected ? sumAll / n : 0);
      sq += v * v;
      const a = Math.abs(v);
      if (a > wPeak) wPeak = a;
    }
    const rms = Math.sqrt(sq / Math.max(1, end - start));
    const db = Math.max(-70, Math.min(0, 20 * Math.log10(Math.max(1e-4, rms)) - 0.691));
    const pDb = Math.max(-70, Math.min(0, 20 * Math.log10(Math.max(1e-4, wPeak))));
    windowDbs.push(db);
    windowPeaksDb.push(pDb);
  }

  const activeDbs = windowDbs.filter((d) => d > -60);
  const sortedActive = [...activeDbs].sort((a, b) => a - b);
  let lufs = -14;
  if (sortedActive.length > 0) {
    const avgActive =
      sortedActive.reduce((acc, v) => acc + v, 0) / sortedActive.length;
    const relGate = avgActive - 10;
    const gated = sortedActive.filter((d) => d >= relGate);
    const pool = gated.length > 0 ? gated : sortedActive;
    lufs = Number(
      (pool.reduce((acc, v) => acc + v, 0) / pool.length).toFixed(1)
    );
  }

  let lra = 7.0;
  if (sortedActive.length >= 4) {
    const p10 = sortedActive[Math.floor(sortedActive.length * 0.1)];
    const p95 = sortedActive[Math.min(sortedActive.length - 1, Math.floor(sortedActive.length * 0.95))];
    lra = Number(Math.max(0.5, Math.min(30, p95 - p10)).toFixed(1));
  }

  const minDb = sortedActive.length > 0 ? Math.min(...sortedActive) : -40;
  const maxDb = sortedActive.length > 0 ? Math.max(...sortedActive) : -8;
  const dbSpan = Math.max(6, maxDb - minDb);
  const loudnessCurve = windowDbs.map((db) =>
    Number(Math.max(0, Math.min(1, (db - minDb) / dbSpan)).toFixed(3))
  );

  const loudParts: DynamicPart[] = [];
  const quietParts: DynamicPart[] = [];

  if (numWindows >= 4 && maxDb - minDb >= 2.0) {
    const loudThresh = Math.min(
      maxDb - 0.8,
      Math.max(lufs - 0.5, minDb + dbSpan * 0.62)
    );
    const quietThresh = Math.max(
      minDb + 0.8,
      Math.min(lufs - 2.0, minDb + dbSpan * 0.35)
    );
    const secPerWin = totalSec / numWindows;

    const extractRegions = (
      predicate: (db: number) => boolean,
      isLoud: boolean
    ): DynamicPart[] => {
      const regions: DynamicPart[] = [];
      let curStart = -1;
      for (let i = 0; i <= numWindows; i++) {
        const match = i < numWindows && predicate(windowDbs[i]);
        if (match && curStart === -1) {
          curStart = i;
        } else if (!match && curStart !== -1) {
          const endIdx = i;
          const durSec = (endIdx - curStart) * secPerWin;
          if (durSec >= Math.min(2.0, totalSec * 0.12)) {
            let dbSum = 0;
            let peak = -70;
            let normSum = 0;
            for (let k = curStart; k < endIdx; k++) {
              dbSum += windowDbs[k];
              if (windowPeaksDb[k] > peak) peak = windowPeaksDb[k];
              normSum += loudnessCurve[k];
            }
            const count = endIdx - curStart;
            const sSec = Number((curStart * secPerWin).toFixed(1));
            const eSec = Number(Math.min(totalSec, endIdx * secPerWin).toFixed(1));
            regions.push({
              start: sSec,
              end: eSec,
              avgDb: Number((dbSum / count).toFixed(1)),
              peakDb: Number(peak.toFixed(1)),
              intensity: Number((normSum / count).toFixed(2)),
              label: isLoud ? "Peak" : "Quiet",
            });
          }
          curStart = -1;
        }
      }
      return regions;
    };

    loudParts.push(...extractRegions((db) => db >= loudThresh, true).slice(0, 8));
    quietParts.push(...extractRegions((db) => db <= quietThresh, false).slice(0, 8));
  }

  return {
    lufs,
    lra,
    truePeak,
    crestFactorDb,
    loudnessCurve,
    loudParts,
    quietParts,
    dcOffsetDetected,
    clippingDetected,
  };
}

/**
 * Estimates BPM, beat punch score, transient hit density (hits/sec) & beat timestamps.
 */
export function analyzeBeatsAndTempo(
  mono: Float32Array,
  sampleRate: number,
  duration: number
): {
  bpm: number;
  bpmConfidence: number;
  beatPunchScore: number;
  transientDensity: number;
  beatTimestamps: number[];
} {
  if (mono.length < sampleRate || sampleRate <= 0) {
    return {
      bpm: 120,
      bpmConfidence: 0.4,
      beatPunchScore: 0.5,
      transientDensity: 2.5,
      beatTimestamps: [],
    };
  }

  const maxSamples = Math.min(mono.length, Math.floor(sampleRate * 90));
  const hop = Math.max(256, Math.round(sampleRate * 0.02));
  const numFrames = Math.floor(maxSamples / hop);

  if (numFrames < 32) {
    return {
      bpm: 120,
      bpmConfidence: 0.4,
      beatPunchScore: 0.5,
      transientDensity: 2.5,
      beatTimestamps: [],
    };
  }

  const energies = new Float32Array(numFrames);
  let energySum = 0;
  for (let f = 0; f < numFrames; f++) {
    const start = f * hop;
    const end = start + hop;
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      sumSq += mono[i] * mono[i];
    }
    const rms = Math.sqrt(sumSq / hop);
    energies[f] = rms;
    energySum += rms;
  }

  const avgRms = Math.max(1e-5, energySum / numFrames);
  const onset = new Float32Array(numFrames);
  let onsetSum = 0;
  let maxOnset = 0;
  for (let f = 1; f < numFrames; f++) {
    const diff = energies[f] - energies[f - 1];
    const v = diff > 0 ? diff : 0;
    onset[f] = v;
    onsetSum += v;
    if (v > maxOnset) maxOnset = v;
  }

  const meanOnset = onsetSum / Math.max(1, numFrames - 1);
  const beatPunchScore = Number(
    Math.min(
      1,
      Math.max(0.1, (maxOnset / avgRms) * 0.5 + (meanOnset / avgRms) * 2.2)
    ).toFixed(3)
  );

  const onsetThresh = Math.max(meanOnset * 2.1, avgRms * 0.14);
  let hitCount = 0;
  let cooldown = 0;
  for (let f = 1; f < numFrames; f++) {
    if (cooldown > 0) {
      cooldown--;
      continue;
    }
    if (onset[f] >= onsetThresh) {
      hitCount++;
      cooldown = 4;
    }
  }
  const analyzedSec = Math.max(1, maxSamples / sampleRate);
  const transientDensity = Number(
    Math.max(0.4, Math.min(14, hitCount / analyzedSec)).toFixed(2)
  );

  const fps = sampleRate / hop;
  const minBpm = 65;
  const maxBpm = 185;
  const minLag = Math.max(4, Math.floor((60 / maxBpm) * fps));
  const maxLag = Math.min(numFrames - 2, Math.ceil((60 / minBpm) * fps));

  let bestLag = Math.round((60 / 120) * fps);
  let bestScore = -1;
  let totalScore = 0;
  let scoreCount = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const limit = numFrames - lag;
    for (let f = 0; f < limit; f++) {
      corr += onset[f] * onset[f + lag];
    }
    const normCorr = corr / Math.max(1, limit);
    totalScore += normCorr;
    scoreCount++;
    if (normCorr > bestScore) {
      bestScore = normCorr;
      bestLag = lag;
    }
  }

  let bpm = Math.round((60 * fps) / Math.max(1, bestLag));
  if (bpm < 70) bpm *= 2;
  if (bpm > 175) bpm = Math.round(bpm / 2);
  bpm = Math.max(60, Math.min(200, bpm));

  const avgScore = scoreCount > 0 ? totalScore / scoreCount : 0;
  const bpmConfidence =
    avgScore > 1e-7
      ? Number(
          Math.max(0.25, Math.min(0.98, (bestScore / avgScore - 1) * 0.45)).toFixed(2)
        )
      : 0.45;

  const beatPeriodSec = 60 / bpm;
  const firstPeriodFrames = Math.min(numFrames, Math.ceil(beatPeriodSec * fps));
  let bestPhaseFrame = 0;
  let bestPhaseScore = -1;
  const stepFrames = Math.max(1, Math.round(beatPeriodSec * fps));

  for (let p = 0; p < firstPeriodFrames; p++) {
    let s = 0;
    for (let f = p; f < numFrames; f += stepFrames) {
      s += onset[f];
    }
    if (s > bestPhaseScore) {
      bestPhaseScore = s;
      bestPhaseFrame = p;
    }
  }

  const firstBeatSec = bestPhaseFrame / fps;
  const beatTimestamps: number[] = [];
  const safeDur = duration || mono.length / sampleRate;
  for (let t = firstBeatSec; t < safeDur && beatTimestamps.length < 500; t += beatPeriodSec) {
    beatTimestamps.push(Number(t.toFixed(3)));
  }

  return {
    bpm,
    bpmConfidence,
    beatPunchScore,
    transientDensity,
    beatTimestamps,
  };
}

/**
 * Estimates 4-band spectral balance + spectral centroid (Hz), mud ratio (220-360Hz),
 * and harshness ratio (3.2-5.5kHz) using one-pole crossover filters.
 */
export function analyzeSpectralBalance(
  mono: Float32Array,
  sampleRate: number
): {
  subEnergyRatio: number;
  lowMidEnergyRatio: number;
  highMidEnergyRatio: number;
  highEnergyRatio: number;
  spectralCentroidHz: number;
  mudRatio: number;
  harshnessRatio: number;
} {
  const n = Math.min(mono.length, Math.floor(sampleRate * 45));
  if (n < 64 || sampleRate <= 0) {
    return {
      subEnergyRatio: 0.25,
      lowMidEnergyRatio: 0.25,
      highMidEnergyRatio: 0.28,
      highEnergyRatio: 0.22,
      spectralCentroidHz: 1850,
      mudRatio: 0.22,
      harshnessRatio: 0.16,
    };
  }

  const lpCoeff = (hz: number) =>
    Math.exp((-2 * Math.PI * Math.min(hz, sampleRate * 0.45)) / sampleRate);

  const a80 = lpCoeff(80);
  const a220 = lpCoeff(220);
  const a400 = lpCoeff(400);
  const a3000 = lpCoeff(3000);
  const a4500 = lpCoeff(4500);

  let lp80 = 0;
  let lp220 = 0;
  let lp400 = 0;
  let lp3000 = 0;
  let lp4500 = 0;

  let eSub = 0;
  let eMud = 0;
  let eLowMid = 0;
  let eHighMid = 0;
  let eHarsh = 0;
  let eHigh = 0;

  for (let i = 0; i < n; i++) {
    const x = mono[i];
    lp80 = a80 * lp80 + (1 - a80) * x;
    lp220 = a220 * lp220 + (1 - a220) * x;
    lp400 = a400 * lp400 + (1 - a400) * x;
    lp3000 = a3000 * lp3000 + (1 - a3000) * x;
    lp4500 = a4500 * lp4500 + (1 - a4500) * x;

    const bSub = lp80;
    const bMud = lp400 - lp220;
    const bLowMid = lp400 - lp80;
    const bHighMid = lp4500 - lp400;
    const bHarsh = lp4500 - lp3000;
    const bHigh = x - lp4500;

    eSub += bSub * bSub;
    eMud += bMud * bMud;
    eLowMid += bLowMid * bLowMid;
    eHighMid += bHighMid * bHighMid;
    eHarsh += bHarsh * bHarsh;
    eHigh += bHigh * bHigh;
  }

  const total = Math.max(1e-9, eSub + eLowMid + eHighMid + eHigh);
  const subEnergyRatio = Number((eSub / total).toFixed(4));
  const lowMidEnergyRatio = Number((eLowMid / total).toFixed(4));
  const highMidEnergyRatio = Number((eHighMid / total).toFixed(4));
  const highEnergyRatio = Number(
    Math.max(0, 1 - subEnergyRatio - lowMidEnergyRatio - highMidEnergyRatio).toFixed(4)
  );

  const mudRatio = Number(Math.min(1, (eMud / total) * 1.45).toFixed(3));
  const harshnessRatio = Number(Math.min(1, (eHarsh / total) * 1.65).toFixed(3));

  const weightedFreq =
    subEnergyRatio * 55 +
    lowMidEnergyRatio * 260 +
    highMidEnergyRatio * 1850 +
    highEnergyRatio * 6400;
  const spectralCentroidHz = Math.round(
    Math.max(260, Math.min(7800, weightedFreq))
  );

  return {
    subEnergyRatio,
    lowMidEnergyRatio,
    highMidEnergyRatio,
    highEnergyRatio,
    spectralCentroidHz,
    mudRatio,
    harshnessRatio,
  };
}

/**
 * Computes stereo phase correlation [-1..+1] between Left and Right channels.
 */
export function analyzeStereoCorrelation(
  left: Float32Array,
  right?: Float32Array
): number {
  if (!right || right.length !== left.length || left.length === 0) {
    return 0.92;
  }
  const step = Math.max(1, Math.floor(left.length / 48000));
  let sumLR = 0;
  let sumL2 = 0;
  let sumR2 = 0;
  for (let i = 0; i < left.length; i += step) {
    const l = left[i];
    const r = right[i];
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
  }
  const denom = Math.sqrt(Math.max(1e-12, sumL2 * sumR2));
  return Number(Math.max(-1, Math.min(1, sumLR / denom)).toFixed(2));
}

export function buildStructuralSections(
  loudnessCurve: number[],
  duration: number
): TrackSection[] {
  const safeDur = Math.max(1, duration || loudnessCurve.length || 180);
  if (loudnessCurve.length < 6) {
    const step = safeDur / 4;
    return [
      { start: 0, end: Number(step.toFixed(1)), label: "intro", energy: 0.4 },
      { start: Number(step.toFixed(1)), end: Number((step * 2).toFixed(1)), label: "verse", energy: 0.6 },
      { start: Number((step * 2).toFixed(1)), end: Number((step * 3).toFixed(1)), label: "chorus", energy: 0.85 },
      { start: Number((step * 3).toFixed(1)), end: Number(safeDur.toFixed(1)), label: "outro", energy: 0.45 },
    ];
  }

  const n = loudnessCurve.length;
  const targetCount = Math.min(7, Math.max(4, Math.round(safeDur / 30)));
  const segLen = Math.max(1, Math.floor(n / targetCount));
  const secPerPt = safeDur / n;

  const avgEnergies: number[] = [];
  for (let s = 0; s < targetCount; s++) {
    const startIdx = s * segLen;
    const endIdx = s === targetCount - 1 ? n : Math.min(n, (s + 1) * segLen);
    let sum = 0;
    for (let i = startIdx; i < endIdx; i++) sum += loudnessCurve[i];
    avgEnergies.push(sum / Math.max(1, endIdx - startIdx));
  }

  const maxE = Math.max(...avgEnergies);
  const sections: TrackSection[] = [];

  for (let s = 0; s < targetCount; s++) {
    const startSec = Number((s * segLen * secPerPt).toFixed(1));
    const endSec =
      s === targetCount - 1
        ? Number(safeDur.toFixed(1))
        : Number(((s + 1) * segLen * secPerPt).toFixed(1));
    const e = avgEnergies[s];

    let label: SectionLabel = "verse";
    if (s === 0 && e < maxE * 0.78) label = "intro";
    else if (s === targetCount - 1 && e < maxE * 0.8) label = "outro";
    else if (e >= maxE * 0.82) label = "chorus";
    else if (s >= 2 && s < targetCount - 1 && e < maxE * 0.62) label = "bridge";

    sections.push({
      start: startSec,
      end: Math.max(startSec + 0.5, endSec),
      label,
      energy: Number(e.toFixed(2)),
    });
  }

  return sections;
}

/**
 * Generates per-second vibe optimization targets across every part of the track
 * so quiet intros stay warm & clear and drops hit with tight sub punch & stereo width.
 */
export function buildVibeCurveAndProfile(params: {
  loudnessCurve: number[];
  duration: number;
  subEnergyRatio: number;
  lowMidEnergyRatio: number;
  highMidEnergyRatio: number;
  highEnergyRatio: number;
  beatPunchScore: number;
  crestFactorDb: number;
  mudRatio: number;
  harshnessRatio: number;
  transientDensity: number;
  hasVocals: boolean;
}): {
  vibeCurve: VibeCurvePoint[];
  optimalProfile: OptimalDspProfile;
  feelingMood: FeelingMood;
  feelingColor: string;
  recommendedPreset: PresetName;
  smartTechniquesApplied: string[];
} {
  const {
    loudnessCurve,
    duration,
    subEnergyRatio,
    lowMidEnergyRatio,
    highMidEnergyRatio,
    highEnergyRatio,
    beatPunchScore,
    crestFactorDb,
    mudRatio,
    harshnessRatio,
    transientDensity,
    hasVocals,
  } = params;

  const safeDur = Math.max(1, duration || loudnessCurve.length || 180);
  const n = loudnessCurve.length;
  const secPerPt = n > 0 ? safeDur / n : 1;

  const vibeCurve: VibeCurvePoint[] = loudnessCurve.map((energy, i) => ({
    t: Number((i * secPerPt).toFixed(2)),
    energy,
    bassLiftDb: Number(
      (1.5 * energy + (subEnergyRatio < 0.22 ? 0.6 : 0.2)).toFixed(2)
    ),
    clarityLiftDb: Number((1.35 * (1 - energy * 0.45)).toFixed(2)),
    widthBoost: Number((0.04 + 0.09 * energy).toFixed(3)),
  }));

  const optimalProfile: OptimalDspProfile = {
    subDb: Number(
      Math.max(-2, Math.min(5.5, (0.24 - subEnergyRatio) * 13 + 1.3)).toFixed(1)
    ),
    bassDb: Number(
      Math.max(-2, Math.min(5.5, (0.25 - subEnergyRatio) * 9.5 + 1.5)).toFixed(1)
    ),
    warmthDb: Number(
      Math.max(-3, Math.min(3.5, (0.23 - lowMidEnergyRatio) * 9.5)).toFixed(1)
    ),
    clarityDb: Number(
      Math.max(
        -1,
        Math.min(5.0, (0.28 - highMidEnergyRatio) * 10.5 + (hasVocals ? 1.1 : 0.5))
      ).toFixed(1)
    ),
    airDb: Number(
      Math.max(-1, Math.min(5.2, (0.2 - highEnergyRatio) * 12.5 + 1.2)).toFixed(1)
    ),
    compAmount: Number(
      Math.min(0.72, Math.max(0.25, crestFactorDb / 22)).toFixed(2)
    ),
    harmonicDrive: Number(
      (beatPunchScore > 0.5 ? 0.16 : 0.12).toFixed(2)
    ),
    stereoWidth: beatPunchScore > 0.55 ? 1.22 : 1.15,
    beatImpact: Number(
      Math.min(0.9, Math.max(0.55, 0.52 + beatPunchScore * 0.38)).toFixed(2)
    ),
  };

  let feelingMood: FeelingMood = "euphoric";
  let feelingColor = "#14B8A6";
  let recommendedPreset: PresetName = "auto";

  if (subEnergyRatio > 0.34) {
    feelingMood = "bass-heavy";
    feelingColor = "#F59E0B";
    recommendedPreset = beatPunchScore > 0.58 ? "club-drop" : "deep-bass";
  } else if (beatPunchScore > 0.62) {
    feelingMood = "electric";
    feelingColor = "#06B6D4";
    recommendedPreset = "smart-beat";
  } else if (highMidEnergyRatio > 0.35 && hasVocals) {
    feelingMood = "bright-pop";
    feelingColor = "#14B8A6";
    recommendedPreset = "vocal-focus";
  } else if (highEnergyRatio < 0.11 && lowMidEnergyRatio > 0.28) {
    feelingMood = "warm-chill";
    feelingColor = "#FB7185";
    recommendedPreset = "warm-analog";
  } else if (crestFactorDb > 14.5) {
    feelingMood = "cinematic";
    feelingColor = "#8B5CF6";
    recommendedPreset = "dynamic-lift";
  } else {
    feelingMood = "euphoric";
    feelingColor = "#10B981";
    recommendedPreset = "vibe-max";
  }

  const smartTechniquesApplied: string[] = [
    "120 Hz Sub-Bass Mono Phase Lock",
    "64 Hz Sub-Harmonic Beat Impact Slam",
    "Two-Stage Zero-Clip Lookahead Limiter",
  ];
  if (mudRatio > 0.25) {
    smartTechniquesApplied.push("260 Hz Adaptive De-Mud Filter");
  }
  if (harshnessRatio > 0.18) {
    smartTechniquesApplied.push("4.1 kHz Ear-Canal Harshness Tamer");
  }
  if (crestFactorDb > 11.5) {
    smartTechniquesApplied.push("Upward Micro-Detail Lift");
  } else {
    smartTechniquesApplied.push("Crest-Factor Headroom Recovery");
  }
  if (transientDensity > 3.2) {
    smartTechniquesApplied.push("23ms Transient-Preserving Drum Attack");
  } else {
    smartTechniquesApplied.push("Fletcher-Munson Equal-Loudness Contour");
  }

  return {
    vibeCurve,
    optimalProfile,
    feelingMood,
    feelingColor,
    recommendedPreset,
    smartTechniquesApplied,
  };
}

export function analyzePcmSync(pcm: RawPcmInput): SongAnalysis {
  const n = pcm.left.length;
  const mono = new Float32Array(n);
  if (pcm.right && pcm.right.length === n) {
    for (let i = 0; i < n; i++) {
      mono[i] = 0.5 * (pcm.left[i] + pcm.right[i]);
    }
  } else {
    mono.set(pcm.left);
  }

  const dyn = analyzeLoudnessDynamics(mono, pcm.sampleRate, pcm.duration);
  const beats = analyzeBeatsAndTempo(mono, pcm.sampleRate, pcm.duration);
  const spec = analyzeSpectralBalance(mono, pcm.sampleRate);
  const stereoCorrelation = analyzeStereoCorrelation(pcm.left, pcm.right);
  const sections = buildStructuralSections(dyn.loudnessCurve, pcm.duration);

  const avgLoudnessNorm =
    dyn.loudnessCurve.length > 0
      ? dyn.loudnessCurve.reduce((a, b) => a + b, 0) / dyn.loudnessCurve.length
      : 0.55;
  const energy = Number(Math.max(0.05, Math.min(1, avgLoudnessNorm)).toFixed(2));

  // Find Peak Drop Timestamp (strongest energy surge / drop climax)
  let peakDropTimeSec = Math.min(
    Math.max(0, pcm.duration - 0.5),
    Number((pcm.duration * 0.28).toFixed(1))
  );
  if (dyn.loudParts.length > 0) {
    const bestLoud = [...dyn.loudParts].sort(
      (a, b) => b.intensity - a.intensity || b.peakDb - a.peakDb
    )[0];
    peakDropTimeSec = bestLoud.start;
  } else if (dyn.loudnessCurve.length >= 4) {
    const secPerWin = pcm.duration / dyn.loudnessCurve.length;
    let bestIdx = 1;
    let bestScore = -1;
    for (let i = 1; i < dyn.loudnessCurve.length; i++) {
      const jump = Math.max(0, dyn.loudnessCurve[i] - dyn.loudnessCurve[i - 1]);
      const score = dyn.loudnessCurve[i] * 0.72 + jump * 0.65;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    peakDropTimeSec = Number(
      Math.min(Math.max(0.5, pcm.duration - 0.5), bestIdx * secPerWin).toFixed(1)
    );
  }

  const subWeightScore = Number(
    Math.min(
      1,
      Math.max(0.15, spec.subEnergyRatio * 2.1 + beats.beatPunchScore * 0.35)
    ).toFixed(2)
  );
  const vocalClarityScore = Number(
    Math.min(
      1,
      Math.max(0.18, spec.highMidEnergyRatio * 2.1 + spec.highEnergyRatio * 0.45)
    ).toFixed(2)
  );

  const qualityFlags: QualityFlag[] = [];
  if (dyn.dcOffsetDetected) qualityFlags.push("dc_offset");
  if (dyn.clippingDetected) qualityFlags.push("clipping");

  const clipPenalty = dyn.clippingDetected ? 24 : 0;
  const crestScore = Math.min(45, Math.max(12, (dyn.crestFactorDb - 4) * 3.8));
  const headroomScore = dyn.truePeak < -1.0 ? 35 : dyn.truePeak < -0.2 ? 24 : 14;
  const dynamicHealthScore = Math.round(
    Math.max(20, Math.min(99, crestScore + headroomScore + 18 - clipPenalty))
  );

  const hasVocals = spec.highMidEnergyRatio >= 0.2;
  const vibe = buildVibeCurveAndProfile({
    loudnessCurve: dyn.loudnessCurve,
    duration: pcm.duration,
    subEnergyRatio: spec.subEnergyRatio,
    lowMidEnergyRatio: spec.lowMidEnergyRatio,
    highMidEnergyRatio: spec.highMidEnergyRatio,
    highEnergyRatio: spec.highEnergyRatio,
    beatPunchScore: beats.beatPunchScore,
    crestFactorDb: dyn.crestFactorDb,
    mudRatio: spec.mudRatio,
    harshnessRatio: spec.harshnessRatio,
    transientDensity: beats.transientDensity,
    hasVocals,
  });

  return normalizeAnalysis(
    {
      bpm: beats.bpm,
      bpmConfidence: beats.bpmConfidence,
      beatTimestamps: beats.beatTimestamps,
      peakDropTimeSec,
      timeSignature: "4/4",
      key: "Detecting…",
      lufs: dyn.lufs,
      lra: dyn.lra,
      truePeak: dyn.truePeak,
      energy,
      crestFactorDb: dyn.crestFactorDb,
      beatPunchScore: beats.beatPunchScore,
      subWeightScore,
      vocalClarityScore,
      spectralCentroidHz: spec.spectralCentroidHz,
      stereoCorrelation,
      transientDensity: beats.transientDensity,
      mudRatio: spec.mudRatio,
      harshnessRatio: spec.harshnessRatio,
      dynamicHealthScore,
      smartTechniquesApplied: vibe.smartTechniquesApplied,
      loudnessCurve: dyn.loudnessCurve,
      loudParts: dyn.loudParts,
      quietParts: dyn.quietParts,
      vibeCurve: vibe.vibeCurve,
      optimalProfile: vibe.optimalProfile,
      subEnergyRatio: spec.subEnergyRatio,
      lowMidEnergyRatio: spec.lowMidEnergyRatio,
      highMidEnergyRatio: spec.highMidEnergyRatio,
      highEnergyRatio: spec.highEnergyRatio,
      hasVocals,
      sections,
      qualityFlags,
      recommendedPreset: vibe.recommendedPreset,
      feelingMood: vibe.feelingMood,
      feelingColor: vibe.feelingColor,
      analysisEngine: "local-dsp",
      apiAnalyzed: false,
      apiAnalyzing: true,
    },
    pcm.duration
  );
}

export function analyzeAudioBuffer(buffer: AudioBuffer): SongAnalysis {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : undefined;
  return analyzePcmSync({
    left,
    right,
    sampleRate: buffer.sampleRate,
    duration: buffer.duration,
  });
}

function sinc(x: number): number {
  if (Math.abs(x) < 1e-6) return 1.0;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

/**
 * High-fidelity 3-lobe Lanczos windowed-sinc anti-aliasing resampler.
 * Prevents high-frequency aliasing distortion when downsampling audio for spectral analysis.
 */
export function resampleLanczos3Mono(
  left: Float32Array,
  right: Float32Array | null,
  srcPos: number,
  cutoffScale: number
): number {
  const n = left.length;
  if (n === 0) return 0;
  const a = 3;
  const filterScale = Math.min(1.0, Math.max(0.15, cutoffScale));
  const support = a / filterScale;
  const startIdx = Math.max(0, Math.ceil(srcPos - support));
  const endIdx = Math.min(n - 1, Math.floor(srcPos + support));

  let sum = 0;
  let weightSum = 0;
  for (let j = startIdx; j <= endIdx; j++) {
    const x = (srcPos - j) * filterScale;
    if (Math.abs(x) >= a) continue;
    const w = sinc(x) * sinc(x / a);
    const s = right ? 0.5 * (left[j] + right[j]) : left[j];
    sum += s * w;
    weightSum += w;
  }

  if (Math.abs(weightSum) < 1e-6) {
    const idx = Math.min(n - 1, Math.max(0, Math.round(srcPos)));
    return right ? 0.5 * (left[idx] + right[idx]) : left[idx];
  }
  return sum / weightSum;
}

/**
 * Downsamples an AudioBuffer using a Lanczos-3 windowed-sinc anti-aliasing filter
 * to a compact 11.025 kHz mono 16-bit PCM WAV (~175 KB for 8s) for lightning-fast API calls.
 */
export function encodeWavSnippetBase64(
  buffer: AudioBuffer,
  maxSeconds = 8
): string {
  const targetRate = 11025;
  const srcRate = buffer.sampleRate || 44100;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const totalSrcSamples = left.length;
  const durationSec = buffer.duration || totalSrcSamples / srcRate;

  const clipSeconds = Math.min(maxSeconds, Math.max(1, durationSec));
  const outSamples = Math.floor(clipSeconds * targetRate);

  const splitMode = durationSec > 20;
  const firstHalfOut = splitMode ? Math.floor(clipSeconds * 0.45 * targetRate) : outSamples;
  const secondStartSrcSec = splitMode
    ? Math.min(durationSec - clipSeconds * 0.6, Math.max(8, durationSec * 0.34))
    : 0;

  const cutoffScale = Math.min(1.0, targetRate / srcRate);

  const wavBytes = new ArrayBuffer(44 + outSamples * 2);
  const view = new DataView(wavBytes);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + outSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, outSamples * 2, true);

  let writePos = 44;
  for (let i = 0; i < outSamples; i++) {
    const srcSec =
      i < firstHalfOut
        ? i / targetRate
        : secondStartSrcSec + (i - firstHalfOut) / targetRate;
    const srcPos = Math.min(
      totalSrcSamples - 1,
      Math.max(0, srcSec * srcRate)
    );
    const sample = resampleLanczos3Mono(left, right, srcPos, cutoffScale);
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(
      writePos,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
    writePos += 2;
  }

  const u8 = new Uint8Array(wavBytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(u8).toString("base64");
}
