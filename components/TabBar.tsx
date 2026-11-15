"use client";

import React from "react";
import { Disc3, ListMusic } from "lucide-react";
import { useStore } from "../store/useStore";

interface MobileTabBarProps {
  onOpenMusicDrawer?: () => void;
}

export function MobileTabBar({ onOpenMusicDrawer }: MobileTabBarProps) {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const tracks = useStore((s) => s.tracks);

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden border-t border-white/[0.08] bg-[#0A0A0B]/95 backdrop-blur-md grid grid-cols-2 shrink-0"
    >
      <button
        type="button"
        data-testid="mobile-tab-player"
        onClick={() => setActiveView("player")}
        className={`flex items-center justify-center gap-1.5 min-h-[48px] text-xs font-medium transition-colors cursor-pointer ${
          activeView === "player"
            ? "text-[#14B8A6] font-semibold"
            : "text-[#8A8A92]"
        }`}
      >
        <Disc3 className="w-4 h-4" aria-hidden="true" />
        <span>Studio Deck</span>
      </button>

      <button
        type="button"
        data-testid="mobile-tab-tracks"
        onClick={() => {
          if (onOpenMusicDrawer && tracks.length > 0) {
            onOpenMusicDrawer();
          } else {
            setActiveView("tracks");
          }
        }}
        className={`flex items-center justify-center gap-1.5 min-h-[48px] text-xs font-medium tabular-nums transition-colors cursor-pointer ${
          activeView === "tracks"
            ? "text-[#14B8A6] font-semibold"
            : "text-[#8A8A92]"
        }`}
      >
        <ListMusic className="w-4 h-4" aria-hidden="true" />
        <span>Library ({tracks.length})</span>
      </button>
    </nav>
  );
}
