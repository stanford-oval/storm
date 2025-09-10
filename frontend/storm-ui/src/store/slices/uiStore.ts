import { logger } from '@/utils/logger';
// UI state store slice
import { create } from 'zustand';
import {
  UIState,
  LayoutConfig,
  CustomPanel,
  KeyboardShortcuts,
  AccessibilitySettings,
} from '../types';
import { persist, createPartialize } from '../middleware/persist';
import { devtools } from '../middleware/devtools';
import { immer } from '../middleware/immer';
import { subscriptions } from '../middleware/subscriptions';

// Initial state
const initialState: UIState = {
  theme: 'system',
  sidebarCollapsed: false,
  activePanel: null,
  openDialogs: [],
  notifications: [],
  layout: {
    density: 'comfortable',
    panelSizes: {
      sidebar: 280,
      mainContent: -1, // Auto
      rightPanel: 320,
    },
    customPanels: [],
  },
  keyboard: {
    enabled: true,
    shortcuts: {
      'cmd+k': 'openCommandPalette',
      'cmd+/': 'toggleShortcutsHelp',
      'cmd+b': 'toggleSidebar',
      'cmd+n': 'createNewProject',
      'cmd+s': 'saveProject',
      'cmd+z': 'undo',
      'cmd+shift+z': 'redo',
      escape: 'closeDialog',
    },
    customShortcuts: {},
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    fontSize: 'medium',
    screenReader: false,
  },
  loading: false,
  error: null,
  lastUpdated: null,
};

// UI store actions interface
interface UIActions {
  // Theme management
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
  getEffectiveTheme: () => 'light' | 'dark';

  // Sidebar management
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Panel management
  setActivePanel: (panelId: string | null) => void;
  togglePanel: (panelId: string) => void;
  resizePanel: (panelId: string, size: number) => void;

  // Dialog management
  openDialog: (dialogId: string) => void;
  closeDialog: (dialogId: string) => void;
  closeAllDialogs: () => void;
  isDialogOpen: (dialogId: string) => boolean;

  // Layout management
  setLayoutDensity: (density: 'comfortable' | 'compact' | 'cozy') => void;
  updatePanelSizes: (sizes: Partial<Record<string, number>>) => void;
  addCustomPanel: (panel: Omit<CustomPanel, 'id'>) => string;
  updateCustomPanel: (panelId: string, updates: Partial<CustomPanel>) => void;
  removeCustomPanel: (panelId: string) => void;
  resetLayout: () => void;

  // Keyboard shortcuts
  setKeyboardEnabled: (enabled: boolean) => void;
  updateShortcut: (key: string, action: string) => void;
  removeShortcut: (key: string) => void;
  addCustomShortcut: (key: string, action: string) => void;
  removeCustomShortcut: (key: string) => void;
  setCustomShortcuts: (shortcuts: Record<string, string>) => void;
  resetShortcuts: () => void;
  executeShortcut: (key: string) => void;

  // Accessibility
  updateAccessibilitySettings: (
    settings: Partial<AccessibilitySettings>
  ) => void;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setFontSize: (size: 'small' | 'medium' | 'large' | 'xl') => void;
  setScreenReaderMode: (enabled: boolean) => void;

  // UI state management
  setFullscreen: (enabled: boolean) => void;
  setFocus: (elementId: string) => void;
  clearFocus: () => void;

  // Command palette
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Help and tutorials
  showShortcutsHelp: () => void;
  showTutorial: (tutorialId: string) => void;
  completeTutorial: (tutorialId: string) => void;

