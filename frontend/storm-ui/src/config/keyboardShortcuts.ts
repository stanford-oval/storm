// Default keyboard shortcuts configuration
// Users can override these in their settings

import {
  Keyboard,
  Search,
  Play,
  Square,
  Settings,
  Download,
  Upload,
} from 'lucide-react';

export interface KeyboardShortcut {
  id: string;
  key: string;
  description: string;
  category: 'general' | 'navigation' | 'editing' | 'pipeline' | 'system';
  icon?: React.ComponentType<any>;
  enabled?: boolean;
  action?: () => void;
}

export interface KeyboardShortcutsConfig {
  enabled: boolean;
  shortcuts: KeyboardShortcut[];
  customShortcuts?: Record<string, string>; // Override default shortcuts
}

// Default shortcuts that don't conflict with browser/OS
export const defaultKeyboardShortcuts: KeyboardShortcut[] = [
  // General - Using Alt/Option key to avoid conflicts
  {
    id: 'help',
    key: 'cmd+/',
    description: 'Show keyboard shortcuts',
    category: 'general',
    icon: Keyboard,
    enabled: true,
  },
  {
    id: 'command-palette',
    key: 'cmd+k',
    description: 'Open command palette',
    category: 'general',
    icon: Search,
    enabled: true,
  },
  {
    id: 'search',
    key: 'ctrl+f',
    description: 'Search in current view (in-app)',
    category: 'general',
    icon: Search,
    enabled: true,
  },

  // Navigation - Using G prefix (Gmail style)
  {
    id: 'dashboard',
    key: 'g then h',
    description: 'Go to home/dashboard',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'projects',
    key: 'g then p',
    description: 'Go to projects',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'analytics',
    key: 'g then a',
    description: 'Go to analytics',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'knowledge-base',
    key: 'g then k',
    description: 'Go to knowledge base',
    category: 'navigation',
    enabled: true,
  },
  {
    id: 'settings',
    key: 'g then s',
    description: 'Go to settings',
    category: 'navigation',
    enabled: true,
  },

  // Editing - Using Alt/Option for app-specific actions
  {
    id: 'new-project',
    key: 'alt+n',
    description: 'Create new project',
    category: 'editing',
    enabled: true,
  },
  {
    id: 'save',
    key: 'cmd+s',
    description: 'Save current work',
    category: 'editing',
    enabled: true,
  },
  {
    id: 'duplicate',
    key: 'alt+d',
    description: 'Duplicate current item',
    category: 'editing',
    enabled: true,
  },
  {
    id: 'delete',
    key: 'alt+backspace',
    description: 'Delete selected item',
    category: 'editing',
    enabled: true,
  },
  {
    id: 'rename',
    key: 'alt+r',
    description: 'Rename current item',
    category: 'editing',
    enabled: true,
  },

  // Pipeline - Using Alt/Option
  {
    id: 'run-pipeline',
    key: 'alt+enter',
    description: 'Run STORM pipeline',
    category: 'pipeline',
    icon: Play,
    enabled: true,
  },
  {
    id: 'stop-pipeline',
    key: 'alt+.',
    description: 'Stop pipeline execution',
    category: 'pipeline',
    icon: Square,
    enabled: true,
  },
  {
    id: 'export',
    key: 'alt+e',
    description: 'Export article/data',
    category: 'pipeline',
    icon: Download,
    enabled: true,
  },
  {
    id: 'import',
    key: 'alt+i',
    description: 'Import data',
    category: 'pipeline',
    icon: Upload,
    enabled: true,
  },
  {
    id: 'refresh-data',
    key: 'alt+shift+r',
    description: 'Refresh current data',
    category: 'pipeline',
    enabled: true,
  },

  // System - Using specific non-conflicting combinations
  {
    id: 'preferences',
    key: 'cmd+,',
    description: 'Open preferences',
    category: 'system',
    icon: Settings,
    enabled: true,
  },
  {
    id: 'toggle-theme',
    key: 'alt+t',
    description: 'Toggle dark/light theme',
    category: 'system',
    enabled: true,
  },
  {
    id: 'toggle-sidebar',
    key: 'alt+s',
    description: 'Toggle sidebar',
    category: 'system',
    enabled: true,
  },
  {
    id: 'zen-mode',
    key: 'alt+z',
    description: 'Toggle zen/focus mode',
    category: 'system',
    enabled: true,
  },
  {
    id: 'notifications',
    key: 'alt+shift+n',
    description: 'Show notifications',
    category: 'system',
    enabled: true,
  },
];

// Platform-specific key mappings
export const platformKeys = {
  mac: {
    cmd: '⌘',
    alt: '⌥',
    shift: '⇧',
    ctrl: '⌃',
    enter: '⏎',
    backspace: '⌫',
  },
  windows: {
    cmd: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    ctrl: 'Ctrl',
    enter: 'Enter',
    backspace: 'Backspace',
  },
};

