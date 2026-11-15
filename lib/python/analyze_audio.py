#!/usr/bin/env python3
"""
Pure-Python standard-library acoustic, psychoacoustic & musicology analyzer for Vibe.
Computes frame-level RMS dynamics, transient crest factor, zero-crossing rate,
spectral centroid (Hz), stereo phase correlation, transient hit density,
mud (260 Hz) & harshness (4.1 kHz) ratios, dynamic health score (0-100),
multi-band Goertzel DFT balance, emotional feeling profile, and per-second optimization targets.
Zero external pip dependencies — safe for Vercel Python & Node child_process execution.
"""

from __future__ import annotations

import base64
import io
import json
import math
import struct
import sys
import wave
from typing import Any, Dict, List


def _goertzel_power(samples: List[float], sample_rate: int, target_hz: float) -> float:
    n = len(samples)
    if n == 0 or target_hz <= 0 or target_hz >= sample_rate * 0.49:
        return 0.0
    k = int(0.5 + (n * target_hz) / sample_rate)
    omega = (2.0 * math.pi * k) / n
    coeff = 2.0 * math.cos(omega)
    q1 = 0.0
    q2 = 0.0
    for x in samples:
        q0 = coeff * q1 - q2 + x
        q2 = q1
        q1 = q0
    power = q1 * q1 + q2 * q2 - q1 * q2 * coeff
    return max(0.0, power) / max(1, n * n)


