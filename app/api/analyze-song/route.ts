import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PRESET_LIST } from "../../../lib/presets";

export const maxDuration = 60;

interface AnalyzeSongRequestBody {
  fileName?: string;
  duration?: number;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
  };
  acousticSummary?: {
    bpm?: number;
    lufs?: number;
    lra?: number;
    truePeak?: number;
    crestFactorDb?: number;
    beatPunchScore?: number;
    spectralCentroidHz?: number;
    stereoCorrelation?: number;
    transientDensity?: number;
    mudRatio?: number;
    harshnessRatio?: number;
    dynamicHealthScore?: number;
    subEnergyRatio?: number;
    lowMidEnergyRatio?: number;
    highMidEnergyRatio?: number;
    highEnergyRatio?: number;
  };
  audioSnippetBase64?: string;
  audioMimeType?: string;
}

interface PythonAnalysisResult {
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
  feelingMood?: string;
  feelingColor?: string;
  recommendedMode?: string;
  optimalProfile?: {
    subDb: number;
    bassDb: number;
    warmthDb: number;
    clarityDb: number;
    airDb: number;
    compAmount: number;
    harmonicDrive: number;
    stereoWidth: number;
    beatImpact?: number;
  };
  vibeCurve?: Array<{
    t: number;
    energy: number;
    bassLiftDb: number;
    clarityLiftDb: number;
    widthBoost: number;
  }>;
  error?: string;
}

