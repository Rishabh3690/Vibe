"use client";

import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onTogglePlay: () => void;
  onSeekRelative: (deltaSec: number) => void;
  onVolumeRelative: (deltaVol: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleBars: () => void;
  onToggleAbOriginal: () => void;
  onToggleFullscreen?: () => void;
  onSetLoopA?: () => void;
  onSetLoopB?: () => void;
  onClearLoop?: () => void;
  onEscape: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onSeekRelative,
  onVolumeRelative,
  onNext,
  onPrev,
  onToggleBars,
  onToggleAbOriginal,
  onToggleFullscreen,
  onSetLoopA,
  onSetLoopB,
  onClearLoop,
  onEscape,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        onEscape();
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSeekRelative(e.shiftKey ? -30 : -5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onSeekRelative(e.shiftKey ? 30 : 5);
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        onSeekRelative(-5);
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        onSeekRelative(5);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onVolumeRelative(0.05);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onVolumeRelative(-0.05);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        onNext();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        onToggleBars();
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        onToggleAbOriginal();
      } else if ((e.key === "f" || e.key === "F") && onToggleFullscreen) {
        e.preventDefault();
        onToggleFullscreen();
      } else if (e.key === "[" && onSetLoopA) {
        e.preventDefault();
        onSetLoopA();
      } else if (e.key === "]" && onSetLoopB) {
        e.preventDefault();
        onSetLoopB();
      } else if (e.key === "\\" && onClearLoop) {
        e.preventDefault();
        onClearLoop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onClearLoop,
    onEscape,
    onNext,
    onPrev,
    onSeekRelative,
    onSetLoopA,
    onSetLoopB,
    onToggleAbOriginal,
    onToggleBars,
    onToggleFullscreen,
    onTogglePlay,
    onVolumeRelative,
  ]);
}
