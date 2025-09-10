'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Command } from 'cmdk';
import {
  Search,
  FileText,
  Folder,
  Settings,
  Zap,
  Download,
  Upload,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Copy,
  Edit,
  Plus,
  Home,
  BarChart3,
  Users,
  Calendar,
  BookOpen,
  Code,
  Terminal,
} from 'lucide-react';
import { useProjectStore, useUIStore } from '@/store';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<any>;
  category: 'navigation' | 'actions' | 'creation' | 'system';
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands?: CommandItem[];
  className?: string;
  placeholder?: string;
}

// Create default commands inside the component to access hooks
const createDefaultCommands = (router: any, openDialog: any): CommandItem[] => [
  // Navigation
  {
    id: 'nav-home',
    label: 'Go to Dashboard',
    description: 'Navigate to the main dashboard',
    icon: Home,
    category: 'navigation',
    shortcut: 'g then h',
    action: () => router.push('/'),
    keywords: ['dashboard', 'home', 'main'],
  },
  {
    id: 'nav-projects',
    label: 'View Projects',
    description: 'See all your projects',
    icon: Folder,
    category: 'navigation',
    action: () => router.push('/'),
    keywords: ['projects', 'folder'],
  },
  {
    id: 'nav-analytics',
    label: 'Open Analytics',
    description: 'View analytics dashboard',
    icon: BarChart3,
    category: 'navigation',
    action: () => router.push('/analytics'),
    keywords: ['analytics', 'stats', 'metrics'],
  },

  // Creation
  {
    id: 'create-project',
    label: 'New Project',
    description: 'Create a new STORM project',
    icon: Plus,
    category: 'creation',
    shortcut: 'alt+n',
    action: () => router.push('/projects/new'),
    keywords: ['new', 'create', 'project'],
  },
  {
    id: 'create-article',
    label: 'New Article',
    description: 'Start writing a new article',
    icon: FileText,
    category: 'creation',
    action: () => router.push('/projects/new'),
    keywords: ['article', 'write', 'document'],
  },

  // Actions
  {
    id: 'action-run',
    label: 'Run Pipeline',
    description: 'Execute the STORM pipeline',
    icon: Play,
    category: 'actions',
    shortcut: 'alt+r',
    action: () => openDialog('run-pipeline'),
    keywords: ['run', 'execute', 'pipeline'],
  },
  {
    id: 'action-stop',
    label: 'Stop Pipeline',
    description: 'Stop the current pipeline execution',
    icon: Square,
    category: 'actions',
    action: () => openDialog('stop-pipeline'),
    keywords: ['stop', 'halt', 'cancel'],
  },
  {
    id: 'action-export',
    label: 'Export Data',
    description: 'Export your project data',
    icon: Download,
    category: 'actions',
    shortcut: 'alt+e',
    action: () => openDialog('export'),
    keywords: ['export', 'download', 'save'],
  },
  {
    id: 'action-import',
    label: 'Import Data',
    description: 'Import project data',
    icon: Upload,
    category: 'actions',
    action: () => openDialog('import'),
    keywords: ['import', 'upload', 'load'],
  },

  // System
  {
    id: 'system-settings',
    label: 'Open Settings',
    description: 'Configure application settings',
    icon: Settings,
    category: 'system',
    shortcut: 'alt+,',
    action: () => router.push('/settings'),
    keywords: ['settings', 'preferences', 'config'],
  },
  {
    id: 'system-terminal',
    label: 'Toggle Terminal',
    description: 'Show/hide terminal',
    icon: Terminal,
    category: 'system',
    shortcut: 'alt+`',
    action: () => openDialog('terminal'),
    keywords: ['terminal', 'console', 'cli'],
  },
];

const categoryColors = {
  navigation: 'text-blue-500',
  actions: 'text-green-500',
  creation: 'text-purple-500',
  system: 'text-gray-500',
};

