"use client";

import { useEffect } from "react";

interface KeyboardShortcutOptions {
  /** Called when Enter or Space is pressed (e.g., resume from review pause) */
  onResume?: () => void;
  /** Called with 0-based index when 1 or 2 is pressed (e.g., select variant) */
  onSelectVariant?: (index: number) => void;
  /** Called when r or R is pressed (e.g., regenerate current variant) */
  onRegenerate?: () => void;
  /** Called when Escape is pressed */
  onCancel?: () => void;
  /** Only listen when enabled is true. Defaults to false. */
  enabled?: boolean;
}

/**
 * Keyboard shortcuts for pipeline review flow.
 *
 * Bindings:
 *  Enter / Space  -> onResume
 *  1 / 2          -> onSelectVariant(0) / onSelectVariant(1)
 *  r / R          -> onRegenerate
 *  Escape         -> onCancel
 *
 * All listeners are ignored when `enabled` is false or when the active
 * element is an input / textarea / select (so typing in forms is unaffected).
 */
export function useKeyboardShortcuts(options: KeyboardShortcutOptions): void {
  const {
    onResume,
    onSelectVariant,
    onRegenerate,
    onCancel,
    enabled = false,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Do not capture when the user is typing in a form field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "Enter":
        case " ": {
          e.preventDefault();
          onResume?.();
          break;
        }
        case "1": {
          onSelectVariant?.(0);
          break;
        }
        case "2": {
          onSelectVariant?.(1);
          break;
        }
        case "r":
        case "R": {
          onRegenerate?.();
          break;
        }
        case "Escape": {
          onCancel?.();
          break;
        }
        default:
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onResume, onSelectVariant, onRegenerate, onCancel]);
}
