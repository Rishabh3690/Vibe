import { sanitizeTrackName } from "./errors";
import { TrackMetadata } from "./types";

/**
 * Parses `"Artist - Title"` from a track filename as a clean fallback
 * when embedded ID3 / MP4 / Vorbis tags are absent.
 */
export function parseFilenameMetadata(fileName: string): TrackMetadata {
  const clean = sanitizeTrackName(fileName);
  // Match common "Artist - Title" or "Artist — Title" patterns
  const sepMatch = clean.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (sepMatch) {
    const artist = sepMatch[1].trim();
    const title = sepMatch[2].trim();
    if (artist.length > 0 && title.length > 0) {
      return {
        title,
        artist,
      };
    }
  }
  return {
    title: clean,
  };
}

function decodeTextBytes(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 1 || encoding === 2) {
      // UTF-16 with BOM (1) or UTF-16BE (2)
      if (
        bytes.length >= 2 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xfe
      ) {
        return new TextDecoder("utf-16le").decode(bytes.subarray(2));
      }
      if (
        bytes.length >= 2 &&
        bytes[0] === 0xfe &&
        bytes[1] === 0xff
      ) {
        return new TextDecoder("utf-16be").decode(bytes.subarray(2));
      }
      return new TextDecoder(encoding === 2 ? "utf-16be" : "utf-16le").decode(
        bytes
      );
    }
    if (encoding === 3) {
      return new TextDecoder("utf-8").decode(bytes);
    }
    return new TextDecoder("iso-8859-1").decode(bytes);
  } catch {
    try {
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return "";
    }
  }
}

function stripNulls(s: string): string {
  return s.replace(/\0+/g, "").trim();
}

function readSyncSafeInt(b: Uint8Array, offset: number): number {
  return (
    ((b[offset] & 0x7f) << 21) |
    ((b[offset + 1] & 0x7f) << 14) |
    ((b[offset + 2] & 0x7f) << 7) |
    (b[offset + 3] & 0x7f)
  );
}

