import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  analyzePcmSync,
  encodeWavSnippetBase64,
  resampleLanczos3Mono,
} from "./audioAnalyze";
import {
  computeLoudnessBoostGain,
  computePsychoacousticLoudnessPlan,
  computeSafeMakeupGain,
  computeTransparentGainStaging,
  OUTPUT_PROFILE_INFO,
} from "./dsp";
import {
  buildPresetEnhancement,
  computeAutoEnhancementForAnalysis,
  normalizePresetName,
  PRESET_CONFIGS,
  PRESET_LIST,
} from "./presets";
import { DEFAULT_ANALYSIS, DEFAULT_ENHANCEMENT } from "./errors";
import { interpolateWaveformBars } from "../components/SeekBar";

describe("analyzePcmSync — internal loud/quiet, beats, vibeCurve & psychoacoustic metrics", () => {
  it("computes vibeCurve, crestFactorDb, beatPunchScore, spectral ratios & psychoacoustic health", () => {
    const sampleRate = 16000;
    const duration = 20;
    const totalSamples = sampleRate * duration;
    const pcm = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const tone = Math.sin(2 * Math.PI * 220 * t);
      const isLoud = (t >= 5 && t < 12) || t >= 16;
      const amp = isLoud ? 0.72 : 0.04;
      pcm[i] = tone * amp;
    }

    const res = analyzePcmSync({
      left: pcm,
      sampleRate,
      duration,
    });

    assert.equal(res.loudnessCurve.length, 20);
    assert.ok(res.vibeCurve.length >= 10, "Expected moment-by-moment vibeCurve");
    assert.ok(res.optimalProfile, "Expected optimal DSP profile");
    assert.ok(res.crestFactorDb >= 0);
    assert.ok(res.beatPunchScore >= 0 && res.beatPunchScore <= 1);
    assert.ok(res.feelingColor.startsWith("#"));
    assert.ok(res.lra > 3, `Expected LRA > 3 dB, got ${res.lra}`);
    assert.ok(res.spectralCentroidHz > 100, `Expected spectralCentroidHz > 100, got ${res.spectralCentroidHz}`);
    assert.ok(res.dynamicHealthScore >= 15 && res.dynamicHealthScore <= 100);
    assert.ok(Array.isArray(res.smartTechniquesApplied) && res.smartTechniquesApplied.length >= 2);
    assert.equal(res.stereoCorrelation, 0.92);

    const bandSum =
      res.subEnergyRatio +
      res.lowMidEnergyRatio +
      res.highMidEnergyRatio +
      res.highEnergyRatio;
    assert.ok(
      Math.abs(bandSum - 1) < 0.02,
      `Spectral ratios should sum to ~1, got ${bandSum}`
    );
  });

  it("estimates ~120 BPM and transientDensity on a 2 Hz periodic pulse train", () => {
    const sampleRate = 16000;
    const duration = 12;
    const totalSamples = sampleRate * duration;
    const pcm = new Float32Array(totalSamples);

    for (let beatSec = 0; beatSec < duration; beatSec += 0.5) {
      const startSample = Math.floor(beatSec * sampleRate);
      const decayLen = Math.floor(0.08 * sampleRate);
      for (let k = 0; k < decayLen && startSample + k < totalSamples; k++) {
        const env = Math.exp(-k / (0.02 * sampleRate));
        pcm[startSample + k] =
          env * 0.85 * Math.sin((2 * Math.PI * 90 * k) / sampleRate);
      }
    }

    const res = analyzePcmSync({ left: pcm, sampleRate, duration });
    assert.ok(
      Math.abs(res.bpm - 120) <= 4,
      `Expected ~120 BPM, got ${res.bpm}`
    );
    assert.ok(res.beatTimestamps.length >= 15);
    assert.ok(res.transientDensity >= 1.2, `Expected transientDensity >= 1.2/s, got ${res.transientDensity}`);
  });
});

