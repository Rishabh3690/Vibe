"use client";

import React, { memo, useCallback, useMemo, useState } from "react";
import {
  ListMusic,
  Play,
  Pause,
  ListStart,
  ListPlus,
  Trash2,
  FolderPlus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { formatTimestamp } from "../lib/format";

interface QueuePlaylistPanelProps {
  compact?: boolean;
}

function QueuePlaylistPanelComponent({
  compact = false,
}: QueuePlaylistPanelProps) {
  const tracks = useStore((s) => s.tracks);
  const currentTrackId = useStore((s) => s.currentTrackId);
  const isPlaying = useStore((s) => s.isPlaying);
  const upNextQueue = useStore((s) => s.upNextQueue);
  const playlists = useStore((s) => s.playlists);
  const activePlaylistId = useStore((s) => s.activePlaylistId);

  const selectTrack = useStore((s) => s.selectTrack);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const playNextInQueue = useStore((s) => s.playNextInQueue);
  const addToQueue = useStore((s) => s.addToQueue);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const reorderQueue = useStore((s) => s.reorderQueue);
  const clearQueue = useStore((s) => s.clearQueue);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const deletePlaylist = useStore((s) => s.deletePlaylist);
  const playPlaylist = useStore((s) => s.playPlaylist);
  const queuePlaylist = useStore((s) => s.queuePlaylist);
  const setActivePlaylistId = useStore((s) => s.setActivePlaylistId);
  const addTrackToPlaylist = useStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useStore((s) => s.removeTrackFromPlaylist);

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleCreatePlaylist = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPlaylistName.trim()) return;
      createPlaylist(newPlaylistName.trim(), currentTrackId || undefined);
      setNewPlaylistName("");
    },
    [createPlaylist, currentTrackId, newPlaylistName]
  );

  const trackMap = useMemo(() => {
    const map = new Map<string, (typeof tracks)[number]>();
    for (const t of tracks) {
      map.set(t.id, t);
    }
    return map;
  }, [tracks]);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) || null,
    [playlists, activePlaylistId]
  );

  const displayedTracks = useMemo(
    () =>
      activePlaylist
        ? activePlaylist.trackIds
            .map((id) => trackMap.get(id))
            .filter((t): t is NonNullable<typeof t> => Boolean(t))
        : tracks,
    [activePlaylist, trackMap, tracks]
  );

  const queuedTracks = useMemo(
    () =>
      upNextQueue
        .map((id, idx) => ({
          queueIndex: idx,
          track: trackMap.get(id),
        }))
        .filter(
          (
            item
          ): item is {
            queueIndex: number;
            track: NonNullable<typeof item.track>;
          } => Boolean(item.track)
        ),
    [upNextQueue, trackMap]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      setDragFromIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragOverIndex]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
      e.preventDefault();
      const rawFrom = e.dataTransfer.getData("text/plain");
      const fromIdx =
        dragFromIndex !== null ? dragFromIndex : Number.parseInt(rawFrom, 10);
      if (Number.isFinite(fromIdx) && fromIdx !== targetIndex) {
        reorderQueue(fromIdx, targetIndex);
      }
      setDragFromIndex(null);
      setDragOverIndex(null);
    },
    [dragFromIndex, reorderQueue]
  );

  const handleDragEnd = useCallback(() => {
    setDragFromIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <div
      data-testid="queue-playlist-panel"
      className={`rounded-2xl bg-[#121215]/85 backdrop-blur-xl border border-white/[0.08] p-3.5 flex flex-col gap-3.5 transition-all duration-150 ${
        compact ? "h-full min-h-0 overflow-y-auto" : ""
      }`}
    >
      {/* 1. Up Next Queue Section with Drag-and-Drop Reordering */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ListStart className="w-4 h-4 text-[#14B8A6]" />
            <h3 className="text-xs font-semibold text-[#EDEDED] tabular-nums">
              Up Next Queue ({queuedTracks.length})
            </h3>
            {queuedTracks.length > 1 && (
              <span className="text-[10px] font-mono text-[#8A8A92]">
                · Drag to reorder
              </span>
            )}
          </div>
          {queuedTracks.length > 0 && (
            <button
              type="button"
              data-testid="clear-queue-btn"
              onClick={clearQueue}
              className="text-[11px] text-[#8A8A92] hover:text-red-400 transition-colors"
            >
              Clear Queue
            </button>
          )}
        </div>

        {queuedTracks.length === 0 ? (
          <p className="text-[11px] text-[#8A8A92] bg-[#0A0A0B]/80 border border-white/[0.06] rounded-xl px-3 py-2">
            Queue is empty — click{" "}
            <strong className="text-[#EDEDED]">Play Next</strong> or{" "}
            <strong className="text-[#EDEDED]">Add to Queue</strong> on any song
            below.
          </p>
        ) : (
          <div
            data-testid="queue-drop-list"
            className="space-y-1.5 max-h-44 overflow-y-auto pr-1"
          >
            {queuedTracks.map(({ queueIndex, track }) => {
              const title = track.metadata?.title || track.name;
              const isDragging = dragFromIndex === queueIndex;
              const isDragTarget =
                dragOverIndex === queueIndex && dragFromIndex !== queueIndex;
              return (
                <div
                  key={`${track.id}_${queueIndex}`}
                  data-testid={`queued-item-${queueIndex}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, queueIndex)}
                  onDragOver={(e) => handleDragOver(e, queueIndex)}
                  onDrop={(e) => handleDrop(e, queueIndex)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#0A0A0B]/90 border text-xs cursor-grab active:cursor-grabbing transition-all duration-150 ${
                    isDragTarget
                      ? "border-[#14B8A6] bg-[#14B8A6]/10"
                      : isDragging
                      ? "opacity-50 border-white/[0.15]"
                      : "border-white/[0.07] hover:border-white/[0.16]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <GripVertical
                      aria-hidden="true"
                      className="w-3.5 h-3.5 text-[#8A8A92] shrink-0"
                    />
                    <span className="text-[10px] font-mono text-[#14B8A6] font-semibold w-4 shrink-0 tabular-nums">
                      #{queueIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        removeFromQueue(queueIndex);
                        selectTrack(track.id, true);
                      }}
                      className="text-[#EDEDED] hover:text-[#14B8A6] font-medium truncate text-left"
                    >
                      {title}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono text-[#8A8A92] tabular-nums mr-0.5">
                      {formatTimestamp(track.duration)}
                    </span>
                    {queuedTracks.length > 1 && (
                      <>
                        <button
                          type="button"
                          data-testid={`queue-move-up-${queueIndex}`}
                          disabled={queueIndex === 0}
                          aria-label={`Move ${title} up in queue`}
                          onClick={() =>
                            reorderQueue(queueIndex, queueIndex - 1)
                          }
                          className="p-1 text-[#8A8A92] hover:text-[#EDEDED] disabled:opacity-30 rounded"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          data-testid={`queue-move-down-${queueIndex}`}
                          disabled={queueIndex === queuedTracks.length - 1}
                          aria-label={`Move ${title} down in queue`}
                          onClick={() =>
                            reorderQueue(queueIndex, queueIndex + 1)
                          }
                          className="p-1 text-[#8A8A92] hover:text-[#EDEDED] disabled:opacity-30 rounded"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${title} from queue`}
                      onClick={() => removeFromQueue(queueIndex)}
                      className="p-1 text-[#8A8A92] hover:text-red-400 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Playlists Strip + Create Playlist */}
      <div className="space-y-2 pt-2.5 border-t border-white/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ListMusic className="w-4 h-4 text-[#14B8A6]" />
            <h3 className="text-xs font-semibold text-[#EDEDED]">
              Playlists ({playlists.length})
            </h3>
          </div>

          <form
            onSubmit={handleCreatePlaylist}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              data-testid="new-playlist-input"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="New playlist name…"
              className="w-36 sm:w-44 px-2.5 py-1 text-[11px] text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.1] rounded-lg focus:outline-none focus:border-[#14B8A6]"
            />
            <button
              type="submit"
              data-testid="create-playlist-submit-btn"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#14B8A6] text-[#0A0A0B] hover:opacity-90 whitespace-nowrap"
            >
              <FolderPlus className="w-3 h-3" />
              <span>Add Playlist</span>
            </button>
          </form>
        </div>

        {/* Playlist Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActivePlaylistId(null)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
              activePlaylistId === null
                ? "bg-[#14B8A6] text-[#0A0A0B] border-[#14B8A6] font-semibold"
                : "bg-[#0A0A0B] text-[#8A8A92] border-white/[0.08] hover:text-[#EDEDED]"
            }`}
          >
            All Songs ({tracks.length})
          </button>

          {playlists.map((pl) => {
            const isSelected = activePlaylistId === pl.id;
            return (
              <div
                key={pl.id}
                className={`inline-flex items-center rounded-lg border text-[11px] transition-colors ${
                  isSelected
                    ? "bg-[#14B8A6]/15 border-[#14B8A6] text-[#EDEDED]"
                    : "bg-[#0A0A0B] border-white/[0.08] text-[#A1A1AA]"
                }`}
              >
                <button
                  type="button"
                  data-testid={`select-playlist-${pl.id}`}
                  onClick={() => setActivePlaylistId(pl.id)}
                  className="px-2.5 py-1 font-medium hover:text-[#EDEDED]"
                >
                  {pl.name} ({pl.trackIds.length})
                </button>
                <button
                  type="button"
                  title={`Play playlist ${pl.name}`}
                  onClick={() => playPlaylist(pl.id)}
                  className="px-1.5 py-1 text-[#14B8A6] hover:opacity-80"
                >
                  <Play className="w-3 h-3 fill-current" />
                </button>
                <button
                  type="button"
                  title={`Queue playlist ${pl.name}`}
                  onClick={() => queuePlaylist(pl.id)}
                  className="px-1.5 py-1 text-[#8A8A92] hover:text-[#EDEDED]"
                >
                  <ListPlus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  title={`Delete playlist ${pl.name}`}
                  onClick={() => deletePlaylist(pl.id)}
                  className="px-1.5 py-1 text-[#8A8A92] hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Songs in Selected Playlist / Library with Instant Play Next & Add to Queue */}
      {compact && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pt-2 border-t border-white/[0.06]">
          {displayedTracks.map((track) => {
            const isCurrent = track.id === currentTrackId;
            const title = track.metadata?.title || track.name;
            return (
              <div
                key={track.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-colors ${
                  isCurrent
                    ? "bg-[#0A0A0B] border-[#14B8A6]/60"
                    : "bg-[#0A0A0B]/70 border-white/[0.06] hover:border-white/[0.14]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) {
                        setIsPlaying(!isPlaying);
                      } else {
                        selectTrack(track.id, true);
                      }
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? "bg-[#14B8A6] text-[#0A0A0B]"
                        : "bg-[#141416] text-[#EDEDED] hover:text-[#14B8A6]"
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#EDEDED] truncate">
                      {title}
                    </p>
                    <p className="text-[10px] font-mono text-[#8A8A92] tabular-nums">
                      {formatTimestamp(track.duration)} · {track.analysis.bpm} BPM
                      {track.customEnhancement
                        ? ` · Rack: ${track.customEnhancement.preset.toUpperCase()}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => playNextInQueue(track.id)}
                    title="Play Next"
                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-[#141416] text-[#EDEDED] border border-white/[0.08] hover:border-[#14B8A6] transition-colors inline-flex items-center gap-1"
                  >
                    <ListStart className="w-3 h-3 text-[#14B8A6]" />
                    <span>Next</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addToQueue(track.id)}
                    title="Add to Queue"
                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-[#141416] text-[#EDEDED] border border-white/[0.08] hover:border-[#14B8A6] transition-colors inline-flex items-center gap-1"
                  >
                    <ListPlus className="w-3 h-3 text-[#14B8A6]" />
                    <span>Queue</span>
                  </button>
                  {activePlaylist && (
                    <button
                      type="button"
                      title="Remove from playlist"
                      onClick={() =>
                        removeTrackFromPlaylist(activePlaylist.id, track.id)
                      }
                      className="p-1 text-[#8A8A92] hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {!activePlaylist && playlists.length > 0 && (
                    <button
                      type="button"
                      title={`Add to ${playlists[0].name}`}
                      onClick={() =>
                        addTrackToPlaylist(playlists[0].id, track.id)
                      }
                      className="p-1 text-[#8A8A92] hover:text-[#14B8A6]"
                    >
                      <FolderPlus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const QueuePlaylistPanel = memo(QueuePlaylistPanelComponent);
export default QueuePlaylistPanel;