  // State persistence
  saveLayoutPresets: (presetName: string, layout: LayoutConfig) => void;
  loadLayoutPreset: (presetName: string) => void;
  deleteLayoutPreset: (presetName: string) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// UI store type
export type UIStore = UIState & UIActions;

// Layout presets storage
const layoutPresets = new Map<string, LayoutConfig>();

// Create UI store
export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      subscriptions(
        immer<UIStore>((set, get) => ({
          // Initial state
          ...initialState,

          // Theme management
          setTheme: theme => {
            set(draft => {
              draft.theme = theme;
              draft.lastUpdated = new Date();
            });

            // Apply theme to document
            const effectiveTheme = get().getEffectiveTheme();
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(effectiveTheme);
          },

          toggleTheme: () => {
            const currentTheme = get().theme;
            let newTheme: 'light' | 'dark' | 'system';

            switch (currentTheme) {
              case 'light':
                newTheme = 'dark';
                break;
              case 'dark':
                newTheme = 'system';
                break;
              default:
                newTheme = 'light';
                break;
            }

            get().setTheme(newTheme);
          },

          getEffectiveTheme: () => {
            const theme = get().theme;

            if (theme === 'system') {
              // Check if window is available (client-side)
              if (typeof window !== 'undefined') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light';
              }
              // Default to light theme on server
              return 'light';
            }

            return theme;
          },

          // Sidebar management
          toggleSidebar: () => {
            set(draft => {
              draft.sidebarCollapsed = !draft.sidebarCollapsed;
            });
          },

          setSidebarCollapsed: collapsed => {
            set(draft => {
              draft.sidebarCollapsed = collapsed;
            });
          },

          // Panel management
          setActivePanel: panelId => {
            set(draft => {
              draft.activePanel = panelId;
            });
          },

          togglePanel: panelId => {
            set(draft => {
              draft.activePanel =
                draft.activePanel === panelId ? null : panelId;
            });
          },

          resizePanel: (panelId, size) => {
            set(draft => {
              draft.layout.panelSizes[panelId] = size;
              draft.lastUpdated = new Date();
            });
          },

          // Dialog management
          openDialog: dialogId => {
            set(draft => {
              if (!draft.openDialogs.includes(dialogId)) {
                draft.openDialogs.push(dialogId);
              }
            });
          },

          closeDialog: dialogId => {
            set(draft => {
              draft.openDialogs = draft.openDialogs.filter(
                id => id !== dialogId
              );
            });
          },

          closeAllDialogs: () => {
            set(draft => {
              draft.openDialogs = [];
            });
          },

          isDialogOpen: dialogId => {
            return get().openDialogs.includes(dialogId);
          },

          // Layout management
          setLayoutDensity: density => {
            set(draft => {
              draft.layout.density = density;
              draft.lastUpdated = new Date();
            });

            // Apply density classes to document
            document.documentElement.classList.remove(
              'density-comfortable',
              'density-compact',
              'density-cozy'
            );
            document.documentElement.classList.add(`density-${density}`);
          },

          updatePanelSizes: sizes => {
            set(draft => {
              Object.assign(draft.layout.panelSizes, sizes);
              draft.lastUpdated = new Date();
            });
          },

          addCustomPanel: panel => {
            const id = `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            set(draft => {
              const newPanel: CustomPanel = {
                ...panel,
                id,
              };
              draft.layout.customPanels.push(newPanel);
              draft.lastUpdated = new Date();
            });

            return id;
          },

          updateCustomPanel: (panelId, updates) => {
            set(draft => {
              const panel = draft.layout.customPanels.find(
                p => p.id === panelId
              );
              if (panel) {
                Object.assign(panel, updates);
                draft.lastUpdated = new Date();
              }
            });
          },

          removeCustomPanel: panelId => {
            set(draft => {
              draft.layout.customPanels = draft.layout.customPanels.filter(
                p => p.id !== panelId
              );

              // Close panel if it's active
              if (draft.activePanel === panelId) {
                draft.activePanel = null;
              }

              draft.lastUpdated = new Date();
            });
          },

          resetLayout: () => {
            set(draft => {
              draft.layout = {
                density: 'comfortable',
                panelSizes: {
                  sidebar: 280,
                  mainContent: -1,
                  rightPanel: 320,
                },
                customPanels: [],
              };
              draft.activePanel = null;
              draft.sidebarCollapsed = false;
              draft.lastUpdated = new Date();
            });
          },

          // Keyboard shortcuts
          setKeyboardEnabled: enabled => {
            set(draft => {
              draft.keyboard.enabled = enabled;
            });
          },

          updateShortcut: (key, action) => {
            set(draft => {
              draft.keyboard.shortcuts[key] = action;
              draft.lastUpdated = new Date();
            });
          },

          removeShortcut: key => {
            set(draft => {
              delete draft.keyboard.shortcuts[key];
              draft.lastUpdated = new Date();
            });
          },

          addCustomShortcut: (key, action) => {
            set(draft => {
              draft.keyboard.customShortcuts[key] = action;
              draft.lastUpdated = new Date();
            });
          },

          removeCustomShortcut: key => {
            set(draft => {
              delete draft.keyboard.customShortcuts[key];
              draft.lastUpdated = new Date();
            });
          },

          setCustomShortcuts: shortcuts => {
            set(draft => {
              draft.keyboard.customShortcuts = shortcuts;
              draft.lastUpdated = new Date();
            });
          },

          resetShortcuts: () => {
            set(draft => {
              draft.keyboard.shortcuts = { ...initialState.keyboard.shortcuts };
              draft.keyboard.customShortcuts = {};
              draft.lastUpdated = new Date();
            });
          },

          executeShortcut: key => {
            const { keyboard } = get();
            if (!keyboard.enabled) return;

            const action =
              keyboard.customShortcuts[key] || keyboard.shortcuts[key];
            if (!action) return;

            // Execute built-in shortcuts
            switch (action) {
              case 'openCommandPalette':
                get().openCommandPalette();
                break;
              case 'toggleShortcutsHelp':
                get().showShortcutsHelp();
                break;
              case 'toggleSidebar':
                get().toggleSidebar();
                break;
              case 'closeDialog':
                get().closeAllDialogs();
                break;
              case 'createNewProject':
                // This would trigger a project creation action
                window.dispatchEvent(new CustomEvent('ui:createNewProject'));
                break;
              case 'saveProject':
                // This would trigger a project save action
                window.dispatchEvent(new CustomEvent('ui:saveProject'));
                break;
              case 'undo':
                window.dispatchEvent(new CustomEvent('ui:undo'));
                break;
              case 'redo':
                window.dispatchEvent(new CustomEvent('ui:redo'));
                break;
              default:
                // Custom actions
                window.dispatchEvent(
                  new CustomEvent('ui:customAction', { detail: { action } })
                );
                break;
            }
          },

          // Accessibility
          updateAccessibilitySettings: settings => {
            set(draft => {
              Object.assign(draft.accessibility, settings);
              draft.lastUpdated = new Date();
            });

            // Apply accessibility settings to document
            const { accessibility } = get();

            document.documentElement.classList.toggle(
              'reduced-motion',
              accessibility.reducedMotion
            );
            document.documentElement.classList.toggle(
              'high-contrast',
              accessibility.highContrast
            );
            document.documentElement.classList.remove(
              'font-small',
              'font-medium',
              'font-large',
              'font-xl'
            );
            document.documentElement.classList.add(
              `font-${accessibility.fontSize}`
            );

            if (accessibility.screenReader) {
              document.documentElement.setAttribute('aria-live', 'polite');
            } else {
              document.documentElement.removeAttribute('aria-live');
            }
          },

          setReducedMotion: enabled => {
            get().updateAccessibilitySettings({ reducedMotion: enabled });
          },

          setHighContrast: enabled => {
            get().updateAccessibilitySettings({ highContrast: enabled });
          },

          setFontSize: size => {
            get().updateAccessibilitySettings({ fontSize: size });
          },

          setScreenReaderMode: enabled => {
            get().updateAccessibilitySettings({ screenReader: enabled });
          },

          // UI state management
          setFullscreen: enabled => {
            if (enabled) {
              document.documentElement.requestFullscreen?.();
            } else {
              document.exitFullscreen?.();
            }
          },

          setFocus: elementId => {
            const element = document.getElementById(elementId);
            if (element) {
              element.focus();
            }
          },

          clearFocus: () => {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && activeElement.blur) {
              activeElement.blur();
            }
          },

          // Command palette
          openCommandPalette: () => {
            get().openDialog('commandPalette');
          },

          closeCommandPalette: () => {
            get().closeDialog('commandPalette');
          },

          // Help and tutorials
          showShortcutsHelp: () => {
            get().openDialog('shortcutsHelp');
          },

          showTutorial: tutorialId => {
            get().openDialog(`tutorial_${tutorialId}`);
          },

          completeTutorial: tutorialId => {
            get().closeDialog(`tutorial_${tutorialId}`);

            // Mark tutorial as completed
            const completedTutorials = JSON.parse(
              localStorage.getItem('completedTutorials') || '[]'
            );

            if (!completedTutorials.includes(tutorialId)) {
              completedTutorials.push(tutorialId);
              localStorage.setItem(
                'completedTutorials',
                JSON.stringify(completedTutorials)
              );
            }
          },

          // State persistence
          saveLayoutPresets: (presetName, layout) => {
            layoutPresets.set(presetName, layout);

            // Save to localStorage
            const presets = Object.fromEntries(layoutPresets);
            localStorage.setItem('layoutPresets', JSON.stringify(presets));
          },

          loadLayoutPreset: presetName => {
            const layout = layoutPresets.get(presetName);
            if (layout) {
              set(draft => {
                draft.layout = { ...layout };
                draft.lastUpdated = new Date();
              });
            }
          },

          deleteLayoutPreset: presetName => {
            layoutPresets.delete(presetName);

            // Update localStorage
            const presets = Object.fromEntries(layoutPresets);
            localStorage.setItem('layoutPresets', JSON.stringify(presets));
          },

          // State management
          setLoading: loading => {
            set(draft => {
              draft.loading = loading;
            });
          },

          setError: error => {
            set(draft => {
              draft.error = error;
            });
          },

          clearError: () => {
            set(draft => {
              draft.error = null;
            });
          },

          reset: () => {
            set(draft => {
              Object.assign(draft, initialState);
            });
          },
        }))
      ),
      {
        name: 'storm-ui-store',
        version: 1,
        partialize: createPartialize<UIStore>([
          'theme',
          'sidebarCollapsed',
          'layout',
          'keyboard',
          'accessibility',
        ]),
      }
    ),
    { name: 'UIStore' }
  )
);

// Initialize theme and accessibility settings on store creation
if (typeof window !== 'undefined') {
  // Load layout presets from localStorage
  try {
    const storedPresets = localStorage.getItem('layoutPresets');
    if (storedPresets) {
      const presets = JSON.parse(storedPresets);
      Object.entries(presets).forEach(([name, layout]) => {
        layoutPresets.set(name, layout as LayoutConfig);
      });
    }
  } catch (error) {
    logger.warn('Failed to load layout presets:', error);
  }

  // Apply initial theme and accessibility settings
  const store = useUIStore.getState();
  const effectiveTheme = store.getEffectiveTheme();
  document.documentElement.classList.add(effectiveTheme);
  document.documentElement.classList.add(`density-${store.layout.density}`);

  if (store.accessibility.reducedMotion) {
    document.documentElement.classList.add('reduced-motion');
  }
  if (store.accessibility.highContrast) {
    document.documentElement.classList.add('high-contrast');
  }
  document.documentElement.classList.add(
    `font-${store.accessibility.fontSize}`
  );

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentStore = useUIStore.getState();
    if (currentStore.theme === 'system') {
      const newTheme = currentStore.getEffectiveTheme();
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newTheme);
    }
  });

  // Global keyboard shortcut listener
  document.addEventListener('keydown', event => {
    const store = useUIStore.getState();
    if (!store.keyboard.enabled) return;

    // Skip if key is undefined or if we're in an input/textarea
    if (!event.key) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true')
    ) {
      // Allow Cmd+Enter or Ctrl+Enter to work in inputs
      if (!((event.metaKey || event.ctrlKey) && event.key === 'Enter')) {
        return;
      }
    }

    const key = [
      event.metaKey && 'cmd',
      event.ctrlKey && 'ctrl',
      event.shiftKey && 'shift',
      event.altKey && 'alt',
      event.key.toLowerCase(),
    ]
      .filter(Boolean)
      .join('+');

    const allShortcuts = {
      ...store.keyboard.shortcuts,
      ...store.keyboard.customShortcuts,
    };

    if (allShortcuts[key]) {
      event.preventDefault();
      store.executeShortcut(key);
    }
  });
}

// Selectors
export const uiSelectors = {
  theme: (state: UIStore) => state.theme,
  effectiveTheme: (state: UIStore) => state.getEffectiveTheme(),
  sidebarCollapsed: (state: UIStore) => state.sidebarCollapsed,
  activePanel: (state: UIStore) => state.activePanel,
  openDialogs: (state: UIStore) => state.openDialogs,
  layout: (state: UIStore) => state.layout,
  keyboard: (state: UIStore) => state.keyboard,
  accessibility: (state: UIStore) => state.accessibility,
  isLoading: (state: UIStore) => state.loading,
  error: (state: UIStore) => state.error,
  isDialogOpen: (dialogId: string) => (state: UIStore) =>
    state.isDialogOpen(dialogId),
  allShortcuts: (state: UIStore) => ({
    ...state.keyboard.shortcuts,
    ...state.keyboard.customShortcuts,
  }),
  customPanels: (state: UIStore) => state.layout.customPanels,
  panelSizes: (state: UIStore) => state.layout.panelSizes,
};

// UI hooks
export const useUI = () => {
  const store = useUIStore();
  return {
    ...store,
    selectors: uiSelectors,
  };
};

export const useTheme = () => useUIStore(uiSelectors.theme);
export const useEffectiveTheme = () => useUIStore(uiSelectors.effectiveTheme);
export const useSidebarCollapsed = () =>
  useUIStore(uiSelectors.sidebarCollapsed);
export const useActivePanel = () => useUIStore(uiSelectors.activePanel);
export const useOpenDialogs = () => useUIStore(uiSelectors.openDialogs);
export const useLayout = () => useUIStore(uiSelectors.layout);
export const useKeyboard = () => useUIStore(uiSelectors.keyboard);
export const useAccessibility = () => useUIStore(uiSelectors.accessibility);
export const useUILoading = () => useUIStore(uiSelectors.isLoading);
export const useUIError = () => useUIStore(uiSelectors.error);
