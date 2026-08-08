'use client';

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcutAction {
  key: string; // e.g., 'n', 'e', 'f', '?'
  ctrlOrCmd?: boolean; // requires Ctrl (Win/Linux) or Cmd (Mac)
  shift?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcutAction[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when user is typing in an input/textarea/select
    const target = e.target as HTMLElement;
    const isInputField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    for (const shortcut of shortcutsRef.current) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlOrCmdMatch = shortcut.ctrlOrCmd
        ? e.ctrlKey || e.metaKey
        : !e.ctrlKey && !e.metaKey;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

      if (keyMatch && ctrlOrCmdMatch && shiftMatch) {
        // For non-modifier shortcuts (like '?'), don't trigger in input fields
        if (!shortcut.ctrlOrCmd && isInputField) {
          continue;
        }

        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/* ── Default shortcuts for the dashboard ─────────────────────── */
export interface DashboardShortcutCallbacks {
  onAddNew?: () => void;
  onExport?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
  onShowHelp?: () => void;
}

export function getDashboardShortcuts(callbacks: DashboardShortcutCallbacks): KeyboardShortcutAction[] {
  return [
    {
      key: 'n',
      ctrlOrCmd: true,
      action: () => callbacks.onAddNew?.(),
      description: 'Tambah data baru',
    },
    {
      key: 'e',
      ctrlOrCmd: true,
      action: () => callbacks.onExport?.(),
      description: 'Export indikator saat ini',
    },
    {
      key: 'f',
      ctrlOrCmd: true,
      action: () => callbacks.onFocusSearch?.(),
      description: 'Fokus ke pencarian',
    },
    {
      key: 'Escape',
      action: () => callbacks.onEscape?.(),
      description: 'Bersihkan pencarian / Tutup modal',
    },
    {
      key: '?',
      action: () => callbacks.onShowHelp?.(),
      description: 'Tampilkan bantuan shortcut',
    },
  ];
}
