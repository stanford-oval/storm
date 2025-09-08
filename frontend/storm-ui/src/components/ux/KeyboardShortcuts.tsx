'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, Command, Search, Play, Square, Settings, Download, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface KeyboardShortcut {
  id: string;
  key: string;
  description: string;
  category: 'general' | 'navigation' | 'editing' | 'pipeline' | 'system';
  icon?: React.ComponentType<any>;
}

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const shortcuts: KeyboardShortcut[] = [
  // General - Using Alt/Option key to avoid conflicts
  {
    id: 'help',
    key: 'cmd+/',
    description: 'Show keyboard shortcuts',
    category: 'general',
    icon: Keyboard,
  },
  {
    id: 'command-palette',
    key: 'cmd+shift+k',
    description: 'Open command palette',
    category: 'general',
    icon: Search,
  },
  {
    id: 'search',
    key: 'ctrl+f',
    description: 'Search in current view (in-app)',
    category: 'general',
    icon: Search,
  },

  // Navigation - Using G prefix (Gmail style)
  {
    id: 'dashboard',
    key: 'g then h',
    description: 'Go to home/dashboard',
    category: 'navigation',
  },
  {
    id: 'projects',
    key: 'g then p',
    description: 'Go to projects',
    category: 'navigation',
  },
  {
    id: 'analytics',
    key: 'g then a',
    description: 'Go to analytics',
    category: 'navigation',
  },
  {
    id: 'knowledge-base',
    key: 'g then k',
    description: 'Go to knowledge base',
    category: 'navigation',
  },
  {
    id: 'settings',
    key: 'g then s',
    description: 'Go to settings',
    category: 'navigation',
  },

  // Editing - Using Alt/Option for app-specific actions
  {
    id: 'new-project',
    key: 'alt+n',
    description: 'Create new project',
    category: 'editing',
  },
  {
    id: 'save',
    key: 'cmd+s',
    description: 'Save current work',
    category: 'editing',
  },
  {
    id: 'duplicate',
    key: 'alt+d',
    description: 'Duplicate current item',
    category: 'editing',
  },
  {
    id: 'delete',
    key: 'alt+backspace',
    description: 'Delete selected item',
    category: 'editing',
  },
  {
    id: 'rename',
    key: 'alt+r',
    description: 'Rename current item',
    category: 'editing',
  },

  // Pipeline - Using Alt/Option
  {
    id: 'run-pipeline',
    key: 'alt+enter',
    description: 'Run STORM pipeline',
    category: 'pipeline',
    icon: Play,
  },
  {
    id: 'stop-pipeline',
    key: 'alt+.',
    description: 'Stop pipeline execution',
    category: 'pipeline',
    icon: Square,
  },
  {
    id: 'export',
    key: 'alt+e',
    description: 'Export article/data',
    category: 'pipeline',
    icon: Download,
  },
  {
    id: 'import',
    key: 'alt+i',
    description: 'Import data',
    category: 'pipeline',
    icon: Upload,
  },
  {
    id: 'refresh-data',
    key: 'alt+r',
    description: 'Refresh current data',
    category: 'pipeline',
  },

  // System - Using specific non-conflicting combinations
  {
    id: 'preferences',
    key: 'cmd+,',
    description: 'Open preferences',
    category: 'system',
    icon: Settings,
  },
  {
    id: 'toggle-theme',
    key: 'alt+t',
    description: 'Toggle dark/light theme',
    category: 'system',
  },
  {
    id: 'toggle-sidebar',
    key: 'alt+s',
    description: 'Toggle sidebar',
    category: 'system',
  },
  {
    id: 'zen-mode',
    key: 'alt+z',
    description: 'Toggle zen/focus mode',
    category: 'system',
  },
  {
    id: 'notifications',
    key: 'alt+shift+n',
    description: 'Show notifications',
    category: 'system',
  },
];

const categoryLabels = {
  general: 'General',
  navigation: 'Navigation',
  editing: 'Editing',
  pipeline: 'Pipeline',
  system: 'System',
};

const categoryColors = {
  general: 'bg-blue-100 text-blue-800',
  navigation: 'bg-green-100 text-green-800',
  editing: 'bg-purple-100 text-purple-800',
  pipeline: 'bg-orange-100 text-orange-800',
  system: 'bg-gray-100 text-gray-800',
};

// Helper function to format key combinations
const formatKey = (key: string): React.ReactNode => {
  const parts = key.split('+');
  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {index > 0 && <span className="mx-1 text-gray-400">+</span>}
      <kbd className="inline-flex items-center px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-medium text-gray-700">
        {part === 'cmd' ? (
          <>
            <Command className="w-3 h-3 mr-1" />
            Cmd
          </>
        ) : part === 'shift' ? (
          '⇧'
        ) : part === 'ctrl' ? (
          'Ctrl'
        ) : part === 'alt' ? (
          'Alt'
        ) : (
          part.toUpperCase()
        )}
      </kbd>
    </React.Fragment>
  ));
};

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Filter shortcuts based on category and search
  const filteredShortcuts = shortcuts.filter(shortcut => {
    const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.key.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  // Group shortcuts by category
  const groupedShortcuts = filteredShortcuts.reduce((groups, shortcut) => {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
    return groups;
  }, {} as Record<string, KeyboardShortcut[]>);

  // Get unique categories from filtered shortcuts
  const availableCategories = Array.from(new Set(filteredShortcuts.map(s => s.category)));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`fixed top-8 left-1/2 transform -translate-x-1/2 w-full max-w-4xl max-h-[90vh] z-50 ${className}`}
          >
            <Card className="shadow-2xl">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <Keyboard className="w-6 h-6" />
                    Keyboard Shortcuts
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Search and Filter */}
                <div className="flex gap-4 mt-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search shortcuts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  {/* Category Filter */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        selectedCategory === 'all'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    {Object.entries(categoryLabels).map(([category, label]) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          selectedCategory === category
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 max-h-96 overflow-y-auto">
                {filteredShortcuts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No shortcuts found{searchQuery && ` for "${searchQuery}"`}
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {availableCategories.map(category => (
                      <motion.div
                        key={category}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: availableCategories.indexOf(category) * 0.1 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <Badge className={categoryColors[category as keyof typeof categoryColors]}>
                            {categoryLabels[category as keyof typeof categoryLabels]}
                          </Badge>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {groupedShortcuts[category]?.map(shortcut => (
                            <motion.div
                              key={shortcut.id}
                              whileHover={{ scale: 1.02 }}
                              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              {shortcut.icon && (
                                <shortcut.icon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {shortcut.description}
                                </div>
                              </div>
                              <div className="flex items-center">
                                {formatKey(shortcut.key)}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>

              {/* Footer */}
              <div className="border-t p-4 bg-gray-50 text-center">
                <p className="text-sm text-gray-600">
                  Press <kbd className="px-2 py-1 bg-white border rounded text-xs">Cmd + /</kbd> anytime to see this dialog
                </p>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};