"use client";

import { useCallback, useRef } from "react";
import { fetchWithTimeout } from "../lib/errors";
import {
  FeelingMood,
  GroundingSource,
  OptimalDspProfile,
  PresetName,
  Track,
  VibeCurvePoint,
} from "../lib/types";
import { useStore } from "../store/useStore";

interface DeepAnalysisPayload {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  year?: string | null;
  genre?: string | null;
  youtubeUrl?: string | null;
  youtubeTitle?: string | null;
  key?: string | null;
  timeSignature?: string | null;
  bpm?: number | null;
  hasVocals?: boolean | null;
  feelingMood?: FeelingMood | null;
  feelingColor?: string | null;
  recommendedPreset?: PresetName | null;
  summary?: string | null;
  beatAndRhythmAnalysis?: string | null;
  optimizationNotes?: string | null;
  enhancementReason?: string | null;
  optimalProfile?: OptimalDspProfile | null;
  vibeCurve?: VibeCurvePoint[] | null;
  beatPunchScore?: number | null;
  peakDropTimeSec?: number | null;
  subWeightScore?: number | null;
  vocalClarityScore?: number | null;
  crestFactorDb?: number | null;
  spectralCentroidHz?: number | null;
  stereoCorrelation?: number | null;
  transientDensity?: number | null;
  mudRatio?: number | null;
  harshnessRatio?: number | null;
  dynamicHealthScore?: number | null;
  smartTechniquesApplied?: string[] | null;
  analysisEngine?: string | null;
}

