"use client";

import React, { useMemo, useState } from "react";
import { ABRepeatState, TrackSection } from "../lib/types";
import { formatTimestamp } from "../lib/format";

interface SeekBarProps {
  currentTime: number;
  duration: number;
  abRepeat?: ABRepeatState;
  loudnessCurve?: number[];
  sections?: TrackSection[];
  peakDropTimeSec?: number;
  accentColor?: string;
  disabled?: boolean;
  onSeek: (seconds: number) => void;
}

const NUM_WAVE_BARS = 56;

export function interpolateWaveformBars(
  loudnessCurve?: number[],
  barCount = NUM_WAVE_BARS
): number[] {
  if (!loudnessCurve || loudnessCurve.length === 0) {
    return Array.from({ length: barCount }, (_, i) => {
      const norm = i / Math.max(1, barCount - 1);
      const env = Math.sin(norm * Math.PI);
      const ripple = 0.5 + 0.5 * Math.sin(i * 0.65) * Math.cos(i * 0.23);
      return Number(Math.max(0.18, Math.min(0.95, 0.25 + env * 0.45 + ripple * 0.25)).toFixed(3));
    });
  }

  const dbMin = -36;
  const dbMax = -5;
  const normalizedSrc = loudnessCurve.map((db) =>
    Math.max(0.16, Math.min(1, (db - dbMin) / (dbMax - dbMin)))
  );

  const out: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const pos = (i / Math.max(1, barCount - 1)) * (normalizedSrc.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(normalizedSrc.length - 1, lo + 1);
    const frac = pos - lo;
    const val = normalizedSrc[lo] * (1 - frac) + normalizedSrc[hi] * frac;
    out.push(Number(Math.max(0.16, Math.min(1, val)).toFixed(3)));
  }
  return out;
}