function readUint32BE(b: Uint8Array, offset: number): number {
  return (
    ((b[offset] << 24) >>> 0) +
    (b[offset + 1] << 16) +
    (b[offset + 2] << 8) +
    b[offset + 3]
  );
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  if (blob.size === 0 || blob.size > 2 * 1024 * 1024) return null;
  if (typeof FileReader === "undefined") return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function parseId3v2Frames(bytes: Uint8Array): {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  imageBlob?: Blob;
} {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {
    return {};
  }

  const majorVersion = bytes[3];
  const flags = bytes[5];
  const tagSize = readSyncSafeInt(bytes, 6);
  const tagEnd = Math.min(bytes.length, 10 + tagSize);

  let pos = 10;
  // Skip extended header if present
  if ((flags & 0x40) !== 0 && pos + 4 <= tagEnd) {
    const extSize =
      majorVersion >= 4 ? readSyncSafeInt(bytes, pos) : readUint32BE(bytes, pos);
    pos += Math.max(4, extSize);
  }

  const out: {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    imageBlob?: Blob;
  } = {};

  if (majorVersion === 2) {
    // ID3v2.2 uses 6-byte frame headers (3-char ID + 3-byte size)
    while (pos + 6 <= tagEnd) {
      const frameId = String.fromCharCode(
        bytes[pos],
        bytes[pos + 1],
        bytes[pos + 2]
      );
      if (bytes[pos] === 0) break;
      const frameSize =
        (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5];
      pos += 6;
      if (frameSize <= 0 || pos + frameSize > tagEnd) break;
      const payload = bytes.subarray(pos, pos + frameSize);
      pos += frameSize;

      if (frameId === "TT2" || frameId === "TP1" || frameId === "TAL" || frameId === "TYE") {
        const text = stripNulls(decodeTextBytes(payload.subarray(1), payload[0]));
        if (frameId === "TT2" && text) out.title = text;
        if (frameId === "TP1" && text) out.artist = text;
        if (frameId === "TAL" && text) out.album = text;
        if (frameId === "TYE" && text) out.year = text.slice(0, 4);
      }
    }
    return out;
  }

  // ID3v2.3 / ID3v2.4 use 10-byte frame headers
  while (pos + 10 <= tagEnd) {
    if (bytes[pos] === 0) break;
    const frameId = String.fromCharCode(
      bytes[pos],
      bytes[pos + 1],
      bytes[pos + 2],
      bytes[pos + 3]
    );
    const frameSize =
      majorVersion >= 4
        ? readSyncSafeInt(bytes, pos + 4)
        : readUint32BE(bytes, pos + 4);
    pos += 10;
    if (frameSize <= 0 || pos + frameSize > tagEnd) break;

    const payload = bytes.subarray(pos, pos + frameSize);
    pos += frameSize;

    if (
      frameId === "TIT2" ||
      frameId === "TPE1" ||
      frameId === "TALB" ||
      frameId === "TYER" ||
      frameId === "TDRC"
    ) {
      const encoding = payload[0];
      const text = stripNulls(decodeTextBytes(payload.subarray(1), encoding));
      if (!text) continue;
      if (frameId === "TIT2") out.title = text;
      else if (frameId === "TPE1") out.artist = text;
      else if (frameId === "TALB") out.album = text;
      else if (frameId === "TYER" || frameId === "TDRC") {
        const yr = text.match(/\d{4}/)?.[0];
        if (yr) out.year = yr;
      }
    } else if (frameId === "APIC" && !out.imageBlob && payload.length > 16) {
      const encoding = payload[0];
      let cursor = 1;
      while (cursor < payload.length && payload[cursor] !== 0) cursor++;
      const mimeRaw = new TextDecoder("iso-8859-1")
        .decode(payload.subarray(1, cursor))
        .trim()
        .toLowerCase();
      cursor++; // skip null
      cursor++; // skip picture type byte
      // skip description
      if (encoding === 1 || encoding === 2) {
        while (
          cursor + 1 < payload.length &&
          !(payload[cursor] === 0 && payload[cursor + 1] === 0)
        ) {
          cursor += 2;
        }
        cursor += 2;
      } else {
        while (cursor < payload.length && payload[cursor] !== 0) cursor++;
        cursor += 1;
      }
      if (cursor < payload.length - 8) {
        const mime = mimeRaw.includes("png") ? "image/png" : "image/jpeg";
        const copy = new Uint8Array(payload.subarray(cursor));
        out.imageBlob = new Blob([copy], { type: mime });
      }
    }
  }

  return out;
}

function parseMp4Atoms(bytes: Uint8Array): {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  imageBlob?: Blob;
} {
  const out: {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    imageBlob?: Blob;
  } = {};

  const decoder = new TextDecoder("utf-8");
  const textAtomMap: Array<[number[], "title" | "artist" | "album" | "year"]> = [
    [[0xa9, 0x6e, 0x61, 0x6d], "title"], // ©nam
    [[0xa9, 0x41, 0x52, 0x54], "artist"], // ©ART
    [[0xa9, 0x61, 0x6c, 0x62], "album"], // ©alb
    [[0xa9, 0x64, 0x61, 0x79], "year"], // ©day
  ];

  for (let i = 4; i < bytes.length - 16; i++) {
    for (const [sig, field] of textAtomMap) {
      if (
        bytes[i] === sig[0] &&
        bytes[i + 1] === sig[1] &&
        bytes[i + 2] === sig[2] &&
        bytes[i + 3] === sig[3]
      ) {
        const atomSize = readUint32BE(bytes, i - 4);
        if (atomSize > 16 && i - 4 + atomSize <= bytes.length) {
          // Search for 'data' sub-atom
          for (let j = i + 4; j < i - 4 + atomSize - 12; j++) {
            if (
              bytes[j] === 0x64 &&
              bytes[j + 1] === 0x61 &&
              bytes[j + 2] === 0x74 &&
              bytes[j + 3] === 0x61
            ) {
              const dataSize = readUint32BE(bytes, j - 4);
              const start = j + 12;
              const end = Math.min(bytes.length, j - 4 + dataSize);
              if (end > start) {
                const txt = stripNulls(decoder.decode(bytes.subarray(start, end)));
                if (txt) {
                  out[field] = field === "year" ? txt.slice(0, 4) : txt;
                }
              }
              break;
            }
          }
        }
      }
    }
  }

  return out;
}

function parseVorbisComments(bytes: Uint8Array): {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
} {
  // Check for FLAC ("fLaC") or Ogg ("OggS")
  const isFlac =
    bytes.length > 12 &&
    bytes[0] === 0x66 &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x61 &&
    bytes[3] === 0x43;
  const isOgg =
    bytes.length > 12 &&
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53;

  if (!isFlac && !isOgg) return {};

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const out: {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
  } = {};

  const titleMatch = text.match(/\bTITLE=([^\0\r\n]{1,160})/i);
  const artistMatch = text.match(/\bARTIST=([^\0\r\n]{1,160})/i);
  const albumMatch = text.match(/\bALBUM=([^\0\r\n]{1,160})/i);
  const dateMatch = text.match(/\bDATE=(\d{4})/i);

  if (titleMatch?.[1]) out.title = titleMatch[1].trim();
  if (artistMatch?.[1]) out.artist = artistMatch[1].trim();
  if (albumMatch?.[1]) out.album = albumMatch[1].trim();
  if (dateMatch?.[1]) out.year = dateMatch[1].trim();

  return out;
}

/**
 * Pure browser-native tag extractor for ID3v2 (MP3), MP4/M4A atoms, and FLAC/Ogg Vorbis comments.
 * Falls back gracefully to filename `"Artist - Title"` parsing.
 */
export async function extractTrackMetadata(
  file: File | Blob,
  fileName: string
): Promise<TrackMetadata> {
  const fallback = parseFilenameMetadata(fileName);

  try {
    const maxBytes = Math.min(file.size, 512 * 1024);
    const buffer = await file.slice(0, maxBytes).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const id3 = parseId3v2Frames(bytes);
    const mp4 =
      !id3.title && !id3.artist ? parseMp4Atoms(bytes) : {};
    const vorbis =
      !id3.title && !id3.artist && !mp4.title
        ? parseVorbisComments(bytes)
        : {};

    const title =
      id3.title || mp4.title || vorbis.title || fallback.title;
    const artist =
      id3.artist || mp4.artist || vorbis.artist || fallback.artist;
    const album = id3.album || mp4.album || vorbis.album;
    const year = id3.year || mp4.year || vorbis.year;

    let coverArtDataUrl: string | null = null;
    const imgBlob = id3.imageBlob || mp4.imageBlob;
    if (imgBlob) {
      coverArtDataUrl = await blobToDataUrl(imgBlob);
    }

    return {
      title,
      ...(artist ? { artist } : {}),
      ...(album ? { album } : {}),
      ...(year ? { year } : {}),
      ...(coverArtDataUrl ? { coverArtDataUrl } : {}),
    };
  } catch {
    return fallback;
  }
}
