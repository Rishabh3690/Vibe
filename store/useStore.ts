"use client";

import { create } from "zustand";
import {
  deleteTrackFromDB,
  getAllSettingsFromDB,
  getAllTracks,
  getLastSessionFromDB,
  isStorageUnavailable,
  saveLastSessionInDB,
  saveSettingInDB,
  saveTrack,
  StorageQuotaError,
  updateTrackAnalysisInDB,
  updateTrackDeepFieldsInDB,
  updateTrackEnhancementInDB,
  updateTrackMetadataInDB,
} from "../lib/db";
import {
  BOOSTER_LEVELS,
  DEFAULT_ENHANCEMENT,
  DEFAULT_SETTINGS,
  normalizeAnalysis,
  normalizeEnhancement,
} from "../lib/errors";
import { buildPresetEnhancement } from "../lib/presets";
import {
  ABRepeatState,
  AppView,
  BarStyleMode,
  BoosterLevel,
  EnhancementSettings,
  PlaybackSpeed,
  Playlist,
  PresetName,
  SongAnalysis,
  Track,
  TrackMetadata,
} from "../lib/types";

export interface ToastMessage {
  id: string;
  message: string;
  type: "info" | "error" | "success";
}

interface VibeStoreState {
  tracks: Track[];
  isHydrated: boolean;
  storageUnavailable: boolean;

  activeView: AppView;
  isFullscreenVibe: boolean;
  visualsEnabled: boolean;
  barStyle: BarStyleMode;

  playlists: Playlist[];
  upNextQueue: string[];
  activePlaylistId: string | null;

  isAnalyzing: boolean;
  analyzingFileName: string | null;

  currentTrackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  restoredPosition: number | null;
  duration: number;
  volume: number;
  playbackSpeed: PlaybackSpeed;
  loopTrack: boolean;
  abRepeat: ABRepeatState;
  autoplayBlocked: boolean;

  enhancement: EnhancementSettings;

  editingTrackId: string | null;
  librarySearchQuery: string;
  toasts: ToastMessage[];

  hydrateFromDB: () => Promise<void>;
  setActiveView: (view: AppView) => void;
  setFullscreenVibe: (fullscreen: boolean) => void;
  toggleFullscreenVibe: () => void;
  setVisualsEnabled: (enabled: boolean) => Promise<void>;
  setBarStyle: (style: BarStyleMode) => Promise<void>;
  setAnalyzingState: (isAnalyzing: boolean, fileName?: string | null) => void;

  addTrack: (track: Track) => Promise<boolean>;
  setTrackApiAnalyzing: (trackId: string, apiAnalyzing: boolean) => void;
  updateTrackAnalysis: (trackId: string, analysis: SongAnalysis) => Promise<void>;
  updateTrackDeepAnalysis: (
    trackId: string,
    patch: {
      analysis?: Partial<SongAnalysis>;
      metadata?: Partial<TrackMetadata>;
    }
  ) => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  updateTrackMetadata: (
    trackId: string,
    metadata: TrackMetadata
  ) => Promise<void>;

