'use client';

import { useState, useEffect } from 'react';
import { KeyboardShortcuts } from '@/components/ux/KeyboardShortcuts';

export function KeyboardShortcutsWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Open keyboard shortcuts with Cmd/Ctrl + K + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Wait for second K press
        const handleSecondKey = (e2: KeyboardEvent) => {
          if (e2.key === 'k') {
            e2.preventDefault();
            setIsOpen(true);
            window.removeEventListener('keydown', handleSecondKey);
          } else {
            window.removeEventListener('keydown', handleSecondKey);
          }
        };
        window.addEventListener('keydown', handleSecondKey);
        setTimeout(() => {
          window.removeEventListener('keydown', handleSecondKey);
        }, 1000); // Timeout after 1 second
      }
      // Also allow ? key
      if (e.key === '?' && !e.target || (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return <KeyboardShortcuts isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}