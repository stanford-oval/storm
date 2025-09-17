// Research data store slice
import { create } from 'zustand';
import { ResearchState, SearchQuery } from '../types';
import { ResearchData, ConversationData, SourceData } from '@/types/storm';
import { persist, createPartialize } from '../middleware/persist';
import { devtools } from '../middleware/devtools';
import { immer } from '../middleware/immer';
import { subscriptions } from '../middleware/subscriptions';

// Initial state
const initialState: ResearchState = {
  currentResearch: null,
  activeConversations: [],
  searchHistory: [],
  sourcesCache: new Map(),
  perspectiveFilters: [],
  viewMode: 'conversations',
  autoRefresh: false,
  loading: false,
  error: null,
  lastUpdated: null,
};

// Research store actions interface
interface ResearchActions {
  // Research data management
  loadResearchData: (projectId: string) => Promise<void>;
  updateResearchData: (research: Partial<ResearchData>) => void;
  clearResearchData: () => void;
  refreshResearchData: () => Promise<void>;

  // Conversation management
  startConversation: (
    perspective: string,
    projectId: string
  ) => Promise<string>;
  updateConversation: (
    conversationId: string,
    updates: Partial<ConversationData>
  ) => void;
  endConversation: (conversationId: string) => Promise<void>;
  removeConversation: (conversationId: string) => void;
  addConversationTurn: (
    conversationId: string,
    content: string,
    speaker: 'user' | 'assistant'
  ) => void;

  // Source management
  addSource: (source: SourceData) => void;
  updateSource: (sourceId: string, updates: Partial<SourceData>) => void;
  removeSource: (sourceId: string) => void;
  markSourceAsUsed: (sourceId: string, sectionId: string) => void;
  bulkAddSources: (sources: SourceData[]) => void;

  // Search functionality
  performSearch: (query: string, perspective?: string) => Promise<SourceData[]>;
  addToSearchHistory: (query: SearchQuery) => void;
  clearSearchHistory: () => void;

  // Filtering and view management
  setPerspectiveFilters: (perspectives: string[]) => void;
  addPerspectiveFilter: (perspective: string) => void;
  removePerspectiveFilter: (perspective: string) => void;
  clearPerspectiveFilters: () => void;
  setViewMode: (mode: 'conversations' | 'sources' | 'timeline') => void;

  // Source caching
  cacheSource: (sourceId: string, data: any) => void;
  getCachedSource: (sourceId: string) => any | null;
  clearSourcesCache: () => void;

  // Auto-refresh management
  setAutoRefresh: (enabled: boolean) => void;
  startAutoRefresh: (interval?: number) => void;
  stopAutoRefresh: () => void;

  // Analytics and insights
  getConversationAnalytics: () => ConversationAnalytics;
  getSourceAnalytics: () => SourceAnalytics;
  getResearchInsights: () => ResearchInsights;