export default function SeekBar({
  currentTime,
  duration,
  abRepeat,
  loudnessCurve,
  sections = [],
  peakDropTimeSec,
  accentColor = "#14B8A6",
  disabled = false,
  onSeek,
}: SeekBarProps) {
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const safeDuration = Math.max(0, duration || 0);
  const safeCurrent = Math.min(safeDuration, Math.max(0, currentTime));
  const progressPct =
    safeDuration > 0 ? Math.min(100, (safeCurrent / safeDuration) * 100) : 0;

  const aPct =
    safeDuration > 0 && abRepeat && abRepeat.a !== null
      ? Math.max(0, Math.min(100, (abRepeat.a / safeDuration) * 100))
      : null;
  const bPct =
    safeDuration > 0 && abRepeat && abRepeat.b !== null
      ? Math.max(0, Math.min(100, (abRepeat.b / safeDuration) * 100))
      : null;

  const dropPct =
    safeDuration > 0 &&
    typeof peakDropTimeSec === "number" &&
    peakDropTimeSec > 0 &&
    peakDropTimeSec < safeDuration
      ? Math.max(2, Math.min(98, (peakDropTimeSec / safeDuration) * 100))
      : null;

  const waveBars = useMemo(
    () => interpolateWaveformBars(loudnessCurve, NUM_WAVE_BARS),
    [loudnessCurve]
  );

  const hoverTimeSec =
    hoverRatio !== null && safeDuration > 0 ? hoverRatio * safeDuration : null;
  const hoveredSection = useMemo(() => {
    if (hoverTimeSec === null || sections.length === 0) return null;
    return (
      sections.find(
        (s) => hoverTimeSec >= s.start && hoverTimeSec <= s.end
      ) || null
    );
  }, [hoverTimeSec, sections]);

  return (
    <div
      data-testid="seekbar-container"
      onMouseMove={(e) => {
        if (disabled || safeDuration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
        );
        setHoverRatio(ratio);
      }}
      onMouseLeave={() => setHoverRatio(null)}
      className="relative flex-1 flex items-center h-8 select-none group"
    >
      {/* Hover Time & Section Scrubbing Readout Tooltip */}
      {hoverTimeSec !== null && hoverRatio !== null && !disabled && (
        <div
          aria-hidden="true"
          style={{ left: `${Math.max(6, Math.min(94, hoverRatio * 100))}%` }}
          className="absolute -top-7 -translate-x-1/2 z-30 pointer-events-none px-2 py-0.5 rounded-md bg-[#0A0A0B] border border-white/[0.15] text-[10px] font-mono text-[#EDEDED] whitespace-nowrap shadow-lg tabular-nums"
        >
          <span>{formatTimestamp(hoverTimeSec)}</span>
          {hoveredSection && (
            <span className="text-[#14B8A6] uppercase ml-1.5 font-semibold">
              · {hoveredSection.label}
            </span>
          )}
        </div>
      )}

      {/* Dynamic 56-Bar Loudness Envelope Waveform */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 inset-y-1 flex items-center justify-between gap-[2px] pointer-events-none z-0 px-0.5"
      >
        {waveBars.map((amp, idx) => {
          const barPct = ((idx + 0.5) / waveBars.length) * 100;
          const isPlayed = barPct <= progressPct;
          const isHovered =
            hoverRatio !== null && barPct <= hoverRatio * 100;
          const inAbLoop =
            aPct !== null &&
            bPct !== null &&
            barPct >= Math.min(aPct, bPct) &&
            barPct <= Math.max(aPct, bPct);

          let barColor = "rgba(255, 255, 255, 0.14)";
          if (inAbLoop) {
            barColor = isPlayed ? "#FBBF24" : "rgba(251, 191, 36, 0.45)";
          } else if (isPlayed) {
            barColor = accentColor;
          } else if (isHovered) {
            barColor = "rgba(255, 255, 255, 0.32)";
          }

          return (
            <span
              key={idx}
              className="flex-1 rounded-full transition-colors duration-75"
              style={{
                height: `${Math.max(18, Math.round(amp * 92))}%`,
                backgroundColor: barColor,
              }}
            />
          );
        })}
      </div>

      {/* A–B Loop Shaded Window & Bracket Pins */}
      {aPct !== null && (
        <div
          aria-hidden="true"
          style={{ left: `${aPct}%` }}
          className="absolute top-0.5 bottom-0.5 w-0.5 bg-amber-400 z-10 pointer-events-none"
        >
          <span className="absolute -top-1 -left-1 px-1 rounded-xs bg-amber-400 text-[#0A0A0B] text-[8px] font-mono font-bold leading-tight">
            A
          </span>
        </div>
      )}

      {aPct !== null && bPct !== null && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-y-1 rounded-sm pointer-events-none z-10 bg-amber-400/15 border-x border-amber-400/70"
            style={{
              left: `${Math.min(aPct, bPct)}%`,
              width: `${Math.max(0.8, Math.abs(bPct - aPct))}%`,
            }}
          />
          <div
            aria-hidden="true"
            style={{ left: `${bPct}%` }}
            className="absolute top-0.5 bottom-0.5 w-0.5 bg-amber-400 z-10 pointer-events-none"
          >
            <span className="absolute -top-1 -left-1 px-1 rounded-xs bg-amber-400 text-[#0A0A0B] text-[8px] font-mono font-bold leading-tight">
              B
            </span>
          </div>
        </>
      )}

      {/* Peak Drop Marker Pin */}
      {dropPct !== null && (
        <div
          aria-hidden="true"
          title={`Peak Drop (${formatTimestamp(peakDropTimeSec!)})`}
          style={{ left: `${dropPct}%` }}
          className="absolute bottom-0 w-1 h-1.5 rounded-full bg-amber-400/80 z-10 pointer-events-none"
        />
      )}

      {/* Playhead Vertical Cursor Needle */}
      {!disabled && safeDuration > 0 && (
        <div
          aria-hidden="true"
          style={{ left: `${progressPct}%` }}
          className="absolute top-0.5 bottom-0.5 w-[2px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] z-10 pointer-events-none"
        />
      )}

      {/* Invisible Full-Area Range Input for Native Keyboard & Drag Scrubbing */}
      <input
        type="range"
        aria-label="Seek song position"
        min={0}
        max={safeDuration || 100}
        step={0.1}
        disabled={disabled}
        value={safeCurrent}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="seekbar-overlay relative z-20 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}
