// Notifications store slice
import { create } from 'zustand';
import {
  NotificationState,
  StormNotification,
  NotificationAction,
  NotificationSettings,
} from '../types';
import { persist, createPartialize } from '../middleware/persist';
import { devtools } from '../middleware/devtools';
import { immer } from '../middleware/immer';
import { subscriptions } from '../middleware/subscriptions';

// Initial state
const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  settings: {
    enabled: true,
    maxVisible: 5,
    autoHideTimeout: 5000,
    groupSimilar: true,
    soundEnabled: false, // Disabled by default to avoid missing file errors
    position: 'top-right',
  },
  history: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

// Notification store actions interface
interface NotificationActions {
  // Notification management
  addNotification: (
    notification: Omit<StormNotification, 'id' | 'timestamp'>
  ) => string;
  updateNotification: (
    notificationId: string,
    updates: Partial<StormNotification>
  ) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  clearAllNotifications: () => void;

  // Quick notification methods
  showSuccess: (
    title: string,
    message?: string,
    actions?: NotificationAction[]
  ) => string;
  showError: (
    title: string,
    message?: string,
    actions?: NotificationAction[]
  ) => string;
  showWarning: (
    title: string,
    message?: string,
    actions?: NotificationAction[]
  ) => string;
  showInfo: (
    title: string,
    message?: string,
    actions?: NotificationAction[]
  ) => string;

  // Notification states
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  toggleRead: (notificationId: string) => void;

  // Persistent notifications
  addPersistentNotification: (
    notification: Omit<StormNotification, 'id' | 'timestamp' | 'persistent'>
  ) => string;
  removePersistentNotification: (notificationId: string) => void;

  // Notification grouping
  groupNotifications: (
    notifications: StormNotification[]
  ) => GroupedNotification[];
  ungroupNotification: (groupId: string) => void;

  // History management
  moveToHistory: (notificationId: string) => void;
  clearHistory: () => void;
  restoreFromHistory: (notificationId: string) => void;

  // Settings management
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  enableNotifications: () => void;
  disableNotifications: () => void;
  toggleSounds: () => void;
  setPosition: (position: NotificationSettings['position']) => void;
  setAutoHideTimeout: (timeout: number) => void;

  // Browser notifications
  requestBrowserPermission: () => Promise<boolean>;
  showBrowserNotification: (
    title: string,
    options?: NotificationOptions
  ) => void;

  // Action handling
  executeNotificationAction: (notificationId: string, actionId: string) => void;

  // Batch operations
  removeMultipleNotifications: (notificationIds: string[]) => void;
  markMultipleAsRead: (notificationIds: string[]) => void;

  // Filtering and search
  getNotificationsByType: (
    type: StormNotification['type']
  ) => StormNotification[];
  getUnreadNotifications: () => StormNotification[];
  searchNotifications: (query: string) => StormNotification[];

  // Auto-cleanup
  startAutoCleanup: (interval?: number) => void;
  stopAutoCleanup: () => void;
  cleanupOldNotifications: (maxAge?: number) => void;

