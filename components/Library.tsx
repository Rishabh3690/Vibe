"use client";

import React from "react";
import { Search, Music } from "lucide-react";
import { useStore } from "../store/useStore";
import Uploader from "./Uploader";
import TrackCard from "./TrackCard";
import QueuePlaylistPanel from "./QueuePlaylistPanel";

interface LibraryProps {
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function Library({ uploadInputRef }: LibraryProps) {
  const tracks = useStore((s) => s.tracks);
  const currentTrackId = useStore((s) => s.currentTrackId);
  const isPlaying = useStore((s) => s.isPlaying);
  const playlists = useStore((s) => s.playlists);
  const activePlaylistId = useStore((s) => s.activePlaylistId);

  const selectTrack = useStore((s) => s.selectTrack);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const removeTrack = useStore((s) => s.removeTrack);
  const setEditingTrackId = useStore((s) => s.setEditingTrackId);
  const playNextInQueue = useStore((s) => s.playNextInQueue);
  const addToQueue = useStore((s) => s.addToQueue);
  const addTrackToPlaylist = useStore((s) => s.addTrackToPlaylist);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const librarySearchQuery = useStore((s) => s.librarySearchQuery);
  const setLibrarySearchQuery = useStore((s) => s.setLibrarySearchQuery);

  const activePlaylist =
    playlists.find((p) => p.id === activePlaylistId) || null;
  const baseTracks = activePlaylist
    ? activePlaylist.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
    : tracks;

  const q = librarySearchQuery.trim().toLowerCase();
  const filteredTracks = q
    ? baseTracks.filter((t) => {
        const title = (t.metadata?.title || t.name || "").toLowerCase();
        const artist = (t.metadata?.artist || "").toLowerCase();
        return title.includes(q) || artist.includes(q);
      })
    : baseTracks;

  return (
    <div className="space-y-4 pb-6">
      <Uploader uploadInputRef={uploadInputRef} compact={tracks.length > 0} />

      {tracks.length > 0 && (
        <>
          <QueuePlaylistPanel />

          <section aria-label="Uploaded songs" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-[#14B8A6]" />
                <h2 className="text-xs font-semibold text-[#EDEDED] tabular-nums">
                  {activePlaylist
                    ? `${activePlaylist.name} (${filteredTracks.length})`
                    : `Uploaded Songs (${filteredTracks.length})`}
                </h2>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#8A8A92] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Filter songs…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs text-[#EDEDED] bg-[#141416] border border-white/[0.08] rounded-xl focus:outline-none focus:border-[#14B8A6]"
                />
              </div>
            </div>

            <div className="space-y-2">
              {filteredTracks.map((track) => {
                const isCurrent = track.id === currentTrackId;
                return (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isCurrent={isCurrent}
                    isPlaying={isPlaying}
                    playlists={playlists}
                    onSelect={() => {
                      if (isCurrent) {
                        setIsPlaying(!isPlaying);
                      } else {
                        selectTrack(track.id, true);
                      }
                    }}
                    onPlayNext={() => playNextInQueue(track.id)}
                    onAddToQueue={() => addToQueue(track.id)}
                    onAddToPlaylist={(plId) =>
                      addTrackToPlaylist(plId, track.id)
                    }
                    onCreatePlaylistWithTrack={(name) =>
                      createPlaylist(name, track.id)
                    }
                    onEdit={() => setEditingTrackId(track.id)}
                    onDelete={() => void removeTrack(track.id)}
                  />
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
