"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Play,
  Pause,
  AlertTriangle,
  Volume2,
  Youtube,
  ExternalLink,
  Maximize2,
  Minimize2,
  Flame,
  BookmarkCheck,
  Sliders,
  ListMusic,
  Repeat,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { usePlayer } from "../hooks/usePlayer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { BoosterLevel, PresetName } from "../lib/types";
import { BOOSTER_LEVEL_INFO } from "../lib/dsp";
import { PRESET_CONFIGS, PRESET_LIST } from "../lib/presets";
import ErrorBoundary from "../components/ErrorBoundary";
import TopBar from "../components/TopBar";
import { MobileTabBar } from "../components/TabBar";
import Uploader, { useAudioUploadHandler } from "../components/Uploader";
import QueuePlaylistPanel from "../components/QueuePlaylistPanel";
import MobileMusicDrawer from "../components/MobileMusicDrawer";
import Player from "../components/Player";
import ToastContainer from "../components/Toast";

const Visualizer = dynamic(() => import("../components/Visualizer"), {
  ssr: false,
});

const Library = dynamic(() => import("../components/Library"), {
  loading: () => (
    <div className="h-64 rounded-2xl bg-[#121215]/70 border border-white/[0.06] animate-pulse" />
  ),
});

const EnhancementPanel = dynamic(
  () => import("../components/EnhancementPanel"),
  {
    loading: () => (
      <div className="h-56 rounded-2xl bg-[#121215]/70 border border-white/[0.06] animate-pulse" />
    ),
  }
);

const SongAnalysisPanel = dynamic(
  () => import("../components/SongAnalysisPanel"),
  {
    loading: () => (
      <div className="h-44 rounded-2xl bg-[#121215]/70 border border-white/[0.06] animate-pulse" />
    ),
  }
);

const EditMetadataModal = dynamic(
  () => import("../components/EditMetadataModal"),
  { ssr: false }
);