  // Sound management (internal)
  playNotificationSound: (type: StormNotification['type']) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// Additional types
interface GroupedNotification {
  id: string;
  type: StormNotification['type'];
  title: string;
  count: number;
  notifications: StormNotification[];
  latestTimestamp: Date;
}

// Notification store type
export type NotificationStore = NotificationState & NotificationActions;

// Auto-cleanup timer
let autoCleanupTimer: NodeJS.Timeout | null = null;

// Sound cache for notification sounds
const notificationSounds = {
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  warning: '/sounds/warning.mp3',
  info: '/sounds/info.mp3',
};

// Create notification store
export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      subscriptions(
        immer<NotificationStore>((set, get) => ({
          // Initial state
          ...initialState,

          // Notification management
          addNotification: notification => {
            const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newNotification: StormNotification = {
              ...notification,
              id,
              timestamp: new Date(),
              read: false,
              persistent: notification.persistent || false,
            };

            set(draft => {
              // Check if notifications are enabled
              if (!draft.settings.enabled) {
                return;
              }

              // Group similar notifications if enabled
              if (draft.settings.groupSimilar) {
                const existing = draft.notifications.find(
                  n =>
                    n.type === newNotification.type &&
                    n.title === newNotification.title &&
                    !n.read
                );

                if (existing) {
                  existing.message = `${existing.message}\n${newNotification.message}`;
                  existing.timestamp = newNotification.timestamp;
                  existing.metadata = {
                    ...existing.metadata,
                    count: (existing.metadata?.count || 1) + 1,
                  };
                  return;
                }
              }

              // Add new notification
              draft.notifications.unshift(newNotification);

              // Update unread count
              draft.unreadCount += 1;

              // Limit visible notifications
              if (draft.notifications.length > draft.settings.maxVisible) {
                const removed = draft.notifications.splice(
                  draft.settings.maxVisible
                );
                // Move excess notifications to history
                draft.history.unshift(...removed);
              }

              draft.lastUpdated = new Date();
            });

            // Auto-hide non-persistent notifications
            if (
              !newNotification.persistent &&
              get().settings.autoHideTimeout > 0
            ) {
              setTimeout(() => {
                get().removeNotification(id);
              }, get().settings.autoHideTimeout);
            }

            // Play notification sound
            if (get().settings.soundEnabled) {
              get().playNotificationSound(newNotification.type);
            }

            // Show browser notification if permission granted
            if (Notification.permission === 'granted') {
              get().showBrowserNotification(newNotification.title, {
                body: newNotification.message,
                icon: `/icons/${newNotification.type}.png`,
                tag: newNotification.id,
              });
            }

            return id;
          },

          updateNotification: (notificationId, updates) => {
            set(draft => {
              const notification = draft.notifications.find(
                n => n.id === notificationId
              );
              if (notification) {
                Object.assign(notification, updates);
                draft.lastUpdated = new Date();
              }
            });
          },

          removeNotification: notificationId => {
            set(draft => {
              const notificationIndex = draft.notifications.findIndex(
                n => n.id === notificationId
              );
              if (notificationIndex !== -1) {
                const notification = draft.notifications[notificationIndex];

                // Update unread count if notification was unread
                if (!notification.read) {
                  draft.unreadCount = Math.max(0, draft.unreadCount - 1);
                }

                // Move to history
                draft.history.unshift(notification);

                // Remove from active notifications
                draft.notifications.splice(notificationIndex, 1);

                draft.lastUpdated = new Date();
              }
            });
          },

          clearNotifications: () => {
            set(draft => {
              // Move all notifications to history
              draft.history.unshift(...draft.notifications);

              // Keep only last 100 items in history
              if (draft.history.length > 100) {
                draft.history = draft.history.slice(0, 100);
              }

              draft.notifications = [];
              draft.unreadCount = 0;
              draft.lastUpdated = new Date();
            });
          },

          clearAllNotifications: () => {
            set(draft => {
              draft.notifications = [];
              draft.history = [];
              draft.unreadCount = 0;
              draft.lastUpdated = new Date();
            });
          },

          // Quick notification methods
          showSuccess: (title, message = '', actions = []) => {
            return get().addNotification({
              type: 'success',
              title,
              message,
              actions,
              read: false,
              persistent: false,
            });
          },

          showError: (title, message = '', actions = []) => {
            return get().addNotification({
              type: 'error',
              title,
              message,
              actions,
              read: false,
              persistent: true, // Errors are persistent by default
            });
          },

          showWarning: (title, message = '', actions = []) => {
            return get().addNotification({
              type: 'warning',
              title,
              message,
              actions,
              read: false,
              persistent: false,
            });
          },

          showInfo: (title, message = '', actions = []) => {
            return get().addNotification({
              type: 'info',
              title,
              message,
              actions,
              read: false,
              persistent: false,
            });
          },

          // Notification states
          markAsRead: notificationId => {
            set(draft => {
              const notification = draft.notifications.find(
                n => n.id === notificationId
              );
              if (notification && !notification.read) {
                notification.read = true;
                draft.unreadCount = Math.max(0, draft.unreadCount - 1);
                draft.lastUpdated = new Date();
              }
            });
          },

          markAllAsRead: () => {
            set(draft => {
              draft.notifications.forEach(notification => {
                notification.read = true;
              });
              draft.unreadCount = 0;
              draft.lastUpdated = new Date();
            });
          },

          toggleRead: notificationId => {
            const notification = get().notifications.find(
              n => n.id === notificationId
            );
            if (notification) {
              if (notification.read) {
                set(draft => {
                  const n = draft.notifications.find(
                    n => n.id === notificationId
                  );
                  if (n) {
                    n.read = false;
                    draft.unreadCount += 1;
                  }
                });
              } else {
                get().markAsRead(notificationId);
              }
            }
          },

          // Persistent notifications
          addPersistentNotification: notification => {
            return get().addNotification({
              ...notification,
              read: false,
              persistent: true,
            });
          },

          removePersistentNotification: notificationId => {
            get().removeNotification(notificationId);
          },

          // Notification grouping
          groupNotifications: notifications => {
            const groups = new Map<string, GroupedNotification>();

            notifications.forEach(notification => {
              const groupKey = `${notification.type}_${notification.title}`;

              if (groups.has(groupKey)) {
                const group = groups.get(groupKey)!;
                group.notifications.push(notification);
                group.count += 1;

                if (notification.timestamp > group.latestTimestamp) {
                  group.latestTimestamp = notification.timestamp;
                }
              } else {
                groups.set(groupKey, {
                  id: groupKey,
                  type: notification.type,
                  title: notification.title,
                  count: 1,
                  notifications: [notification],
                  latestTimestamp: notification.timestamp,
                });
              }
            });

            return Array.from(groups.values()).sort(
              (a, b) =>
                b.latestTimestamp.getTime() - a.latestTimestamp.getTime()
            );
          },

          ungroupNotification: groupId => {
            // This would expand a grouped notification back into individual ones
            // Implementation depends on how grouping is stored and displayed
          },

          // History management
          moveToHistory: notificationId => {
            get().removeNotification(notificationId);
          },

          clearHistory: () => {
            set(draft => {
              draft.history = [];
              draft.lastUpdated = new Date();
            });
          },

          restoreFromHistory: notificationId => {
            set(draft => {
              const historyIndex = draft.history.findIndex(
                n => n.id === notificationId
              );
              if (historyIndex !== -1) {
                const notification = draft.history[historyIndex];

                // Move back to active notifications
                draft.notifications.unshift(notification);
                draft.history.splice(historyIndex, 1);

                // Update unread count if notification is unread
                if (!notification.read) {
                  draft.unreadCount += 1;
                }

                draft.lastUpdated = new Date();
              }
            });
          },

          // Settings management
          updateSettings: settings => {
            set(draft => {
              Object.assign(draft.settings, settings);
              draft.lastUpdated = new Date();
            });
          },

          enableNotifications: () => {
            get().updateSettings({ enabled: true });
          },

          disableNotifications: () => {
            get().updateSettings({ enabled: false });
          },

          toggleSounds: () => {
            const currentSoundEnabled = get().settings.soundEnabled;
            get().updateSettings({ soundEnabled: !currentSoundEnabled });
          },

          setPosition: position => {
            get().updateSettings({ position });
          },

          setAutoHideTimeout: timeout => {
            get().updateSettings({ autoHideTimeout: timeout });
          },

          // Browser notifications
          requestBrowserPermission: async () => {
            if (!('Notification' in window)) {
              return false;
            }

            if (Notification.permission === 'granted') {
              return true;
            }

            if (Notification.permission !== 'denied') {
              const permission = await Notification.requestPermission();
              return permission === 'granted';
            }

            return false;
          },

          showBrowserNotification: (title, options = {}) => {
            if (Notification.permission === 'granted') {
              new Notification(title, options);
            }
          },

          // Action handling
          executeNotificationAction: (notificationId, actionId) => {
            const notification = get().notifications.find(
              n => n.id === notificationId
            );
            if (!notification || !notification.actions) return;

            const action = notification.actions.find(
              a => a.action === actionId
            );
            if (!action) return;

            // Execute the action (emit custom event)
            window.dispatchEvent(
              new CustomEvent('notification:action', {
                detail: { notificationId, action: action.action, notification },
              })
            );

            // Remove notification after action if it's not persistent
            if (!notification.persistent) {
              get().removeNotification(notificationId);
            }
          },

          // Batch operations
          removeMultipleNotifications: notificationIds => {
            notificationIds.forEach(id => get().removeNotification(id));
          },

          markMultipleAsRead: notificationIds => {
            notificationIds.forEach(id => get().markAsRead(id));
          },

          // Filtering and search
          getNotificationsByType: type => {
            return get().notifications.filter(n => n.type === type);
          },

          getUnreadNotifications: () => {
            return get().notifications.filter(n => !n.read);
          },

          searchNotifications: query => {
            const lowerQuery = query.toLowerCase();
            const allNotifications = [...get().notifications, ...get().history];

            return allNotifications.filter(
              n =>
                n.title.toLowerCase().includes(lowerQuery) ||
                n.message.toLowerCase().includes(lowerQuery)
            );
          },

          // Auto-cleanup
          startAutoCleanup: (interval = 60000) => {
            // Default: 1 minute
            get().stopAutoCleanup();

            autoCleanupTimer = setInterval(() => {
              get().cleanupOldNotifications();
            }, interval);
          },

          stopAutoCleanup: () => {
            if (autoCleanupTimer) {
              clearInterval(autoCleanupTimer);
              autoCleanupTimer = null;
            }
          },

          cleanupOldNotifications: (maxAge = 24 * 60 * 60 * 1000) => {
            // Default: 24 hours
            const cutoffTime = Date.now() - maxAge;

            set(draft => {
              // Clean up history
              draft.history = draft.history.filter(n => {
                const timestamp =
                  n.timestamp instanceof Date
                    ? n.timestamp
                    : new Date(n.timestamp);
                return timestamp.getTime() > cutoffTime;
              });

              // Clean up read notifications that are older than cutoff
              draft.notifications = draft.notifications.filter(n => {
                const timestamp =
                  n.timestamp instanceof Date
                    ? n.timestamp
                    : new Date(n.timestamp);
                return (
                  !n.read || timestamp.getTime() > cutoffTime || n.persistent
                );
              });

              draft.lastUpdated = new Date();
            });
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
            get().stopAutoCleanup();

            set(draft => {
              Object.assign(draft, initialState);
            });
          },

          // Private method for playing sounds
          playNotificationSound: (type: StormNotification['type']) => {
            try {
              const soundUrl = notificationSounds[type];
              if (soundUrl && get().settings.soundEnabled) {
                // Check if sound file exists before playing
                fetch(soundUrl, { method: 'HEAD' })
                  .then(response => {
                    if (response.ok) {
                      const audio = new Audio(soundUrl);
                      audio.volume = 0.5;
                      audio.play().catch(() => {
                        // Silently fail if audio can't be played
                      });
                    }
                  })
                  .catch(() => {
                    // Silently fail if sound file doesn't exist
                  });
              }
            } catch (error) {
              // Silently fail if audio is not supported
            }
          },
        }))
      ),
      {
        name: 'storm-notification-store',
        version: 1,
        partialize: createPartialize<NotificationStore>([
          'settings',
          'history',
        ]),
      }
    ),
    { name: 'NotificationStore' }
  )
);

