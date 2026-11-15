"use client";

import React from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/useStore";

export default function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-28 md:bottom-24 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border shadow-2xl text-xs font-medium ${
              toast.type === "error"
                ? "bg-red-950/95 border-red-500/40 text-red-100"
                : "bg-[#141416]/95 border-white/[0.12] text-[#EDEDED]"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {toast.type === "success" ? (
                <Check
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "var(--accent)" }}
                  aria-hidden="true"
                />
              ) : toast.type === "error" ? (
                <AlertCircle
                  className="w-3.5 h-3.5 text-red-400 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Info
                  className="w-3.5 h-3.5 text-[#7A7A80] shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="break-words">{toast.message}</span>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="p-1 text-[#7A7A80] hover:text-[#EDEDED] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
