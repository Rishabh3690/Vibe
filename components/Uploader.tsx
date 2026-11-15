"use client";

import React, { useCallback, useState } from "react";
import { Upload, AudioLines, Sliders, Search } from "lucide-react";
import { useStore } from "../store/useStore";
import { validateAudioFile } from "../lib/errors";
import { extractTrackMetadata } from "../lib/id3";
import { analyzeAudioBuffer, encodeWavSnippetBase64 } from "../lib/audioAnalyze";
import { Track } from "../lib/types";
import { useSongAnalysis } from "../hooks/useSongAnalysis";

interface UploaderProps {
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  compact?: boolean;
}

export function useAudioUploadHandler() {
  const addTrack = useStore((s) => s.addTrack);
  const selectTrack = useStore((s) => s.selectTrack);
  const setAnalyzingState = useStore((s) => s.setAnalyzingState);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const addToast = useStore((s) => s.addToast);
  const { analyzeTrackWithAPI } = useSongAnalysis();

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      for (const file of files) {
        const validation = validateAudioFile(file);
        if (!validation.valid) {
          addToast(validation.error || "Unsupported audio file.", "error");
          continue;
        }
        if (validation.largeWarning) {
          addToast(
            `"${file.name}" is large (>100 MB) — decoding locally…`,
            "info",
            3200
          );
        }

        setAnalyzingState(true, file.name);
        let decodeCtx: AudioContext | null = null;

        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          decodeCtx = new AudioCtx();

          const arrayBuf = await file.arrayBuffer();
          const audioBuffer = await decodeCtx.decodeAudioData(
            arrayBuf.slice(0)
          );

          const [metadata, analysis] = await Promise.all([
            extractTrackMetadata(file, file.name),
            Promise.resolve(analyzeAudioBuffer(audioBuffer)),
          ]);

          const wavSnippetBase64 = encodeWavSnippetBase64(audioBuffer, 20);

          const trackId =
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

          const newTrack: Track = {
            id: trackId,
            name: metadata.title || file.name,
            blob: file,
            duration: Number(audioBuffer.duration.toFixed(2)),
            createdAt: Date.now(),
            analysis,
            metadata,
          };

          const saved = await addTrack(newTrack);
          if (saved) {
            selectTrack(newTrack.id, true);
            setIsPlaying(true);
            addToast(
              `Loaded "${newTrack.metadata.title}" — calibrating studio profile…`,
              "success",
              2800
            );
            void analyzeTrackWithAPI(
              newTrack,
              wavSnippetBase64,
              "audio/wav",
              false
            );
          }
        } catch {
          addToast(
            `Could not decode "${file.name}". Please upload a standard MP3, WAV, FLAC, OGG, or M4A file.`,
            "error"
          );
        } finally {
          if (decodeCtx) {
            await decodeCtx.close().catch(() => {});
          }
          setAnalyzingState(false, null);
        }
      }
    },
    [addToast, addTrack, analyzeTrackWithAPI, selectTrack, setAnalyzingState, setIsPlaying]
  );

  return { processFiles };
}

export default function Uploader({
  uploadInputRef,
  compact = false,
}: UploaderProps) {
  const isAnalyzing = useStore((s) => s.isAnalyzing);
  const analyzingFileName = useStore((s) => s.analyzingFileName);
  const { processFiles } = useAudioUploadHandler();
  const [dragging, setDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void processFiles(files);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-2xl border transition-all ${
        dragging
          ? "border-[#14B8A6] bg-[#14B8A6]/10"
          : "border-white/[0.08] bg-[#141416] hover:border-white/[0.16]"
      } ${compact ? "p-4" : "p-6 sm:p-10"}`}
    >
      <input
        ref={uploadInputRef}
        data-testid="file-upload-input"
        type="file"
        accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus,.webm"
        multiple
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Upload audio song file"
      />

      <div className="flex flex-col items-center text-center max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-xl bg-[#0A0A0B] border border-white/[0.08] flex items-center justify-center mb-4 text-[#14B8A6]">
          <Upload className="w-5 h-5" aria-hidden="true" />
        </div>

        <h1
          className={`font-semibold tracking-tight text-[#EDEDED] text-balance ${
            compact ? "text-sm" : "text-xl sm:text-2xl"
          }`}
        >
          {isAnalyzing && analyzingFileName
            ? `Decoding "${analyzingFileName}"…`
            : "Drop a song to analyze, master & play"}
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-[#8A8A92] leading-relaxed">
          Upload MP3, WAV, FLAC, OGG, or M4A. Vibe maps every beat, peak drop,
          and dynamic contour, unlocks 25 studio mastering profiles with a
          4-level 100%–400% distortion-free booster, and drives a kinetic
          spectrum stage.
        </p>

        <button
          type="button"
          disabled={isAnalyzing}
          onClick={() => uploadInputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#0A0A0B] bg-[#14B8A6] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-55 whitespace-nowrap"
        >
          <Upload className="w-4 h-4" aria-hidden="true" />
          <span>{isAnalyzing ? "Decoding Audio…" : "Choose Audio File"}</span>
        </button>

        {!compact && (
          <div className="mt-6 pt-5 border-t border-white/[0.06] w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="flex items-start gap-2.5">
              <Search className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-[#EDEDED]">
                  Acoustic &amp; Web Lookup
                </p>
                <p className="text-[11px] text-[#8A8A92] mt-0.5">
                  Detects Peak Drop, BPM, key, YouTube link &amp; dynamic contour.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Sliders className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-[#EDEDED]">
                  400% Booster &amp; 25 Profiles
                </p>
                <p className="text-[11px] text-[#8A8A92] mt-0.5">
                  100%, 200%, 250% &amp; 400% psychoacoustic gain with zero clipping.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <AudioLines className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-[#EDEDED]">
                  Fullscreen Zen Stage
                </p>
                <p className="text-[11px] text-[#8A8A92] mt-0.5">
                  Distraction-free spectrum bars, beat shockwaves &amp; playlists.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
