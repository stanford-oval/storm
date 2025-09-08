'use client';

import { useState, useEffect } from 'react';
import { KeyboardShortcuts } from '@/components/ux/KeyboardShortcuts';

export function KeyboardShortcutsWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Open keyboard shortcuts with Cmd/Ctrl + /
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
        return;
      }
      
      // Also allow ? key (Shift + / on most keyboards) when not in an input field
      const target = e.target as HTMLElement;
      const isInputField = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true'
      );
      
      if (e.key === '?' && !isInputField) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return <KeyboardShortcuts isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}