// Initialize auto-cleanup on store creation
if (typeof window !== 'undefined') {
  const store = useNotificationStore.getState();
  store.startAutoCleanup();
}

// Selectors
export const notificationSelectors = {
  notifications: (state: NotificationStore) => state.notifications,
  unreadCount: (state: NotificationStore) => state.unreadCount,
  settings: (state: NotificationStore) => state.settings,
  history: (state: NotificationStore) => state.history,
  isLoading: (state: NotificationStore) => state.loading,
  error: (state: NotificationStore) => state.error,
  unreadNotifications: (state: NotificationStore) =>
    state.getUnreadNotifications(),
  successNotifications: (state: NotificationStore) =>
    state.getNotificationsByType('success'),
  errorNotifications: (state: NotificationStore) =>
    state.getNotificationsByType('error'),
  warningNotifications: (state: NotificationStore) =>
    state.getNotificationsByType('warning'),
  infoNotifications: (state: NotificationStore) =>
    state.getNotificationsByType('info'),
  persistentNotifications: (state: NotificationStore) =>
    state.notifications.filter(n => n.persistent),
  recentNotifications: (state: NotificationStore) =>
    state.notifications.slice(0, state.settings.maxVisible),
  groupedNotifications: (state: NotificationStore) =>
    state.groupNotifications(state.notifications),
};

