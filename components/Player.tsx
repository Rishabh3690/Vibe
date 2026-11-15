"use client";

import React, { memo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  AudioLines,
  ArrowLeftRight,
  Zap,
  BarChart2,
  Maximize2,
  Minimize2,
  ListMusic,
  X,
} from "lucide-react";
import {
  ABRepeatState,
  EnhancementSettings,
  PlaybackSpeed,
  Track,
} from "../lib/types";
import { formatTimestamp } from "../lib/format";
import SeekBar from "./SeekBar";

interface PlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackSpeed: PlaybackSpeed;
  loopTrack: boolean;
  abRepeat: ABRepeatState;
  enhancement: EnhancementSettings;
  visualsEnabled: boolean;
  isFullscreenVibe?: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeChange: (v: number) => void;
  onPlaybackSpeedChange: (speed: PlaybackSpeed) => void;
  onToggleLoop: () => void;
  onSetLoopA?: () => void;
  onSetLoopB?: () => void;
  onClearLoop?: () => void;
  onLoopPeakDrop?: () => void;
  onToggleAbOriginal: () => void;
  onToggleLoudness200: () => void;
  onToggleBars: () => void;
  onToggleFullscreenVibe?: () => void;
  onOpenMusicDrawer?: () => void;
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.75, 1, 1.25, 1.5, 2];