  // Export functionality
  exportResearchData: (format: 'json' | 'csv' | 'txt') => string;
  exportConversation: (
    conversationId: string,
    format: 'json' | 'txt'
  ) => string;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// Additional types
interface ConversationAnalytics {
  totalConversations: number;
  activeConversations: number;
  completedConversations: number;
  averageTurnsPerConversation: number;
  totalTurns: number;
  perspectiveBreakdown: Array<{ perspective: string; count: number }>;
  conversationDurations: Array<{ conversationId: string; duration: number }>;
}

interface SourceAnalytics {
  totalSources: number;
  uniqueDomains: number;
  averageRelevanceScore: number;
  mostUsedSources: Array<{ source: SourceData; usageCount: number }>;
  sourcesByPerspective: Array<{ perspective: string; count: number }>;
}

interface ResearchInsights {
  keyTopics: string[];
  emergingThemes: string[];
  coverageGaps: string[];
  sourceDiversity: number;
  informationDensity: number;
  conflictingInformation: Array<{ topic: string; sources: SourceData[] }>;
}

// Research store type
export type ResearchStore = ResearchState & ResearchActions;

// Auto-refresh timer
let autoRefreshTimer: NodeJS.Timeout | null = null;

// Create research store
export const useResearchStore = create<ResearchStore>()(
  devtools(
    persist(
      subscriptions(
        immer<ResearchStore>((set, get) => ({
          // Initial state
          ...initialState,

          // Research data management
          loadResearchData: async projectId => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const response = await fetch(`/api/research/${projectId}`);

              if (!response.ok) {
                throw new Error('Failed to load research data');
              }

              const researchData: ResearchData = await response.json();

              set(draft => {
                draft.currentResearch = researchData;
                draft.activeConversations = researchData.conversations.filter(
                  c => c.status === 'active'
                );
                draft.loading = false;
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to load research data';
                draft.loading = false;
              });
              throw error;
            }
          },

          updateResearchData: research => {
            set(draft => {
              if (draft.currentResearch) {
                Object.assign(draft.currentResearch, research);
                draft.lastUpdated = new Date();
              }
            });
          },

          clearResearchData: () => {
            set(draft => {
              draft.currentResearch = null;
              draft.activeConversations = [];
              draft.sourcesCache.clear();
            });
          },

          refreshResearchData: async () => {
            const { currentResearch } = get();
            if (currentResearch && currentResearch.conversations.length > 0) {
              // Assuming we can derive projectId from the first conversation
              // In a real app, this would be stored separately
              const projectId = 'current-project'; // Placeholder
              await get().loadResearchData(projectId);
            }
          },

          // Conversation management
          startConversation: async (perspective, projectId) => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const response = await fetch('/api/conversations/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ perspective, projectId }),
              });

              if (!response.ok) {
                throw new Error('Failed to start conversation');
              }

              const conversation: ConversationData = await response.json();

              set(draft => {
                if (!draft.currentResearch) {
                  draft.currentResearch = {
                    conversations: [],
                    sources: [],
                    perspectives: [],
                    totalQueries: 0,
                    lastUpdated: new Date(),
                  };
                }

                draft.currentResearch.conversations.push(conversation);
                draft.activeConversations.push(conversation);

                if (!draft.currentResearch.perspectives.includes(perspective)) {
                  draft.currentResearch.perspectives.push(perspective);
                }

                draft.loading = false;
                draft.lastUpdated = new Date();
              });

              return conversation.id;
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to start conversation';
                draft.loading = false;
              });
              throw error;
            }
          },

          updateConversation: (conversationId, updates) => {
            set(draft => {
              if (draft.currentResearch) {
                const conversation = draft.currentResearch.conversations.find(
                  c => c.id === conversationId
                );
                if (conversation) {
                  Object.assign(conversation, updates);

                  // Update active conversations list
                  const activeIndex = draft.activeConversations.findIndex(
                    c => c.id === conversationId
                  );
                  if (activeIndex !== -1) {
                    Object.assign(
                      draft.activeConversations[activeIndex],
                      updates
                    );
                  }

                  draft.lastUpdated = new Date();
                }
              }
            });
          },

          endConversation: async conversationId => {
            try {
              const response = await fetch(
                `/api/conversations/${conversationId}/end`,
                {
                  method: 'POST',
                }
              );

              if (!response.ok) {
                throw new Error('Failed to end conversation');
              }

              set(draft => {
                draft.activeConversations = draft.activeConversations.filter(
                  c => c.id !== conversationId
                );

                if (draft.currentResearch) {
                  const conversation = draft.currentResearch.conversations.find(
                    c => c.id === conversationId
                  );
                  if (conversation) {
                    conversation.status = 'completed';
                    conversation.endTime = new Date();
                  }
                }

                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to end conversation';
              });
              throw error;
            }
          },

          removeConversation: conversationId => {
            set(draft => {
              if (draft.currentResearch) {
                draft.currentResearch.conversations =
                  draft.currentResearch.conversations.filter(
                    c => c.id !== conversationId
                  );
              }
              draft.activeConversations = draft.activeConversations.filter(
                c => c.id !== conversationId
              );
            });
          },

          addConversationTurn: (conversationId, content, speaker) => {
            set(draft => {
              if (draft.currentResearch) {
                const conversation = draft.currentResearch.conversations.find(
                  c => c.id === conversationId
                );
                if (conversation) {
                  const turn = {
                    id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    speaker,
                    content,
                    timestamp: new Date(),
                  };

                  conversation.turns.push(turn);

                  // Update active conversation as well
                  const activeConversation = draft.activeConversations.find(
                    c => c.id === conversationId
                  );
                  if (activeConversation) {
                    activeConversation.turns.push(turn);
                  }
                }
              }
            });
          },