export function useSongAnalysis() {
  const inflightRef = useRef<Set<string>>(new Set());

  const analyzeTrackWithAPI = useCallback(
    async (
      track: Track,
      audioSnippetBase64?: string,
      audioMimeType = "audio/wav",
      notifyOnFinish = false
    ): Promise<boolean> => {
      if (inflightRef.current.has(track.id)) return false;
      inflightRef.current.add(track.id);

      const { setTrackApiAnalyzing, updateTrackDeepAnalysis, addToast } =
        useStore.getState();
      setTrackApiAnalyzing(track.id, true);

      try {
        const res = await fetchWithTimeout(
          "/api/analyze-song",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: track.name,
              duration: track.duration,
              metadata: {
                title: track.metadata?.title || track.name,
                artist: track.metadata?.artist,
                album: track.metadata?.album,
                year: track.metadata?.year,
              },
              acousticSummary: {
                bpm: track.analysis.bpm,
                lufs: track.analysis.lufs,
                lra: track.analysis.lra,
                truePeak: track.analysis.truePeak,
                crestFactorDb: track.analysis.crestFactorDb,
                beatPunchScore: track.analysis.beatPunchScore,
                spectralCentroidHz: track.analysis.spectralCentroidHz,
                stereoCorrelation: track.analysis.stereoCorrelation,
                transientDensity: track.analysis.transientDensity,
                mudRatio: track.analysis.mudRatio,
                harshnessRatio: track.analysis.harshnessRatio,
                dynamicHealthScore: track.analysis.dynamicHealthScore,
                subEnergyRatio: track.analysis.subEnergyRatio,
                lowMidEnergyRatio: track.analysis.lowMidEnergyRatio,
                highMidEnergyRatio: track.analysis.highMidEnergyRatio,
                highEnergyRatio: track.analysis.highEnergyRatio,
              },
              ...(audioSnippetBase64
                ? { audioSnippetBase64, audioMimeType }
                : {}),
            }),
          },
          55000
        );

        const data = (await res.json()) as {
          analysis?: DeepAnalysisPayload | null;
          groundingSources?: GroundingSource[];
          apiError?: string;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || "Song analysis returned an error.");
        }

        // If Node runtime didn't have python3 (e.g., Vercel Node lambda), try Vercel Python endpoint `/api/python_analyze`
        let pythonFallback: DeepAnalysisPayload | null = null;
        if (
          audioSnippetBase64 &&
          (!data.analysis?.analysisEngine ||
            !data.analysis.analysisEngine.includes("python"))
        ) {
          try {
            const pyRes = await fetchWithTimeout(
              "/api/python_analyze",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ audioSnippetBase64 }),
              },
              10000
            );
            if (pyRes.ok) {
              const pyJson = (await pyRes.json()) as {
                pythonAnalysis?: {
                  engine?: string;
                  crestFactorDb?: number;
                  beatPunchScore?: number;
                  peakDropTimeSec?: number;
                  subWeightScore?: number;
                  vocalClarityScore?: number;
                  spectralCentroidHz?: number;
                  stereoCorrelation?: number;
                  transientDensity?: number;
                  mudRatio?: number;
                  harshnessRatio?: number;
                  dynamicHealthScore?: number;
                  smartTechniquesApplied?: string[];
                  feelingMood?: FeelingMood;
                  feelingColor?: string;
                  recommendedMode?: PresetName;
                  optimalProfile?: OptimalDspProfile;
                  vibeCurve?: VibeCurvePoint[];
                };
              };
              if (pyJson.pythonAnalysis) {
                const p = pyJson.pythonAnalysis;
                pythonFallback = {
                  optimalProfile: p.optimalProfile,
                  vibeCurve: p.vibeCurve,
                  beatPunchScore: p.beatPunchScore,
                  peakDropTimeSec: p.peakDropTimeSec,
                  subWeightScore: p.subWeightScore,
                  vocalClarityScore: p.vocalClarityScore,
                  crestFactorDb: p.crestFactorDb,
                  spectralCentroidHz: p.spectralCentroidHz,
                  stereoCorrelation: p.stereoCorrelation,
                  transientDensity: p.transientDensity,
                  mudRatio: p.mudRatio,
                  harshnessRatio: p.harshnessRatio,
                  dynamicHealthScore: p.dynamicHealthScore,
                  smartTechniquesApplied: p.smartTechniquesApplied,
                  feelingMood: p.feelingMood,
                  feelingColor: p.feelingColor,
                  recommendedPreset: p.recommendedMode,
                  analysisEngine: `${p.engine || "python-dsp-v3"}${
                    data.analysis ? " + gemini-google" : ""
                  }`,
                };
              }
            }
          } catch {
            // Local /api/python_analyze only exists on Vercel Python runtime; ignore cleanly in Next dev
          }
        }

        const ai: DeepAnalysisPayload = {
          ...(data.analysis || {}),
          ...(pythonFallback || {}),
        };

        const latestTrack =
          useStore.getState().tracks.find((t) => t.id === track.id) || track;

        const validYt =
          typeof ai.youtubeUrl === "string" &&
          /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(
            ai.youtubeUrl.trim()
          )
            ? ai.youtubeUrl.trim()
            : undefined;

        const hasGeminiResult = Boolean(
          ai.summary || ai.youtubeUrl || ai.artist || ai.beatAndRhythmAnalysis
        );

        await updateTrackDeepAnalysis(track.id, {
          metadata: {
            ...(typeof ai.title === "string" && ai.title.trim()
              ? { title: ai.title.trim() }
              : {}),
            ...(typeof ai.artist === "string" && ai.artist.trim()
              ? { artist: ai.artist.trim() }
              : {}),
            ...(typeof ai.album === "string" && ai.album.trim()
              ? { album: ai.album.trim() }
              : {}),
            ...(typeof ai.year === "string" && ai.year.trim()
              ? { year: ai.year.trim() }
              : {}),
            ...(typeof ai.genre === "string" && ai.genre.trim()
              ? { genre: ai.genre.trim() }
              : {}),
            ...(validYt ? { youtubeUrl: validYt } : {}),
            ...(typeof ai.youtubeTitle === "string" && ai.youtubeTitle.trim()
              ? { youtubeTitle: ai.youtubeTitle.trim() }
              : {}),
          },
          analysis: {
            apiAnalyzed: hasGeminiResult || Boolean(ai.optimalProfile),
            apiAnalyzing: false,
            apiError: data.apiError || null,
            ...(typeof ai.key === "string" && ai.key.trim()
              ? { key: ai.key.trim() }
              : {
                  key:
                    latestTrack.analysis.key === "Detecting…"
                      ? "Unknown"
                      : latestTrack.analysis.key,
                }),
            ...(typeof ai.timeSignature === "string" && ai.timeSignature.trim()
              ? { timeSignature: ai.timeSignature.trim() }
              : {}),
            ...(typeof ai.bpm === "number" &&
            Number.isFinite(ai.bpm) &&
            ai.bpm >= 40 &&
            ai.bpm <= 240
              ? { bpm: Math.round(ai.bpm) }
              : {}),
            ...(typeof ai.hasVocals === "boolean"
              ? { hasVocals: ai.hasVocals }
              : {}),
            ...(ai.feelingMood ? { feelingMood: ai.feelingMood } : {}),
            ...(ai.feelingColor ? { feelingColor: ai.feelingColor } : {}),
            ...(ai.recommendedPreset
              ? { recommendedPreset: ai.recommendedPreset }
              : {}),
            ...(ai.optimalProfile ? { optimalProfile: ai.optimalProfile } : {}),
            ...(Array.isArray(ai.vibeCurve) && ai.vibeCurve.length > 0
              ? { vibeCurve: ai.vibeCurve }
              : {}),
            ...(typeof ai.beatPunchScore === "number"
              ? { beatPunchScore: ai.beatPunchScore }
              : {}),
            ...(typeof ai.peakDropTimeSec === "number"
              ? { peakDropTimeSec: ai.peakDropTimeSec }
              : {}),
            ...(typeof ai.subWeightScore === "number"
              ? { subWeightScore: ai.subWeightScore }
              : {}),
            ...(typeof ai.vocalClarityScore === "number"
              ? { vocalClarityScore: ai.vocalClarityScore }
              : {}),
            ...(typeof ai.crestFactorDb === "number"
              ? { crestFactorDb: ai.crestFactorDb }
              : {}),
            ...(typeof ai.spectralCentroidHz === "number"
              ? { spectralCentroidHz: ai.spectralCentroidHz }
              : {}),
            ...(typeof ai.stereoCorrelation === "number"
              ? { stereoCorrelation: ai.stereoCorrelation }
              : {}),
            ...(typeof ai.transientDensity === "number"
              ? { transientDensity: ai.transientDensity }
              : {}),
            ...(typeof ai.mudRatio === "number"
              ? { mudRatio: ai.mudRatio }
              : {}),
            ...(typeof ai.harshnessRatio === "number"
              ? { harshnessRatio: ai.harshnessRatio }
              : {}),
            ...(typeof ai.dynamicHealthScore === "number"
              ? { dynamicHealthScore: ai.dynamicHealthScore }
              : {}),
            ...(Array.isArray(ai.smartTechniquesApplied) &&
            ai.smartTechniquesApplied.length > 0
              ? { smartTechniquesApplied: ai.smartTechniquesApplied }
              : {}),
            ...(ai.analysisEngine
              ? { analysisEngine: ai.analysisEngine }
              : {}),
            ...(typeof ai.summary === "string" && ai.summary.trim()
              ? { aiSummary: ai.summary.trim() }
              : {}),
            ...(typeof ai.beatAndRhythmAnalysis === "string" &&
            ai.beatAndRhythmAnalysis.trim()
              ? { beatAndRhythmNotes: ai.beatAndRhythmAnalysis.trim() }
              : {}),
            ...(typeof ai.optimizationNotes === "string" &&
            ai.optimizationNotes.trim()
              ? { optimizationNotes: ai.optimizationNotes.trim() }
              : {}),
            ...(typeof ai.enhancementReason === "string" &&
            ai.enhancementReason.trim()
              ? { enhancementReason: ai.enhancementReason.trim() }
              : {}),
            ...(Array.isArray(data.groundingSources)
              ? { groundingSources: data.groundingSources }
              : {}),
          },
        });

        if (notifyOnFinish) {
          addToast(
            data.apiError
              ? "Acoustic profile calibrated locally"
              : "Track metadata & studio profile updated",
            "success",
            2600
          );
        }
        return true;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Song analysis unavailable";
        const latest =
          useStore.getState().tracks.find((t) => t.id === track.id) || track;
        await useStore.getState().updateTrackDeepAnalysis(track.id, {
          analysis: {
            apiAnalyzing: false,
            apiError: msg,
            key:
              latest.analysis.key === "Detecting…"
                ? "Unknown"
                : latest.analysis.key,
          },
        });
        if (notifyOnFinish) {
          addToast(msg, "error", 3200);
        }
        return false;
      } finally {
        inflightRef.current.delete(track.id);
      }
    },
    []
  );

  return { analyzeTrackWithAPI };
}
