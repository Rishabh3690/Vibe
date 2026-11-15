"use client";

import React, { memo, useEffect, useRef } from "react";
import {
  BarStyleMode,
  FeelingMood,
  VisualizerLevels,
} from "../lib/types";

interface VisualizerProps {
  getAnalyserNode: () => AnalyserNode | null;
  getVisualizerLevels?: () => VisualizerLevels;
  getCurrentTime?: () => number;
  beatTimestamps?: number[];
  accentColor?: string;
  feelingMood?: FeelingMood;
  barStyle?: BarStyleMode;
  onChangeBarStyle?: (style: BarStyleMode) => void;
  loudnessPercent?: number;
  beatImpact?: number;
  crossfadeDuration?: number;
  visualsEnabled: boolean;
  isPlaying: boolean;
  fullscreen?: boolean;
}

interface ShockwaveRing {
  active: boolean;
  radius: number;
  maxRadius: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
}

interface VibeEmber {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
}

export function computeLogSpectrumMagnitude(
  freqData: Uint8Array,
  col0: number,
  col1: number,
  sampleRate = 44100,
  fftSize = 2048
): number {
  const binCount = freqData.length;
  if (binCount === 0) return 0;

  const minFreq = 24;
  const maxFreq = Math.min(15500, sampleRate * 0.48);
  const logRatio = maxFreq / minFreq;

  const fStart = minFreq * Math.pow(logRatio, Math.max(0, Math.min(1, col0)));
  const fEnd = minFreq * Math.pow(logRatio, Math.max(0, Math.min(1, col1)));
  const fCenter = (fStart + fEnd) * 0.5;

  const binHz = sampleRate / fftSize;

  if (fCenter < 260) {
    const exactBin = Math.max(0, Math.min(binCount - 1, fCenter / binHz));
    const lowBin = Math.floor(exactBin);
    const highBin = Math.min(binCount - 1, lowBin + 1);
    const frac = exactBin - lowBin;
    const v0 = freqData[lowBin] || 0;
    const v1 = freqData[highBin] || 0;
    return (v0 * (1 - frac) + v1 * frac) / 255;
  }

  const startBin = Math.max(
    0,
    Math.min(binCount - 1, Math.floor(fStart / binHz))
  );
  const endBin = Math.max(
    startBin,
    Math.min(binCount - 1, Math.ceil(fEnd / binHz))
  );

  let maxVal = 0;
  let sum = 0;
  let count = 0;
  for (let b = startBin; b <= endBin; b++) {
    const v = freqData[b] || 0;
    if (v > maxVal) maxVal = v;
    sum += v;
    count++;
  }
  const avgVal = count > 0 ? sum / count : 0;
  return (maxVal * 0.72 + avgVal * 0.28) / 255;
}