describe("encodeWavSnippetBase64 & Python DSP v3 analyzer", () => {
  it("writes a valid RIFF/WAVE header and analyzes cleanly via Python DSP v3", () => {
    const sampleRate = 16000;
    const duration = 4;
    const samples = new Float32Array(sampleRate * duration);
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const beat = t % 0.5 < 0.06 ? 0.8 * Math.sin(2 * Math.PI * 65 * t) : 0;
      samples[i] = beat + 0.15 * Math.sin(2 * Math.PI * 440 * t);
    }

    const fakeBuffer = {
      sampleRate,
      numberOfChannels: 1,
      duration,
      getChannelData: () => samples,
    } as unknown as AudioBuffer;

    const b64 = encodeWavSnippetBase64(fakeBuffer, 4);
    const bytes = Buffer.from(b64, "base64");
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    assert.equal(bytes.toString("ascii", 36, 40), "data");

    const scriptPath = path.resolve(process.cwd(), "lib/python/analyze_audio.py");
    const py = spawnSync("python3", [scriptPath], {
      input: JSON.stringify({ audioSnippetBase64: b64 }),
      encoding: "utf-8",
      timeout: 8000,
    });
    assert.equal(py.status, 0, `Python stderr: ${py.stderr}`);
    const parsed = JSON.parse(py.stdout);
    assert.equal(parsed.engine, "python-dsp-v3");
    assert.ok(parsed.optimalProfile);
    assert.ok(typeof parsed.peakDropTimeSec === "number" && parsed.peakDropTimeSec >= 0);
    assert.ok(Array.isArray(parsed.vibeCurve) && parsed.vibeCurve.length > 0);
    assert.ok(parsed.recommendedMode in PRESET_CONFIGS);
    assert.ok(typeof parsed.spectralCentroidHz === "number" && parsed.spectralCentroidHz > 50);
    assert.ok(typeof parsed.dynamicHealthScore === "number" && parsed.dynamicHealthScore >= 15);
    assert.ok(Array.isArray(parsed.smartTechniquesApplied) && parsed.smartTechniquesApplied.length >= 2);
  });
});