def analyze_wav_bytes(wav_bytes: bytes) -> Dict[str, Any]:
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        sample_rate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sample_rate <= 0 or n_frames <= 0:
        raise ValueError("Empty or invalid WAV stream")

    if sample_width == 2:
        total_samples = len(raw) // 2
        ints = struct.unpack(f"<{total_samples}h", raw[: total_samples * 2])
        scale = 1.0 / 32768.0
    elif sample_width == 1:
        ints = [b - 128 for b in raw]
        scale = 1.0 / 128.0
    else:
        raise ValueError(f"Unsupported WAV sample width: {sample_width}")

    mono: List[float] = []
    stereo_corr = 0.92
    if channels == 1:
        mono = [v * scale for v in ints]
    else:
        sum_lr = 0.0
        sum_l2 = 0.0
        sum_r2 = 0.0
        for i in range(0, len(ints) - channels + 1, channels):
            l_val = ints[i] * scale
            r_val = ints[i + 1] * scale
            mono.append(0.5 * (l_val + r_val))
            sum_lr += l_val * r_val
            sum_l2 += l_val * l_val
            sum_r2 += r_val * r_val
        denom = math.sqrt(max(1e-12, sum_l2 * sum_r2))
        stereo_corr = max(-1.0, min(1.0, sum_lr / denom))

    n = len(mono)
    duration = n / float(sample_rate)

    # 1. Per-window (~0.5s) RMS, Peak, ZCR, and Clipping check
    win_len = max(256, int(sample_rate * 0.5))
    num_windows = max(1, (n + win_len - 1) // win_len)

    window_rms: List[float] = []
    window_peaks: List[float] = []
    window_zcr: List[float] = []
    clipped_count = 0

    for w in range(num_windows):
        start = w * win_len
        end = min(n, start + win_len)
        seg = mono[start:end]
        m = len(seg)
        if m == 0:
            continue
        sq = 0.0
        pk = 0.0
        zc = 0
        prev = seg[0]
        for s in seg:
            sq += s * s
            a = abs(s)
            if a > pk:
                pk = a
            if a >= 0.995:
                clipped_count += 1
            if (s >= 0 and prev < 0) or (s < 0 and prev >= 0):
                zc += 1
            prev = s
        rms = math.sqrt(sq / m)
        window_rms.append(rms)
        window_peaks.append(pk)
        window_zcr.append(zc / float(m))

    avg_rms = sum(window_rms) / max(1, len(window_rms))
    max_rms = max(window_rms) if window_rms else 0.1
    min_rms = min(window_rms) if window_rms else 0.01
    global_peak = max(window_peaks) if window_peaks else 0.1
    crest_db = 20.0 * math.log10(max(1e-5, global_peak) / max(1e-5, avg_rms))

    # 2. Multi-band Goertzel spectral energy + Mud (240-340Hz) + Harshness (3.4-5.2kHz) + Spectral Centroid
    sub_freqs = [45.0, 65.0]
    punch_freqs = [95.0, 140.0, 190.0]
    warmth_freqs = [250.0, 320.0, 420.0]
    vocal_freqs = [950.0, 1800.0, 2600.0]
    harsh_freqs = [3500.0, 4200.0, 5200.0]
    air_freqs = [6200.0, 7400.0]

    all_centroid_freqs = [55.0, 120.0, 280.0, 650.0, 1400.0, 2500.0, 4100.0, 6500.0]
    centroid_weights = [0.0] * len(all_centroid_freqs)

    chunk_size = min(2048, n)
    step_samples = max(chunk_size, n // 12)
    e_sub = e_punch = e_warmth = e_vocal = e_harsh = e_air = 0.0
    chunks_counted = 0

    pos = 0
    while pos + chunk_size <= n and chunks_counted < 14:
        chunk = mono[pos : pos + chunk_size]
        windowed = [
            chunk[i] * (0.5 - 0.5 * math.cos((2.0 * math.pi * i) / max(1, chunk_size - 1)))
            for i in range(chunk_size)
        ]
        e_sub += sum(_goertzel_power(windowed, sample_rate, f) for f in sub_freqs)
        e_punch += sum(_goertzel_power(windowed, sample_rate, f) for f in punch_freqs)
        e_warmth += sum(_goertzel_power(windowed, sample_rate, f) for f in warmth_freqs)
        e_vocal += sum(_goertzel_power(windowed, sample_rate, f) for f in vocal_freqs)
        e_harsh += sum(_goertzel_power(windowed, sample_rate, f) for f in harsh_freqs)
        e_air += sum(_goertzel_power(windowed, sample_rate, f) for f in air_freqs)

        for idx_f, cf in enumerate(all_centroid_freqs):
            if cf < sample_rate * 0.48:
                centroid_weights[idx_f] += math.sqrt(_goertzel_power(windowed, sample_rate, cf))

        chunks_counted += 1
        pos += step_samples

    spec_total = max(1e-12, e_sub + e_punch + e_warmth + e_vocal + e_harsh + e_air)
    sub_ratio = e_sub / spec_total
    punch_ratio = e_punch / spec_total
    warmth_ratio = e_warmth / spec_total
    vocal_ratio = e_vocal / spec_total
    harshness_ratio = (e_harsh * 1.35) / spec_total
    air_ratio = (e_air + e_harsh * 0.5) / spec_total
    mud_ratio = min(1.0, warmth_ratio * 1.25)

    weight_sum = sum(centroid_weights)
    if weight_sum > 1e-9:
        spectral_centroid_hz = int(
            round(
                sum(f * w for f, w in zip(all_centroid_freqs, centroid_weights)) / weight_sum
            )
        )
    else:
        spectral_centroid_hz = 1850
    spectral_centroid_hz = max(260, min(7800, spectral_centroid_hz))

    # 3. Beat onset punchiness & transient hit density (hits/sec)
    hop = max(128, int(sample_rate * 0.02))
    frames_e: List[float] = []
    for i in range(0, n - hop + 1, hop):
        s_sq = 0.0
        for x in mono[i : i + hop]:
            s_sq += x * x
        frames_e.append(math.sqrt(s_sq / hop))
    onsets = [max(0.0, frames_e[i] - frames_e[i - 1]) for i in range(1, len(frames_e))]
    mean_onset = sum(onsets) / max(1, len(onsets))
    max_onset = max(onsets) if onsets else 0.0
    beat_punch_score = min(
        1.0,
        max(0.0, (max_onset / max(1e-5, avg_rms)) * 0.65 + (mean_onset / max(1e-5, avg_rms)) * 2.4),
    )

    onset_thresh = max(mean_onset * 2.1, avg_rms * 0.14)
    hit_count = 0
    cooldown = 0
    for o in onsets:
        if cooldown > 0:
            cooldown -= 1
            continue
        if o >= onset_thresh:
            hit_count += 1
            cooldown = 4  # ~80ms minimum inter-onset gap
    transient_density = round(max(0.4, min(14.0, hit_count / max(1.0, duration))), 2)

    # 4. Dynamic Health Score (0-100): measures headroom, crest factor, and absence of clipping
    clip_penalty = min(35.0, (clipped_count / max(1.0, n)) * 12000.0)
    crest_score = min(45.0, max(10.0, (crest_db - 4.0) * 3.8))
    headroom_score = 35.0 if global_peak < 0.92 else (22.0 if global_peak < 0.98 else 12.0)
    balance_score = 20.0 - min(14.0, abs(mud_ratio - 0.22) * 30.0 + max(0.0, harshness_ratio - 0.22) * 30.0)
    dynamic_health_score = int(round(max(18.0, min(99.0, crest_score + headroom_score + balance_score - clip_penalty))))

    # 5. Per-window smart vibe optimization curve & Peak Drop Finder
    span_rms = max(1e-4, max_rms - min_rms)
    vibe_curve: List[Dict[str, float]] = []
    peak_drop_idx = 0
    best_drop_score = -1.0
    for idx, rms in enumerate(window_rms):
        norm_energy = max(0.0, min(1.0, (rms - min_rms) / span_rms))
        prev_e = (
            max(0.0, min(1.0, (window_rms[idx - 1] - min_rms) / span_rms))
            if idx > 0
            else norm_energy
        )
        drop_jump = max(0.0, norm_energy - prev_e)
        drop_score = norm_energy * 0.72 + drop_jump * 0.65
        if idx >= 1 and drop_score > best_drop_score:
            best_drop_score = drop_score
            peak_drop_idx = idx
        bass_lift = round(1.6 * norm_energy + (0.6 if sub_ratio < 0.22 else 0.0), 2)
        clarity_lift = round(1.4 * (1.0 - norm_energy * 0.5), 2)
        width_boost = round(0.05 + 0.09 * norm_energy, 3)
        vibe_curve.append({
            "t": round(idx * 0.5, 2),
            "energy": round(norm_energy, 3),
            "bassLiftDb": bass_lift,
            "clarityLiftDb": clarity_lift,
            "widthBoost": width_boost,
        })

    peak_drop_time_sec = round(min(max(0.5, duration - 0.5), peak_drop_idx * 0.5), 1)
    sub_weight_score = round(min(1.0, max(0.15, (sub_ratio + punch_ratio * 0.7) * 1.9)), 2)
    vocal_clarity_score = round(min(1.0, max(0.18, (vocal_ratio + air_ratio * 0.5) * 2.1)), 2)

    # 6. Feeling Mood & Smart Mode Recommendation
    avg_zcr = sum(window_zcr) / max(1, len(window_zcr))
    if sub_ratio + punch_ratio > 0.46:
        feeling_mood = "bass-heavy"
        feeling_color = "#F59E0B"
        recommended_mode = "deep-bass" if beat_punch_score < 0.6 else "club-drop"
    elif vocal_ratio > 0.34 and avg_zcr > 0.08:
        feeling_mood = "bright-pop"
        feeling_color = "#14B8A6"
        recommended_mode = "vocal-focus" if air_ratio > 0.16 else "bright-pop"
    elif beat_punch_score > 0.58 and crest_db > 11.0:
        feeling_mood = "electric"
        feeling_color = "#06B6D4"
        recommended_mode = "smart-beat"
    elif warmth_ratio > 0.30 and air_ratio < 0.12:
        feeling_mood = "warm-chill"
        feeling_color = "#FB7185"
        recommended_mode = "warm-analog"
    elif crest_db > 14.0:
        feeling_mood = "cinematic"
        feeling_color = "#8B5CF6"
        recommended_mode = "dynamic-lift"
    else:
        feeling_mood = "euphoric"
        feeling_color = "#10B981"
        recommended_mode = "auto"

    # 7. Smart Psychoacoustic Techniques tailored to this track
    smart_techniques: List[str] = [
        "120 Hz Sub-Bass Mono Phase Lock",
        "64 Hz Sub-Harmonic Beat Impact Slam",
        "Two-Stage Zero-Clip Lookahead Limiter",
    ]
    if mud_ratio > 0.25:
        smart_techniques.append(f"260 Hz Adaptive De-Mud (-{round((mud_ratio - 0.22) * 8.5, 1)} dB)")
    if harshness_ratio > 0.18:
        smart_techniques.append("4.1 kHz Ear-Canal Harshness Tamer")
    if crest_db > 11.5:
        smart_techniques.append("Upward Micro-Detail Lift (Quiet Restorer)")
    else:
        smart_techniques.append("Crest-Factor Headroom Recovery")
    if transient_density > 3.2:
        smart_techniques.append("23ms Transient-Preserving Drum Attack")
    else:
        smart_techniques.append("Fletcher-Munson Equal-Loudness Contour")

    # Optimal mastering EQ offsets (bounded to prevent overload)
    opt_sub = round(max(-2.0, min(5.5, (0.24 - sub_ratio) * 13.0 + 1.2)), 1)
    opt_bass = round(max(-2.0, min(5.5, (0.25 - punch_ratio) * 11.0 + 1.4)), 1)
    opt_warmth = round(max(-3.0, min(3.5, (0.22 - warmth_ratio) * 9.5)), 1)
    opt_clarity = round(max(-1.0, min(5.0, (0.28 - vocal_ratio) * 10.5 + 1.0)), 1)
    opt_air = round(max(-1.0, min(5.2, (0.18 - air_ratio) * 12.5 + 1.2)), 1)
    opt_beat_impact = round(min(0.9, max(0.55, 0.52 + beat_punch_score * 0.38)), 2)

    return {
        "engine": "python-dsp-v3",
        "duration": round(duration, 2),
        "sampleRate": sample_rate,
        "peakDropTimeSec": peak_drop_time_sec,
        "crestFactorDb": round(crest_db, 2),
        "beatPunchScore": round(beat_punch_score, 3),
        "subWeightScore": sub_weight_score,
        "vocalClarityScore": vocal_clarity_score,
        "spectralCentroidHz": spectral_centroid_hz,
        "stereoCorrelation": round(stereo_corr, 2),
        "transientDensity": transient_density,
        "mudRatio": round(mud_ratio, 3),
        "harshnessRatio": round(min(1.0, harshness_ratio), 3),
        "dynamicHealthScore": dynamic_health_score,
        "smartTechniquesApplied": smart_techniques,
        "avgZcr": round(avg_zcr, 4),
        "spectral5Band": {
            "sub": round(sub_ratio, 4),
            "punch": round(punch_ratio, 4),
            "warmth": round(warmth_ratio, 4),
            "vocal": round(vocal_ratio, 4),
            "air": round(air_ratio, 4),
        },
        "feelingMood": feeling_mood,
        "feelingColor": feeling_color,
        "recommendedMode": recommended_mode,
        "optimalProfile": {
            "subDb": opt_sub,
            "bassDb": opt_bass,
            "warmthDb": opt_warmth,
            "clarityDb": opt_clarity,
            "airDb": opt_air,
            "compAmount": round(min(0.72, max(0.24, crest_db / 22.0)), 2),
            "harmonicDrive": round(0.16 if feeling_mood in ("warm-chill", "bass-heavy") else 0.12, 2),
            "stereoWidth": 1.22 if feeling_mood in ("euphoric", "electric", "cinematic") else 1.14,
            "beatImpact": opt_beat_impact,
        },
        "vibeCurve": vibe_curve[:120],
    }


def main() -> None:
    try:
        raw_in = sys.stdin.read().strip()
        if not raw_in:
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
        payload = json.loads(raw_in)
        b64 = payload.get("audioSnippetBase64", "")
        if not b64:
            print(json.dumps({"error": "Missing audioSnippetBase64"}))
            sys.exit(1)
        wav_bytes = base64.b64decode(b64)
        result = analyze_wav_bytes(wav_bytes)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