          // Source management
          addSource: source => {
            set(draft => {
              if (!draft.currentResearch) {
                draft.currentResearch = {
                  conversations: [],
                  sources: [],
                  perspectives: [],
                  totalQueries: 0,
                  lastUpdated: new Date(),
                };
              }

              // Check if source already exists
              const existingSource = draft.currentResearch.sources.find(
                s => s.url === source.url
              );
              if (!existingSource) {
                draft.currentResearch.sources.push(source);
                draft.lastUpdated = new Date();
              }
            });
          },

          updateSource: (sourceId, updates) => {
            set(draft => {
              if (draft.currentResearch) {
                const source = draft.currentResearch.sources.find(
                  s => s.id === sourceId
                );
                if (source) {
                  Object.assign(source, updates);
                  draft.lastUpdated = new Date();
                }
              }
            });
          },

          removeSource: sourceId => {
            set(draft => {
              if (draft.currentResearch) {
                draft.currentResearch.sources =
                  draft.currentResearch.sources.filter(s => s.id !== sourceId);
              }
              draft.sourcesCache.delete(sourceId);
            });
          },

          markSourceAsUsed: (sourceId, sectionId) => {
            set(draft => {
              if (draft.currentResearch) {
                const source = draft.currentResearch.sources.find(
                  s => s.id === sourceId
                );
                if (source) {
                  if (!source.usedInSections) {
                    source.usedInSections = [];
                  }
                  if (!source.usedInSections.includes(sectionId)) {
                    source.usedInSections.push(sectionId);
                  }
                }
              }
            });
          },

          bulkAddSources: sources => {
            set(draft => {
              if (!draft.currentResearch) {
                draft.currentResearch = {
                  conversations: [],
                  sources: [],
                  perspectives: [],
                  totalQueries: 0,
                  lastUpdated: new Date(),
                };
              }

              // Add only new sources
              const existingUrls = new Set(
                draft.currentResearch.sources.map(s => s.url)
              );
              const newSources = sources.filter(s => !existingUrls.has(s.url));

              draft.currentResearch.sources.push(...newSources);
              draft.lastUpdated = new Date();
            });
          },

