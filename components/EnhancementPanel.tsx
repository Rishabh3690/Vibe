"use client";

import React, { memo, useMemo, useState } from "react";
import {
  Sliders,
  ArrowLeftRight,
  Zap,
  Headphones,
  Wand2,
  BookmarkCheck,
  RotateCcw,
} from "lucide-react";
import {
  PRESET_CATEGORIES,
  PRESET_CONFIGS,
  PRESET_LIST,
} from "../lib/presets";
import {
  BOOSTER_LEVEL_INFO,
  computePsychoacousticLoudnessPlan,
  OUTPUT_PROFILE_INFO,
} from "../lib/dsp";
import {
  BoosterLevel,
  EnhancementSettings,
  OutputDeviceProfile,
  PresetCategory,
  PresetName,
  SongAnalysis,
} from "../lib/types";

interface EnhancementPanelProps {
  enhancement: EnhancementSettings;
  analysis?: SongAnalysis | null;
  hasCustomSongConfig?: boolean;
  onChange: (patch: Partial<EnhancementSettings>) => void;
  onSelectPreset: (preset: PresetName) => void;
  onApplySmartOptimal?: () => void;
  onSaveToSong?: () => void;
  onClearSongConfig?: () => void;
  onToggleEnabled: () => void;
  onToggleAbOriginal: () => void;
  onSetBoosterLevel?: (level: BoosterLevel) => void;
  onToggleLoudness200: () => void;
}

const OUTPUT_PROFILES: OutputDeviceProfile[] = [
  "headphones",
  "speakers",
  "car",
  "club",
  "studio",
];