function PlayerComponent({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  playbackSpeed,
  loopTrack,
  abRepeat,
  enhancement,
  visualsEnabled,
  isFullscreenVibe = false,
  onTogglePlay,
  onSeek,
  onPrev,
  onNext,
  onVolumeChange,
  onPlaybackSpeedChange,
  onToggleLoop,
  onSetLoopA,
  onSetLoopB,
  onClearLoop,
  onLoopPeakDrop,
  onToggleAbOriginal,
  onToggleLoudness200,
  onToggleBars,
  onToggleFullscreenVibe,
  onOpenMusicDrawer,
}: PlayerProps) {
  const safeDuration = Math.max(0, duration || currentTrack?.duration || 0);
  const safeCurrent = Math.min(safeDuration, Math.max(0, currentTime));
  const title =
    currentTrack?.metadata?.title || currentTrack?.name || "No song selected";
  const artist = currentTrack?.metadata?.artist;
  const loudnessPct = Math.round(enhancement.loudnessPercent ?? 100);
  const isBoostActive =
    loudnessPct > 100 && enhancement.enabled && !enhancement.abBypassOriginal;
  const feelingColor = currentTrack?.analysis.feelingColor || "#14B8A6";

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackSpeed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    onPlaybackSpeedChange(next);
  };

  const hasLoopA = abRepeat.a !== null;
  const hasActiveAbLoop = abRepeat.active && abRepeat.a !== null && abRepeat.b !== null;

  return (
    <footer
      aria-label="Audio transport controls"
      className="bg-[#0A0A0B]/95 backdrop-blur-md border-t border-white/[0.08] px-4 py-2.5 shrink-0 z-20"
    >
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center gap-2.5 md:gap-5">
        {/* Left: Active Song Identity (1-Tap opens Songs & Playlists Drawer) */}
        <div className="flex items-center justify-between md:justify-start gap-2.5 md:w-64 shrink-0 min-w-0">
          <button
            type="button"
            onClick={onOpenMusicDrawer}
            data-testid="footer-music-drawer-btn"
            title="Tap to open Songs, Playlists & Up Next Queue"
            className="flex items-center gap-2.5 min-w-0 text-left group hover:bg-white/[0.04] rounded-lg p-1 -m-1 transition-colors flex-1 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-[#141416] border border-white/[0.08] group-hover:border-[#14B8A6]/40 overflow-hidden flex items-center justify-center shrink-0 transition-colors">
              {currentTrack?.metadata?.coverArtDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentTrack.metadata.coverArtDataUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <AudioLines className="w-4 h-4 text-[#14B8A6]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#EDEDED] group-hover:text-[#14B8A6] truncate transition-colors">
                {title}
              </p>
              <p className="text-[11px] text-[#8A8A92] truncate tabular-nums">
                {artist ||
                  (currentTrack
                    ? `${currentTrack.analysis.bpm} BPM · ${currentTrack.analysis.lufs} LUFS`
                    : "Tap to browse or load audio")}
              </p>
            </div>
          </button>

          {/* Mobile quick Songs Drawer + Play buttons */}
          <div className="md:hidden flex items-center gap-1.5 shrink-0">
            {onOpenMusicDrawer && (
              <button
                type="button"
                onClick={onOpenMusicDrawer}
                aria-label="Open Songs and Playlists"
                className="w-9 h-9 rounded-lg bg-[#141416] border border-white/[0.1] text-[#EDEDED] hover:border-[#14B8A6]/40 flex items-center justify-center cursor-pointer"
              >
                <ListMusic className="w-4 h-4 text-[#14B8A6]" />
              </button>
            )}
            <button
              type="button"
              disabled={!currentTrack}
              onClick={onTogglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="w-9 h-9 rounded-full bg-[#14B8A6] text-[#0A0A0B] flex items-center justify-center disabled:opacity-40 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Center: Main Transport + Dynamic Waveform Seekbar + A-B Phrase Looper */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={!currentTrack}
                onClick={onPrev}
                aria-label="Previous song"
                className="p-1.5 text-[#8A8A92] hover:text-[#EDEDED] rounded-lg disabled:opacity-35 cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={!currentTrack}
                onClick={onTogglePlay}
                aria-label={isPlaying ? "Pause playback" : "Start playback"}
                className="w-8 h-8 rounded-full bg-[#14B8A6] text-[#0A0A0B] flex items-center justify-center hover:opacity-90 disabled:opacity-35 cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                disabled={!currentTrack}
                onClick={onNext}
                aria-label="Next song"
                className="p-1.5 text-[#8A8A92] hover:text-[#EDEDED] rounded-lg disabled:opacity-35 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={!currentTrack}
                onClick={onToggleLoop}
                aria-label="Toggle track repeat"
                title="Repeat full track"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  loopTrack
                    ? "text-[#14B8A6] bg-[#14B8A6]/15"
                    : "text-[#8A8A92] hover:text-[#EDEDED]"
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>

            <span className="text-[11px] font-mono text-[#8A8A92] tabular-nums w-10 text-right shrink-0">
              {formatTimestamp(safeCurrent)}
            </span>

            <SeekBar
              currentTime={safeCurrent}
              duration={safeDuration}
              abRepeat={abRepeat}
              loudnessCurve={currentTrack?.analysis.loudnessCurve}
              sections={currentTrack?.analysis.sections}
              peakDropTimeSec={currentTrack?.analysis.peakDropTimeSec}
              accentColor={feelingColor}
              disabled={!currentTrack}
              onSeek={onSeek}
            />

            <span className="text-[11px] font-mono text-[#8A8A92] tabular-nums w-10 shrink-0">
              {formatTimestamp(safeDuration)}
            </span>
          </div>
        </div>

        {/* Right: A-B Loop Deck, Speed, 4-Level Booster, A/B Compare, Bars, Fullscreen & Volume */}
        <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Hardware A-B Phrase & Drop Loop Controls */}
            {currentTrack && (
              <div
                role="group"
                aria-label="A-B Phrase Loop Controls"
                data-testid="ab-loop-controls"
                className="inline-flex items-center gap-0.5 bg-[#141416] border border-white/[0.08] rounded-lg p-0.5"
              >
                <button
                  type="button"
                  data-testid="ab-set-a-btn"
                  onClick={onSetLoopA}
                  title="Set Loop Start Point A at current time (Shortcut: [)"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                    hasLoopA
                      ? "bg-amber-400 text-[#0A0A0B]"
                      : "text-[#8A8A92] hover:text-[#EDEDED]"
                  }`}
                >
                  {hasLoopA ? `[A ${formatTimestamp(abRepeat.a!)}` : "[ A"}
                </button>
                <button
                  type="button"
                  data-testid="ab-set-b-btn"
                  onClick={onSetLoopB}
                  title="Set Loop End Point B at current time (Shortcut: ])"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                    hasActiveAbLoop
                      ? "bg-amber-400 text-[#0A0A0B]"
                      : "text-[#8A8A92] hover:text-[#EDEDED]"
                  }`}
                >
                  {hasActiveAbLoop ? `${formatTimestamp(abRepeat.b!)} B]` : "B ]"}
                </button>
                {onLoopPeakDrop && !hasActiveAbLoop && (
                  <button
                    type="button"
                    data-testid="ab-loop-drop-btn"
                    onClick={onLoopPeakDrop}
                    title="Auto-loop the 16-second Peak Drop section"
                    className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-amber-300 hover:bg-amber-400/15 transition-colors cursor-pointer"
                  >
                    Loop Drop
                  </button>
                )}
                {(hasLoopA || hasActiveAbLoop) && onClearLoop && (
                  <button
                    type="button"
                    data-testid="ab-clear-btn"
                    onClick={onClearLoop}
                    title="Clear A-B Loop (Shortcut: \)"
                    aria-label="Clear A-B Loop"
                    className="p-0.5 rounded text-amber-300 hover:bg-white/[0.08] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={cycleSpeed}
              title="Cycle playback speed"
              className="px-2 py-1 text-[11px] font-mono text-[#EDEDED] bg-[#141416] border border-white/[0.08] rounded-lg hover:border-white/[0.2] tabular-nums whitespace-nowrap cursor-pointer"
            >
              {playbackSpeed}×
            </button>

            <button
              type="button"
              data-testid="footer-booster-cycle-btn"
              onClick={onToggleLoudness200}
              title="Cycle 4-Level Audio Booster (100% Normal → 200% Boost → 250% Hyper → 400% Max)"
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                isBoostActive
                  ? "bg-amber-400 text-[#0A0A0B] border-amber-400"
                  : "bg-[#141416] text-[#EDEDED] border-white/[0.08] hover:border-amber-400/50"
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>{loudnessPct}%</span>
            </button>

            <button
              type="button"
              onClick={onToggleAbOriginal}
              title="Compare Enhanced vs Original audio (Shortcut: B)"
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                enhancement.abBypassOriginal
                  ? "bg-amber-400 text-[#0A0A0B] border-amber-400 font-semibold"
                  : "bg-[#141416] text-[#EDEDED] border-white/[0.08] hover:border-white/[0.2]"
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span className="hidden lg:inline">
                {enhancement.abBypassOriginal ? "Original" : "Enhanced"}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleBars}
              title="Toggle frequency analyzer (Shortcut: V)"
              aria-label="Toggle frequency bars"
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                visualsEnabled
                  ? "text-[#14B8A6] border-[#14B8A6]/40 bg-[#14B8A6]/10"
                  : "text-[#8A8A92] border-white/[0.08] bg-[#141416]"
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              <span>Spectrum</span>
            </button>

            {onToggleFullscreenVibe && currentTrack && (
              <button
                type="button"
                data-testid="footer-fullscreen-btn"
                onClick={onToggleFullscreenVibe}
                title="Toggle Distraction-Free Fullscreen Vibe Mode (Shortcut: F)"
                aria-label="Toggle Fullscreen Vibe Mode"
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  isFullscreenVibe
                    ? "text-[#14B8A6] border-[#14B8A6] bg-[#14B8A6]/15 font-semibold"
                    : "text-[#EDEDED] border-white/[0.08] bg-[#141416] hover:border-[#14B8A6]/50"
                }`}
              >
                {isFullscreenVibe ? (
                  <Minimize2 className="w-3 h-3" />
                ) : (
                  <Maximize2 className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">
                  {isFullscreenVibe ? "Exit Zen" : "Zen"}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 pl-1 border-l border-white/[0.08]">
            <button
              type="button"
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.9)}
              aria-label={volume === 0 ? "Unmute" : "Mute"}
              className="p-1 text-[#8A8A92] hover:text-[#EDEDED] cursor-pointer"
            >
              {volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              aria-label="Master volume"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-20 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}

const Player = memo(PlayerComponent);
export default Player;