          // Search functionality
          performSearch: async (query, perspective) => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, perspective }),
              });

              if (!response.ok) {
                throw new Error('Search failed');
              }

              const sources: SourceData[] = await response.json();

              set(draft => {
                draft.loading = false;
                if (draft.currentResearch) {
                  draft.currentResearch.totalQueries += 1;
                }
                draft.lastUpdated = new Date();
              });

              // Add to search history
              get().addToSearchHistory({
                id: `search_${Date.now()}`,
                query,
                timestamp: new Date(),
                results: sources.length,
                perspective,
              });

              // Add sources to research data
              get().bulkAddSources(sources);

              return sources;
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error ? error.message : 'Search failed';
                draft.loading = false;
              });
              throw error;
            }
          },

          addToSearchHistory: query => {
            set(draft => {
              draft.searchHistory.unshift(query);

              // Keep only last 100 searches
              if (draft.searchHistory.length > 100) {
                draft.searchHistory = draft.searchHistory.slice(0, 100);
              }
            });
          },

          clearSearchHistory: () => {
            set(draft => {
              draft.searchHistory = [];
            });
          },

          // Filtering and view management
          setPerspectiveFilters: perspectives => {
            set(draft => {
              draft.perspectiveFilters = perspectives;
            });
          },

          addPerspectiveFilter: perspective => {
            set(draft => {
              if (!draft.perspectiveFilters.includes(perspective)) {
                draft.perspectiveFilters.push(perspective);
              }
            });
          },

          removePerspectiveFilter: perspective => {
            set(draft => {
              draft.perspectiveFilters = draft.perspectiveFilters.filter(
                p => p !== perspective
              );
            });
          },

          clearPerspectiveFilters: () => {
            set(draft => {
              draft.perspectiveFilters = [];
            });
          },

          setViewMode: mode => {
            set(draft => {
              draft.viewMode = mode;
            });
          },

          // Source caching
          cacheSource: (sourceId, data) => {
            set(draft => {
              draft.sourcesCache.set(sourceId, data);
            });
          },

          getCachedSource: sourceId => {
            return get().sourcesCache.get(sourceId) || null;
          },

          clearSourcesCache: () => {
            set(draft => {
              draft.sourcesCache.clear();
            });
          },

          // Auto-refresh management
          setAutoRefresh: enabled => {
            set(draft => {
              draft.autoRefresh = enabled;
            });

            if (enabled) {
              get().startAutoRefresh();
            } else {
              get().stopAutoRefresh();
            }
          },

          startAutoRefresh: (interval = 30000) => {
            get().stopAutoRefresh(); // Clear existing timer

            autoRefreshTimer = setInterval(() => {
              get().refreshResearchData();
            }, interval);
          },

          stopAutoRefresh: () => {
            if (autoRefreshTimer) {
              clearInterval(autoRefreshTimer);
              autoRefreshTimer = null;
            }
          },

          // Analytics and insights
          getConversationAnalytics: () => {
            const { currentResearch } = get();
            if (!currentResearch) {
              return {
                totalConversations: 0,
                activeConversations: 0,
                completedConversations: 0,
                averageTurnsPerConversation: 0,
                totalTurns: 0,
                perspectiveBreakdown: [],
                conversationDurations: [],
              };
            }

            const conversations = currentResearch.conversations;
            const totalConversations = conversations.length;
            const activeConversations = conversations.filter(
              c => c.status === 'active'
            ).length;
            const completedConversations = conversations.filter(
              c => c.status === 'completed'
            ).length;
            const totalTurns = conversations.reduce(
              (sum, c) => sum + c.turns.length,
              0
            );
            const averageTurnsPerConversation =
              totalConversations > 0 ? totalTurns / totalConversations : 0;

            // Perspective breakdown
            const perspectiveCounts = new Map<string, number>();
            conversations.forEach(c => {
              const count = perspectiveCounts.get(c.perspective) || 0;
              perspectiveCounts.set(c.perspective, count + 1);
            });

            const perspectiveBreakdown = Array.from(perspectiveCounts.entries())
              .map(([perspective, count]) => ({ perspective, count }))
              .sort((a, b) => b.count - a.count);

            // Conversation durations
            const conversationDurations = conversations
              .filter(c => c.endTime)
              .map(c => ({
                conversationId: c.id,
                duration: c.endTime!.getTime() - c.startTime.getTime(),
              }));

            return {
              totalConversations,
              activeConversations,
              completedConversations,
              averageTurnsPerConversation,
              totalTurns,
              perspectiveBreakdown,
              conversationDurations,
            };
          },

          getSourceAnalytics: () => {
            const { currentResearch } = get();
            if (!currentResearch) {
              return {
                totalSources: 0,
                uniqueDomains: 0,
                averageRelevanceScore: 0,
                mostUsedSources: [],
                sourcesByPerspective: [],
              };
            }

            const sources = currentResearch.sources;
            const totalSources = sources.length;

            // Unique domains
            const domains = new Set(sources.map(s => new URL(s.url).hostname));
            const uniqueDomains = domains.size;

            // Average relevance score
            const relevanceScores = sources.map(s => s.relevanceScore || 0);
            const averageRelevanceScore =
              relevanceScores.length > 0
                ? relevanceScores.reduce((sum, score) => sum + score, 0) /
                  relevanceScores.length
                : 0;

            // Most used sources
            const mostUsedSources = sources
              .map(source => ({
                source,
                usageCount: source.usedInSections?.length || 0,
              }))
              .sort((a, b) => b.usageCount - a.usageCount)
              .slice(0, 10);

            // This would require additional tracking of which perspective found which source
            const sourcesByPerspective: Array<{
              perspective: string;
              count: number;
            }> = [];

            return {
              totalSources,
              uniqueDomains,
              averageRelevanceScore,
              mostUsedSources,
              sourcesByPerspective,
            };
          },

          getResearchInsights: () => {
            const { currentResearch } = get();
            if (!currentResearch) {
              return {
                keyTopics: [],
                emergingThemes: [],
                coverageGaps: [],
                sourceDiversity: 0,
                informationDensity: 0,
                conflictingInformation: [],
              };
            }

            // This would require NLP analysis in a real implementation
            const keyTopics: string[] = [];
            const emergingThemes: string[] = [];
            const coverageGaps: string[] = [];
            const sourceDiversity = new Set(
              currentResearch.sources.map(s => new URL(s.url).hostname)
            ).size;
            const informationDensity =
              currentResearch.sources.length /
              Math.max(currentResearch.conversations.length, 1);
            const conflictingInformation: Array<{
              topic: string;
              sources: SourceData[];
            }> = [];

            return {
              keyTopics,
              emergingThemes,
              coverageGaps,
              sourceDiversity,
              informationDensity,
              conflictingInformation,
            };
          },

          // Export functionality
          exportResearchData: format => {
            const { currentResearch } = get();
            if (!currentResearch) return '';

            switch (format) {
              case 'json':
                return JSON.stringify(currentResearch, null, 2);
              case 'csv':
                // Simple CSV export of sources
                const csvHeaders =
                  'Title,URL,Snippet,Retrieved At,Relevance Score\n';
                const csvRows = currentResearch.sources
                  .map(
                    s =>
                      `"${s.title}","${s.url}","${s.snippet}","${s.retrievedAt}","${s.relevanceScore || 0}"`
                  )
                  .join('\n');
                return csvHeaders + csvRows;
              case 'txt':
                let txtOutput = `Research Data Export\n${'='.repeat(50)}\n\n`;
                txtOutput += `Total Conversations: ${currentResearch.conversations.length}\n`;
                txtOutput += `Total Sources: ${currentResearch.sources.length}\n`;
                txtOutput += `Perspectives: ${currentResearch.perspectives.join(', ')}\n\n`;

                txtOutput += 'Sources:\n' + '-'.repeat(20) + '\n';
                currentResearch.sources.forEach((source, index) => {
                  txtOutput += `${index + 1}. ${source.title}\n   ${source.url}\n   ${source.snippet}\n\n`;
                });

                return txtOutput;
              default:
                return '';
            }
          },

          exportConversation: (conversationId, format) => {
            const { currentResearch } = get();
            if (!currentResearch) return '';

            const conversation = currentResearch.conversations.find(
              c => c.id === conversationId
            );
            if (!conversation) return '';

            switch (format) {
              case 'json':
                return JSON.stringify(conversation, null, 2);
              case 'txt':
                let txtOutput = `Conversation: ${conversation.perspective}\n${'='.repeat(50)}\n\n`;
                conversation.turns.forEach((turn, index) => {
                  txtOutput += `${index + 1}. ${turn.speaker.toUpperCase()}: ${turn.content}\n\n`;
                });
                return txtOutput;
              default:
                return '';
            }
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
            get().stopAutoRefresh();
            set(draft => {
              Object.assign(draft, initialState);
              draft.sourcesCache = new Map();
            });
          },
        }))
      ),
      {
        name: 'storm-research-store',
        version: 1,
        partialize: createPartialize<ResearchStore>([
          'searchHistory',
          'perspectiveFilters',
          'viewMode',
          'autoRefresh',
        ]),
      }
    ),
    { name: 'ResearchStore' }
  )
);