function EnhancementPanelComponent({
  enhancement,
  analysis,
  hasCustomSongConfig = false,
  onChange,
  onSelectPreset,
  onApplySmartOptimal,
  onSaveToSong,
  onClearSongConfig,
  onToggleEnabled,
  onToggleAbOriginal,
  onSetBoosterLevel,
  onToggleLoudness200,
}: EnhancementPanelProps) {
  const activePresetCfg =
    PRESET_CONFIGS[enhancement.preset] || PRESET_CONFIGS.auto;
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory>(
    activePresetCfg.category || "smart"
  );

  const isBypassed = !enhancement.enabled || enhancement.abBypassOriginal;
  const loudnessPct = Math.round(enhancement.loudnessPercent ?? 100);
  const isBoostActive = loudnessPct > 100 && !isBypassed;
  const outputProfile = enhancement.outputProfile || "headphones";
  const outputInfo =
    OUTPUT_PROFILE_INFO[outputProfile] || OUTPUT_PROFILE_INFO.headphones;

  const psychoPlan = useMemo(
    () =>
      computePsychoacousticLoudnessPlan(
        loudnessPct,
        analysis,
        enhancement.psychoacousticContour ?? true
      ),
    [loudnessPct, analysis, enhancement.psychoacousticContour]
  );

  const effectiveBoostDb = (
    20 * Math.log10(Math.max(1, psychoPlan.safePreLimiterGain)) +
    psychoPlan.upwardDensityDb * 0.55 +
    psychoPlan.fletcherPresenceLiftDb * 0.55
  ).toFixed(1);

  const modesInCategory = useMemo(
    () =>
      PRESET_LIST.filter(
        (id) => PRESET_CONFIGS[id].category === selectedCategory
      ),
    [selectedCategory]
  );

  const handleSelectBooster = (level: BoosterLevel) => {
    if (onSetBoosterLevel) {
      onSetBoosterLevel(level);
    } else {
      onChange({
        loudnessPercent: level,
        enabled: true,
        abBypassOriginal: false,
      });
    }
  };

  return (
    <div
      data-testid="enhancement-panel"
      className="rounded-2xl bg-[#121215]/85 backdrop-blur-xl border border-white/[0.08] p-4 sm:p-5 space-y-4 transition-all duration-150"
    >
      {/* Header + Save to Song + Auto-Master + Cycle Booster + A/B Compare + Master Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sliders className="w-4 h-4 text-[#14B8A6] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-[#EDEDED]">
              Studio Mastering Rack &amp; Per-Song Configuration (
              {PRESET_LIST.length} Profiles)
            </h2>
            <p className="text-[11px] text-[#8A8A92] truncate tabular-nums">
              {enhancement.abBypassOriginal
                ? "Listening to Original un-processed lossless audio"
                : enhancement.enabled
                ? `${activePresetCfg.label} · ${outputInfo.label} · ${loudnessPct}% Booster · 32-Bit Float / 320kbps Lossless Gain-Staging`
                : "Mastering rack bypassed"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onSaveToSong && (
            <button
              type="button"
              data-testid="save-song-config-btn"
              onClick={onSaveToSong}
              title="Permanently save this Studio Mastering Rack & EQ configuration for the current song"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                hasCustomSongConfig
                  ? "bg-[#14B8A6]/20 text-[#14B8A6] border-[#14B8A6]"
                  : "bg-[#0A0A0B] text-[#EDEDED] border-white/[0.14] hover:border-[#14B8A6]"
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>
                {hasCustomSongConfig
                  ? `Saved to Song (${activePresetCfg.label})`
                  : "Save Rack to Song"}
              </span>
            </button>
          )}

          {hasCustomSongConfig && onClearSongConfig && (
            <button
              type="button"
              data-testid="clear-song-config-btn"
              onClick={onClearSongConfig}
              title="Reset per-song saved configuration"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#8A8A92] hover:text-[#EDEDED] bg-[#0A0A0B] border border-white/[0.08] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Song</span>
            </button>
          )}

          {onApplySmartOptimal && (
            <button
              type="button"
              data-testid="smart-implementer-apply-btn"
              onClick={onApplySmartOptimal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#0A0A0B] bg-[#14B8A6] hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto-Match Track</span>
            </button>
          )}

          <button
            type="button"
            data-testid="loudness-200-toggle"
            onClick={onToggleLoudness200}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
              isBoostActive
                ? "bg-amber-400 text-[#0A0A0B] border-amber-400"
                : "bg-[#0A0A0B] text-[#EDEDED] border-white/[0.12] hover:border-amber-400/50"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {isBoostActive ? `Booster ${loudnessPct}% ON` : "Cycle Booster"}
            </span>
          </button>

          <button
            type="button"
            data-testid="ab-original-button"
            onClick={onToggleAbOriginal}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
              enhancement.abBypassOriginal
                ? "bg-amber-400 text-[#0A0A0B] border-amber-400"
                : "bg-[#0A0A0B] text-[#EDEDED] border-white/[0.12] hover:border-white/[0.25]"
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>
              {enhancement.abBypassOriginal ? "Original (Raw)" : "A/B Compare"}
            </span>
          </button>

          <button
            type="button"
            data-testid="enhance-master-toggle"
            onClick={onToggleEnabled}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
              enhancement.enabled
                ? "bg-[#14B8A6] text-[#0A0A0B] border-[#14B8A6]"
                : "bg-[#0A0A0B] text-[#8A8A92] border-white/[0.1]"
            }`}
          >
            {enhancement.enabled ? "Master ON" : "Master OFF"}
          </button>
        </div>
      </div>

      {/* Output Hardware Target Profile (Headphones / Speakers / Car / Club / Studio) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <Headphones className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-[#EDEDED] block">
              Playback Hardware Target
            </span>
            <span className="text-[10px] text-[#8A8A92] block truncate">
              {outputInfo.shortDesc}
            </span>
          </div>
        </div>

        <div
          role="group"
          aria-label="Listening device output profile"
          className="flex flex-wrap items-center gap-1 bg-[#0A0A0B] p-1 rounded-xl border border-white/[0.06]"
        >
          {OUTPUT_PROFILES.map((prof) => {
            const active = outputProfile === prof;
            return (
              <button
                key={prof}
                type="button"
                data-testid={`output-profile-${prof}`}
                onClick={() =>
                  onChange({ outputProfile: prof, enabled: true })
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[#14B8A6] text-[#0A0A0B] font-semibold"
                    : "text-[#8A8A92] hover:text-[#EDEDED]"
                }`}
              >
                {OUTPUT_PROFILE_INFO[prof].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4-Level Distortion-Free Psychoacoustic Audio Booster (100% Normal · 200% Boost · 250% Hyper · 400% Max) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pb-3.5 border-b border-white/[0.06]">
        <div className="lg:col-span-7 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-[#EDEDED]">
              4-Level Transparent Loudness Booster (100% – 400%)
            </span>
            <span className="font-mono text-amber-300 tabular-nums">
              {loudnessPct}% (+{effectiveBoostDb} dB · De-Harsh{" "}
              {psychoPlan.deHarshCutDb} dB)
            </span>
          </div>

          {/* 4 Instant Booster Level Buttons */}
          <div
            role="group"
            aria-label="4-Level Audio Booster"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
          >
            {BOOSTER_LEVEL_INFO.map((item) => {
              const isSelected = Math.abs(loudnessPct - item.level) <= 8;
              return (
                <button
                  key={item.level}
                  type="button"
                  data-testid={`booster-level-${item.level}`}
                  onClick={() => handleSelectBooster(item.level)}
                  title={item.desc}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors text-center whitespace-nowrap ${
                    isSelected
                      ? item.level === 100
                        ? "bg-[#14B8A6] text-[#0A0A0B] border-[#14B8A6]"
                        : "bg-amber-400 text-[#0A0A0B] border-amber-400"
                      : "bg-[#0A0A0B] text-[#D4D4D8] border-white/[0.08] hover:border-amber-400/50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <input
            type="range"
            data-testid="loudness-percent-slider"
            aria-label="Loudness boost percentage up to 400 percent"
            min={100}
            max={400}
            step={10}
            value={loudnessPct}
            onChange={(e) =>
              onChange({
                loudnessPercent: Number(e.target.value),
                enabled: true,
                abBypassOriginal: false,
              })
            }
            style={{ accentColor: loudnessPct > 100 ? "#FBBF24" : "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
          <p className="text-[10px] text-[#8A8A92] font-mono tabular-nums">
            Transparent Gain-Staging · Upward Density +{psychoPlan.upwardDensityDb} dB · True-Peak Ceiling -0.35 dBFS
          </p>
        </div>

        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2 lg:pl-4 lg:border-l lg:border-white/[0.06] text-[11px]">
          <label className="inline-flex items-center gap-2 cursor-pointer text-[#EDEDED]">
            <input
              type="checkbox"
              data-testid="smart-vibe-adapt-checkbox"
              checked={Boolean(enhancement.smartVibeAdapt)}
              onChange={(e) => onChange({ smartVibeAdapt: e.target.checked })}
              style={{ accentColor: "#14B8A6" }}
              className="rounded cursor-pointer"
            />
            <span className="truncate">Dynamic Section Adapt</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer text-[#EDEDED]">
            <input
              type="checkbox"
              data-testid="mono-bass-checkbox"
              checked={enhancement.monoBassBelow120Hz ?? true}
              onChange={(e) =>
                onChange({ monoBassBelow120Hz: e.target.checked })
              }
              style={{ accentColor: "#14B8A6" }}
              className="rounded cursor-pointer"
            />
            <span className="truncate">120 Hz Mono Bass Lock</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer text-[#EDEDED]">
            <input
              type="checkbox"
              data-testid="psycho-contour-checkbox"
              checked={enhancement.psychoacousticContour ?? true}
              onChange={(e) =>
                onChange({ psychoacousticContour: e.target.checked })
              }
              style={{ accentColor: "#14B8A6" }}
              className="rounded cursor-pointer"
            />
            <span className="truncate">Fletcher-Munson Contour</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer text-[#EDEDED]">
            <input
              type="checkbox"
              data-testid="upward-lift-checkbox"
              checked={enhancement.upwardMicrolift ?? true}
              onChange={(e) => onChange({ upwardMicrolift: e.target.checked })}
              style={{ accentColor: "#14B8A6" }}
              className="rounded cursor-pointer"
            />
            <span className="truncate">Upward Micro-Detail Lift</span>
          </label>
        </div>
      </div>

      {/* Category Tabs for 25 Enhancement Modes */}
      <div className="space-y-2.5">
        <div
          role="tablist"
          aria-label="Enhancement mode categories"
          className="flex flex-wrap items-center gap-1.5"
        >
          {PRESET_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            const containsActivePreset = activePresetCfg.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`preset-cat-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap border ${
                  active
                    ? "bg-[#14B8A6]/15 text-[#EDEDED] border-[#14B8A6]"
                    : "bg-[#0A0A0B] text-[#8A8A92] border-white/[0.06] hover:text-[#EDEDED]"
                }`}
              >
                {cat.label}
                {containsActivePreset ? " ·" : ""}
              </button>
            );
          })}
        </div>

        {/* 5 Modes within the selected category (25 total) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {modesInCategory.map((preset) => {
            const cfg = PRESET_CONFIGS[preset];
            const active = enhancement.preset === preset;
            const isRecommended = analysis?.recommendedPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                data-testid={`preset-mode-${preset}`}
                onClick={() => onSelectPreset(preset)}
                title={cfg.description}
                className={`px-3 py-2 rounded-xl text-left border transition-colors ${
                  active
                    ? "bg-[#14B8A6]/15 border-[#14B8A6] text-[#EDEDED]"
                    : "bg-[#0A0A0B] border-white/[0.06] text-[#A1A1AA] hover:text-[#EDEDED] hover:border-white/[0.16]"
                }`}
              >
                <span className="text-[11px] font-semibold block truncate">
                  {cfg.label}
                </span>
                <span className="text-[10px] text-[#8A8A92] block truncate mt-0.5">
                  {isRecommended ? "Recommended" : cfg.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 9 Precision Mastering & Beat Impact Controls */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2.5 transition-opacity ${
          isBypassed ? "opacity-55" : "opacity-100"
        }`}
      >
        <div className="rounded-xl bg-[#0A0A0B] border border-[#14B8A6]/30 p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#14B8A6] font-semibold">Beat Slam</span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {Math.round((enhancement.beatImpact ?? 0.65) * 100)}%
            </span>
          </div>
          <input
            type="range"
            data-testid="beat-impact-slider"
            aria-label="Sub-harmonic beat slam and kick impact"
            min={0}
            max={1}
            step={0.05}
            value={enhancement.beatImpact ?? 0.65}
            onChange={(e) =>
              onChange({ beatImpact: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>

        <div className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#A1A1AA]">Sub (52 Hz)</span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {enhancement.subDb > 0
                ? `+${enhancement.subDb}`
                : enhancement.subDb}{" "}
              dB
            </span>
          </div>
          <input
            type="range"
            aria-label="Sub bass 52 Hz in dB"
            min={-4}
            max={8}
            step={0.5}
            value={enhancement.subDb ?? 1.8}
            onChange={(e) =>
              onChange({ subDb: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>

        <div className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#A1A1AA]">
              Punch ({outputInfo.bassFreqHz}Hz)
            </span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {enhancement.bassDb > 0
                ? `+${enhancement.bassDb}`
                : enhancement.bassDb}{" "}
              dB
            </span>
          </div>
          <input
            type="range"
            aria-label="Bass punch in dB"
            min={-6}
            max={8}
            step={0.5}
            value={enhancement.bassDb}
            onChange={(e) =>
              onChange({ bassDb: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>

        <div className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#A1A1AA]">Warmth (260Hz)</span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {enhancement.warmthDb > 0
                ? `+${enhancement.warmthDb}`
                : enhancement.warmthDb}{" "}
              dB
            </span>
          </div>
          <input
            type="range"
            aria-label="Body warmth 260 Hz in dB"
            min={-6}
            max={6}
            step={0.5}
            value={enhancement.warmthDb ?? 0.2}
            onChange={(e) =>
              onChange({ warmthDb: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>

        <div className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#A1A1AA]">Clarity (2.2k)</span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {enhancement.clarityDb > 0
                ? `+${enhancement.clarityDb}`
                : enhancement.clarityDb}{" "}
              dB
            </span>
          </div>
          <input
            type="range"
            aria-label="Vocal and presence clarity in dB"
            min={-6}
            max={8}
            step={0.5}
            value={enhancement.clarityDb}
            onChange={(e) =>
              onChange({ clarityDb: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>

        <div className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#A1A1AA]">Air (9.5 kHz)</span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {enhancement.airDb > 0
                ? `+${enhancement.airDb}`
                : enhancement.airDb}{" "}
              dB
            </span>
          </div>
          <input
            type="range"
            aria-label="Treble air sparkle in dB"
            min={-6}
            max={8}
            step={0.5}
            value={enhancement.airDb}
            onChange={(e) =>
              onChange({ airDb: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>

        <div className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#A1A1AA]">Glue &amp; Punch</span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {Math.round(enhancement.compAmount * 100)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Dynamic compression punch"
            min={0}
            max={1}
            step={0.05}
            value={enhancement.compAmount}
            onChange={(e) =>
              onChange({ compAmount: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>

        <div className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#A1A1AA]">Exciter (&gt;1.2k)</span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {Math.round((enhancement.harmonicDrive ?? 0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Band-isolated upper harmonic exciter"
            min={0}
            max={0.5}
            step={0.02}
            value={enhancement.harmonicDrive ?? 0}
            onChange={(e) =>
              onChange({ harmonicDrive: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>

        <div className="rounded-xl bg-[#0A0A0B] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[#A1A1AA]">Stereo Width</span>
            <span className="font-mono text-[#EDEDED] tabular-nums">
              {(enhancement?.stereoWidth ?? 1.15).toFixed(2)}×
            </span>
          </div>
          <input
            type="range"
            aria-label="Stereo width multiplier"
            min={0.6}
            max={1.6}
            step={0.05}
            value={enhancement.stereoWidth}
            onChange={(e) =>
              onChange({ stereoWidth: Number(e.target.value), enabled: true })
            }
            style={{ accentColor: "#14B8A6" }}
            className="w-full h-1.5 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

const EnhancementPanel = memo(EnhancementPanelComponent);
export default EnhancementPanel;