function runPythonAnalyzer(
  audioSnippetBase64?: string
): PythonAnalysisResult | null {
  if (!audioSnippetBase64) return null;
  try {
    const scriptPath = path.join(
      process.cwd(),
      "lib",
      "python",
      "analyze_audio.py"
    );
    const proc = spawnSync("python3", [scriptPath], {
      input: JSON.stringify({ audioSnippetBase64 }),
      encoding: "utf-8",
      timeout: 8000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (proc.status === 0 && proc.stdout) {
      const parsed = JSON.parse(proc.stdout) as PythonAnalysisResult;
      if (!parsed.error) return parsed;
    }
  } catch {
    // Environments without python3 fall back seamlessly
  }
  return null;
}

function buildPythonPayload(pythonResult: PythonAnalysisResult | null) {
  if (!pythonResult) return null;
  return {
    recommendedPreset: pythonResult.recommendedMode || "auto",
    feelingMood: pythonResult.feelingMood,
    feelingColor: pythonResult.feelingColor,
    optimalProfile: pythonResult.optimalProfile,
    vibeCurve: pythonResult.vibeCurve,
    beatPunchScore: pythonResult.beatPunchScore,
    peakDropTimeSec: pythonResult.peakDropTimeSec,
    subWeightScore: pythonResult.subWeightScore,
    vocalClarityScore: pythonResult.vocalClarityScore,
    crestFactorDb: pythonResult.crestFactorDb,
    spectralCentroidHz: pythonResult.spectralCentroidHz,
    stereoCorrelation: pythonResult.stereoCorrelation,
    transientDensity: pythonResult.transientDensity,
    mudRatio: pythonResult.mudRatio,
    harshnessRatio: pythonResult.harshnessRatio,
    dynamicHealthScore: pythonResult.dynamicHealthScore,
    smartTechniquesApplied: pythonResult.smartTechniquesApplied,
    analysisEngine: pythonResult.engine || "python-dsp-v3",
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: AnalyzeSongRequestBody;
  try {
    body = (await req.json()) as AnalyzeSongRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  // Stage 1: Execute Python acoustic & psychoacoustic DSP analyzer on WAV snippet
  const pythonResult = runPythonAnalyzer(body.audioSnippetBase64);
  const pyFields = buildPythonPayload(pythonResult);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      analysis: pyFields
        ? {
            ...pyFields,
            optimizationNotes:
              "Python DSP v3 tuned 5-band EQ, 120 Hz mono bass lock, adaptive de-mud/de-harsh, and per-second vibe dynamics.",
          }
        : null,
      apiError: null,
      groundingSources: [],
    });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const fileName = String(body.fileName || "Uploaded Song").slice(0, 200);
  const duration =
    typeof body.duration === "number" && body.duration > 0
      ? Number(body.duration.toFixed(1))
      : 180;
  const titleHint = body.metadata?.title || fileName;
  const artistHint = body.metadata?.artist || "";
  const albumHint = body.metadata?.album || "";

  const combinedMetrics = {
    acousticSummary: body.acousticSummary || {},
    ...(pythonResult
      ? {
          pythonDsp: {
            crestFactorDb: pythonResult.crestFactorDb,
            beatPunchScore: pythonResult.beatPunchScore,
            spectralCentroidHz: pythonResult.spectralCentroidHz,
            transientDensity: pythonResult.transientDensity,
            mudRatio: pythonResult.mudRatio,
            harshnessRatio: pythonResult.harshnessRatio,
            dynamicHealthScore: pythonResult.dynamicHealthScore,
            feelingMood: pythonResult.feelingMood,
            recommendedMode: pythonResult.recommendedMode,
            optimalProfile: pythonResult.optimalProfile,
          },
        }
      : {}),
  };

  const modesList = PRESET_LIST.join(" | ");

  const systemInstruction = [
    "You are a world-class mastering engineer, psychoacoustic researcher, and musicologist.",
    "The user uploaded an audio track. You receive:",
    "1) An audio snippet of the song (listen closely to beats, sub-bass groove, vocal presence, mud/harshness, energy swings, and emotional vibe).",
    "2) Python DSP v3 + Web Audio psychoacoustic telemetry (LUFS, LRA, crest factor, beat punch score, spectral centroid Hz, transient density, mud ratio, harshness ratio, dynamic health score).",
    "3) Google Search tool (`googleSearch`) — ALWAYS search Google & YouTube to identify the official track, artist, genre, year, YouTube link, BPM, and musical key.",
    "",
    "Do NOT return lyrics. Focus 100% on deep song identification, beat & dynamic energy analysis, emotional vibe palette, and smart psychoacoustic enhancement so every part of the song feels punchy, loud (up to 200%), clear, and vibey without distortion.",
    "",
    "Return ONLY ONE valid JSON object matching these exact keys:",
    "{",
    '  "title": string,',
    '  "artist": string | null,',
    '  "album": string | null,',
    '  "year": string | null,',
    '  "genre": string | null,',
    '  "youtubeUrl": string | null,',
    '  "youtubeTitle": string | null,',
    '  "key": string,',
    '  "timeSignature": string,',
    '  "bpm": number | null,',
    '  "hasVocals": boolean,',
    '  "feelingMood": "euphoric" | "bass-heavy" | "warm-chill" | "electric" | "cinematic" | "bright-pop",',
    '  "feelingColor": string,',
    `  "recommendedPreset": ${JSON.stringify(modesList)},`,
    '  "summary": string,',
    '  "beatAndRhythmAnalysis": string,',
    '  "optimizationNotes": string,',
    '  "enhancementReason": string',
    "}",
    "",
    "RULES:",
    "- Use real YouTube URLs found via googleSearch (set youtubeUrl to null if not found).",
    `- recommendedPreset MUST be one of: ${modesList}.`,
    "- feelingColor MUST be a 6-digit hex color matching the emotional energy of the song (e.g. #14B8A6, #F59E0B, #06B6D4, #FB7185, #8B5CF6, #10B981).",
    "- Keep optimizationNotes practical and specific to how 120Hz mono bass lock, Fletcher-Munson equal-loudness contour, upward micro-detail lift, and de-mud/de-harshing optimize this track.",
  ].join("\n");

  const userPrompt = [
    `Uploaded file: "${fileName}"`,
    `Duration: ${duration}s`,
    `Hints -> Title: "${titleHint}", Artist: "${artistHint}", Album: "${albumHint}"`,
    `Python DSP v3 & Psychoacoustic Telemetry:\n${JSON.stringify(combinedMetrics, null, 2)}`,
    "",
    "Search Google & YouTube for this song, analyze the attached audio, and return the JSON vibe & psychoacoustic optimization profile.",
  ].join("\n");

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (
    typeof body.audioSnippetBase64 === "string" &&
    body.audioSnippetBase64.length > 0 &&
    body.audioSnippetBase64.length < 6_000_000
  ) {
    parts.push({
      inlineData: {
        mimeType: body.audioMimeType || "audio/wav",
        data: body.audioSnippetBase64,
      },
    });
  }
  parts.push({ text: userPrompt });

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const rawText = response.text || "";
    const parsed = extractJsonObject(rawText);

    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingSources: Array<{ title: string; uri: string }> = [];
    const seenUris = new Set<string>();
    for (const chunk of chunks) {
      const uri = chunk?.web?.uri;
      const title = chunk?.web?.title;
      if (typeof uri === "string" && /^https?:\/\//i.test(uri) && !seenUris.has(uri)) {
        seenUris.add(uri);
        groundingSources.push({
          uri,
          title: typeof title === "string" && title.trim() ? title.trim() : uri,
        });
      }
    }

    if (!parsed) {
      return NextResponse.json({
        analysis: pyFields,
        apiError: "Could not parse Gemini response; Python DSP v3 optimization applied.",
        groundingSources,
      });
    }

    const mergedAnalysis = {
      ...parsed,
      ...(pyFields
        ? {
            optimalProfile: pyFields.optimalProfile,
            vibeCurve: pyFields.vibeCurve,
            beatPunchScore: pyFields.beatPunchScore,
            peakDropTimeSec: pyFields.peakDropTimeSec,
            subWeightScore: pyFields.subWeightScore,
            vocalClarityScore: pyFields.vocalClarityScore,
            crestFactorDb: pyFields.crestFactorDb,
            spectralCentroidHz: pyFields.spectralCentroidHz,
            stereoCorrelation: pyFields.stereoCorrelation,
            transientDensity: pyFields.transientDensity,
            mudRatio: pyFields.mudRatio,
            harshnessRatio: pyFields.harshnessRatio,
            dynamicHealthScore: pyFields.dynamicHealthScore,
            smartTechniquesApplied: pyFields.smartTechniquesApplied,
            analysisEngine: `${pyFields.analysisEngine} + gemini-google`,
          }
        : { analysisEngine: "local-dsp + gemini-google" }),
    };

    return NextResponse.json({
      analysis: mergedAnalysis,
      groundingSources,
    });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Gemini song analysis failed.";
    let message =
      "Google/Gemini web analysis unavailable — Python DSP v3 & local psychoacoustic optimization remain active.";

    if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
      message =
        "Gemini API quota/rate limit reached (429). Python DSP v3 & psychoacoustic song optimization remain active.";
    } else if (
      raw.includes("API_KEY_INVALID") ||
      raw.includes("PERMISSION_DENIED") ||
      raw.includes("403")
    ) {
      message =
        "Gemini API key rejected (403). Verify Settings > Secrets — Python DSP v3 & psychoacoustic optimization remain active.";
    }

    return NextResponse.json({
      analysis: pyFields,
      apiError: message,
      groundingSources: [],
    });
  }
}
