"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Image as ImageIcon, Check, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/useStore";

const MAX_COVER_IMAGE_BYTES = 2 * 1024 * 1024;

export default function EditMetadataModal() {
  const editingTrackId = useStore((s) => s.editingTrackId);
  const tracks = useStore((s) => s.tracks);
  const setEditingTrackId = useStore((s) => s.setEditingTrackId);
  const updateTrackMetadata = useStore((s) => s.updateTrackMetadata);
  const addToast = useStore((s) => s.addToast);

  const track = tracks.find((t) => t.id === editingTrackId) || null;

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [year, setYear] = useState("");
  const [coverArtDataUrl, setCoverArtDataUrl] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!track) return;
    const t = setTimeout(() => {
      setTitle(track.metadata?.title || track.name);
      setArtist(track.metadata?.artist || "");
      setAlbum(track.metadata?.album || "");
      setYear(track.metadata?.year || "");
      setCoverArtDataUrl(track.metadata?.coverArtDataUrl || null);
    }, 0);
    return () => clearTimeout(t);
  }, [track]);

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast("Please choose a valid image file.", "error");
      return;
    }
    if (file.size > MAX_COVER_IMAGE_BYTES) {
      addToast("Cover image must be under 2 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCoverArtDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) return;
    const cleanTitle = title.trim() || track.name;
    await updateTrackMetadata(track.id, {
      ...track.metadata,
      title: cleanTitle,
      artist: artist.trim() || undefined,
      album: album.trim() || undefined,
      year: year.trim() || undefined,
      coverArtDataUrl,
    });
    setEditingTrackId(null);
  };

  return (
    <AnimatePresence>
      {track && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-metadata-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md rounded-2xl bg-[#141416] border border-white/[0.1] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h2
                id="edit-metadata-modal-title"
                className="text-sm font-semibold text-[#EDEDED]"
              >
                Edit Song Info
              </h2>
              <button
                type="button"
                onClick={() => setEditingTrackId(null)}
                aria-label="Close edit metadata dialog"
                className="p-1.5 text-[#8A8A92] hover:text-[#EDEDED] rounded-lg hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-xl bg-[#0A0A0B] border border-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">
                  {coverArtDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverArtDataUrl}
                      alt="Cover art preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-[#8A8A92]" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium text-[#EDEDED] bg-[#0A0A0B] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl"
                  >
                    Upload cover (≤ 2 MB)
                  </button>
                  {coverArtDataUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverArtDataUrl(null)}
                      aria-label="Remove cover art"
                      className="p-1.5 text-[#8A8A92] hover:text-red-400 rounded-lg hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="meta-title-input"
                  className="block text-[11px] font-medium text-[#8A8A92] mb-1"
                >
                  Title
                </label>
                <input
                  id="meta-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.1] rounded-xl focus:outline-none focus:border-[#14B8A6]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="meta-artist-input"
                  className="block text-[11px] font-medium text-[#8A8A92] mb-1"
                >
                  Artist
                </label>
                <input
                  id="meta-artist-input"
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Optional artist name"
                  className="w-full px-3 py-2 text-xs text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.1] rounded-xl focus:outline-none focus:border-[#14B8A6]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label
                    htmlFor="meta-album-input"
                    className="block text-[11px] font-medium text-[#8A8A92] mb-1"
                  >
                    Album
                  </label>
                  <input
                    id="meta-album-input"
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-xs text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.1] rounded-xl focus:outline-none focus:border-[#14B8A6]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="meta-year-input"
                    className="block text-[11px] font-medium text-[#8A8A92] mb-1"
                  >
                    Year
                  </label>
                  <input
                    id="meta-year-input"
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2025"
                    className="w-full px-3 py-2 text-xs text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.1] rounded-xl focus:outline-none focus:border-[#14B8A6]"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTrackId(null)}
                    className="px-3 py-2 text-xs font-medium text-[#8A8A92] hover:text-[#EDEDED] rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0A0A0B] bg-[#14B8A6] rounded-xl hover:opacity-90"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