// Notification hooks
export const useNotifications = () => {
  const store = useNotificationStore();
  return {
    ...store,
    selectors: notificationSelectors,
  };
};

export const useNotificationsList = () =>
  useNotificationStore(notificationSelectors.notifications);
export const useUnreadCount = () =>
  useNotificationStore(notificationSelectors.unreadCount);
export const useNotificationSettings = () =>
  useNotificationStore(notificationSelectors.settings);
export const useNotificationHistory = () =>
  useNotificationStore(notificationSelectors.history);
export const useNotificationLoading = () =>
  useNotificationStore(notificationSelectors.isLoading);
export const useNotificationError = () =>
  useNotificationStore(notificationSelectors.error);
export const useUnreadNotifications = () =>
  useNotificationStore(notificationSelectors.unreadNotifications);
export const usePersistentNotifications = () =>
  useNotificationStore(notificationSelectors.persistentNotifications);

// Convenience hooks for specific notification types
export const useSuccessNotifications = () =>
  useNotificationStore(notificationSelectors.successNotifications);
export const useErrorNotifications = () =>
  useNotificationStore(notificationSelectors.errorNotifications);
export const useWarningNotifications = () =>
  useNotificationStore(notificationSelectors.warningNotifications);
export const useInfoNotifications = () =>
  useNotificationStore(notificationSelectors.infoNotifications);
