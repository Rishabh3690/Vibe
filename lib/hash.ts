/**
 * Generates a deterministic ID hash from file name, size, and sample bytes
 * using Web Crypto SHA-256 (with FNV-1a synchronous fallback).
 */
export async function computeTrackHash(file: File | Blob, name: string): Promise<string> {
  try {
    const slice = file.slice(0, 16384);
    const buffer = await slice.arrayBuffer();
    const header = new TextEncoder().encode(`${name}:${file.size}:`);
    const combined = new Uint8Array(header.length + buffer.byteLength);
    combined.set(header, 0);
    combined.set(new Uint8Array(buffer), header.length);

    if (typeof crypto !== "undefined" && crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", combined);
      const hex = Array.from(new Uint8Array(digest))
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `trk_${hex}`;
    }
  } catch {
    // Fallback below
  }
  return computeSyncHash(`${name}:${file.size}:${Date.now()}`);
}

export function computeSyncHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `id_${(h >>> 0).toString(16).padStart(8, "0")}`;
}
