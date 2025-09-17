import { logger } from '@/utils/logger';
import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  useUIStore,
  useProjectStore,
  usePipelineStore,
  useNotificationStore,
} from '@/store';
import {
  getMergedShortcuts,
  parseShortcut,
  defaultKeyboardShortcuts,
} from '@/config/keyboardShortcuts';

// Track sequence shortcuts (like "g then h")
let sequenceBuffer: string[] = [];
let sequenceTimer: NodeJS.Timeout | null = null;

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { keyboard, setTheme, toggleSidebar, openDialog } = useUIStore();
  const { addNotification } = useNotificationStore();
  const { createProject, loadProjects } = useProjectStore();
  const { startPipeline, cancelPipeline } = usePipelineStore();

  // Get merged shortcuts with custom overrides
  const shortcuts = getMergedShortcuts(
    keyboard?.customShortcuts || {},
    defaultKeyboardShortcuts
  );

  // Track if we're in an input field
  const isInInputField = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement;
    return (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true')
    );
  }, []);

  // Execute shortcut action
  const executeAction = useCallback(
    (shortcutId: string) => {
      logger.log('Executing shortcut action:', shortcutId);

      switch (shortcutId) {
        // General
        case 'help':
          openDialog('keyboard-shortcuts');
          break;
        case 'command-palette':
          openDialog('commandPalette');
          break;
        case 'search':
          if (!isInInputField()) {
            openDialog('search');
          }
          break;

        // Navigation
        case 'dashboard':
          router.push('/');
          break;
        case 'projects':
          router.push('/projects');
          break;
        case 'analytics':
          router.push('/analytics');
          break;
        case 'knowledge-base':
          router.push('/knowledge-base');
          break;
        case 'settings':
          router.push('/settings');
          break;

        // Editing
        case 'new-project':
          router.push('/projects/new');
          break;
        case 'save':
          // Trigger save in current context
          addNotification({
            type: 'info',
            title: 'Save',
            message: 'Project saved',
            read: false,
            persistent: false,
          });
          break;
        case 'duplicate':
          addNotification({
            type: 'info',
            title: 'Duplicate',
            message: 'Feature coming soon',
            read: false,
            persistent: false,
          });
          break;
        case 'delete':
          if (!isInInputField()) {
            addNotification({
              type: 'warning',
              title: 'Delete',
              message: 'Select an item to delete',
              read: false,
              persistent: false,
            });
          }
          break;
        case 'rename':
          addNotification({
            type: 'info',
            title: 'Rename',
            message: 'Feature coming soon',
            read: false,
            persistent: false,
          });
          break;

        // Pipeline
        case 'run-pipeline':
          addNotification({
            type: 'info',
            title: 'Pipeline',
            message: 'Starting pipeline...',
            read: false,
            persistent: false,
          });
          break;
        case 'stop-pipeline':
          addNotification({
            type: 'info',
            title: 'Pipeline',
            message: 'Stopping pipeline...',
            read: false,
            persistent: false,
          });
          break;
        case 'export':
          openDialog('export');
          break;
        case 'import':
          openDialog('import');
          break;
        case 'refresh-data':
          loadProjects();
          addNotification({
            type: 'info',
            title: 'Refresh',
            message: 'Data refreshed',
            read: false,
            persistent: false,
          });
          break;

        // System
        case 'preferences':
          router.push('/settings');
          break;
        case 'toggle-theme':
          const currentTheme = useUIStore.getState().theme;
          const newTheme =
            currentTheme === 'light'
              ? 'dark'
              : currentTheme === 'dark'
                ? 'system'
                : 'light';
          setTheme(newTheme);
          break;
        case 'toggle-sidebar':
          toggleSidebar();
          break;
        case 'zen-mode':
          addNotification({
            type: 'info',
            title: 'Zen Mode',
            message: 'Feature coming soon',
            read: false,
            persistent: false,
          });
          break;
        case 'notifications':
          openDialog('notifications');
          break;

        default:
          logger.log('Unknown shortcut action:', shortcutId);
      }
    },
    [
      router,
      openDialog,
      setTheme,
      toggleSidebar,
      loadProjects,
      addNotification,
      isInInputField,
    ]
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if shortcuts are disabled
      if (!keyboard?.enabled) return;

      // Special handling for Cmd+/ to open shortcuts dialog (always active)
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        openDialog('keyboard-shortcuts');
        return;
      }

      // Skip other shortcuts if in input field (except specific ones)
      const inInput = isInInputField();

      // Check each shortcut
      for (const shortcut of shortcuts) {
        if (!shortcut.enabled) continue;

        const parsed = parseShortcut(shortcut.key);

        // Handle sequence shortcuts (like "g then h")
        if (parsed.sequence) {
          // Check if this matches the start of a sequence
          if (sequenceBuffer.length === 0 && e.key === parsed.sequence[0]) {
            sequenceBuffer.push(e.key);

            // Clear sequence after timeout
            if (sequenceTimer) clearTimeout(sequenceTimer);
            sequenceTimer = setTimeout(() => {
              sequenceBuffer = [];
            }, 1000);

            e.preventDefault();
            return;
          }

          // Check if this completes a sequence
          if (sequenceBuffer.length > 0 && parsed.sequence.length === 2) {
            const expected = parsed.sequence.join(' then ');
            const current = [...sequenceBuffer, e.key].join(' then ');

            if (expected === current) {
              e.preventDefault();
              executeAction(shortcut.id);
              sequenceBuffer = [];
              if (sequenceTimer) {
                clearTimeout(sequenceTimer);
                sequenceTimer = null;
              }
              return;
            }
          }
          continue;
        }

        // Skip non-sequence shortcuts if in input (except save)
        if (inInput && shortcut.id !== 'save') continue;

        // Check modifier keys
        const hasCmd = parsed.modifiers.cmd || parsed.modifiers.meta;
        const hasCtrl = parsed.modifiers.ctrl;
        const hasAlt = parsed.modifiers.alt;
        const hasShift = parsed.modifiers.shift;

        const cmdMatch = hasCmd
          ? e.metaKey || e.ctrlKey
          : !(e.metaKey || e.ctrlKey);
        const ctrlMatch = hasCtrl ? e.ctrlKey : !e.ctrlKey || hasCmd;
        const altMatch = hasAlt ? e.altKey : !e.altKey;
        const shiftMatch = hasShift ? e.shiftKey : !e.shiftKey;

        // Check key
        const keyMatch = e.key.toLowerCase() === parsed.key.toLowerCase();

        if (cmdMatch && ctrlMatch && altMatch && shiftMatch && keyMatch) {
          e.preventDefault();
          executeAction(shortcut.id);
          return;
        }
      }
    },
    [keyboard, shortcuts, executeAction, openDialog, isInInputField]
  );

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (sequenceTimer) {
        clearTimeout(sequenceTimer);
      }
    };
  }, [handleKeyDown]);

  return { shortcuts, executeAction };
}
