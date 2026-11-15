import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
  AppSettings,
  BarStyleMode,
  EnhancementSettings,
  PlaybackSession,
  SongAnalysis,
  Track,
  TrackMetadata,
} from "./types";
import {
  DEFAULT_SETTINGS,
  isQuotaExceededError,
  normalizeAnalysis,
  normalizeBarStyle,
  normalizeEnhancement,
  normalizePlaylists,
} from "./errors";

export class StorageQuotaError extends Error {
  constructor(message = "IndexedDB storage quota exceeded") {
    super(message);
    this.name = "StorageQuotaError";
  }
}

interface StoredTrackMeta {
  id: string;
  name: string;
  duration: number;
  createdAt: number;
  analysis: SongAnalysis;
  metadata?: TrackMetadata;
  customEnhancement?: EnhancementSettings | null;
  blob?: Blob;
}

interface VibeDB extends DBSchema {
  tracks: {
    key: string;
    value: StoredTrackMeta;
    indexes: { "by-createdAt": number };
  };
  blobs: {
    key: string;
    value: { id: string; blob: Blob };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = "vibe-audio-db";
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<VibeDB>> | null = null;
let storageUnavailableFlag = false;

export function isStorageUnavailable(): boolean {
  return storageUnavailableFlag;
}

export function getDB(): Promise<IDBPDatabase<VibeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VibeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("tracks")) {
          const trackStore = db.createObjectStore("tracks", { keyPath: "id" });
          trackStore.createIndex("by-createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("blobs")) {
          db.createObjectStore("blobs", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
        if ((db.objectStoreNames as unknown as DOMStringList).contains("playlists")) {
          try {
            db.deleteObjectStore("playlists" as never);
          } catch {
            // ignore
          }
        }
      },
    }).catch((err) => {
      storageUnavailableFlag = true;
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

function hydrateTrackRecord(meta: StoredTrackMeta, blob: Blob): Track {
  const duration =
    typeof meta.duration === "number" &&
    Number.isFinite(meta.duration) &&
    meta.duration > 0
      ? meta.duration
      : 180;
  return {
    id: meta.id,
    name: meta.name || "Untitled Song",
    blob,
    duration,
    createdAt: typeof meta.createdAt === "number" ? meta.createdAt : Date.now(),
    analysis: normalizeAnalysis(meta.analysis, duration),
    metadata: meta.metadata || { title: meta.name || "Untitled Song" },
    customEnhancement: meta.customEnhancement
      ? normalizeEnhancement(meta.customEnhancement)
      : null,
  };
}

export async function getAllTracks(): Promise<Track[]> {
  try {
    const db = await getDB();
    const allMeta = await db.getAll("tracks");
    const allBlobs = await db.getAll("blobs");
    const blobMap = new Map<string, Blob>();
    for (const b of allBlobs) {
      if (b && b.blob instanceof Blob) {
        blobMap.set(b.id, b.blob);
      }
    }

    const tracks: Track[] = [];
    for (const item of allMeta) {
      const blob =
        blobMap.get(item.id) ||
        (item.blob instanceof Blob
          ? item.blob
          : new Blob([], { type: "audio/mpeg" }));
      tracks.push(hydrateTrackRecord(item, blob));
    }

    tracks.sort((a, b) => b.createdAt - a.createdAt);
    return tracks;
  } catch {
    storageUnavailableFlag = true;
    return [];
  }
}

export async function saveTrack(track: Track): Promise<void> {
  try {
    const db = await getDB();
    const { blob, ...rest } = track;
    const cleanMeta: StoredTrackMeta = {
      ...rest,
      analysis: normalizeAnalysis(rest.analysis, rest.duration),
      customEnhancement: rest.customEnhancement
        ? normalizeEnhancement(rest.customEnhancement)
        : null,
    };
    const tx = db.transaction(["tracks", "blobs"], "readwrite");
    await Promise.all([
      tx.objectStore("tracks").put(cleanMeta),
      tx.objectStore("blobs").put({ id: track.id, blob }),
      tx.done,
    ]);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw new StorageQuotaError();
    }
    storageUnavailableFlag = true;
    throw err;
  }
}

export async function updateTrackEnhancementInDB(
  trackId: string,
  customEnhancement: EnhancementSettings | null
): Promise<Track | null> {
  try {
    const db = await getDB();
    const existing = await db.get("tracks", trackId);
    if (!existing) return null;

    const updated: StoredTrackMeta = {
      ...existing,
      customEnhancement: customEnhancement
        ? normalizeEnhancement(customEnhancement)
        : null,
    };
    await db.put("tracks", updated);

    const blobRecord = await db.get("blobs", trackId);
    const blob =
      blobRecord?.blob instanceof Blob
        ? blobRecord.blob
        : existing.blob instanceof Blob
        ? existing.blob
        : new Blob([], { type: "audio/mpeg" });

    return hydrateTrackRecord(updated, blob);
  } catch {
    return null;
  }
}

export async function updateTrackAnalysisInDB(
  trackId: string,
  analysis: SongAnalysis
): Promise<Track | null> {
  try {
    const db = await getDB();
    const existing = await db.get("tracks", trackId);
    if (!existing) return null;
    const updatedMeta: StoredTrackMeta = {
      ...existing,
      analysis: normalizeAnalysis(analysis, existing.duration),
    };
    await db.put("tracks", updatedMeta);
    const blobRow = await db.get("blobs", trackId);
    const blob =
      blobRow?.blob instanceof Blob
        ? blobRow.blob
        : existing.blob instanceof Blob
        ? existing.blob
        : new Blob([], { type: "audio/mpeg" });
    return hydrateTrackRecord(updatedMeta, blob);
  } catch {
    return null;
  }
}

export async function updateTrackDeepFieldsInDB(
  trackId: string,
  patch: {
    analysis?: SongAnalysis;
    metadata?: TrackMetadata;
  }
): Promise<Track | null> {
  try {
    const db = await getDB();
    const existing = await db.get("tracks", trackId);
    if (!existing) return null;
    const updatedMeta: StoredTrackMeta = {
      ...existing,
      ...(patch.metadata
        ? {
            name: patch.metadata.title || existing.name,
            metadata: patch.metadata,
          }
        : {}),
      ...(patch.analysis
        ? { analysis: normalizeAnalysis(patch.analysis, existing.duration) }
        : {}),
    };
    await db.put("tracks", updatedMeta);
    const blobRow = await db.get("blobs", trackId);
    const blob =
      blobRow?.blob instanceof Blob
        ? blobRow.blob
        : existing.blob instanceof Blob
        ? existing.blob
        : new Blob([], { type: "audio/mpeg" });
    return hydrateTrackRecord(updatedMeta, blob);
  } catch {
    return null;
  }
}

export async function deleteTrackFromDB(trackId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(["tracks", "blobs"], "readwrite");
    await Promise.all([
      tx.objectStore("tracks").delete(trackId),
      tx.objectStore("blobs").delete(trackId),
      tx.done,
    ]);
  } catch {
    // ignore
  }
}

export async function updateTrackMetadataInDB(
  trackId: string,
  metadata: TrackMetadata
): Promise<Track | null> {
  try {
    const db = await getDB();
    const existing = await db.get("tracks", trackId);
    if (!existing) return null;
    const updatedMeta: StoredTrackMeta = {
      ...existing,
      name: metadata.title || existing.name,
      metadata,
    };
    await db.put("tracks", updatedMeta);
    const blobRow = await db.get("blobs", trackId);
    const blob = blobRow?.blob || existing.blob || new Blob([]);
    return hydrateTrackRecord(updatedMeta, blob);
  } catch (err) {
    if (isQuotaExceededError(err)) throw new StorageQuotaError();
    return null;
  }
}

export async function getAllSettingsFromDB(): Promise<AppSettings> {
  try {
    const db = await getDB();
    const rows = await db.getAll("settings");
    const map = new Map<string, unknown>();
    for (const r of rows) {
      map.set(r.key, r.value);
    }

    const visualsEnabled =
      typeof map.get("visualsEnabled") === "boolean"
        ? (map.get("visualsEnabled") as boolean)
        : DEFAULT_SETTINGS.visualsEnabled;

    const barStyle: BarStyleMode = normalizeBarStyle(map.get("barStyle"));

    const rawEnh = map.get("enhancement");
    const enhancement: EnhancementSettings = normalizeEnhancement(
      rawEnh && typeof rawEnh === "object"
        ? (rawEnh as Partial<EnhancementSettings>)
        : null
    );

    const playlists = normalizePlaylists(map.get("playlists"));
    const rawQueue = map.get("upNextQueue");
    const upNextQueue = Array.isArray(rawQueue)
      ? rawQueue.filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0
        )
      : [];
    const activePlaylistId =
      typeof map.get("activePlaylistId") === "string"
        ? (map.get("activePlaylistId") as string)
        : null;

    return {
      visualsEnabled,
      barStyle,
      enhancement,
      playlists,
      upNextQueue,
      activePlaylistId,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      enhancement: { ...DEFAULT_SETTINGS.enhancement },
      playlists: [],
      upNextQueue: [],
      activePlaylistId: null,
    };
  }
}

export async function saveSettingInDB<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  try {
    const db = await getDB();
    await db.put("settings", { key, value });
  } catch {
    // ignore
  }
}

export async function getLastSessionFromDB(): Promise<PlaybackSession | null> {
  try {
    const db = await getDB();
    const row = await db.get("settings", "lastSession");
    if (row?.value && typeof row.value === "object") {
      return row.value as PlaybackSession;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveLastSessionInDB(
  session: PlaybackSession
): Promise<void> {
  try {
    const db = await getDB();
    await db.put("settings", { key: "lastSession", value: session });
  } catch {
    // ignore
  }
}