function parseHexToRgb(hex: string): [number, number, number] {
  const clean = (hex || "").replace("#", "");
  if (clean.length !== 6) return [20, 184, 166];
  return [
    parseInt(clean.slice(0, 2), 16) || 20,
    parseInt(clean.slice(2, 4), 16) || 184,
    parseInt(clean.slice(4, 6), 16) || 166,
  ];
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

export function getFeelingPalette(
  mood: FeelingMood | undefined,
  baseHex: string,
  bass: number,
  energy: number
): {
  lowRgb: [number, number, number];
  peakRgb: [number, number, number];
  capRgb: [number, number, number];
} {
  const base = parseHexToRgb(baseHex);
  const presets: Record<
    FeelingMood,
    { top: [number, number, number]; hot: [number, number, number] }
  > = {
    euphoric: { top: [45, 212, 191], hot: [56, 189, 248] },
    "bass-heavy": { top: [249, 115, 22], hot: [251, 191, 36] },
    "warm-chill": { top: [245, 158, 11], hot: [253, 186, 116] },
    electric: { top: [168, 85, 247], hot: [34, 211, 238] },
    cinematic: { top: [59, 130, 246], hot: [129, 140, 248] },
    "bright-pop": { top: [236, 72, 153], hot: [45, 212, 191] },
  };

  const chosen = presets[mood || "euphoric"] || presets.euphoric;
  const surgeMix = Math.max(0, Math.min(1, bass * 0.65 + energy * 0.35));
  const peakRgb = lerpColor(chosen.top, chosen.hot, surgeMix);
  const capRgb = lerpColor(peakRgb, [255, 255, 255], 0.35 + energy * 0.25);

  return {
    lowRgb: base,
    peakRgb,
    capRgb,
  };
}

const DISPLAY_MODES: Array<{ id: BarStyleMode; label: string }> = [
  { id: "mirror-wave", label: "Mirror Wave" },
  { id: "peak-meter", label: "Studio RTA" },
  { id: "beat-surge", label: "Scope + Sub" },
];

function VisualizerComponent({
  getAnalyserNode,
  getVisualizerLevels,
  getCurrentTime,
  beatTimestamps = [],
  accentColor = "#14B8A6",
  feelingMood = "euphoric",
  barStyle = "mirror-wave",
  onChangeBarStyle,
  loudnessPercent = 100,
  beatImpact = 0.65,
  crossfadeDuration = 0.55,
  visualsEnabled,
  isPlaying,
  fullscreen = false,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const propsRef = useRef({
    getAnalyserNode,
    getVisualizerLevels,
    getCurrentTime,
    beatTimestamps,
    accentColor,
    feelingMood,
    barStyle,
    loudnessPercent,
    beatImpact,
    crossfadeDuration,
    visualsEnabled,
    isPlaying,
  });

  useEffect(() => {
    propsRef.current = {
      getAnalyserNode,
      getVisualizerLevels,
      getCurrentTime,
      beatTimestamps,
      accentColor,
      feelingMood,
      barStyle,
      loudnessPercent,
      beatImpact,
      crossfadeDuration,
      visualsEnabled,
      isPlaying,
    };
  }, [
    getAnalyserNode,
    getVisualizerLevels,
    getCurrentTime,
    beatTimestamps,
    accentColor,
    feelingMood,
    barStyle,
    loudnessPercent,
    beatImpact,
    crossfadeDuration,
    visualsEnabled,
    isPlaying,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    let disposed = false;
    let rafId = 0;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d", {
        alpha: false,
      }) as CanvasRenderingContext2D | null;
    } catch {
      ctx = null;
    }
    if (!ctx) {
      ctx = canvas.getContext("2d");
    }

    const NUM_BARS = 64;
    const smoothedBars = new Float32Array(NUM_BARS);
    const peakHoldCaps = new Float32Array(NUM_BARS);
    const rawCols = new Float32Array(NUM_BARS);
    const mirrorMap = new Uint8Array(NUM_BARS);
    for (let c = 0; c < NUM_BARS; c++) {
      mirrorMap[c] = Math.min(
        NUM_BARS - 1,
        Math.floor(
          (Math.abs(c - (NUM_BARS - 1) * 0.5) / (NUM_BARS * 0.5)) *
            (NUM_BARS * 0.85)
        )
      );
    }

    let freqData = new Uint8Array(1024);
    let timeData = new Uint8Array(1024);

    const MAX_SHOCKWAVES = 4;
    const shockwaves: ShockwaveRing[] = Array.from(
      { length: MAX_SHOCKWAVES },
      () => ({
        active: false,
        radius: 0,
        maxRadius: 0,
        alpha: 0,
        r: 20,
        g: 184,
        b: 166,
      })
    );

    const MAX_EMBERS = 28;
    const embers: VibeEmber[] = Array.from({ length: MAX_EMBERS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 2,
      alpha: 0,
      r: 20,
      g: 184,
      b: 166,
    }));

    let runningPeak = 0.4;
    let prevBass = 0;
    let transientKick = 0;
    let lastBeatIdx = -1;
    let lastShockwaveMs = 0;
    let lastRenderMs = 0;

    let activeHex = propsRef.current.accentColor || "#14B8A6";
    let fromRgb = parseHexToRgb(activeHex);
    let toRgb = parseHexToRgb(activeHex);
    let currentRgb = parseHexToRgb(activeHex);
    let fadeStartMs = performance.now();
    let fadeDurMs = 550;

    let cachedBarGrad: CanvasGradient | null = null;
    let gradCacheKey = "";

    const syncCanvasSize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(320, Math.round(rect.width * dpr));
      const targetH = Math.max(160, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        cachedBarGrad = null;
      }
    };

    syncCanvasSize();
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncCanvasSize)
        : null;
    if (resizeObserver) resizeObserver.observe(canvas);
    window.addEventListener("resize", syncCanvasSize, { passive: true });

    const draw = (nowMs: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(draw);

      const {
        getAnalyserNode: getAnalyser,
        getVisualizerLevels: getLevels,
        getCurrentTime: getTime,
        beatTimestamps: beats,
        accentColor: desiredHexProp,
        feelingMood: mood,
        barStyle: currentStyle,
        loudnessPercent: loudnessPct,
        beatImpact: impactAmt,
        crossfadeDuration: xfadeSec,
        visualsEnabled: enabled,
        isPlaying: playing,
      } = propsRef.current;

      if (!enabled || !ctx) {
        return;
      }

      const minIntervalMs = playing ? 15.2 : 32.0;
      const elapsedMs = nowMs - lastRenderMs;
      if (elapsedMs < minIntervalMs) {
        return;
      }
      const dtScale = Math.min(2.2, Math.max(0.5, elapsedMs / 16.667));
      lastRenderMs = nowMs;

      const desiredHex = desiredHexProp || "#14B8A6";
      if (desiredHex !== activeHex) {
        activeHex = desiredHex;
        fromRgb = currentRgb;
        toRgb = parseHexToRgb(desiredHex);
        fadeStartMs = nowMs;
        fadeDurMs = Math.max(300, (xfadeSec || 0.55) * 1000);
      }

      const fadeT = Math.min(1, Math.max(0, (nowMs - fadeStartMs) / fadeDurMs));
      const eased = fadeT * fadeT * (3 - 2 * fadeT);
      currentRgb = lerpColor(fromRgb, toRgb, eased);

      const cw = canvas.width;
      const ch = canvas.height;
      const centerY = ch * 0.5;
      ctx.fillStyle = "#0A0A0B";
      ctx.fillRect(0, 0, cw, ch);

      let bassNorm = 0.08;
      let totalEnergy = 0.1;
      let beatPulse = 0;

      if (playing && getLevels) {
        const lvls = getLevels();
        bassNorm = lvls.bass;
        totalEnergy = lvls.energy;
        beatPulse = lvls.beatPulse;
      }

      const currentHex = `#${currentRgb
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
        .join("")}`;
      const palette = getFeelingPalette(mood, currentHex, bassNorm, totalEnergy);

      const bassRise = Math.max(0, bassNorm - prevBass);
      prevBass = bassNorm * 0.7 + prevBass * 0.3;
      let beatTriggeredThisFrame = false;

      if (bassRise > 0.042 || beatPulse > 0.34) {
        transientKick = Math.min(
          1,
          Math.max(
            transientKick,
            0.48 + bassRise * 4.8 + beatPulse * 0.42 + (impactAmt ?? 0.65) * 0.15
          )
        );
        if (nowMs - lastShockwaveMs > 180 && bassRise > 0.055) {
          beatTriggeredThisFrame = true;
        }
      } else {
        transientKick *= Math.pow(0.84, dtScale);
      }

      if (playing && getTime && beats.length > 0) {
        const curSec = getTime();
        for (let b = Math.max(0, lastBeatIdx - 2); b < beats.length; b++) {
          const dt = curSec - beats[b];
          if (dt >= -0.025 && dt <= 0.065) {
            if (b !== lastBeatIdx) {
              lastBeatIdx = b;
              transientKick = Math.max(transientKick, 0.78);
              beatTriggeredThisFrame = true;
            }
            break;
          }
          if (beats[b] > curSec + 0.1) break;
        }
      } else {
        lastBeatIdx = -1;
      }

      if (playing && beatTriggeredThisFrame && nowMs - lastShockwaveMs > 165) {
        lastShockwaveMs = nowMs;
        for (let i = 0; i < MAX_SHOCKWAVES; i++) {
          if (!shockwaves[i].active) {
            shockwaves[i].active = true;
            shockwaves[i].radius = Math.min(cw, ch) * 0.05;
            shockwaves[i].maxRadius = Math.max(cw, ch) * 0.58;
            shockwaves[i].alpha = 0.34 + Math.min(0.26, transientKick * 0.24);
            shockwaves[i].r = palette.peakRgb[0];
            shockwaves[i].g = palette.peakRgb[1];
            shockwaves[i].b = palette.peakRgb[2];
            break;
          }
        }
      }

      const analyser = getAnalyser();
      if (analyser && playing) {
        const binCount = analyser.frequencyBinCount;
        if (freqData.length !== binCount) {
          freqData = new Uint8Array(binCount);
          timeData = new Uint8Array(binCount);
        }
        analyser.getByteFrequencyData(freqData);
        if (currentStyle === "beat-surge") {
          analyser.getByteTimeDomainData(timeData);
        }

        const sr = analyser.context.sampleRate || 44100;
        const fft = analyser.fftSize || 2048;

        let frameMax = 0.08;
        for (let c = 0; c < NUM_BARS; c++) {
          const col0 = c / NUM_BARS;
          const col1 = (c + 1) / NUM_BARS;
          const mag =
            computeLogSpectrumMagnitude(freqData, col0, col1, sr, fft) *
            (1.0 + col0 * 0.24);
          rawCols[c] = mag;
          if (mag > frameMax) frameMax = mag;
        }

        if (frameMax > runningPeak) {
          runningPeak = runningPeak * 0.52 + frameMax * 0.48;
        } else {
          runningPeak = Math.max(0.32, runningPeak * 0.992);
        }

        const loudnessFeelBoost =
          1.0 +
          Math.max(0, Math.min(3, (loudnessPct - 100) / 100)) * 0.11 +
          (impactAmt ?? 0.65) * 0.08;

        const invPeak = 1 / Math.max(0.26, runningPeak);
        for (let c = 0; c < NUM_BARS; c++) {
          const norm = rawCols[c] * invPeak;
          const bassZone = c < 30 ? Math.pow(1 - c / 30, 1.15) : 0.16;
          const kickAdd = transientKick * bassZone * 0.4;
          const boosted = Math.min(
            1.0,
            Math.pow(Math.max(0, norm), 0.84) * loudnessFeelBoost + kickAdd
          );

          if (boosted >= smoothedBars[c]) {
            smoothedBars[c] = smoothedBars[c] * 0.2 + boosted * 0.8;
          } else {
            smoothedBars[c] = smoothedBars[c] * 0.76 + boosted * 0.24;
          }

          if (smoothedBars[c] >= peakHoldCaps[c]) {
            peakHoldCaps[c] = smoothedBars[c];
          } else {
            peakHoldCaps[c] = Math.max(0.02, peakHoldCaps[c] - 0.008 * dtScale);
          }
        }
      } else {
        const tSec = nowMs * 0.0016;
        for (let c = 0; c < NUM_BARS; c++) {
          const centerDist = Math.abs(c - NUM_BARS * 0.5) / (NUM_BARS * 0.5);
          const idleTarget =
            0.045 +
            0.04 *
              (1 - centerDist * 0.5) *
              Math.sin(tSec + c * 0.22) *
              Math.cos(tSec * 0.65 - c * 0.1);
          smoothedBars[c] = smoothedBars[c] * 0.88 + idleTarget * 0.12;
          peakHoldCaps[c] = Math.max(smoothedBars[c], peakHoldCaps[c] * 0.96);
        }
      }

      const dpr = cw / Math.max(1, canvas.clientWidth || 640);

      // 1. Ambient Studio Horizon Glow
      const glowAlpha = Math.min(
        0.34,
        0.06 + bassNorm * 0.14 + transientKick * 0.15
      );
      const bgGlow = ctx.createRadialGradient(
        cw * 0.5,
        centerY,
        cw * 0.03,
        cw * 0.5,
        centerY,
        cw * 0.62
      );
      bgGlow.addColorStop(
        0,
        `rgba(${palette.peakRgb[0]}, ${palette.peakRgb[1]}, ${palette.peakRgb[2]}, ${glowAlpha.toFixed(3)})`
      );
      bgGlow.addColorStop(
        0.55,
        `rgba(${palette.lowRgb[0]}, ${palette.lowRgb[1]}, ${palette.lowRgb[2]}, ${(glowAlpha * 0.42).toFixed(3)})`
      );
      bgGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, cw, ch);

      // 2. Beat Shockwave Rings
      for (let i = 0; i < MAX_SHOCKWAVES; i++) {
        const sw = shockwaves[i];
        if (!sw.active) continue;
        sw.radius += ((sw.maxRadius - sw.radius) * 0.085 + 2.8 * dpr) * dtScale;
        sw.alpha *= Math.pow(0.92, dtScale);
        if (sw.alpha <= 0.015 || sw.radius >= sw.maxRadius) {
          sw.active = false;
          continue;
        }
        ctx.beginPath();
        ctx.ellipse(
          cw * 0.5,
          centerY,
          sw.radius,
          sw.radius * 0.4,
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = `rgba(${sw.r}, ${sw.g}, ${sw.b}, ${sw.alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(1.4 * dpr, 2.3 * dpr * sw.alpha);
        ctx.stroke();
      }

      const padX = 10 * dpr;
      const drawW = cw - padX * 2;
      const slotW = drawW / NUM_BARS;
      const gap = Math.max(1.5 * dpr, slotW * 0.25);
      const barW = Math.max(2 * dpr, slotW - gap);
      const maxHalfH = ch * 0.45;

      const nextGradKey = `${cw}x${ch}:${palette.lowRgb.join(",")}:${palette.peakRgb.join(",")}:${palette.capRgb.join(",")}`;
      if (!cachedBarGrad || gradCacheKey !== nextGradKey) {
        gradCacheKey = nextGradKey;
        const grad = ctx.createLinearGradient(0, ch * 0.05, 0, ch * 0.95);
        grad.addColorStop(
          0,
          `rgba(${palette.capRgb[0]}, ${palette.capRgb[1]}, ${palette.capRgb[2]}, 0.98)`
        );
        grad.addColorStop(
          0.26,
          `rgba(${palette.peakRgb[0]}, ${palette.peakRgb[1]}, ${palette.peakRgb[2]}, 0.88)`
        );
        grad.addColorStop(
          0.5,
          `rgba(${palette.lowRgb[0]}, ${palette.lowRgb[1]}, ${palette.lowRgb[2]}, 0.62)`
        );
        grad.addColorStop(
          0.74,
          `rgba(${palette.peakRgb[0]}, ${palette.peakRgb[1]}, ${palette.peakRgb[2]}, 0.72)`
        );
        grad.addColorStop(
          1,
          `rgba(${palette.capRgb[0]}, ${palette.capRgb[1]}, ${palette.capRgb[2]}, 0.85)`
        );
        cachedBarGrad = grad;
      }

      if (currentStyle === "peak-meter") {
        // MODE 2: Studio RTA Spectrum Analyzer (Bottom-anchored 64-band log spectrum + Peak-Hold Caps + dBFS grid)
        const bottomY = ch - 22 * dpr;
        const maxBarH = ch - 52 * dpr;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        for (const r of [0.25, 0.5, 0.75]) {
          const gy = bottomY - maxBarH * r;
          ctx.beginPath();
          ctx.moveTo(padX, gy);
          ctx.lineTo(cw - padX, gy);
          ctx.stroke();
        }

        ctx.fillStyle = cachedBarGrad;
        ctx.beginPath();
        const radius = Math.min(barW * 0.45, 4 * dpr);
        const hasRoundRect = typeof ctx.roundRect === "function";

        for (let c = 0; c < NUM_BARS; c++) {
          const val = Math.max(0.03, Math.min(1, smoothedBars[c]));
          const x = padX + c * slotW + gap * 0.5;
          const barH = Math.max(3 * dpr, val * maxBarH);
          const barTop = bottomY - barH;
          if (hasRoundRect) {
            ctx.roundRect(x, barTop, barW, barH, radius);
          } else {
            ctx.rect(x, barTop, barW, barH);
          }
        }
        ctx.fill();

        // Floating Peak-Hold Caps
        ctx.fillStyle = `rgba(${palette.capRgb[0]}, ${palette.capRgb[1]}, ${palette.capRgb[2]}, 0.92)`;
        for (let c = 0; c < NUM_BARS; c++) {
          const capVal = Math.max(0.04, Math.min(1, peakHoldCaps[c]));
          const x = padX + c * slotW + gap * 0.5;
          const capY = bottomY - capVal * maxBarH - 3 * dpr;
          ctx.fillRect(x, capY, barW, Math.max(1.5 * dpr, 2 * dpr));
        }
      } else if (currentStyle === "beat-surge") {
        // MODE 3: Dual Oscilloscope Waveform + Sub-Bass Floor Bars
        const bottomY = ch - 20 * dpr;
        const floorMaxH = ch * 0.34;
        ctx.fillStyle = `rgba(${palette.lowRgb[0]}, ${palette.lowRgb[1]}, ${palette.lowRgb[2]}, 0.32)`;
        ctx.beginPath();
        for (let c = 0; c < NUM_BARS; c++) {
          const val = Math.max(0.03, Math.min(1, smoothedBars[c]));
          const x = padX + c * slotW + gap * 0.5;
          const barH = val * floorMaxH;
          ctx.rect(x, bottomY - barH, barW, barH);
        }
        ctx.fill();

        // Time-domain Oscilloscope Trace
        ctx.beginPath();
        const sliceCount = Math.min(256, timeData.length || 256);
        for (let i = 0; i < sliceCount; i++) {
          const x = padX + (i / Math.max(1, sliceCount - 1)) * drawW;
          const sample = playing && timeData.length > 0 ? (timeData[i] - 128) / 128 : Math.sin(nowMs * 0.003 + i * 0.12) * 0.06;
          const y = centerY + sample * (ch * 0.36);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${palette.capRgb[0]}, ${palette.capRgb[1]}, ${palette.capRgb[2]}, 0.95)`;
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      } else {
        // MODE 1 (Default): Symmetrical Mirror Wave + Kinetic Embers
        if (playing && (transientKick > 0.44 || totalEnergy > 0.54)) {
          const barIdx = Math.floor(Math.random() * NUM_BARS);
          const val = smoothedBars[mirrorMap[barIdx]];
          if (val > 0.48) {
            for (let e = 0; e < MAX_EMBERS; e++) {
              if (!embers[e].active) {
                const upper = Math.random() > 0.35;
                const rgb = Math.random() > 0.4 ? palette.capRgb : palette.peakRgb;
                embers[e].active = true;
                embers[e].x = padX + barIdx * slotW + barW * 0.5;
                embers[e].y = upper
                  ? centerY - val * maxHalfH
                  : centerY + val * maxHalfH;
                embers[e].vx = (Math.random() - 0.5) * 0.75 * dpr;
                embers[e].vy =
                  (upper ? -1 : 1) *
                  (0.65 + Math.random() * 1.4 + transientKick * 1.1) *
                  dpr;
                embers[e].size = (1.3 + Math.random() * 1.6) * dpr;
                embers[e].alpha = 0.62 + Math.random() * 0.28;
                embers[e].r = rgb[0];
                embers[e].g = rgb[1];
                embers[e].b = rgb[2];
                break;
              }
            }
          }
        }

        for (let i = 0; i < MAX_EMBERS; i++) {
          const em = embers[i];
          if (!em.active) continue;
          em.x += em.vx * dtScale;
          em.y += em.vy * dtScale;
          em.alpha *= Math.pow(0.95, dtScale);
          if (em.alpha <= 0.03 || em.y < 0 || em.y > ch) {
            em.active = false;
            continue;
          }
          ctx.fillStyle = `rgba(${em.r}, ${em.g}, ${em.b}, ${em.alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(em.x, em.y, em.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        for (let c = 0; c < NUM_BARS; c++) {
          const val = Math.max(0.03, Math.min(1, smoothedBars[mirrorMap[c]]));
          const x = padX + c * slotW + gap * 0.5 + barW * 0.5;
          const y = centerY - val * maxHalfH;
          if (c === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevVal = Math.max(
              0.03,
              Math.min(1, smoothedBars[mirrorMap[c - 1]])
            );
            const prevX = padX + (c - 1) * slotW + gap * 0.5 + barW * 0.5;
            const prevY = centerY - prevVal * maxHalfH;
            ctx.quadraticCurveTo(prevX, prevY, (prevX + x) * 0.5, (prevY + y) * 0.5);
          }
        }
        ctx.strokeStyle = `rgba(${palette.capRgb[0]}, ${palette.capRgb[1]}, ${palette.capRgb[2]}, ${(0.28 + transientKick * 0.24).toFixed(3)})`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        ctx.fillStyle = cachedBarGrad;
        ctx.beginPath();
        const radius = Math.min(barW * 0.48, 4.5 * dpr);
        const hasRoundRect = typeof ctx.roundRect === "function";

        for (let c = 0; c < NUM_BARS; c++) {
          const val = Math.max(0.03, Math.min(1, smoothedBars[mirrorMap[c]]));
          const x = padX + c * slotW + gap * 0.5;
          const barTop = centerY - val * maxHalfH;
          const barH = Math.max(4 * dpr, val * (maxHalfH * 2));
          if (hasRoundRect) {
            ctx.roundRect(x, barTop, barW, barH, radius);
          } else {
            ctx.rect(x, barTop, barW, barH);
          }
        }
        ctx.fill();

        ctx.fillStyle = `rgba(${palette.capRgb[0]}, ${palette.capRgb[1]}, ${palette.capRgb[2]}, ${(0.1 + transientKick * 0.18).toFixed(3)})`;
        ctx.fillRect(padX, centerY - 0.5 * dpr, drawW, Math.max(1, dpr));
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, []);

  const boosterLabel =
    loudnessPercent >= 350
      ? "400% MAX"
      : loudnessPercent >= 230
      ? "250% HYPER"
      : loudnessPercent >= 175
      ? "200% BOOST"
      : "100% NORMAL";

  return (
    <div
      data-testid="bars-visualizer"
      data-visuals-enabled={visualsEnabled ? "true" : "false"}
      data-bar-style={barStyle}
      data-feeling-mood={feelingMood}
      className={`relative w-full overflow-hidden rounded-xl bg-[#0A0A0B]/90 backdrop-blur-md border border-white/[0.08] ${
        fullscreen ? "flex-1 min-h-[280px] h-full" : "h-48 sm:h-56"
      }`}
    >
      {/* Top Studio Readout & Display Mode Switcher */}
      {visualsEnabled && (
        <div className="absolute top-2 left-3 right-3 z-10 flex items-center justify-between gap-2 text-[10px] font-mono text-[#8A8A92] tabular-nums whitespace-nowrap">
          <div className="flex items-center gap-1.5 bg-[#0A0A0B]/75 backdrop-blur-xs px-2 py-0.5 rounded-md border border-white/[0.07] min-w-0 pointer-events-none">
            <span
              className="capitalize font-semibold truncate"
              style={{ color: accentColor }}
            >
              {feelingMood}
            </span>
            <span aria-hidden="true">·</span>
            <span>Slam {Math.round((beatImpact ?? 0.65) * 100)}%</span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span
              className={`hidden sm:inline ${
                loudnessPercent > 100
                  ? "text-amber-300 font-semibold"
                  : "text-[#8A8A92]"
              }`}
            >
              {boosterLabel}
            </span>
          </div>

          {onChangeBarStyle ? (
            <div
              role="group"
              aria-label="Analyzer display mode"
              className="inline-flex items-center gap-0.5 bg-[#0A0A0B]/85 backdrop-blur-xs p-0.5 rounded-lg border border-white/[0.08]"
            >
              {DISPLAY_MODES.map((m) => {
                const active = barStyle === m.id || (barStyle === "auto-feel" && m.id === "mirror-wave");
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`viz-mode-${m.id}`}
                    onClick={() => onChangeBarStyle(m.id)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-colors cursor-pointer ${
                      active
                        ? "bg-[#14B8A6] text-[#0A0A0B]"
                        : "text-[#8A8A92] hover:text-[#EDEDED]"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-[#0A0A0B]/75 backdrop-blur-xs px-2 py-0.5 rounded-md border border-white/[0.07] shrink-0 pointer-events-none">
              <span
                className={
                  loudnessPercent > 100
                    ? "text-amber-300 font-semibold"
                    : "text-[#8A8A92]"
                }
              >
                Booster {boosterLabel}
              </span>
            </div>
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        data-testid="frequency-bars-canvas"
        className={`w-full h-full block pointer-events-none transition-opacity duration-200 ${
          visualsEnabled ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Bottom Precision Frequency Axis */}
      {visualsEnabled && (
        <div className="absolute bottom-1.5 left-3.5 right-3.5 z-10 flex items-center justify-between text-[9px] font-mono text-[#8A8A92]/80 tabular-nums select-none whitespace-nowrap pointer-events-none">
          <span>32 Hz</span>
          <span className="hidden sm:inline">64 Hz</span>
          <span>125 Hz</span>
          <span className="hidden sm:inline">250 Hz</span>
          <span>500 Hz</span>
          <span className="hidden sm:inline">1 kHz</span>
          <span>2.2 kHz</span>
          <span className="hidden sm:inline">4.5 kHz</span>
          <span>9.5 kHz</span>
          <span>16 kHz</span>
        </div>
      )}
    </div>
  );
}

const Visualizer = memo(VisualizerComponent);
export default Visualizer;
