"use client";

import React from "react";
import {
  AudioLines,
  Upload,
  Maximize2,
  Minimize2,
  ListMusic,
  Sliders,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { AppView } from "../lib/types";

interface TopBarProps {
  onTriggerUpload: () => void;
  onOpenMusicDrawer?: () => void;
}

export default function TopBar({
  onTriggerUpload,
  onOpenMusicDrawer,
}: TopBarProps) {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const isFullscreenVibe = useStore((s) => s.isFullscreenVibe);
  const toggleFullscreenVibe = useStore((s) => s.toggleFullscreenVibe);
  const tracks = useStore((s) => s.tracks);
  const upNextQueue = useStore((s) => s.upNextQueue);
  const isAnalyzing = useStore((s) => s.isAnalyzing);

  const navItems: Array<{ id: AppView; label: string; testId: string }> = [
    { id: "player", label: "Studio Deck", testId: "nav-tab-player" },
    {
      id: "tracks",
      label:
        upNextQueue.length > 0
          ? `Library (${tracks.length}) · Queue (${upNextQueue.length})`
          : `Library & Playlists (${tracks.length})`,
      testId: "nav-tab-tracks",
    },
  ];

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/[0.07] shrink-0">
      <div className="max-w-[1440px] mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Wordmark + Signal Spec */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#141416] border border-white/[0.1] shadow-inner"
            style={{ color: "#14B8A6" }}
          >
            <AudioLines className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-tight text-[#EDEDED] whitespace-nowrap">
              Vibe
            </span>
            <span className="hidden sm:inline text-[10px] font-mono text-[#8A8A92] uppercase tracking-wider">
              32-Bit DSP Console
            </span>
          </div>
        </div>

        {/* Center: 2-View Navigation (Studio Deck / Library & Playlists) */}
        <nav
          aria-label="Primary views"
          className="hidden md:flex items-center gap-1 bg-[#141416] p-1 rounded-xl border border-white/[0.07]"
        >
          {navItems.map((item) => {
            const active = activeView === item.id && !isFullscreenVibe;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.testId}
                onClick={() => {
                  if (isFullscreenVibe) {
                    useStore.getState().setFullscreenVibe(false);
                  }
                  setActiveView(item.id);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums inline-flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? "bg-white/[0.1] text-[#EDEDED] font-semibold"
                    : "text-[#8A8A92] hover:text-[#EDEDED]"
                }`}
              >
                {item.id === "player" ? (
                  <Sliders className="w-3.5 h-3.5 text-[#14B8A6]" />
                ) : (
                  <ListMusic className="w-3.5 h-3.5 text-[#14B8A6]" />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Quick Drawer + Fullscreen Vibe + Upload */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {tracks.length > 0 && onOpenMusicDrawer && (
            <button
              type="button"
              data-testid="topbar-music-drawer-btn"
              onClick={onOpenMusicDrawer}
              title="Open Songs, Playlists & Queue"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[38px] rounded-xl text-xs font-semibold bg-[#141416] text-[#EDEDED] border border-white/[0.1] hover:border-[#14B8A6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ListMusic className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>Queue ({tracks.length})</span>
            </button>
          )}

          {tracks.length > 0 && (
            <button
              type="button"
              data-testid="topbar-fullscreen-vibe-btn"
              onClick={toggleFullscreenVibe}
              title="Toggle Distraction-Free Fullscreen Vibe Mode (F)"
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[38px] rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isFullscreenVibe
                  ? "bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]"
                  : "bg-[#141416] text-[#EDEDED] border-white/[0.1] hover:border-[#14B8A6]/50"
              }`}
            >
              {isFullscreenVibe ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit Stage</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span className="hidden sm:inline">Zen Stage</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={isAnalyzing}
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 min-h-[38px] rounded-xl text-xs font-semibold text-[#0A0A0B] bg-[#14B8A6] hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isAnalyzing ? "Decoding…" : "Load Audio"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