describe("Psychoacoustic 4-Level Loudness Plan (100% / 200% / 250% / 400%), Device Profiles & 25 Enhancement Modes", () => {
  it("provides exactly 25 enhancement modes across 5 categories and 5 output device profiles", () => {
    assert.equal(PRESET_LIST.length, 25);
    assert.equal(Object.keys(OUTPUT_PROFILE_INFO).length, 5);
    assert.equal(normalizePresetName("bass"), "deep-bass");
    assert.equal(normalizePresetName("vocal"), "vocal-focus");
    assert.equal(normalizePresetName("unknown-mode"), "auto");

    for (const id of PRESET_LIST) {
      const cfg = PRESET_CONFIGS[id];
      assert.ok(cfg.label.length > 0);
      assert.ok(cfg.subDb >= -4 && cfg.subDb <= 8);
      assert.ok(cfg.bassDb >= -6 && cfg.bassDb <= 8);
      assert.ok(cfg.stereoWidth >= 0.5 && cfg.stereoWidth <= 1.6);
    }
  });

  it("computes distortion-free psychoacoustic 4-level loudness plan (100%, 200%, 250%, 400%) without raw clipping", () => {
    const plan100 = computePsychoacousticLoudnessPlan(100, DEFAULT_ANALYSIS, true);
    assert.equal(plan100.safePreLimiterGain, 1.0);
    assert.equal(plan100.fletcherPresenceLiftDb, 0);

    const plan200 = computePsychoacousticLoudnessPlan(
      200,
      { ...DEFAULT_ANALYSIS, mudRatio: 0.34, harshnessRatio: 0.25 },
      true
    );
    const plan250 = computePsychoacousticLoudnessPlan(
      250,
      { ...DEFAULT_ANALYSIS, mudRatio: 0.34, harshnessRatio: 0.25 },
      true
    );
    const plan400 = computePsychoacousticLoudnessPlan(
      400,
      { ...DEFAULT_ANALYSIS, mudRatio: 0.34, harshnessRatio: 0.25 },
      true
    );
    assert.ok(plan200.safePreLimiterGain > 1.35 && plan200.safePreLimiterGain < plan250.safePreLimiterGain);
    assert.ok(plan250.safePreLimiterGain < plan400.safePreLimiterGain && plan400.safePreLimiterGain <= 2.5);
    assert.ok(plan400.upwardDensityDb > plan200.upwardDensityDb, "Expected upward density lift to increase at 400%");
    assert.ok(plan400.fletcherPresenceLiftDb > plan200.fletcherPresenceLiftDb, "Expected Fletcher-Munson presence lift at 400%");
    assert.ok(plan400.deMudCutDb < plan200.deMudCutDb, "Expected deeper proportional 260 Hz de-mud cut at 400%");
    assert.ok(plan400.deHarshCutDb < plan200.deHarshCutDb, "Expected deeper 4.1 kHz ear-canal anti-harshness cut at 400%");

    assert.equal(computeLoudnessBoostGain(100, true, false), 1.0);
    assert.equal(computeLoudnessBoostGain(200, true, false), 2.0);
    assert.equal(computeLoudnessBoostGain(250, true, false), 2.5);
    assert.equal(computeLoudnessBoostGain(400, true, false), 4.0);
    assert.equal(computeLoudnessBoostGain(400, false, false), 1.0);
    assert.equal(computeLoudnessBoostGain(400, true, true), 1.0);
  });

  it("clamps normalization gain cleanly into safe distortion-free [0.55, 1.85] range", () => {
    assert.equal(computeSafeMakeupGain({ ...DEFAULT_ANALYSIS, lufs: -14, truePeak: -1 }, true), 1);
    assert.ok(computeSafeMakeupGain({ ...DEFAULT_ANALYSIS, lufs: -30, truePeak: -12 }, true) <= 1.85);
    assert.ok(computeSafeMakeupGain({ ...DEFAULT_ANALYSIS, lufs: -30, truePeak: -12 }, true) > 1.5);
    assert.equal(computeSafeMakeupGain({ ...DEFAULT_ANALYSIS, lufs: -4, truePeak: -0.2 }, true), 0.5623413251903491);
    assert.equal(computeSafeMakeupGain({ ...DEFAULT_ANALYSIS, lufs: -30, truePeak: -12 }, false), 1);
  });

  it("adapts Auto Master based on track analysis and applies named preset", () => {
    const bassThinAnalysis = analyzePcmSync({
      left: new Float32Array(16000 * 4).map((_, i) =>
        Math.sin((2 * Math.PI * 5000 * i) / 16000) * 0.3
      ),
      sampleRate: 16000,
      duration: 4,
    });
    const autoCfg = computeAutoEnhancementForAnalysis(bassThinAnalysis);
    assert.ok(autoCfg.bassDb > 1.0);

    const bassPreset = buildPresetEnhancement(
      "deep-bass",
      DEFAULT_ENHANCEMENT,
      bassThinAnalysis
    );
    assert.equal(bassPreset.preset, "deep-bass");
    assert.equal(bassPreset.subDb, 4.8);
  });

  it("computes clean, transparent gain-staging pre-trim and booster ceiling without internal overload", () => {
    const bypassStage = computeTransparentGainStaging({
      subDb: 6,
      beatImpactDb: 3,
      bassDb: 6,
      warmthDb: 2,
      clarityDb: 4,
      airDb: 4,
      upwardDetailDb: 1.5,
      safePreLimiterGain: 2.0,
      isEnhanced: false,
    });
    assert.equal(bypassStage.preTrimLinear, 1.0);
    assert.equal(bypassStage.totalBoosterLinear, 1.0);

    const activeStage = computeTransparentGainStaging({
      subDb: 5.5,
      beatImpactDb: 2.8,
      bassDb: 5.0,
      warmthDb: 1.0,
      clarityDb: 3.0,
      airDb: 2.5,
      upwardDetailDb: 1.2,
      safePreLimiterGain: 1.65,
      isEnhanced: true,
    });
    assert.ok(activeStage.preTrimDb < -2.5 && activeStage.preTrimDb >= -8.5);
    assert.ok(activeStage.preTrimLinear < 0.75 && activeStage.preTrimLinear > 0.35);
    assert.ok(activeStage.totalBoosterLinear > 1.65 && activeStage.totalBoosterLinear <= 2.35);
  });

  it("resamples via Lanczos-3 windowed-sinc anti-aliasing filter without clipping or DC drift", () => {
    const sr = 44100;
    const len = 4096;
    const left = new Float32Array(len);
    const right = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      left[i] = 0.6 * Math.sin((2 * Math.PI * 440 * i) / sr);
      right[i] = 0.6 * Math.sin((2 * Math.PI * 440 * i) / sr);
    }
    const sample = resampleLanczos3Mono(left, right, 512.37, 11025 / 44100);
    assert.ok(Number.isFinite(sample) && Math.abs(sample) <= 0.65);
  });

  it("interpolates dynamic loudnessCurve into bounded 56-bar SeekBar waveform", () => {
    const fallbackBars = interpolateWaveformBars(undefined, 56);
    assert.equal(fallbackBars.length, 56);
    assert.ok(fallbackBars.every((b) => b >= 0.16 && b <= 1));

    const customCurve = [-32, -24, -18, -9, -6, -12, -28];
    const bars = interpolateWaveformBars(customCurve, 56);
    assert.equal(bars.length, 56);
    assert.ok(Math.max(...bars) > 0.85, "Peak drop bar should exceed 0.85");
    assert.ok(Math.min(...bars) < 0.3, "Quiet intro/outro bar should be below 0.3");
  });
});
