"use client";

import React, { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export default function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#0A0A0B] transition-opacity hover:opacity-90 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        style={{ backgroundColor: "var(--accent)" }}
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-[#0A0A0B] px-3 py-2 text-xs font-medium text-[#EDEDED] hover:bg-white/[0.05] transition-colors min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Install Vibe on iPhone or iPad"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-[#141416] border border-white/[0.1] p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#EDEDED]">
                  Install on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close iOS install instructions"
                  className="p-1 text-[#7A7A80] hover:text-[#EDEDED]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-2.5 text-xs text-[#7A7A80] leading-relaxed">
                1. Tap the <strong className="text-[#EDEDED]">Share</strong>{" "}
                button in Safari toolbar.
                <br />
                2. Scroll down and tap{" "}
                <strong className="text-[#EDEDED]">Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl py-2 text-xs font-semibold text-[#0A0A0B]"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