  // Queue & Playlist Actions
  playNextInQueue: (trackId: string) => void;
  addToQueue: (trackId: string) => void;
  removeFromQueue: (queueIndex: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  createPlaylist: (name: string, initialTrackId?: string) => Playlist | null;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  playPlaylist: (playlistId: string) => void;
  queuePlaylist: (playlistId: string) => void;
  setActivePlaylistId: (playlistId: string | null) => void;

  selectTrack: (trackId: string, autoPlay?: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (t: number) => void;
  clearRestoredPosition: () => void;
  setDuration: (d: number) => void;
  setVolume: (v: number) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setLoopTrack: (loop: boolean) => void;
  setABPointA: (t: number) => void;
  setABPointB: (t: number) => void;
  setABLoopRange: (startSec: number, endSec: number, label?: string) => void;
  clearABRepeat: () => void;
  setAutoplayBlocked: (blocked: boolean) => void;
  advanceToNextTrack: () => Track | null;
  stepToPrevTrack: () => Track | null;

  setEnhancement: (patch: Partial<EnhancementSettings>) => void;
  selectEnhancementPreset: (preset: PresetName) => void;
  applySmartOptimalEnhancement: () => void;
  saveTrackEnhancement: (
    trackId?: string,
    presetOverride?: PresetName
  ) => Promise<void>;
  clearTrackEnhancement: (trackId?: string) => Promise<void>;
  toggleEnhancementEnabled: () => void;
  toggleAbOriginal: () => void;
  setLoudnessBoosterLevel: (level: BoosterLevel) => void;
  cycleLoudnessBooster: () => void;
  toggleLoudness200: () => void;

  setEditingTrackId: (trackId: string | null) => void;
  setLibrarySearchQuery: (q: string) => void;
  persistSessionSnapshot: () => Promise<void>;
  addToast: (
    message: string,
    type?: "info" | "error" | "success",
    durationMs?: number
  ) => void;
  dismissToast: (id: string) => void;
}

export const useStore = create<VibeStoreState>((set, get) => ({
  tracks: [],
  isHydrated: false,
  storageUnavailable: false,

  activeView: "player",
  isFullscreenVibe: false,
  visualsEnabled: DEFAULT_SETTINGS.visualsEnabled,
  barStyle: DEFAULT_SETTINGS.barStyle,

  playlists: [],
  upNextQueue: [],
  activePlaylistId: null,

  isAnalyzing: false,
  analyzingFileName: null,

  currentTrackId: null,
  isPlaying: false,
  currentTime: 0,
  restoredPosition: null,
  duration: 0,
  volume: 0.9,
  playbackSpeed: 1,
  loopTrack: false,
  abRepeat: { a: null, b: null, active: false },
  autoplayBlocked: false,

  enhancement: { ...DEFAULT_ENHANCEMENT },

  editingTrackId: null,
  librarySearchQuery: "",
  toasts: [],

  hydrateFromDB: async () => {
    try {
      const [tracks, settings, lastSession] = await Promise.all([
        getAllTracks(),
        getAllSettingsFromDB(),
        getLastSessionFromDB(),
      ]);

      const restoredTrack = lastSession
        ? tracks.find((t) => t.id === lastSession.trackId) || null
        : null;
      const initialTrack = restoredTrack || tracks[0] || null;
      const restoredPos =
        restoredTrack && Number.isFinite(lastSession?.position)
          ? Math.max(
              0,
              Math.min(restoredTrack.duration, lastSession!.position)
            )
          : null;

      let enhancement = settings.enhancement;
      if (initialTrack?.customEnhancement) {
        enhancement = normalizeEnhancement(initialTrack.customEnhancement);
      } else if (initialTrack && enhancement.preset === "auto") {
        enhancement = buildPresetEnhancement(
          "auto",
          enhancement,
          initialTrack.analysis
        );
      }

      const validTrackIds = new Set(tracks.map((t) => t.id));
      const cleanQueue = (settings.upNextQueue || []).filter((id) =>
        validTrackIds.has(id)
      );
      const cleanPlaylists = (settings.playlists || []).map((pl) => ({
        ...pl,
        trackIds: pl.trackIds.filter((id) => validTrackIds.has(id)),
      }));

      set({
        tracks,
        storageUnavailable: isStorageUnavailable(),
        isHydrated: true,
        activeView: "player",
        visualsEnabled: settings.visualsEnabled,
        barStyle: settings.barStyle,
        enhancement,
        playlists: cleanPlaylists,
        upNextQueue: cleanQueue,
        activePlaylistId: settings.activePlaylistId || null,
        currentTrackId: initialTrack ? initialTrack.id : null,
        duration: initialTrack ? initialTrack.duration : 0,
        currentTime: restoredPos ?? 0,
        restoredPosition: restoredPos,
        isPlaying: false,
      });
    } catch {
      set({
        isHydrated: true,
        storageUnavailable: isStorageUnavailable(),
      });
    }
  },

  setActiveView: (activeView) => set({ activeView }),

  setFullscreenVibe: (isFullscreenVibe) => {
    set({ isFullscreenVibe });
    if (
      typeof document !== "undefined" &&
      typeof navigator !== "undefined" &&
      !navigator.webdriver
    ) {
      if (isFullscreenVibe) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  },

  toggleFullscreenVibe: () => {
    const next = !get().isFullscreenVibe;
    get().setFullscreenVibe(next);
  },

  setVisualsEnabled: async (visualsEnabled) => {
    set({ visualsEnabled });
    await saveSettingInDB("visualsEnabled", visualsEnabled);
  },

  setBarStyle: async (barStyle) => {
    set({ barStyle });
    await saveSettingInDB("barStyle", barStyle);
  },

  setAnalyzingState: (isAnalyzing, fileName = null) =>
    set({
      isAnalyzing,
      analyzingFileName: fileName,
    }),

  addTrack: async (track) => {
    try {
      await saveTrack(track);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        get().addToast("Storage full — delete an older track first", "error");
        return false;
      }
      get().addToast("Could not save track to browser storage.", "error");
      return false;
    }

    const { tracks, enhancement } = get();
    const filtered = tracks.filter((t) => t.id !== track.id);
    const nextTracks = [track, ...filtered];
    const nextEnhancement =
      enhancement.preset === "auto"
        ? buildPresetEnhancement("auto", enhancement, track.analysis)
        : enhancement;

    set({
      tracks: nextTracks,
      storageUnavailable: isStorageUnavailable(),
      currentTrackId: track.id,
      duration: track.duration,
      currentTime: 0,
      restoredPosition: null,
      playbackSpeed: 1,
      abRepeat: { a: null, b: null, active: false },
      activeView: "player",
      enhancement: nextEnhancement,
    });
    return true;
  },

  setTrackApiAnalyzing: (trackId, apiAnalyzing) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              analysis: {
                ...t.analysis,
                apiAnalyzing,
                ...(apiAnalyzing ? { apiError: null } : {}),
              },
            }
          : t
      ),
    })),

  updateTrackAnalysis: async (trackId, analysis) => {
    const updated = await updateTrackAnalysisInDB(trackId, analysis);
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? updated || { ...t, analysis } : t
      ),
    }));
  },

  updateTrackDeepAnalysis: async (trackId, patch) => {
    const existing = get().tracks.find((t) => t.id === trackId);
    if (!existing) return;

    const mergedMetadata: TrackMetadata = {
      ...existing.metadata,
      ...patch.metadata,
      title: patch.metadata?.title || existing.metadata.title || existing.name,
    };

    const mergedAnalysis: SongAnalysis = normalizeAnalysis(
      {
        ...existing.analysis,
        ...patch.analysis,
      },
      existing.duration
    );

    const saved = await updateTrackDeepFieldsInDB(trackId, {
      analysis: mergedAnalysis,
      metadata: mergedMetadata,
    });

    const finalTrack: Track = saved || {
      ...existing,
      name: mergedMetadata.title || existing.name,
      metadata: mergedMetadata,
      analysis: mergedAnalysis,
    };

    set((state) => {
      const nextState: Partial<VibeStoreState> = {
        tracks: state.tracks.map((t) => (t.id === trackId ? finalTrack : t)),
      };
      if (
        state.currentTrackId === trackId &&
        state.enhancement.preset === "auto"
      ) {
        nextState.enhancement = buildPresetEnhancement(
          "auto",
          state.enhancement,
          finalTrack.analysis
        );
      }
      return nextState;
    });
  },

  removeTrack: async (trackId) => {
    await deleteTrackFromDB(trackId);
    const {
      tracks,
      currentTrackId,
      duration,
      isPlaying,
      abRepeat,
      upNextQueue,
      playlists,
    } = get();
    const nextTracks = tracks.filter((t) => t.id !== trackId);
    const nextQueue = upNextQueue.filter((id) => id !== trackId);
    const nextPlaylists = playlists.map((pl) => ({
      ...pl,
      trackIds: pl.trackIds.filter((id) => id !== trackId),
    }));

    let nextCurrentId = currentTrackId;
    let nextDuration = duration;
    let nextPlaying = isPlaying;

    if (currentTrackId === trackId) {
      const fallback = nextTracks[0] || null;
      nextCurrentId = fallback ? fallback.id : null;
      nextDuration = fallback ? fallback.duration : 0;
      nextPlaying = false;
    }

    set({
      tracks: nextTracks,
      upNextQueue: nextQueue,
      playlists: nextPlaylists,
      currentTrackId: nextCurrentId,
      duration: nextDuration,
      isPlaying: nextPlaying,
      abRepeat:
        currentTrackId === trackId
          ? { a: null, b: null, active: false }
          : abRepeat,
    });

    void saveSettingInDB("upNextQueue", nextQueue);
    void saveSettingInDB("playlists", nextPlaylists);
    get().addToast("Song deleted", "info", 2200);
  },

  updateTrackMetadata: async (trackId, metadata) => {
    try {
      const updated = await updateTrackMetadataInDB(trackId, metadata);
      if (!updated) return;
      set((state) => ({
        tracks: state.tracks.map((t) => (t.id === trackId ? updated : t)),
      }));
      get().addToast("Song info updated", "success", 2200);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        get().addToast("Storage full — delete a track first", "error");
      }
    }
  },

  // Queue & Playlist Actions
  playNextInQueue: (trackId) => {
    const { tracks, currentTrackId, upNextQueue } = get();
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;

    const title = target.metadata?.title || target.name;
    if (!currentTrackId) {
      get().selectTrack(trackId, true);
      get().addToast(`Now playing: ${title}`, "success", 2200);
      return;
    }

    const withoutDup = upNextQueue.filter((id) => id !== trackId);
    const nextQueue = [trackId, ...withoutDup];
    set({ upNextQueue: nextQueue });
    void saveSettingInDB("upNextQueue", nextQueue);
    get().addToast(`Playing next: ${title}`, "success", 2400);
  },

  addToQueue: (trackId) => {
    const { tracks, currentTrackId, upNextQueue } = get();
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;

    const title = target.metadata?.title || target.name;
    if (!currentTrackId) {
      get().selectTrack(trackId, true);
      get().addToast(`Now playing: ${title}`, "success", 2200);
      return;
    }

    const nextQueue = [...upNextQueue, trackId];
    set({ upNextQueue: nextQueue });
    void saveSettingInDB("upNextQueue", nextQueue);
    get().addToast(
      `Added to queue (#${nextQueue.length}): ${title}`,
      "success",
      2400
    );
  },

  removeFromQueue: (queueIndex) => {
    const { upNextQueue } = get();
    if (queueIndex < 0 || queueIndex >= upNextQueue.length) return;
    const nextQueue = upNextQueue.filter((_, idx) => idx !== queueIndex);
    set({ upNextQueue: nextQueue });
    void saveSettingInDB("upNextQueue", nextQueue);
  },

  reorderQueue: (fromIndex, toIndex) => {
    const { upNextQueue } = get();
    if (
      fromIndex < 0 ||
      fromIndex >= upNextQueue.length ||
      toIndex < 0 ||
      toIndex >= upNextQueue.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const nextQueue = [...upNextQueue];
    const [moved] = nextQueue.splice(fromIndex, 1);
    nextQueue.splice(toIndex, 0, moved);
    set({ upNextQueue: nextQueue });
    void saveSettingInDB("upNextQueue", nextQueue);
  },

  clearQueue: () => {
    set({ upNextQueue: [] });
    void saveSettingInDB("upNextQueue", []);
    get().addToast("Up Next queue cleared", "info", 1800);
  },

  createPlaylist: (name, initialTrackId) => {
    const cleanName = name.trim().slice(0, 60);
    if (!cleanName) {
      get().addToast("Enter a playlist name first", "error", 2000);
      return null;
    }
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      trackIds: initialTrackId ? [initialTrackId] : [],
      createdAt: Date.now(),
    };
    const nextPlaylists = [newPlaylist, ...get().playlists];
    set({ playlists: nextPlaylists, activePlaylistId: newPlaylist.id });
    void saveSettingInDB("playlists", nextPlaylists);
    void saveSettingInDB("activePlaylistId", newPlaylist.id);
    get().addToast(`Created playlist "${cleanName}"`, "success", 2200);
    return newPlaylist;
  },

  deletePlaylist: (playlistId) => {
    const { playlists, activePlaylistId } = get();
    const target = playlists.find((p) => p.id === playlistId);
    const nextPlaylists = playlists.filter((p) => p.id !== playlistId);
    const nextActive =
      activePlaylistId === playlistId ? null : activePlaylistId;
    set({ playlists: nextPlaylists, activePlaylistId: nextActive });
    void saveSettingInDB("playlists", nextPlaylists);
    void saveSettingInDB("activePlaylistId", nextActive);
    if (target) {
      get().addToast(`Deleted playlist "${target.name}"`, "info", 2000);
    }
  },

  addTrackToPlaylist: (playlistId, trackId) => {
    const { playlists, tracks } = get();
    const track = tracks.find((t) => t.id === trackId);
    const targetPl = playlists.find((p) => p.id === playlistId);
    if (!track || !targetPl) return;

    if (targetPl.trackIds.includes(trackId)) {
      get().addToast(`Already in "${targetPl.name}"`, "info", 1800);
      return;
    }

    const nextPlaylists = playlists.map((p) =>
      p.id === playlistId
        ? { ...p, trackIds: [...p.trackIds, trackId] }
        : p
    );
    set({ playlists: nextPlaylists });
    void saveSettingInDB("playlists", nextPlaylists);
    get().addToast(
      `Added "${track.metadata?.title || track.name}" to "${targetPl.name}"`,
      "success",
      2200
    );
  },

  removeTrackFromPlaylist: (playlistId, trackId) => {
    const { playlists } = get();
    const nextPlaylists = playlists.map((p) =>
      p.id === playlistId
        ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
        : p
    );
    set({ playlists: nextPlaylists });
    void saveSettingInDB("playlists", nextPlaylists);
  },

  playPlaylist: (playlistId) => {
    const { playlists, tracks } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const validIds = pl.trackIds.filter((id) =>
      tracks.some((t) => t.id === id)
    );
    if (validIds.length === 0) {
      get().addToast(`Playlist "${pl.name}" is empty — add songs first`, "info");
      return;
    }
    const [firstId, ...restIds] = validIds;
    set({ activePlaylistId: playlistId, upNextQueue: restIds });
    void saveSettingInDB("activePlaylistId", playlistId);
    void saveSettingInDB("upNextQueue", restIds);
    get().selectTrack(firstId, true);
    get().addToast(`Playing playlist "${pl.name}" (${validIds.length} songs)`, "success");
  },

  queuePlaylist: (playlistId) => {
    const { playlists, tracks, upNextQueue } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const validIds = pl.trackIds.filter((id) =>
      tracks.some((t) => t.id === id)
    );
    if (validIds.length === 0) {
      get().addToast(`Playlist "${pl.name}" has no songs yet`, "info");
      return;
    }
    const nextQueue = [...upNextQueue, ...validIds];
    set({ upNextQueue: nextQueue });
    void saveSettingInDB("upNextQueue", nextQueue);
    get().addToast(`Queued ${validIds.length} songs from "${pl.name}"`, "success");
  },

  setActivePlaylistId: (activePlaylistId) => {
    set({ activePlaylistId });
    void saveSettingInDB("activePlaylistId", activePlaylistId);
  },

  selectTrack: (trackId, autoPlay = true) => {
    const { tracks, enhancement } = get();
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;

    const nextEnh = target.customEnhancement
      ? normalizeEnhancement(target.customEnhancement)
      : enhancement.preset === "auto"
      ? buildPresetEnhancement("auto", enhancement, target.analysis)
      : enhancement;

    set({
      currentTrackId: target.id,
      duration: target.duration,
      currentTime: 0,
      restoredPosition: null,
      isPlaying: autoPlay,
      playbackSpeed: 1,
      abRepeat: { a: null, b: null, active: false },
      activeView: "player",
      enhancement: nextEnh,
    });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  clearRestoredPosition: () => set({ restoredPosition: null }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setLoopTrack: (loopTrack) => set({ loopTrack }),

  setABPointA: (t) => {
    const clamped = Math.max(0, Number(t.toFixed(2)));
    set({ abRepeat: { a: clamped, b: null, active: false } });
    get().addToast(`Loop point A set at ${Math.floor(clamped)}s`, "info", 1800);
  },

  setABPointB: (t) => {
    const { abRepeat } = get();
    const pointA = abRepeat.a ?? 0;
    const pointB = Math.max(pointA + 0.5, Number(t.toFixed(2)));
    set({ abRepeat: { a: pointA, b: pointB, active: true } });
    get().addToast(
      `A-B Loop (${Math.floor(pointA)}s – ${Math.floor(pointB)}s)`,
      "success",
      2200
    );
  },

  setABLoopRange: (startSec, endSec, label) => {
    const a = Math.max(0, Number(startSec.toFixed(2)));
    const b = Math.max(a + 0.5, Number(endSec.toFixed(2)));
    set({ abRepeat: { a, b, active: true } });
    get().addToast(
      label
        ? `Looping ${label} (${Math.floor(a)}s – ${Math.floor(b)}s)`
        : `A–B Loop locked (${Math.floor(a)}s – ${Math.floor(b)}s)`,
      "success",
      2200
    );
  },

  clearABRepeat: () => {
    if (get().abRepeat.a !== null || get().abRepeat.b !== null) {
      set({ abRepeat: { a: null, b: null, active: false } });
      get().addToast("A–B loop cleared", "info", 1600);
    }
  },
  setAutoplayBlocked: (autoplayBlocked) => set({ autoplayBlocked }),

  advanceToNextTrack: () => {
    const { tracks, currentTrackId, upNextQueue, playlists, activePlaylistId } =
      get();
    if (tracks.length === 0) return null;

    // 1. Priority: pop from Up Next queue first!
    if (upNextQueue.length > 0) {
      const remaining = [...upNextQueue];
      while (remaining.length > 0) {
        const nextId = remaining.shift()!;
        const found = tracks.find((t) => t.id === nextId);
        if (found) {
          set({ upNextQueue: remaining });
          void saveSettingInDB("upNextQueue", remaining);
          return found;
        }
      }
      set({ upNextQueue: [] });
      void saveSettingInDB("upNextQueue", []);
    }

    // 2. If an active playlist is selected, advance within that playlist
    if (activePlaylistId) {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      if (pl && pl.trackIds.length > 0) {
        const plTracks = pl.trackIds
          .map((id) => tracks.find((t) => t.id === id))
          .filter((t): t is Track => Boolean(t));
        if (plTracks.length > 0) {
          const idx = currentTrackId
            ? plTracks.findIndex((t) => t.id === currentTrackId)
            : -1;
          return plTracks[(idx + 1) % plTracks.length] || plTracks[0];
        }
      }
    }

    // 3. Default: advance through library tracks
    const idx = currentTrackId
      ? tracks.findIndex((t) => t.id === currentTrackId)
      : -1;
    return tracks[(idx + 1) % tracks.length] || null;
  },

  stepToPrevTrack: () => {
    const { tracks, currentTrackId, playlists, activePlaylistId } = get();
    if (tracks.length === 0) return null;

    if (activePlaylistId) {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      if (pl && pl.trackIds.length > 0) {
        const plTracks = pl.trackIds
          .map((id) => tracks.find((t) => t.id === id))
          .filter((t): t is Track => Boolean(t));
        if (plTracks.length > 0) {
          const idx = currentTrackId
            ? plTracks.findIndex((t) => t.id === currentTrackId)
            : 0;
          return (
            plTracks[(idx - 1 + plTracks.length) % plTracks.length] ||
            plTracks[0]
          );
        }
      }
    }

    const idx = currentTrackId
      ? tracks.findIndex((t) => t.id === currentTrackId)
      : 0;
    return tracks[(idx - 1 + tracks.length) % tracks.length] || null;
  },

  setEnhancement: (patch) => {
    const merged = normalizeEnhancement({ ...get().enhancement, ...patch });
    set({ enhancement: merged });
    void saveSettingInDB("enhancement", merged);
  },

  selectEnhancementPreset: (preset) => {
    const { tracks, currentTrackId, enhancement } = get();
    const activeTrack = tracks.find((t) => t.id === currentTrackId) || null;
    const updated = normalizeEnhancement(
      buildPresetEnhancement(
        preset,
        { ...enhancement, enabled: true, abBypassOriginal: false },
        activeTrack?.analysis
      )
    );
    set({ enhancement: updated });
    void saveSettingInDB("enhancement", updated);
  },

  applySmartOptimalEnhancement: () => {
    const { tracks, currentTrackId, enhancement } = get();
    const activeTrack = tracks.find((t) => t.id === currentTrackId) || null;
    if (!activeTrack) return;
    const opt = activeTrack.analysis.optimalProfile;
    const recommended = activeTrack.analysis.recommendedPreset || "auto";
    const base = buildPresetEnhancement(
      recommended,
      { ...enhancement, enabled: true, abBypassOriginal: false },
      activeTrack.analysis
    );
    const updated = normalizeEnhancement({
      ...base,
      ...(opt
        ? {
            subDb: opt.subDb,
            bassDb: opt.bassDb,
            warmthDb: opt.warmthDb,
            clarityDb: opt.clarityDb,
            airDb: opt.airDb,
            compAmount: opt.compAmount,
            harmonicDrive: opt.harmonicDrive,
            stereoWidth: opt.stereoWidth,
            beatImpact: opt.beatImpact ?? 0.72,
          }
        : { beatImpact: 0.72 }),
      smartVibeAdapt: true,
      monoBassBelow120Hz: true,
      psychoacousticContour: true,
      upwardMicrolift: true,
    });
    set({ enhancement: updated });
    void saveSettingInDB("enhancement", updated);
    get().addToast(
      `Smart Implementer applied tailored DSP (${recommended.toUpperCase()})`,
      "success",
      2400
    );
  },

  saveTrackEnhancement: async (trackId, presetOverride) => {
    const { tracks, currentTrackId, enhancement } = get();
    const targetId = trackId || currentTrackId;
    if (!targetId) return;
    const targetTrack = tracks.find((t) => t.id === targetId);
    if (!targetTrack) return;

    const configToSave = presetOverride
      ? normalizeEnhancement(
          buildPresetEnhancement(
            presetOverride,
            { ...enhancement, enabled: true, abBypassOriginal: false },
            targetTrack.analysis
          )
        )
      : normalizeEnhancement({ ...enhancement, enabled: true });

    const nextTracks = tracks.map((t) =>
      t.id === targetId ? { ...t, customEnhancement: configToSave } : t
    );
    set({
      tracks: nextTracks,
      ...(targetId === currentTrackId ? { enhancement: configToSave } : {}),
    });
    await updateTrackEnhancementInDB(targetId, configToSave);
    void saveSettingInDB("enhancement", configToSave);
    const title = targetTrack.metadata?.title || targetTrack.name;
    get().addToast(
      `Saved permanent Studio Mastering Rack (${configToSave.preset.toUpperCase()}) for "${title}"`,
      "success",
      2500
    );
  },

  clearTrackEnhancement: async (trackId) => {
    const { tracks, currentTrackId } = get();
    const targetId = trackId || currentTrackId;
    if (!targetId) return;
    const targetTrack = tracks.find((t) => t.id === targetId);
    if (!targetTrack) return;

    const nextTracks = tracks.map((t) =>
      t.id === targetId ? { ...t, customEnhancement: null } : t
    );
    set({ tracks: nextTracks });
    await updateTrackEnhancementInDB(targetId, null);
    const title = targetTrack.metadata?.title || targetTrack.name;
    get().addToast(
      `Cleared per-song config for "${title}"`,
      "info",
      2200
    );
  },

  toggleEnhancementEnabled: () => {
    const cur = get().enhancement;
    const next = { ...cur, enabled: !cur.enabled, abBypassOriginal: false };
    set({ enhancement: next });
    void saveSettingInDB("enhancement", next);
  },

  toggleAbOriginal: () => {
    const cur = get().enhancement;
    const next = { ...cur, abBypassOriginal: !cur.abBypassOriginal };
    set({ enhancement: next });
    void saveSettingInDB("enhancement", next);
  },

  setLoudnessBoosterLevel: (level) => {
    const cur = get().enhancement;
    const next = normalizeEnhancement({
      ...cur,
      enabled: true,
      abBypassOriginal: false,
      loudnessPercent: level,
    });
    set({ enhancement: next });
    void saveSettingInDB("enhancement", next);
  },

  cycleLoudnessBooster: () => {
    const cur = get().enhancement;
    const currentPct = Math.round(cur.loudnessPercent ?? 100);
    // Find current or nearest level in [100, 200, 250, 400] and step to next
    let nextLevel: BoosterLevel = 200;
    if (currentPct < 150) nextLevel = 200;
    else if (currentPct < 225) nextLevel = 250;
    else if (currentPct < 325) nextLevel = 400;
    else nextLevel = 100;

    const next = normalizeEnhancement({
      ...cur,
      enabled: true,
      abBypassOriginal: false,
      loudnessPercent: nextLevel,
    });
    set({ enhancement: next });
    void saveSettingInDB("enhancement", next);
    const labelMap: Record<BoosterLevel, string> = {
      100: "100% Normal",
      200: "200% Boost",
      250: "250% Hyper",
      400: "400% Max",
    };
    get().addToast(
      `Audio Booster: ${labelMap[nextLevel]} (Zero-Clip Psychoacoustic)`,
      "info",
      2000
    );
  },

  toggleLoudness200: () => {
    get().cycleLoudnessBooster();
  },

  setEditingTrackId: (editingTrackId) => set({ editingTrackId }),
  setLibrarySearchQuery: (librarySearchQuery) => set({ librarySearchQuery }),

  persistSessionSnapshot: async () => {
    const { currentTrackId, currentTime } = get();
    if (!currentTrackId) return;
    await saveLastSessionInDB({
      trackId: currentTrackId,
      position: Number(currentTime.toFixed(2)),
      updatedAt: Date.now(),
    });
  },

  addToast: (message, type = "info", durationMs = 3500) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id, message, type }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, durationMs);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export { BOOSTER_LEVELS };
