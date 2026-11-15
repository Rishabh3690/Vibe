"use client";

import { useCallback } from "react";
import { extractTrackMetadata, parseFilenameMetadata } from "../lib/id3";
import { TrackMetadata } from "../lib/types";

export function useMetadata() {
  const extract = useCallback(
    async (file: File | Blob, fileName: string): Promise<TrackMetadata> => {
      try {
        return await extractTrackMetadata(file, fileName);
      } catch {
        return parseFilenameMetadata(fileName);
      }
    },
    []
  );

  return { extractMetadata: extract };
}
