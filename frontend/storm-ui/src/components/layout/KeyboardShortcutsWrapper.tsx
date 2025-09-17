'use client';

import { useState, useEffect } from 'react';
import { KeyboardShortcuts } from '@/components/ux/KeyboardShortcuts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUIStore } from '@/store';

export function KeyboardShortcutsWrapper() {
  const [mounted, setMounted] = useState(false);
  const openDialogs = useUIStore(state => state.openDialogs);
  const closeDialog = useUIStore(state => state.closeDialog);

  // Use the keyboard shortcuts hook to handle all shortcuts
  useKeyboardShortcuts();

  // Check if keyboard shortcuts dialog is open
  const isOpen = openDialogs.includes('keyboard-shortcuts');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <KeyboardShortcuts
      isOpen={isOpen}
      onClose={() => closeDialog('keyboard-shortcuts')}
    />
  );
}
