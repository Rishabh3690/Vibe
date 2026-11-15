"use client";

import React, { memo } from "react";
import { ListMusic, Upload, X } from "lucide-react";
import QueuePlaylistPanel from "./QueuePlaylistPanel";

interface MobileMusicDrawerProps {
  open: boolean;
  onClose: () => void;
  onTriggerUpload?: () => void;
}

function MobileMusicDrawerComponent({
  open,
  onClose,
  onTriggerUpload,
}: MobileMusicDrawerProps) {
  if (!open) return null;

  return (
    <div
      data-testid="mobile-music-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Songs, Queue & Playlists"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-2xl mx-auto max-h-[84dvh] rounded-t-3xl bg-[#121215] border-t border-x border-white/[0.12] p-4 flex flex-col gap-3 shadow-2xl">
        {/* Centered Grab Handle for Mobile Thumb Ergonomics */}
        <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto shrink-0" />

        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-[#14B8A6]" />
            <h2 className="text-sm font-bold text-[#EDEDED]">
              Songs, Playlists &amp; Up Next Queue
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {onTriggerUpload && (
              <button
                type="button"
                onClick={() => {
                  onTriggerUpload();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-[#14B8A6] text-[#0A0A0B]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Add Song</span>
              </button>
            )}
            <button
              type="button"
              data-testid="close-music-drawer-btn"
              onClick={onClose}
              aria-label="Close songs and playlists drawer"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-[#0A0A0B] border border-white/[0.1] flex items-center justify-center text-[#EDEDED] hover:border-[#14B8A6]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <QueuePlaylistPanel compact={true} />
        </div>
      </div>
    </div>
  );
}

const MobileMusicDrawer = memo(MobileMusicDrawerComponent);
export default MobileMusicDrawer;