// Get platform-specific key display
export function formatShortcutKey(
  key: string,
  platform: 'mac' | 'windows' = 'mac'
): string {
  const keys = platformKeys[platform];
  let formatted = key;

  // Replace key names with symbols/proper names
  Object.entries(keys).forEach(([name, symbol]) => {
    formatted = formatted.replace(new RegExp(name, 'gi'), symbol);
  });

  // Format "then" sequences
  formatted = formatted.replace(' then ', ' → ');

  return formatted;
}

// Parse shortcut string into key components
export function parseShortcut(shortcut: string): {
  modifiers: {
    cmd?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  key: string;
  sequence?: string[]; // For "g then h" style shortcuts
} {
  const normalized = shortcut.toLowerCase();

  // Check if it's a sequence shortcut
  if (normalized.includes(' then ')) {
    const parts = normalized.split(' then ');
    return {
      modifiers: {},
      key: parts[0].trim(),
      sequence: parts.map(p => p.trim()),
    };
  }

  // Parse modifier keys
  const parts = normalized.split('+');
  const modifiers = {
    cmd: parts.includes('cmd') || parts.includes('meta'),
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt') || parts.includes('option'),
    shift: parts.includes('shift'),
    meta: parts.includes('cmd') || parts.includes('meta'),
  };

  // The last part is the main key
  const key = parts[parts.length - 1];

  return { modifiers, key };
}

// Check if a keyboard event matches a shortcut
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: string
): boolean {
  const parsed = parseShortcut(shortcut);

  // For sequence shortcuts, this needs to be handled differently
  if (parsed.sequence) {
    return false; // Sequences are handled separately
  }

  const keyMatches = event.key.toLowerCase() === parsed.key;
  const cmdMatches = parsed.modifiers.cmd
    ? event.metaKey || event.ctrlKey
    : true;
  const ctrlMatches = parsed.modifiers.ctrl ? event.ctrlKey : !event.ctrlKey;
  const altMatches = parsed.modifiers.alt ? event.altKey : !event.altKey;
  const shiftMatches = parsed.modifiers.shift
    ? event.shiftKey
    : !event.shiftKey;

  return keyMatches && cmdMatches && ctrlMatches && altMatches && shiftMatches;
}

// Detect potential conflicts with browser/OS shortcuts
export function hasConflict(shortcut: string): {
  hasConflict: boolean;
  reason?: string;
} {
  const conflictingShortcuts = [
    { keys: 'cmd+n', reason: 'Opens new browser window' },
    { keys: 'cmd+t', reason: 'Opens new browser tab' },
    { keys: 'cmd+shift+t', reason: 'Reopens closed tab' },
    { keys: 'cmd+w', reason: 'Closes current tab' },
    { keys: 'cmd+shift+w', reason: 'Closes current window' },
    { keys: 'cmd+q', reason: 'Quits application' },
    { keys: 'cmd+h', reason: 'Hides window (macOS)' },
    { keys: 'cmd+m', reason: 'Minimizes window (macOS)' },
    { keys: 'cmd+r', reason: 'Reloads page' },
    { keys: 'cmd+shift+r', reason: 'Hard reload page' },
    { keys: 'cmd+d', reason: 'Bookmarks page' },
    { keys: 'cmd+shift+d', reason: 'Bookmarks all tabs' },
    { keys: 'cmd+l', reason: 'Focuses address bar' },
    { keys: 'cmd+k', reason: 'Browser search (Safari/Chrome)' },
    { keys: 'cmd+shift+p', reason: 'Private browsing' },
    { keys: 'cmd+shift+n', reason: 'Incognito mode (Chrome)' },
    { keys: 'cmd+o', reason: 'Open file' },
    { keys: 'cmd+p', reason: 'Print page' },
    { keys: 'f11', reason: 'Fullscreen' },
    { keys: 'f12', reason: 'DevTools' },
  ];

  const normalized = shortcut.toLowerCase();
  const conflict = conflictingShortcuts.find(c => c.keys === normalized);

  if (conflict) {
    return { hasConflict: true, reason: conflict.reason };
  }

  return { hasConflict: false };
}

// Get user's custom shortcuts merged with defaults
export function getMergedShortcuts(
  customShortcuts: Record<string, string> = {},
  defaults: KeyboardShortcut[] = defaultKeyboardShortcuts
): KeyboardShortcut[] {
  return defaults.map(shortcut => {
    const customKey = customShortcuts[shortcut.id];
    if (customKey) {
      return { ...shortcut, key: customKey };
    }
    return shortcut;
  });
}
