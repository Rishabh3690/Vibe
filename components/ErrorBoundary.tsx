"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  scopeName?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const msg =
      error instanceof Error && error.message
        ? error.message
        : "Something went wrong displaying this view.";
    return { hasError: true, message: msg };
  }

  componentDidCatch(): void {
    // Intentionally silent in production UI; contained by error boundary fallback
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: "" });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-2xl bg-[#141416] border border-white/[0.08] p-6 flex flex-col items-center justify-center text-center gap-3 my-4"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0A0A0B] border border-white/[0.08] flex items-center justify-center text-amber-300">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="max-w-md space-y-1">
            <h2 className="text-sm font-semibold text-[#EDEDED]">
              {this.props.scopeName
                ? `${this.props.scopeName} encountered an issue`
                : "Something went wrong"}
            </h2>
            <p className="text-xs text-[#7A7A80]">{this.state.message}</p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0A0A0B] rounded-xl transition-opacity hover:opacity-90 min-h-[40px]"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
