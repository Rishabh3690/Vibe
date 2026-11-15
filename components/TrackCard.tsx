"use client";

import React, { memo, useState } from "react";
import {
  Play,
  Pause,
  Pencil,
  Trash2,
  Youtube,
  ListStart,
  ListPlus,
  FolderPlus,
  Plus,
  Check,
} from "lucide-react";
import { Playlist, Track } from "../lib/types";
import { formatTimestamp } from "../lib/format";

interface TrackCardProps {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  playlists?: Playlist[];
  onSelect: () => void;
  onPlayNext?: () => void;
  onAddToQueue?: () => void;
  onAddToPlaylist?: (playlistId: string) => void;
  onCreatePlaylistWithTrack?: (name: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TrackCardComponent({
  track,
  isCurrent,
  isPlaying,
  playlists = [],
  onSelect,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onCreatePlaylistWithTrack,
  onEdit,
  onDelete,
}: TrackCardProps) {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const title = track.metadata?.title || track.name;
  const artist = track.metadata?.artist;

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !onCreatePlaylistWithTrack) return;
    onCreatePlaylistWithTrack(newPlaylistName.trim());
    setNewPlaylistName("");
    setShowPlaylistMenu(false);
  };

  return (
    <div
      data-testid={`track-card-${track.id}`}
      className={`relative rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150 ${
        isCurrent
          ? "bg-[#121215]/90 backdrop-blur-xl border-[#14B8A6]/60"
          : "bg-[#121215]/75 backdrop-blur-xl border-white/[0.08] hover:border-white/[0.16]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onSelect}
          aria-label={isCurrent && isPlaying ? `Pause ${title}` : `Play ${title}`}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            isCurrent
              ? "bg-[#14B8A6] text-[#0A0A0B]"
              : "bg-[#0A0A0B] border border-white/[0.08] text-[#EDEDED] hover:border-[#14B8A6]"
          }`}
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onSelect}
              className="text-xs sm:text-sm font-semibold text-[#EDEDED] hover:text-[#14B8A6] truncate text-left"
            >
              {title}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#8A8A92] mt-0.5 tabular-nums">
            {artist && (
              <>
                <span className="truncate max-w-[180px]">{artist}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="font-mono">{formatTimestamp(track.duration)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{track.analysis.bpm} BPM</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{track.analysis.lufs} LUFS</span>
            {track.analysis.key !== "Unknown" &&
              track.analysis.key !== "Detecting…" && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{track.analysis.key}</span>
                </>
              )}
            {track.customEnhancement && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#14B8A6]">
                  Rack: {track.customEnhancement.preset.toUpperCase()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Action Buttons: Play Next, Add to Queue, + Playlist, YouTube, Edit, Delete */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {onPlayNext && (
          <button
            type="button"
            data-testid={`play-next-btn-${track.id}`}
            onClick={onPlayNext}
            title="Play this song immediately after the current track"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.08] hover:border-[#14B8A6]/60 hover:text-[#14B8A6] transition-colors whitespace-nowrap"
          >
            <ListStart className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Play Next</span>
          </button>
        )}

        {onAddToQueue && (
          <button
            type="button"
            data-testid={`add-queue-btn-${track.id}`}
            onClick={onAddToQueue}
            title="Add this song to the Up Next queue"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.08] hover:border-[#14B8A6]/60 hover:text-[#14B8A6] transition-colors whitespace-nowrap"
          >
            <ListPlus className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Add to Queue</span>
          </button>
        )}

        {(onAddToPlaylist || onCreatePlaylistWithTrack) && (
          <div className="relative">
            <button
              type="button"
              data-testid={`playlist-menu-btn-${track.id}`}
              onClick={() => setShowPlaylistMenu((v) => !v)}
              title="Add to playlist"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.08] hover:border-[#14B8A6]/60 transition-colors whitespace-nowrap"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>+ Playlist</span>
            </button>

            {showPlaylistMenu && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-[#0A0A0B] border border-white/[0.14] shadow-2xl p-2.5 z-30 space-y-2">
                <p className="text-[11px] font-semibold text-[#EDEDED] px-1">
                  Add to Playlist
                </p>

                {playlists.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {playlists.map((pl) => {
                      const inPlaylist = pl.trackIds.includes(track.id);
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => {
                            onAddToPlaylist?.(pl.id);
                            setShowPlaylistMenu(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] text-[#EDEDED] hover:bg-white/[0.06] transition-colors"
                        >
                          <span className="truncate">{pl.name}</span>
                          {inPlaylist ? (
                            <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                          ) : (
                            <span className="text-[10px] text-[#8A8A92] font-mono">
                              {pl.trackIds.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {onCreatePlaylistWithTrack && (
                  <form onSubmit={handleCreatePlaylist} className="flex gap-1.5 pt-1 border-t border-white/[0.08]">
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="New playlist name…"
                      className="flex-1 min-w-0 px-2 py-1 text-[11px] text-[#EDEDED] bg-[#141416] border border-white/[0.1] rounded-lg focus:outline-none focus:border-[#14B8A6]"
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#14B8A6] text-[#0A0A0B] hover:opacity-90 shrink-0 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {track.metadata?.youtubeUrl && (
          <a
            href={track.metadata.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Watch on YouTube"
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Youtube className="w-4 h-4" />
          </a>
        )}
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit info for ${title}`}
          className="p-2 text-[#8A8A92] hover:text-[#EDEDED] hover:bg-white/[0.06] rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${title}`}
          className="p-2 text-[#8A8A92] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

const TrackCard = memo(TrackCardComponent);
export default TrackCard;
