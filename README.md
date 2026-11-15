# Vibe — 32-Bit Local DSP & Studio Mastering Player (Next.js 15)

A precision, local-first Web Audio DSP & studio mastering deck built with **Next.js 15**, **React 19**, **Web Audio API**, and **IndexedDB** (`idb`).

## ✨ Core Features
- **Interactive Waveform Scrubbing & A–B Section Looper (`components/SeekBar.tsx`, `components/Player.tsx`, `components/SongAnalysisPanel.tsx`)**:
  - 56-bar dynamic loudness envelope rendered directly inside the transport seekbar with hover timestamp + structural section preview (`01:28 · DROP`), Peak Drop marker pin, and playhead needle.
  - 1-click **`[ A`**, **`B ]`**, **`Loop Drop`**, and structural section loop buttons (`Intro`, `Verse`, `Chorus`, `Drop`, `Outro`) plus keyboard shortcuts (`[`, `]`, `\`).
- **3 Real-Time 60fps Analyzer Display Modes (`components/Visualizer.tsx`)**:
  - Switch live between **Mirror Wave**, **Studio RTA (with Floating Peak-Hold Caps & dBFS Grid)**, and **Scope + Sub (Oscilloscope + Sub-Bass Floor)**.
- **25 Studio Mastering Profiles & 4-Level Psychoacoustic Loudness Booster (`lib/dsp.ts`, `components/EnhancementPanel.tsx`)**:
  - 100% Normal, 200% Boost, 250% Hyper, and 400% Max distortion-free gain-staging with 120 Hz mono bass lock, Fletcher-Munson equal-loudness contour, upward micro-detail lift, and 5 playback hardware target profiles (Headphones, Speakers, Car, Club, Studio).

---

## 🚀 Push Updates to `Rishabh3690/Vibe` & Auto-Deploy on Vercel

```bash
git init
git add .
git commit -m "feat: remove song game, add interactive waveform & A-B section looper, and upgrade studio analyzer"
git branch -M main
git remote add origin https://github.com/Rishabh3690/Vibe.git
git push -u origin main --force
```
