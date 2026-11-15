"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "../store/useStore";
import { useAudioEngine } from "./useAudioEngine";
import { Track } from "../lib/types";

export function usePlayer() {
  const tracks = useStore((s) => s.tracks);
  const currentTrackId = useStore((s) => s.currentTrackId);
  const isPlaying = useStore((s) => s.isPlaying);
  const currentTime = useStore((s) => s.currentTime);
  const restoredPosition = useStore((s) => s.restoredPosition);
  const duration = useStore((s) => s.duration);
  const volume = useStore((s) => s.volume);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const loopTrack = useStore((s) => s.loopTrack);
  const abRepeat = useStore((s) => s.abRepeat);
  const enhancement = useStore((s) => s.enhancement);
  const visualsEnabled = useStore((s) => s.visualsEnabled);
  const barStyle = useStore((s) => s.barStyle);
  const isFullscreenVibe = useStore((s) => s.isFullscreenVibe);

  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const setCurrentTime = useStore((s) => s.setCurrentTime);
  const clearRestoredPosition = useStore((s) => s.clearRestoredPosition);
  const setDuration = useStore((s) => s.setDuration);
  const setVolume = useStore((s) => s.setVolume);
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed);
  const setLoopTrack = useStore((s) => s.setLoopTrack);
  const setABPointA = useStore((s) => s.setABPointA);
  const setABPointB = useStore((s) => s.setABPointB);
  const setABLoopRange = useStore((s) => s.setABLoopRange);
  const clearABRepeat = useStore((s) => s.clearABRepeat);
  const setEnhancement = useStore((s) => s.setEnhancement);
  const selectEnhancementPreset = useStore((s) => s.selectEnhancementPreset);
  const applySmartOptimalEnhancement = useStore(
    (s) => s.applySmartOptimalEnhancement
  );
  const saveTrackEnhancement = useStore((s) => s.saveTrackEnhancement);
  const clearTrackEnhancement = useStore((s) => s.clearTrackEnhancement);
  const reorderQueue = useStore((s) => s.reorderQueue);
  const toggleEnhancementEnabled = useStore((s) => s.toggleEnhancementEnabled);
  const toggleAbOriginal = useStore((s) => s.toggleAbOriginal);
  const setLoudnessBoosterLevel = useStore((s) => s.setLoudnessBoosterLevel);
  const cycleLoudnessBooster = useStore((s) => s.cycleLoudnessBooster);
  const toggleLoudness200 = useStore((s) => s.toggleLoudness200);
  const setVisualsEnabled = useStore((s) => s.setVisualsEnabled);
  const setBarStyle = useStore((s) => s.setBarStyle);
  const setFullscreenVibe = useStore((s) => s.setFullscreenVibe);
  const toggleFullscreenVibe = useStore((s) => s.toggleFullscreenVibe);
  const setAutoplayBlocked = useStore((s) => s.setAutoplayBlocked);
  const selectTrack = useStore((s) => s.selectTrack);
  const advanceToNextTrack = useStore((s) => s.advanceToNextTrack);
  const stepToPrevTrack = useStore((s) => s.stepToPrevTrack);
  const persistSessionSnapshot = useStore((s) => s.persistSessionSnapshot);
  const addToast = useStore((s) => s.addToast);

  const currentTrack: Track | null = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) || null,
    [tracks, currentTrackId]
  );

  const onDecodeError = useCallback(
    (msg: string) => {
      setIsPlaying(false);
      addToast(msg, "error");
    },
    [addToast, setIsPlaying]
  );

  const advanceRef = useRef<() => void>(() => {});

  const engine = useAudioEngine({
    currentTrack,
    isPlaying,
    volume,
    playbackSpeed,
    loopTrack,
    abRepeat,
    enhancement,
    restoredPosition,
    onRestoredPositionApplied: clearRestoredPosition,
    onTimeUpdate: setCurrentTime,
    onDurationChange: setDuration,
    onAutoAdvance: () => advanceRef.current(),
    onDecodeError,
    onAutoplayBlocked: setAutoplayBlocked,
  });

  useEffect(() => {
    if (!currentTrackId) return;
    const interval = setInterval(() => {
      if (isPlaying) {
        void persistSessionSnapshot();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentTrackId, isPlaying, persistSessionSnapshot]);

  useEffect(() => {
    if (!isPlaying && currentTrackId) {
      void persistSessionSnapshot();
    }
  }, [currentTrackId, isPlaying, persistSessionSnapshot]);

  useEffect(() => {
    const handleUnload = () => {
      void persistSessionSnapshot();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [persistSessionSnapshot]);

  const playNextTrack = useCallback(() => {
    const next = advanceToNextTrack();
    if (!next) return;
    if (next.id === currentTrack?.id) {
      engine.seek(0);
      setIsPlaying(true);
      return;
    }
    selectTrack(next.id, true);
  }, [advanceToNextTrack, currentTrack?.id, engine, selectTrack, setIsPlaying]);

  useEffect(() => {
    advanceRef.current = playNextTrack;
  }, [playNextTrack]);

  const playPrevTrack = useCallback(() => {
    const t = engine.getCurrentTime();
    if (t > 3 && currentTrack) {
      engine.seek(0);
      return;
    }
    const prev = stepToPrevTrack();
    if (!prev) return;
    if (prev.id === currentTrack?.id) {
      engine.seek(0);
      setIsPlaying(true);
      return;
    }
    selectTrack(prev.id, true);
  }, [currentTrack, engine, selectTrack, setIsPlaying, stepToPrevTrack]);

  const togglePlay = useCallback(() => {
    if (!currentTrack && tracks.length > 0) {
      selectTrack(tracks[0].id, true);
      return;
    }
    if (!currentTrack) return;
    setIsPlaying(!isPlaying);
  }, [currentTrack, isPlaying, selectTrack, setIsPlaying, tracks]);

  const loopSection = useCallback(
    (startSec: number, endSec: number, label?: string) => {
      setABLoopRange(startSec, endSec, label);
      engine.seek(startSec);
      if (!isPlaying) {
        setIsPlaying(true);
      }
    },
    [engine, isPlaying, setABLoopRange, setIsPlaying]
  );

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration: duration || currentTrack?.duration || 0,
    volume,
    playbackSpeed,
    loopTrack,
    abRepeat,
    enhancement,
    visualsEnabled,
    barStyle,
    isFullscreenVibe,
    togglePlay,
    seek: engine.seek,
    getCurrentTime: engine.getCurrentTime,
    getAnalyserNode: engine.getAnalyserNode,
    getVisualizerLevels: engine.getVisualizerLevels,
    resumeAudioContext: engine.resumeAudioContext,
    setVolume,
    setPlaybackSpeed,
    setLoopTrack,
    setABPointA,
    setABPointB,
    setABLoopRange,
    clearABRepeat,
    loopSection,
    setEnhancement,
    selectEnhancementPreset,
    applySmartOptimalEnhancement,
    saveTrackEnhancement,
    clearTrackEnhancement,
    reorderQueue,
    toggleEnhancementEnabled,
    toggleAbOriginal,
    setLoudnessBoosterLevel,
    cycleLoudnessBooster,
    toggleLoudness200,
    setVisualsEnabled,
    setBarStyle,
    setFullscreenVibe,
    toggleFullscreenVibe,
    playNextTrack,
    playPrevTrack,
    selectTrack,
  };
}
