'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  X,
  Edit2,
  Save,
  RotateCcw,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { useUIStore } from '@/store';
import {
  defaultKeyboardShortcuts,
  formatShortcutKey,
  hasConflict,
  getMergedShortcuts,
  type KeyboardShortcut,
} from '@/config/keyboardShortcuts';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  shortcuts?: KeyboardShortcut[];
  allowCustomization?: boolean;
}

const categoryLabels = {
  general: 'General',
  navigation: 'Navigation',
  editing: 'Editing',
  pipeline: 'Pipeline',
  system: 'System',
};

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  isOpen,
  onClose,
  className = '',
  shortcuts: propShortcuts,
  allowCustomization = true,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingShortcuts, setEditingShortcuts] = useState<
    Record<string, string>
  >({});
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  // Get shortcuts from store or use defaults - using stable selectors
  const storeKeyboard = useUIStore(state => state.keyboard);
  const setCustomShortcuts = useUIStore(state => state.setCustomShortcuts);

  // Extract customShortcuts in a stable way
  const customShortcuts = useMemo(() => {
    return storeKeyboard?.customShortcuts || {};
  }, [storeKeyboard?.customShortcuts]);

  // Use prop shortcuts or merge custom with defaults
  const shortcuts = useMemo(() => {
    if (propShortcuts) return propShortcuts;
    return getMergedShortcuts(customShortcuts, defaultKeyboardShortcuts);
  }, [propShortcuts, customShortcuts]);

  // Detect platform
  const platform = useMemo(() => {
    if (typeof window === 'undefined') return 'mac';
    return navigator.platform.toLowerCase().includes('mac') ? 'mac' : 'windows';
  }, []);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isEditing, onClose]);

  // Filter shortcuts based on category and search
  const filteredShortcuts = shortcuts.filter(shortcut => {
    const matchesCategory =
      selectedCategory === 'all' || shortcut.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.key.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Group shortcuts by category
  const groupedShortcuts = filteredShortcuts.reduce(
    (groups, shortcut) => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
      return groups;
    },
    {} as Record<string, KeyboardShortcut[]>
  );

  // Get unique categories from filtered shortcuts
  const availableCategories = Array.from(
    new Set(filteredShortcuts.map(s => s.category))
  );

  // Handle editing
  const handleStartEdit = () => {
    setIsEditing(true);
    const currentShortcuts: Record<string, string> = {};
    shortcuts.forEach(s => {
      currentShortcuts[s.id] = s.key;
    });
    setEditingShortcuts(currentShortcuts);
    setValidationErrors({});
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingShortcuts({});
    setValidationErrors({});
  };

  const handleSaveEdit = () => {
    // Validate all shortcuts
    const errors: Record<string, string> = {};

    Object.entries(editingShortcuts).forEach(([id, key]) => {
      const conflict = hasConflict(key);
      if (conflict.hasConflict) {
        errors[id] = conflict.reason || 'Conflicts with browser shortcut';
      }

      // Check for duplicates within our shortcuts
      const duplicate = Object.entries(editingShortcuts).find(
        ([otherId, otherKey]) => otherId !== id && otherKey === key
      );
      if (duplicate) {
        errors[id] = `Duplicate shortcut with "${duplicate[0]}"`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Save custom shortcuts
    const customKeys: Record<string, string> = {};
    Object.entries(editingShortcuts).forEach(([id, key]) => {
      const defaultShortcut = defaultKeyboardShortcuts.find(s => s.id === id);
      if (defaultShortcut && defaultShortcut.key !== key) {
        customKeys[id] = key;
      }
    });

    if (setCustomShortcuts) {
      setCustomShortcuts(customKeys);
    }
    setIsEditing(false);
    setEditingShortcuts({});
  };

  const handleResetDefaults = () => {
    if (setCustomShortcuts) {
      setCustomShortcuts({});
    }
    setEditingShortcuts({});
    setValidationErrors({});
  };

  const handleShortcutChange = (id: string, value: string) => {
    setEditingShortcuts(prev => ({ ...prev, [id]: value }));

    // Clear validation error when user types
    if (validationErrors[id]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => !isEditing && onClose()}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`fixed inset-x-4 bottom-[10%] top-[10%] z-50 mx-auto max-w-4xl ${className}`}
          >
            <Card className="flex h-full flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Keyboard className="h-5 w-5 text-primary" />
                    <CardTitle>Keyboard Shortcuts</CardTitle>
                    {isEditing && (
                      <Badge variant="secondary">Editing Mode</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {allowCustomization && !isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartEdit}
                      >
                        <Edit2 className="mr-1 h-4 w-4" />
                        Customize
                      </Button>
                    )}
                    {isEditing && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetDefaults}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" />
                          Reset to Defaults
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Save className="mr-1 h-4 w-4" />
                          Save Changes
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      disabled={isEditing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Search and filters */}
                <div className="mt-4 flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search shortcuts..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={
                        selectedCategory === 'all' ? 'default' : 'outline'
                      }
                      size="sm"
                      onClick={() => setSelectedCategory('all')}
                    >
                      All
                    </Button>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <Button
                        key={key}
                        variant={
                          selectedCategory === key ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() => setSelectedCategory(key)}
                        disabled={!availableCategories.includes(key as any)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-auto p-6">
                {Object.entries(groupedShortcuts).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No shortcuts found matching your search.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedShortcuts).map(
                      ([category, shortcuts]) => (
                        <div key={category}>
                          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            {
                              categoryLabels[
                                category as keyof typeof categoryLabels
                              ]
                            }
                          </h3>
                          <div className="grid gap-2">
                            {shortcuts.map(shortcut => {
                              const hasError = validationErrors[shortcut.id];
                              const hasCustom = customShortcuts[shortcut.id];

                              return (
                                <div
                                  key={shortcut.id}
                                  className={`flex items-center justify-between rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted ${
                                    hasError ? 'ring-2 ring-destructive' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {shortcut.icon && (
                                      <shortcut.icon className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className="text-sm">
                                      {shortcut.description}
                                    </span>
                                    {hasCustom && !isEditing && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Custom
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <Input
                                          value={
                                            editingShortcuts[shortcut.id] ||
                                            shortcut.key
                                          }
                                          onChange={e =>
                                            handleShortcutChange(
                                              shortcut.id,
                                              e.target.value
                                            )
                                          }
                                          onKeyDown={e => {
                                            // Capture key combination
                                            e.stopPropagation();

                                            // Skip certain keys
                                            if (
                                              [
                                                'Tab',
                                                'Enter',
                                                'Escape',
                                              ].includes(e.key)
                                            ) {
                                              return;
                                            }

                                            e.preventDefault();

                                            // Build the shortcut string
                                            const parts = [];
                                            if (e.metaKey || e.ctrlKey)
                                              parts.push('cmd');
                                            if (e.altKey) parts.push('alt');
                                            if (e.shiftKey) parts.push('shift');

                                            // Add the key
                                            let key = e.key.toLowerCase();
                                            // Normalize special keys
                                            if (key === ' ') key = 'space';
                                            if (key === 'arrowup') key = 'up';
                                            if (key === 'arrowdown')
                                              key = 'down';
                                            if (key === 'arrowleft')
                                              key = 'left';
                                            if (key === 'arrowright')
                                              key = 'right';

                                            // Don't add modifier keys as the main key
                                            if (
                                              ![
                                                'control',
                                                'meta',
                                                'alt',
                                                'shift',
                                                'cmd',
                                              ].includes(key)
                                            ) {
                                              parts.push(key);
                                              const shortcutStr =
                                                parts.join('+');
                                              handleShortcutChange(
                                                shortcut.id,
                                                shortcutStr
                                              );
                                            }
                                          }}
                                          className="h-8 w-40 text-xs"
                                          placeholder="Press keys..."
                                        />
                                        {hasError && (
                                          <AlertCircle className="h-4 w-4 text-destructive" />
                                        )}
                                      </>
                                    ) : (
                                      <Badge
                                        variant="secondary"
                                        className="font-mono"
                                      >
                                        {formatShortcutKey(
                                          shortcut.key,
                                          platform
                                        )}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {Object.keys(validationErrors).length > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Some shortcuts have conflicts. Please fix them before
                      saving.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>

              {/* Footer with tips */}
              <div className="border-t px-6 py-3">
                <p className="text-xs text-muted-foreground">
                  Tip: Press{' '}
                  <kbd className="rounded bg-muted px-1 py-0.5 text-xs">
                    Cmd+/
                  </kbd>{' '}
                  anytime to show this dialog.
                  {isEditing &&
                    ' • Use standard format like "cmd+shift+k" or "alt+n" for shortcuts.'}
                </p>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