export default function HomePage() {
  const hydrateFromDB = useStore((s) => s.hydrateFromDB);
  const tracks = useStore((s) => s.tracks);
  const activeView = useStore((s) => s.activeView);
  const storageUnavailable = useStore((s) => s.storageUnavailable);
  const autoplayBlocked = useStore((s) => s.autoplayBlocked);
  const setAutoplayBlocked = useStore((s) => s.setAutoplayBlocked);
  const setEditingTrackId = useStore((s) => s.setEditingTrackId);
  const addToast = useStore((s) => s.addToast);

  const [isMusicDrawerOpen, setIsMusicDrawerOpen] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const globalUploadRef = useRef<HTMLInputElement | null>(null);

  const player = usePlayer();
  const { processFiles } = useAudioUploadHandler();

  useEffect(() => {
    void hydrateFromDB();
  }, [hydrateFromDB]);

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (
        reason &&
        typeof reason === "object" &&
        "name" in reason &&
        (reason as { name?: string }).name === "AbortError"
      ) {
        return;
      }
      addToast("An unexpected background action failed.", "error", 3200);
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () =>
      window.removeEventListener("unhandledrejection", handleRejection);
  }, [addToast]);

  const triggerGlobalUpload = useCallback(() => {
    if (uploadInputRef.current) {
      uploadInputRef.current.click();
    } else {
      globalUploadRef.current?.click();
    }
  }, []);

  const handleGlobalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void processFiles(files);
    }
    e.target.value = "";
  };

  const handleSeekRelative = useCallback(
    (deltaSec: number) => {
      if (!player.currentTrack) return;
      const cur = player.getCurrentTime();
      const maxDur = player.duration || player.currentTrack.duration || 0;
      const next = Math.max(0, Math.min(maxDur, cur + deltaSec));
      player.seek(next);
    },
    [player]
  );

  const handleVolumeRelative = useCallback(
    (deltaVol: number) => {
      const next = Math.max(
        0,
        Math.min(1, Number((player.volume + deltaVol).toFixed(2)))
      );
      player.setVolume(next);
    },
    [player]
  );

  const handleEscape = useCallback(() => {
    setEditingTrackId(null);
    setIsMusicDrawerOpen(false);
    if (player.isFullscreenVibe) {
      player.setFullscreenVibe(false);
    }
  }, [player, setEditingTrackId]);

  const handleSetLoopA = useCallback(() => {
    if (!player.currentTrack) return;
    player.setABPointA(player.getCurrentTime());
  }, [player]);

  const handleSetLoopB = useCallback(() => {
    if (!player.currentTrack) return;
    player.setABPointB(player.getCurrentTime());
  }, [player]);

  useKeyboardShortcuts({
    onTogglePlay: player.togglePlay,
    onSeekRelative: handleSeekRelative,
    onVolumeRelative: handleVolumeRelative,
    onNext: player.playNextTrack,
    onPrev: player.playPrevTrack,
    onToggleBars: () => void player.setVisualsEnabled(!player.visualsEnabled),
    onToggleAbOriginal: player.toggleAbOriginal,
    onToggleFullscreen: player.toggleFullscreenVibe,
    onSetLoopA: handleSetLoopA,
    onSetLoopB: handleSetLoopB,
    onClearLoop: player.clearABRepeat,
    onEscape: handleEscape,
  });

  const handleJumpToPeakDrop = useCallback(
    (seconds: number) => {
      player.seek(seconds);
      if (!player.isPlaying) {
        player.togglePlay();
      }
      addToast("Jumped to song Peak Drop!", "info", 2000);
    },
    [addToast, player]
  );

  const handleLoopPeakDrop = useCallback(() => {
    if (!player.currentTrack) return;
    const dropStart = Math.max(
      0,
      player.currentTrack.analysis.peakDropTimeSec ?? 30
    );
    const maxDur = player.duration || player.currentTrack.duration || 180;
    const dropEnd = Math.min(maxDur, dropStart + 16);
    if (dropEnd > dropStart + 1) {
      player.loopSection(dropStart, dropEnd, "PEAK DROP");
    }
  }, [player]);

  const activeTrack = player.currentTrack;
  const heroTitle = activeTrack?.metadata?.title || activeTrack?.name || "";
  const heroArtist = activeTrack?.metadata?.artist;
  const heroCover = activeTrack?.metadata?.coverArtDataUrl;
  const feelingColor = activeTrack?.analysis.feelingColor || "#14B8A6";
  const feelingMood = activeTrack?.analysis.feelingMood || "euphoric";
  const loudnessPct = Math.round(player.enhancement?.loudnessPercent ?? 100);
  const beatImpact = player.enhancement?.beatImpact ?? 0.65;
  const activePreset = player.enhancement?.preset || "auto";
  const activePresetLabel =
    PRESET_CONFIGS[activePreset]?.label || "Smart Auto-Master";
  const hasSavedRackOnSong = Boolean(activeTrack?.customEnhancement);

  return (
    <ErrorBoundary scopeName="Vibe App">
      <div className="h-dvh flex flex-col bg-[#0A0A0B] text-[#EDEDED] overflow-hidden">
        <input
          ref={globalUploadRef}
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus,.webm"
          multiple
          onChange={handleGlobalFileChange}
          className="sr-only"
          aria-label="Upload audio song"
        />

        {!player.isFullscreenVibe && (
          <TopBar
            onTriggerUpload={triggerGlobalUpload}
            onOpenMusicDrawer={() => setIsMusicDrawerOpen(true)}
          />
        )}

        {storageUnavailable && !player.isFullscreenVibe && (
          <div
            role="alert"
            className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs flex items-center justify-center gap-2 shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Browser storage is unavailable — uploaded tracks cannot persist
              across reloads.
            </span>
          </div>
        )}

        <main className="flex-1 min-h-0 max-w-[1440px] w-full mx-auto px-3 sm:px-5 py-3 sm:py-4 overflow-y-auto flex flex-col">
          {/* DISTRACTION-FREE FULLSCREEN VIBE STAGE */}
          {player.isFullscreenVibe && activeTrack ? (
            <ErrorBoundary scopeName="Fullscreen Vibe">
              <div
                data-testid="fullscreen-vibe-view"
                className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4"
              >
                {/* Left/Center: Giant Visualizer Stage */}
                <section
                  aria-label="Fullscreen Vibe Stage"
                  className="lg:col-span-8 rounded-2xl bg-[#121215]/85 backdrop-blur-xl border border-white/[0.08] p-3.5 sm:p-4 flex flex-col gap-3 min-h-[340px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={player.togglePlay}
                        className="w-11 h-11 rounded-xl bg-[#14B8A6] text-[#0A0A0B] flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        {player.isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <h1 className="text-base sm:text-lg font-bold text-[#EDEDED] truncate">
                          {heroTitle}
                        </h1>
                        <p className="text-[11px] font-mono text-[#8A8A92] tabular-nums">
                          {feelingMood} · {activeTrack.analysis.bpm} BPM ·
                          Booster {loudnessPct}% · {activePresetLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="fullscreen-music-drawer-btn"
                        onClick={() => setIsMusicDrawerOpen(true)}
                        className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/50 cursor-pointer"
                      >
                        <ListMusic className="w-3.5 h-3.5" />
                        <span>Library ({tracks.length})</span>
                      </button>

                      {/* Studio Mastering Rack Selector + Permanent Per-Song Save */}
                      <div className="inline-flex items-center gap-1.5 bg-[#0A0A0B]/90 border border-white/[0.1] rounded-lg px-2 py-1 min-h-[38px]">
                        <Sliders className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                        <select
                          aria-label="Select Studio Mastering Rack"
                          data-testid="fullscreen-preset-select"
                          value={activePreset}
                          onChange={(e) => {
                            const nextPreset = e.target.value as PresetName;
                            player.selectEnhancementPreset(nextPreset);
                          }}
                          className="bg-transparent text-[11px] font-medium text-[#EDEDED] focus:outline-none cursor-pointer"
                        >
                          {PRESET_LIST.map((presetId) => (
                            <option
                              key={presetId}
                              value={presetId}
                              className="bg-[#121215] text-[#EDEDED]"
                            >
                              {PRESET_CONFIGS[presetId].label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          data-testid="fullscreen-save-rack-btn"
                          onClick={() =>
                            void player.saveTrackEnhancement(
                              activeTrack.id,
                              activePreset
                            )
                          }
                          title="Make this Studio Mastering Rack permanent for this song"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                            hasSavedRackOnSong
                              ? "bg-[#14B8A6] text-[#0A0A0B]"
                              : "bg-white/[0.08] text-[#EDEDED] hover:bg-[#14B8A6] hover:text-[#0A0A0B]"
                          }`}
                        >
                          <BookmarkCheck className="w-3 h-3" />
                          <span>
                            {hasSavedRackOnSong ? "Rack Locked" : "Lock Rack"}
                          </span>
                        </button>
                      </div>

                      {/* Quick 4-Level Booster Selector inside Fullscreen */}
                      <div
                        role="group"
                        aria-label="Fullscreen 4-Level Audio Booster"
                        className="inline-flex items-center gap-1 bg-[#0A0A0B]/90 border border-white/[0.08] rounded-lg p-0.5"
                      >
                        {BOOSTER_LEVEL_INFO.map((b) => {
                          const active = Math.abs(loudnessPct - b.level) <= 8;
                          return (
                            <button
                              key={b.level}
                              type="button"
                              onClick={() =>
                                player.setLoudnessBoosterLevel(
                                  b.level as BoosterLevel
                                )
                              }
                              className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                                active
                                  ? b.level === 100
                                    ? "bg-[#14B8A6] text-[#0A0A0B]"
                                    : "bg-amber-400 text-[#0A0A0B]"
                                  : "text-[#8A8A92] hover:text-[#EDEDED]"
                              }`}
                            >
                              {b.badge}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        data-testid="exit-fullscreen-vibe-btn"
                        onClick={() => player.setFullscreenVibe(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.12] hover:border-[#14B8A6] transition-colors cursor-pointer"
                      >
                        <Minimize2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                        <span>Exit Stage</span>
                      </button>
                    </div>
                  </div>

                  <Visualizer
                    getAnalyserNode={player.getAnalyserNode}
                    getVisualizerLevels={player.getVisualizerLevels}
                    getCurrentTime={player.getCurrentTime}
                    beatTimestamps={activeTrack.analysis.beatTimestamps}
                    accentColor={feelingColor}
                    feelingMood={feelingMood}
                    barStyle={player.barStyle}
                    onChangeBarStyle={(style) => void player.setBarStyle(style)}
                    loudnessPercent={loudnessPct}
                    beatImpact={beatImpact}
                    crossfadeDuration={0.55}
                    visualsEnabled={player.visualsEnabled}
                    isPlaying={player.isPlaying}
                    fullscreen={true}
                  />
                </section>

                {/* Right: Distraction-Free Playlist & Up Next Queue Panel */}
                <aside
                  aria-label="Fullscreen Playlist and Queue"
                  className="lg:col-span-4 min-h-0 flex flex-col"
                >
                  <QueuePlaylistPanel compact={true} />
                </aside>
              </div>
            </ErrorBoundary>
          ) : activeView === "tracks" ? (
            <ErrorBoundary scopeName="Tracks">
              <Library uploadInputRef={uploadInputRef} />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary scopeName="Player">
              {!activeTrack || tracks.length === 0 ? (
                <div className="min-h-full flex items-center justify-center py-6">
                  <div className="w-full max-w-2xl">
                    <Uploader uploadInputRef={uploadInputRef} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Now Playing Stage + Multi-Mode 60fps Spectrum Stage */}
                  <section
                    aria-label="Now Playing Stage"
                    className="relative rounded-2xl bg-[#121215]/85 backdrop-blur-xl border border-white/[0.08] p-4 sm:p-5 flex flex-col gap-4 overflow-hidden transition-all duration-150"
                  >
                    {autoplayBlocked && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                        <button
                          type="button"
                          onClick={async () => {
                            await player.resumeAudioContext();
                            setAutoplayBlocked(false);
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0A0A0B] bg-[#14B8A6] shadow-xl hover:opacity-90 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Tap to enable audio</span>
                        </button>
                      </div>
                    )}

                    {/* Top Row: Telemetry Readout + Peak Drop + Loop Drop + Studio Rack Lock + Zen Stage */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8A8A92] tabular-nums">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="font-semibold capitalize"
                          style={{ color: feelingColor }}
                        >
                          {feelingMood}
                        </span>
                        <span>·</span>
                        <span>{activeTrack.analysis.bpm} BPM</span>
                        <span>·</span>
                        <span>{activeTrack.analysis.lufs} LUFS</span>
                        <span>·</span>
                        <span>{loudnessPct}% output</span>
                        <span className="hidden sm:inline">·</span>
                        <span className="hidden sm:inline text-[#D4D4D8]">
                          32-Bit Float DSP
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          data-testid="stage-peak-drop-btn"
                          onClick={() =>
                            handleJumpToPeakDrop(
                              activeTrack.analysis.peakDropTimeSec ?? 30
                            )
                          }
                          title="Jump straight to the song's Peak Drop"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-sans font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/30 hover:bg-amber-400/20 transition-colors cursor-pointer"
                        >
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>Peak Drop</span>
                        </button>

                        <button
                          type="button"
                          data-testid="stage-loop-drop-btn"
                          onClick={() => {
                            if (player.abRepeat.active) {
                              player.clearABRepeat();
                            } else {
                              handleLoopPeakDrop();
                            }
                          }}
                          title="Toggle 16-second A–B loop around the Peak Drop"
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-sans font-semibold border transition-colors cursor-pointer ${
                            player.abRepeat.active
                              ? "bg-amber-400 text-[#0A0A0B] border-amber-400"
                              : "bg-[#0A0A0B] text-[#EDEDED] border-white/[0.12] hover:border-amber-400/50"
                          }`}
                        >
                          <Repeat className="w-3 h-3" />
                          <span>
                            {player.abRepeat.active ? "Stop Loop" : "Loop Drop"}
                          </span>
                        </button>

                        <button
                          type="button"
                          data-testid="stage-music-drawer-btn"
                          onClick={() => setIsMusicDrawerOpen(true)}
                          title="Open Songs, Playlists & Queue"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-sans font-semibold text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.12] hover:border-[#14B8A6] transition-colors cursor-pointer"
                        >
                          <ListMusic className="w-3 h-3 text-[#14B8A6]" />
                          <span>Queue &amp; Playlists</span>
                        </button>

                        <button
                          type="button"
                          data-testid="stage-save-rack-btn"
                          onClick={() =>
                            void player.saveTrackEnhancement(activeTrack.id)
                          }
                          title="Make current Studio Mastering Rack & EQ configuration permanent for this song"
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-sans font-semibold border transition-colors cursor-pointer ${
                            hasSavedRackOnSong
                              ? "bg-[#14B8A6]/20 text-[#14B8A6] border-[#14B8A6]"
                              : "bg-[#0A0A0B] text-[#EDEDED] border-white/[0.12] hover:border-[#14B8A6]"
                          }`}
                        >
                          <BookmarkCheck className="w-3 h-3 text-[#14B8A6]" />
                          <span>
                            {hasSavedRackOnSong
                              ? `Rack Locked (${activePresetLabel})`
                              : "Lock Studio Rack"}
                          </span>
                        </button>

                        <button
                          type="button"
                          data-testid="stage-fullscreen-vibe-btn"
                          onClick={() => player.setFullscreenVibe(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-sans font-semibold text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.12] hover:border-[#14B8A6] transition-colors cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3 text-[#14B8A6]" />
                          <span>Zen Stage</span>
                        </button>

                        {activeTrack.metadata?.youtubeUrl && (
                          <a
                            href={activeTrack.metadata.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#EDEDED] hover:text-red-300 transition-colors font-sans"
                          >
                            <Youtube className="w-3.5 h-3.5 text-red-400" />
                            <span>YouTube</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Center Song Focal Point */}
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-[#0A0A0B] border border-white/[0.12] flex items-center justify-center shrink-0">
                        {heroCover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={heroCover}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={player.togglePlay}
                          aria-label={
                            player.isPlaying
                              ? `Pause ${heroTitle}`
                              : `Play ${heroTitle}`
                          }
                          className={`absolute inset-0 flex items-center justify-center transition-colors cursor-pointer ${
                            heroCover
                              ? "bg-black/35 hover:bg-black/50"
                              : "hover:bg-white/[0.04]"
                          }`}
                        >
                          {player.isPlaying ? (
                            <Pause className="w-7 h-7 fill-current text-[#14B8A6]" />
                          ) : (
                            <Play className="w-7 h-7 fill-current text-[#14B8A6] ml-0.5" />
                          )}
                        </button>
                      </div>

                      <div className="text-center sm:text-left min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#EDEDED] truncate">
                          {heroTitle}
                        </h1>
                        {heroArtist && (
                          <p className="text-xs sm:text-sm text-[#D4D4D8] mt-0.5 truncate">
                            {heroArtist}
                            {activeTrack.metadata?.album
                              ? ` · ${activeTrack.metadata.album}`
                              : ""}
                          </p>
                        )}
                        <p className="text-[11px] text-[#8A8A92] mt-1 font-mono tabular-nums">
                          {player.enhancement?.abBypassOriginal
                            ? "Signal Path: Raw Unprocessed PCM (A/B Bypass)"
                            : player.enhancement?.enabled
                            ? `Signal Path: ${activePresetLabel} · Booster ${loudnessPct}% · Beat Slam ${Math.round(
                                beatImpact * 100
                              )}% · Width ${(
                                player.enhancement.stereoWidth ?? 1.15
                              ).toFixed(2)}×${
                                hasSavedRackOnSong ? " · Locked to Track" : ""
                              }`
                            : "Signal Path: Bypassed"}
                        </p>
                      </div>
                    </div>

                    {/* Dedicated 60fps Multi-Mode Spectrum Stage */}
                    <Visualizer
                      getAnalyserNode={player.getAnalyserNode}
                      getVisualizerLevels={player.getVisualizerLevels}
                      getCurrentTime={player.getCurrentTime}
                      beatTimestamps={activeTrack.analysis.beatTimestamps}
                      accentColor={feelingColor}
                      feelingMood={feelingMood}
                      barStyle={player.barStyle}
                      onChangeBarStyle={(style) =>
                        void player.setBarStyle(style)
                      }
                      loudnessPercent={loudnessPct}
                      beatImpact={beatImpact}
                      crossfadeDuration={0.55}
                      visualsEnabled={player.visualsEnabled}
                      isPlaying={player.isPlaying}
                    />
                  </section>

                  {/* Per-Song Configuration & 25-Mode Studio Mastering Rack */}
                  <EnhancementPanel
                    enhancement={player.enhancement}
                    analysis={activeTrack.analysis}
                    hasCustomSongConfig={hasSavedRackOnSong}
                    onChange={player.setEnhancement}
                    onSelectPreset={player.selectEnhancementPreset}
                    onApplySmartOptimal={player.applySmartOptimalEnhancement}
                    onSaveToSong={() =>
                      void player.saveTrackEnhancement(activeTrack.id)
                    }
                    onClearSongConfig={() =>
                      void player.clearTrackEnhancement(activeTrack.id)
                    }
                    onToggleEnabled={player.toggleEnhancementEnabled}
                    onToggleAbOriginal={player.toggleAbOriginal}
                    onSetBoosterLevel={player.setLoudnessBoosterLevel}
                    onToggleLoudness200={player.toggleLoudness200}
                  />

                  {/* Deep Psychoacoustic Telemetry & Structural Section Looper */}
                  <SongAnalysisPanel
                    track={activeTrack}
                    abRepeat={player.abRepeat}
                    onJumpToPeakDrop={handleJumpToPeakDrop}
                    onSeekToTime={(sec) => {
                      player.seek(sec);
                      if (!player.isPlaying) player.togglePlay();
                    }}
                    onLoopSection={player.loopSection}
                    onClearLoop={player.clearABRepeat}
                    onApplySmartOptimal={player.applySmartOptimalEnhancement}
                  />
                </div>
              )}
            </ErrorBoundary>
          )}
        </main>

        <Player
          currentTrack={activeTrack}
          isPlaying={player.isPlaying}
          currentTime={player.currentTime}
          duration={player.duration}
          volume={player.volume}
          playbackSpeed={player.playbackSpeed}
          loopTrack={player.loopTrack}
          abRepeat={player.abRepeat}
          enhancement={player.enhancement}
          visualsEnabled={player.visualsEnabled}
          isFullscreenVibe={player.isFullscreenVibe}
          onTogglePlay={player.togglePlay}
          onSeek={player.seek}
          onPrev={player.playPrevTrack}
          onNext={player.playNextTrack}
          onVolumeChange={player.setVolume}
          onPlaybackSpeedChange={player.setPlaybackSpeed}
          onToggleLoop={() => player.setLoopTrack(!player.loopTrack)}
          onSetLoopA={handleSetLoopA}
          onSetLoopB={handleSetLoopB}
          onClearLoop={player.clearABRepeat}
          onLoopPeakDrop={handleLoopPeakDrop}
          onToggleAbOriginal={player.toggleAbOriginal}
          onToggleLoudness200={player.toggleLoudness200}
          onToggleBars={() =>
            void player.setVisualsEnabled(!player.visualsEnabled)
          }
          onToggleFullscreenVibe={player.toggleFullscreenVibe}
          onOpenMusicDrawer={() => setIsMusicDrawerOpen(true)}
        />

        {!player.isFullscreenVibe && (
          <MobileTabBar onOpenMusicDrawer={() => setIsMusicDrawerOpen(true)} />
        )}

        <MobileMusicDrawer
          open={isMusicDrawerOpen}
          onClose={() => setIsMusicDrawerOpen(false)}
          onTriggerUpload={triggerGlobalUpload}
        />

        <EditMetadataModal />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