const categoryLabels = {
  navigation: 'Navigation',
  actions: 'Actions',
  creation: 'Creation',
  system: 'System',
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  className = '',
  placeholder = 'Type a command or search...',
}) => {
  const router = useRouter();
  const { openDialog } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Use provided commands or create default ones
  const effectiveCommands =
    commands || createDefaultCommands(router, openDialog);

  // Register keyboard shortcuts for commands and escape key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Handle escape key
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Handle command shortcuts when palette is closed
      if (!isOpen) {
        effectiveCommands.forEach(command => {
          if (command.shortcut) {
            // Parse shortcut (e.g., "cmd+k" or "ctrl+shift+p")
            const keys = command.shortcut.toLowerCase().split('+');
            const hasCmd = keys.includes('cmd') || keys.includes('meta');
            const hasCtrl = keys.includes('ctrl');
            const hasShift = keys.includes('shift');
            const hasAlt = keys.includes('alt');
            const mainKey = keys[keys.length - 1];

            if (
              ((hasCmd && e.metaKey) ||
                (hasCtrl && e.ctrlKey) ||
                (!hasCmd && !hasCtrl)) &&
              (hasShift ? e.shiftKey : !e.shiftKey) &&
              (hasAlt ? e.altKey : !e.altKey) &&
              e.key.toLowerCase() === mainKey
            ) {
              e.preventDefault();
              command.action();
            }
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onClose, effectiveCommands]);

  // Filter and group commands
  const filteredCommands = useMemo(() => {
    if (!query) return effectiveCommands;

    const lowerQuery = query.toLowerCase();
    return effectiveCommands.filter(
      command =>
        command.label.toLowerCase().includes(lowerQuery) ||
        command.description?.toLowerCase().includes(lowerQuery) ||
        command.keywords?.some(keyword =>
          keyword.toLowerCase().includes(lowerQuery)
        )
    );
  }, [effectiveCommands, query]);

  const groupedCommands = useMemo(() => {
    return filteredCommands.reduce(
      (groups, command) => {
        if (!groups[command.category]) {
          groups[command.category] = [];
        }
        groups[command.category].push(command);
        return groups;
      },
      {} as Record<string, CommandItem[]>
    );
  }, [filteredCommands]);

  // Handle command execution
  const executeCommand = useCallback(
    (command: CommandItem) => {
      command.action();
      onClose();
      setQuery('');
      setSelectedIndex(0);
    },
    [onClose]
  );

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            Math.min(prev + 1, filteredCommands.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
      }
    },
    [filteredCommands, selectedIndex, executeCommand]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`fixed left-1/2 top-24 z-50 w-full max-w-2xl -translate-x-1/2 transform ${className}`}
          >
            <Command
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl"
              onKeyDown={handleKeyDown}
            >
              {/* Search Input */}
              <div className="flex items-center border-b border-gray-200 px-4 py-3">
                <Search className="mr-3 h-5 w-5 text-gray-400" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-lg placeholder-gray-400 outline-none"
                  autoFocus
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Results */}
              <Command.List className="max-h-96 overflow-y-auto">
                {filteredCommands.length === 0 ? (
                  <Command.Empty className="px-4 py-8 text-center text-gray-500">
                    No commands found for "{query}"
                  </Command.Empty>
                ) : (
                  <div className="py-2">
                    {Object.entries(groupedCommands).map(
                      ([category, categoryCommands]) => (
                        <Command.Group
                          key={category}
                          heading={
                            categoryLabels[
                              category as keyof typeof categoryLabels
                            ]
                          }
                        >
                          {categoryCommands.map((command, index) => {
                            const globalIndex =
                              filteredCommands.indexOf(command);
                            return (
                              <Command.Item
                                key={command.id}
                                value={command.id}
                                onSelect={() => executeCommand(command)}
                                className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                                  selectedIndex === globalIndex
                                    ? 'bg-blue-50 text-blue-900'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <command.icon
                                  className={`h-5 w-5 ${categoryColors[command.category]}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium text-gray-900">
                                    {command.label}
                                  </div>
                                  {command.description && (
                                    <div className="truncate text-sm text-gray-500">
                                      {command.description}
                                    </div>
                                  )}
                                </div>
                                {command.shortcut && (
                                  <kbd className="rounded border bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                                    {command.shortcut}
                                  </kbd>
                                )}
                              </Command.Item>
                            );
                          })}
                        </Command.Group>
                      )
                    )}
                  </div>
                )}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border bg-white px-1.5 py-0.5 text-xs">
                      ↑↓
                    </kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border bg-white px-1.5 py-0.5 text-xs">
                      ↵
                    </kbd>
                    Execute
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border bg-white px-1.5 py-0.5 text-xs">
                      esc
                    </kbd>
                    Close
                  </span>
                </div>
                <span>{filteredCommands.length} commands</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
