"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  applyEnhancementToSlot,
  createDoubleChainAudioGraph,
  DoubleChainAudioGraph,
  MasteringSlotNodes,
} from "../lib/dsp";
import {
  ABRepeatState,
  EnhancementSettings,
  PlaybackSpeed,
  Track,
  VisualizerLevels,
} from "../lib/types";

interface SlotRuntimeState {
  id: "A" | "B";
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  track: Track | null;
  startedAtContextTime: number;
  offsetSeconds: number;
  autoAdvanceFired: boolean;
}

interface UseAudioEngineOptions {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: PlaybackSpeed;
  loopTrack: boolean;
  abRepeat: ABRepeatState;
  enhancement: EnhancementSettings;
  restoredPosition: number | null;
  onRestoredPositionApplied: () => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onAutoAdvance: () => void;
  onDecodeError: (msg: string) => void;
  onAutoplayBlocked: (blocked: boolean) => void;
}

export interface AudioEngineController {
  seek: (seconds: number) => void;
  getCurrentTime: () => number;
  getAnalyserNode: () => AnalyserNode | null;
  getVisualizerLevels: () => VisualizerLevels;
  resumeAudioContext: () => Promise<boolean>;
}

export function useAudioEngine({
  currentTrack,
  isPlaying,
  volume,
  playbackSpeed,
  loopTrack,
  abRepeat,
  enhancement,
  restoredPosition,
  onRestoredPositionApplied,
  onTimeUpdate,
  onDurationChange,
  onAutoAdvance,
  onDecodeError,
  onAutoplayBlocked,
}: UseAudioEngineOptions): AudioEngineController {
  const graphRef = useRef<DoubleChainAudioGraph | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSlotIdRef = useRef<"A" | "B">("A");
  const playRequestSeqRef = useRef<number>(0);
  const lastAppliedSpeedRef = useRef<PlaybackSpeed>(playbackSpeed);

  const slotsRef = useRef<Record<"A" | "B", SlotRuntimeState>>({
    A: {
      id: "A",
      source: null,
      buffer: null,
      track: null,
      startedAtContextTime: 0,
      offsetSeconds: 0,
      autoAdvanceFired: false,
    },
    B: {
      id: "B",
      source: null,
      buffer: null,
      track: null,
      startedAtContextTime: 0,
      offsetSeconds: 0,
      autoAdvanceFired: false,
    },
  });

  const isPlayingRef = useRef<boolean>(isPlaying);
  const volumeRef = useRef<number>(volume);
  const playbackSpeedRef = useRef<PlaybackSpeed>(playbackSpeed);
  const loopTrackRef = useRef<boolean>(loopTrack);
  const abRepeatRef = useRef<ABRepeatState>(abRepeat);
  const enhancementRef = useRef<EnhancementSettings>(enhancement);
  const restoredPositionRef = useRef<number | null>(restoredPosition);
  const rafIdRef = useRef<number>(0);
  const freqScratchRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const lastMomentAdaptMsRef = useRef<number>(0);
  const prevBassEnergyRef = useRef<number>(0);
  const beatPulseHoldRef = useRef<number>(0);

  const callbacksRef = useRef({
    onRestoredPositionApplied,
    onTimeUpdate,
    onDurationChange,
    onAutoAdvance,
    onDecodeError,
    onAutoplayBlocked,
  });

  useEffect(() => {
    callbacksRef.current = {
      onRestoredPositionApplied,
      onTimeUpdate,
      onDurationChange,
      onAutoAdvance,
      onDecodeError,
      onAutoplayBlocked,
    };
  }, [
    onRestoredPositionApplied,
    onTimeUpdate,
    onDurationChange,
    onAutoAdvance,
    onDecodeError,
    onAutoplayBlocked,
  ]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    loopTrackRef.current = loopTrack;
  }, [loopTrack]);

  useEffect(() => {
    abRepeatRef.current = abRepeat;
  }, [abRepeat]);

  useEffect(() => {
    enhancementRef.current = enhancement;
  }, [enhancement]);

  useEffect(() => {
    restoredPositionRef.current = restoredPosition;
  }, [restoredPosition]);

  const ensureGraph = useCallback((): DoubleChainAudioGraph | null => {
    if (typeof window === "undefined") return null;
    if (!graphRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      let ctx: AudioContext;
      try {
        ctx = new AudioCtx({ latencyHint: "interactive" });
      } catch {
        ctx = new AudioCtx();
      }
      graphRef.current = createDoubleChainAudioGraph(ctx);
    }
    return graphRef.current;
  }, []);

  const getSlotChain = useCallback(
    (slotId: "A" | "B"): MasteringSlotNodes | null => {
      const g = graphRef.current;
      if (!g) return null;
      return slotId === "A" ? g.slotA : g.slotB;
    },
    []
  );

  const stopSlotSource = useCallback((slotId: "A" | "B") => {
    const slot = slotsRef.current[slotId];
    if (slot.source) {
      try {
        slot.source.onended = null;
        slot.source.stop();
        slot.source.disconnect();
      } catch {
        // Already stopped
      }
      slot.source = null;
    }
  }, []);

  const decodeTrackBuffer = useCallback(
    async (track: Track): Promise<AudioBuffer | null> => {
      const graph = ensureGraph();
      if (!graph) return null;

      const cache = bufferCacheRef.current;
      const cached = cache.get(track.id);
      if (cached) {
        // Refresh LRU order
        cache.delete(track.id);
        cache.set(track.id, cached);
        return cached;
      }

      const arrayBuf = await track.blob.arrayBuffer();
      const decoded = await graph.context.decodeAudioData(arrayBuf.slice(0));
      if (cache.size >= 12) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      cache.set(track.id, decoded);
      return decoded;
    },
    [ensureGraph]
  );

  const resumeAudioContext = useCallback(async (): Promise<boolean> => {
    const graph = ensureGraph();
    if (!graph) return false;
    try {
      if (graph.context.state === "suspended") {
        await graph.context.resume();
      }
      const resumed = graph.context.state === "running";
      callbacksRef.current.onAutoplayBlocked(!resumed);
      return resumed;
    } catch {
      callbacksRef.current.onAutoplayBlocked(true);
      return false;
    }
  }, [ensureGraph]);

  const computeSlotTime = useCallback(
    (slot: SlotRuntimeState, ctxTime: number): number => {
      if (!slot.buffer) return slot.offsetSeconds;
      if (!slot.source || !isPlayingRef.current) return slot.offsetSeconds;
      const elapsed =
        (ctxTime - slot.startedAtContextTime) * playbackSpeedRef.current +
        slot.offsetSeconds;
      return Math.min(slot.buffer.duration, Math.max(0, elapsed));
    },
    []
  );

  const startSlotPlaybackRef = useRef<
    ((slotId: "A" | "B", track: Track, buffer: AudioBuffer, offsetSec: number) => void) | null
  >(null);

  const startSlotPlayback = useCallback(
    (
      slotId: "A" | "B",
      track: Track,
      buffer: AudioBuffer,
      offsetSec: number
    ) => {
      const graph = ensureGraph();
      if (!graph) return;
      const chain = slotId === "A" ? graph.slotA : graph.slotB;
      const slot = slotsRef.current[slotId];

      if (graph.context.state === "suspended") {
        graph.context
          .resume()
          .then(() => {
            callbacksRef.current.onAutoplayBlocked(
              graph.context.state !== "running"
            );
          })
          .catch(() => {
            callbacksRef.current.onAutoplayBlocked(true);
          });
      }

      stopSlotSource(slotId);

      const clampedOffset = Math.max(
        0,
        Math.min(offsetSec, Math.max(0, buffer.duration - 0.05))
      );

      applyEnhancementToSlot(
        chain,
        track.analysis,
        enhancementRef.current,
        clampedOffset
      );

      const now = graph.context.currentTime;
      chain.inputGain.gain.cancelScheduledValues(now);
      chain.inputGain.gain.setValueAtTime(0.001, now);
      chain.inputGain.gain.linearRampToValueAtTime(1.0, now + 0.015);

      const src = graph.context.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.setValueAtTime(playbackSpeedRef.current, now);
      src.connect(chain.inputGain);

      slot.track = track;
      slot.buffer = buffer;
      slot.offsetSeconds = clampedOffset;
      slot.startedAtContextTime = now;
      slot.autoAdvanceFired = false;
      slot.source = src;

      src.onended = () => {
        if (activeSlotIdRef.current !== slotId || !isPlayingRef.current) return;
        const ab = abRepeatRef.current;
        if (ab.active && ab.a !== null && ab.b !== null) {
          return;
        }
        const elapsed = computeSlotTime(slot, graph.context.currentTime);
        if (elapsed >= buffer.duration - 0.2 && !slot.autoAdvanceFired) {
          slot.autoAdvanceFired = true;
          if (loopTrackRef.current) {
            slot.offsetSeconds = 0;
            callbacksRef.current.onTimeUpdate(0);
            startSlotPlaybackRef.current?.(slotId, track, buffer, 0);
          } else {
            slot.offsetSeconds = 0;
            callbacksRef.current.onTimeUpdate(0);
            callbacksRef.current.onAutoAdvance();
          }
        }
      };

      src.start(0, clampedOffset);
    },
    [computeSlotTime, ensureGraph, stopSlotSource]
  );

  useEffect(() => {
    startSlotPlaybackRef.current = startSlotPlayback;
  }, [startSlotPlayback]);

  useEffect(() => {
    const prevSpeed = lastAppliedSpeedRef.current;
    playbackSpeedRef.current = playbackSpeed;
    lastAppliedSpeedRef.current = playbackSpeed;

    const graph = graphRef.current;
    if (!graph) return;
    const activeSlot = slotsRef.current[activeSlotIdRef.current];
    if (activeSlot.source && activeSlot.buffer && isPlayingRef.current) {
      const now = graph.context.currentTime;
      const currentPos = Math.min(
        activeSlot.buffer.duration,
        Math.max(
          0,
          (now - activeSlot.startedAtContextTime) * prevSpeed +
            activeSlot.offsetSeconds
        )
      );
      activeSlot.offsetSeconds = currentPos;
      activeSlot.startedAtContextTime = now;
      activeSlot.source.playbackRate.setValueAtTime(playbackSpeed, now);
    }
  }, [playbackSpeed]);

  useEffect(() => {
    let cancelled = false;
    if (!currentTrack) {
      stopSlotSource("A");
      stopSlotSource("B");
      slotsRef.current.A.buffer = null;
      slotsRef.current.A.track = null;
      slotsRef.current.B.buffer = null;
      slotsRef.current.B.track = null;
      return;
    }

    const activeId = activeSlotIdRef.current;
    const activeSlot = slotsRef.current[activeId];

    if (activeSlot.track?.id === currentTrack.id && activeSlot.buffer) {
      activeSlot.track = currentTrack;
      const activeChain = getSlotChain(activeId);
      if (activeChain) {
        applyEnhancementToSlot(
          activeChain,
          currentTrack.analysis,
          enhancementRef.current,
          activeSlot.offsetSeconds
        );
      }
      return;
    }

    const requestSeq = ++playRequestSeqRef.current;
    const otherId: "A" | "B" = activeId === "A" ? "B" : "A";
    stopSlotSource(activeId);
    stopSlotSource(otherId);

    const initialPos = restoredPositionRef.current ?? 0;
    if (restoredPositionRef.current !== null) {
      callbacksRef.current.onRestoredPositionApplied();
    }
    activeSlot.offsetSeconds = initialPos;
    callbacksRef.current.onTimeUpdate(initialPos);

    async function loadTrack(track: Track) {
      try {
        const graph = ensureGraph();
        if (!graph) return;
        const decoded = await decodeTrackBuffer(track);
        if (cancelled || !decoded || requestSeq !== playRequestSeqRef.current) {
          return;
        }

        const activeChain = activeId === "A" ? graph.slotA : graph.slotB;
        const otherChain = otherId === "A" ? graph.slotA : graph.slotB;

        const now = graph.context.currentTime;
        otherChain.slotGain.gain.cancelScheduledValues(now);
        otherChain.slotGain.gain.setValueAtTime(0, now);

        activeChain.slotGain.gain.cancelScheduledValues(now);
        activeChain.slotGain.gain.setValueAtTime(1, now);

        activeSlot.track = track;
        activeSlot.buffer = decoded;
        callbacksRef.current.onDurationChange(decoded.duration);

        applyEnhancementToSlot(
          activeChain,
          track.analysis,
          enhancementRef.current,
          activeSlot.offsetSeconds
        );

        if (isPlayingRef.current) {
          startSlotPlayback(activeId, track, decoded, activeSlot.offsetSeconds);
        }
      } catch {
        if (!cancelled && requestSeq === playRequestSeqRef.current) {
          callbacksRef.current.onDecodeError(
            `Could not decode "${track.name}". Ensure it is a valid audio file.`
          );
        }
      }
    }

    void loadTrack(currentTrack);

    return () => {
      cancelled = true;
    };
  }, [
    currentTrack,
    decodeTrackBuffer,
    ensureGraph,
    getSlotChain,
    startSlotPlayback,
    stopSlotSource,
  ]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const activeId = activeSlotIdRef.current;
    const activeSlot = slotsRef.current[activeId];
    const otherId: "A" | "B" = activeId === "A" ? "B" : "A";

    if (isPlaying) {
      if (graph.context.state === "suspended") {
        graph.context
          .resume()
          .then(() => {
            callbacksRef.current.onAutoplayBlocked(
              graph.context.state !== "running"
            );
          })
          .catch(() => {
            callbacksRef.current.onAutoplayBlocked(true);
          });
      }

      if (!activeSlot.source && activeSlot.buffer && activeSlot.track) {
        const now = graph.context.currentTime;
        const activeChain = activeId === "A" ? graph.slotA : graph.slotB;
        activeChain.slotGain.gain.cancelScheduledValues(now);
        activeChain.slotGain.gain.setValueAtTime(1, now);

        startSlotPlayback(
          activeId,
          activeSlot.track,
          activeSlot.buffer,
          activeSlot.offsetSeconds
        );
      }
    } else {
      stopSlotSource(otherId);
      const otherChain = otherId === "A" ? graph.slotA : graph.slotB;
      const now = graph.context.currentTime;
      otherChain.slotGain.gain.cancelScheduledValues(now);
      otherChain.slotGain.gain.setValueAtTime(0, now);

      const activeChain = activeId === "A" ? graph.slotA : graph.slotB;
      activeChain.slotGain.gain.cancelScheduledValues(now);
      activeChain.slotGain.gain.setValueAtTime(1, now);

      if (activeSlot.source && activeSlot.buffer) {
        activeSlot.offsetSeconds = computeSlotTime(
          activeSlot,
          graph.context.currentTime
        );
        stopSlotSource(activeId);
      }
    }
  }, [computeSlotTime, isPlaying, startSlotPlayback, stopSlotSource]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    (["A", "B"] as const).forEach((slotId) => {
      const slot = slotsRef.current[slotId];
      const chain = slotId === "A" ? graph.slotA : graph.slotB;
      applyEnhancementToSlot(
        chain,
        slot.track?.analysis ?? currentTrack?.analysis ?? null,
        enhancement,
        slot.offsetSeconds
      );
    });
  }, [currentTrack?.analysis, enhancement]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const now = graph.context.currentTime;
    const clampedVol = Math.max(0, Math.min(1, volume));
    graph.masterGain.gain.cancelScheduledValues(now);
    graph.masterGain.gain.setValueAtTime(graph.masterGain.gain.value, now);
    graph.masterGain.gain.linearRampToValueAtTime(clampedVol, now + 0.025);
  }, [volume]);

  const seek = useCallback(
    (seconds: number) => {
      const graph = graphRef.current;
      const activeId = activeSlotIdRef.current;
      const activeSlot = slotsRef.current[activeId];
      const maxDur = activeSlot.buffer
        ? activeSlot.buffer.duration
        : currentTrack?.duration || 0;

      const target = Math.max(0, Math.min(seconds, maxDur));
      activeSlot.offsetSeconds = target;
      activeSlot.autoAdvanceFired = false;
      callbacksRef.current.onTimeUpdate(target);

      if (
        graph &&
        activeSlot.buffer &&
        activeSlot.track &&
        isPlayingRef.current
      ) {
        startSlotPlayback(activeId, activeSlot.track, activeSlot.buffer, target);
      }
    },
    [currentTrack?.duration, startSlotPlayback]
  );

  useEffect(() => {
    const tick = (nowMs: number) => {
      const graph = graphRef.current;
      const activeId = activeSlotIdRef.current;
      const activeSlot = slotsRef.current[activeId];

      if (
        isPlayingRef.current &&
        graph &&
        activeSlot.buffer &&
        activeSlot.source
      ) {
        const current = computeSlotTime(activeSlot, graph.context.currentTime);
        callbacksRef.current.onTimeUpdate(current);

        // Per-moment Smart Vibe adaptation (~8 Hz updates for smooth dynamic flow)
        if (
          enhancementRef.current.smartVibeAdapt &&
          enhancementRef.current.enabled &&
          !enhancementRef.current.abBypassOriginal &&
          activeSlot.track?.analysis?.vibeCurve?.length &&
          nowMs - lastMomentAdaptMsRef.current >= 125
        ) {
          lastMomentAdaptMsRef.current = nowMs;
          const activeChain = activeId === "A" ? graph.slotA : graph.slotB;
          applyEnhancementToSlot(
            activeChain,
            activeSlot.track.analysis,
            enhancementRef.current,
            current
          );
        }

        const ab = abRepeatRef.current;
        if (ab.active && ab.a !== null && ab.b !== null && current >= ab.b) {
          seek(ab.a);
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [computeSlotTime, seek]);

  useEffect(() => {
    return () => {
      stopSlotSource("A");
      stopSlotSource("B");
      if (graphRef.current) {
        graphRef.current.context.close().catch(() => {});
        graphRef.current = null;
      }
    };
  }, [stopSlotSource]);

  const getCurrentTime = useCallback((): number => {
    const graph = graphRef.current;
    const activeSlot = slotsRef.current[activeSlotIdRef.current];
    if (!graph || !activeSlot.buffer) return activeSlot.offsetSeconds;
    return computeSlotTime(activeSlot, graph.context.currentTime);
  }, [computeSlotTime]);

  const getVisualizerLevels = useCallback((): VisualizerLevels => {
    const graph = graphRef.current;
    const analyser = graph?.masterAnalyser;
    if (!analyser || !isPlayingRef.current) {
      return { bass: 0.06, mid: 0.06, high: 0.06, energy: 0.08, beatPulse: 0 };
    }
    const binCount = analyser.frequencyBinCount;
    if (!freqScratchRef.current || freqScratchRef.current.length !== binCount) {
      freqScratchRef.current = new Uint8Array(binCount);
    }
    analyser.getByteFrequencyData(freqScratchRef.current);

    let bassSum = 0;
    let bassPeak = 0;
    for (let i = 0; i <= 10 && i < binCount; i++) {
      const v = freqScratchRef.current[i];
      bassSum += v;
      if (v > bassPeak) bassPeak = v;
    }
    const bass = Math.min(1, (bassSum / (11 * 255)) * 0.55 + (bassPeak / 255) * 0.6);

    let midSum = 0;
    for (let i = 11; i <= 75 && i < binCount; i++) {
      midSum += freqScratchRef.current[i];
    }
    const mid = Math.min(1, (midSum / (65 * 255)) * 1.25);

    let highSum = 0;
    const highEnd = Math.min(260, binCount - 1);
    for (let i = 76; i <= highEnd; i++) {
      highSum += freqScratchRef.current[i];
    }
    const high = Math.min(1, (highSum / (Math.max(1, highEnd - 75) * 255)) * 1.45);

    const energy = Math.min(1, bass * 0.45 + mid * 0.35 + high * 0.2);

    // Real-time transient kick/beat detector + analyzed beat timestamp proximity
    const delta = bass - prevBassEnergyRef.current;
    prevBassEnergyRef.current = bass * 0.72 + prevBassEnergyRef.current * 0.28;
    if (delta > 0.06 || bass > 0.72) {
      beatPulseHoldRef.current = Math.min(1, Math.max(beatPulseHoldRef.current, bass * 0.95 + delta * 1.8));
    } else {
      beatPulseHoldRef.current *= 0.84;
    }

    return {
      bass,
      mid,
      high,
      energy,
      beatPulse: Math.max(0, Math.min(1, beatPulseHoldRef.current)),
    };
  }, []);

  const getAnalyserNode = useCallback((): AnalyserNode | null => {
    return graphRef.current?.masterAnalyser || null;
  }, []);

  return {
    seek,
    getCurrentTime,
    getAnalyserNode,
    getVisualizerLevels,
    resumeAudioContext,
  };
}