// Selectors
export const researchSelectors = {
  currentResearch: (state: ResearchStore) => state.currentResearch,
  activeConversations: (state: ResearchStore) => state.activeConversations,
  searchHistory: (state: ResearchStore) => state.searchHistory,
  perspectiveFilters: (state: ResearchStore) => state.perspectiveFilters,
  viewMode: (state: ResearchStore) => state.viewMode,
  autoRefresh: (state: ResearchStore) => state.autoRefresh,
  isLoading: (state: ResearchStore) => state.loading,
  error: (state: ResearchStore) => state.error,
  sources: (state: ResearchStore) => state.currentResearch?.sources || [],
  conversations: (state: ResearchStore) =>
    state.currentResearch?.conversations || [],
  perspectives: (state: ResearchStore) =>
    state.currentResearch?.perspectives || [],
  filteredConversations: (state: ResearchStore) => {
    const conversations = state.currentResearch?.conversations || [];
    if (state.perspectiveFilters.length === 0) return conversations;
    return conversations.filter(c =>
      state.perspectiveFilters.includes(c.perspective)
    );
  },
  filteredSources: (state: ResearchStore) => {
    const sources = state.currentResearch?.sources || [];
    if (state.perspectiveFilters.length === 0) return sources;
    // This would require tracking which perspective found which source
    return sources;
  },
};

// Research hooks
export const useResearch = () => {
  const store = useResearchStore();
  return {
    ...store,
    selectors: researchSelectors,
  };
};

export const useCurrentResearch = () =>
  useResearchStore(researchSelectors.currentResearch);
export const useActiveConversations = () =>
  useResearchStore(researchSelectors.activeConversations);
export const useResearchSources = () =>
  useResearchStore(researchSelectors.sources);
export const useResearchLoading = () =>
  useResearchStore(researchSelectors.isLoading);
export const useResearchError = () => useResearchStore(researchSelectors.error);
export const useViewMode = () => useResearchStore(researchSelectors.viewMode);
export const usePerspectiveFilters = () =>
  useResearchStore(researchSelectors.perspectiveFilters);
