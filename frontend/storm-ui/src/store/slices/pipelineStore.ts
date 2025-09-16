import { logger } from '@/utils/logger';
// Pipeline execution store slice
import { create } from 'zustand';
import {
  PipelineState,
  PipelineExecution,
  PipelineLog,
  ResourceUsage,
} from '../types';
import { PipelineStage, StormConfig, PipelineProgress } from '@/types/storm';
import { persist, createPartialize } from '../middleware/persist';
import { devtools } from '../middleware/devtools';
import { immer } from '../middleware/immer';
import { subscriptions } from '../middleware/subscriptions';

// Initial state
const initialState: PipelineState = {
  runningPipelines: {},
  pipelineHistory: [],
  activeStage: null,
  globalProgress: 0,
  estimatedTimeRemaining: null,
  canCancel: false,
  autoSave: true,
  loading: false,
  error: null,
  lastUpdated: null,
  updateIntervals: {},
};

// Pipeline store actions interface
interface PipelineActions {
  // Pipeline execution
  startPipeline: (projectId: string, config: StormConfig) => Promise<string>;
  pausePipeline: (pipelineId: string) => Promise<void>;
  resumePipeline: (pipelineId: string) => Promise<void>;
  cancelPipeline: (pipelineId: string) => Promise<void>;
  retryPipeline: (pipelineId: string) => Promise<string>;

  // Pipeline monitoring
  updatePipelineProgress: (
    pipelineId: string,
    progress: Partial<PipelineProgress>
  ) => void;
  addPipelineLog: (pipelineId: string, log: Omit<PipelineLog, 'id'>) => void;
  updateResourceUsage: (
    pipelineId: string,
    usage: Partial<ResourceUsage>
  ) => void;
  setPipelineStatus: (
    pipelineId: string,
    status: PipelineExecution['status']
  ) => void;

  // Pipeline management
  getPipelineExecution: (pipelineId: string) => PipelineExecution | null;
  removePipelineExecution: (pipelineId: string) => void;
  clearPipelineHistory: () => void;
  archivePipeline: (pipelineId: string) => void;

  // Global pipeline state
  setActiveStage: (stage: PipelineStage | null) => void;
  updateGlobalProgress: () => void;
  setCanCancel: (canCancel: boolean) => void;
  setAutoSave: (autoSave: boolean) => void;

  // Estimation and analytics
  estimateTimeRemaining: (pipelineId: string) => number | null;
  calculateResourceCost: (pipelineId: string) => number;
  getPipelineAnalytics: (projectId?: string) => PipelineAnalytics;

  // Batch operations
  cancelAllPipelines: () => Promise<void>;
  pauseAllPipelines: () => Promise<void>;
  resumeAllPipelines: () => Promise<void>;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;

  // WebSocket integration
  handlePipelineEvent: (event: PipelineEvent) => void;
  subscribeToUpdates: (pipelineId: string) => void;
  unsubscribeFromUpdates: (pipelineId: string) => void;
}

// Additional types
interface PipelineAnalytics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  totalTokensUsed: number;
  totalCost: number;
  commonErrors: Array<{ error: string; count: number }>;
  stagePerformance: Array<{ stage: PipelineStage; averageDuration: number }>;
}

interface PipelineEvent {
  type: 'progress' | 'log' | 'status' | 'error' | 'complete';
  pipelineId: string;
  data: any;
  timestamp: Date;
}

// Pipeline store type
export type PipelineStore = PipelineState & PipelineActions;

// Create pipeline store
export const usePipelineStore = create<PipelineStore>()(
  devtools(
    persist(
      subscriptions(
        immer<PipelineStore>((set, get) => ({
          // Initial state
          ...initialState,

          // Pipeline execution
          startPipeline: async (projectId, config) => {
            console.log('[PipelineStore] Starting pipeline for project:', projectId);
            console.log('[PipelineStore] Config received:', config);
            
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              // Map frontend config to backend nested format
              const backendConfig = config
                ? {
                    llm: {
                      provider: config.llm?.provider ?? 'openai',
                      model: config.llm?.model ?? 'gpt-4o',
                      temperature: config.llm?.temperature ?? 0.7,
                      max_tokens: config.llm?.maxTokens ?? 4000,
                    },
                    retriever: {
                      retriever_type: config.retriever?.type ?? 'tavily',
                      max_search_results: config.retriever?.maxResults ?? 10,
                      search_top_k: config.retriever?.topK ?? 3,
                    },
                    pipeline: {
                      max_conv_turn: config.pipeline?.maxConvTurns ?? 3,
                      max_perspective: config.pipeline?.maxPerspectives ?? 4,
                      max_search_queries_per_turn:
                        config.pipeline?.maxSearchQueriesPerTurn ?? 3,
                      do_research: config.pipeline?.doResearch ?? true,
                      do_generate_outline: config.pipeline?.doGenerateOutline ?? true,
                      do_generate_article: config.pipeline?.doGenerateArticle ?? true,
                      do_polish_article: config.pipeline?.doPolishArticle ?? true,
                    },
                    output: {
                      output_format: config.output?.format ?? 'markdown',
                      include_citations: config.output?.includeCitations ?? true,
                    },
                  }
                : undefined;

              console.log('[PipelineStore] Backend config:', backendConfig);
              
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              const url = `${apiUrl}/pipeline/${projectId}/run`;
              const requestBody = { config: backendConfig, mock_mode: false };
              
              console.log('[PipelineStore] API URL:', url);
              console.log('[PipelineStore] Request body:', requestBody);
              
              const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              });

              console.log('[PipelineStore] Response status:', response.status);
              console.log('[PipelineStore] Response ok:', response.ok);

              if (!response.ok) {
                const errorText = await response.text();
                console.error('[PipelineStore] Error response:', errorText);
                
                // Check if the error is about an already running pipeline
                if (response.status === 400 && errorText.includes('already running')) {
                  // Offer to cancel the stuck pipeline
                  const shouldCancel = window.confirm(
                    'A pipeline appears to be already running or stuck. Would you like to cancel it and start a new one?'
                  );
                  
                  if (shouldCancel) {
                    console.log('[PipelineStore] User chose to cancel stuck pipeline');
                    // Cancel the stuck pipeline
                    const cancelUrl = `${apiUrl}/pipeline/${projectId}/cancel`;
                    const cancelResponse = await fetch(cancelUrl, { method: 'POST' });
                    
                    if (cancelResponse.ok) {
                      console.log('[PipelineStore] Successfully cancelled stuck pipeline, retrying...');
                      // Wait a moment for the cancellation to process
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      // Retry the pipeline start
                      const retryResponse = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                      });
                      
                      if (retryResponse.ok) {
                        const data = await retryResponse.json();
                        // Continue with normal flow
                        const pipelineId = data.pipelineId || `pipeline-${projectId}-${Date.now()}`;
                        
                        const pipelineExecution: PipelineExecution = {
                          id: pipelineId,
                          projectId,
                          progress: {
                            stage: 'initializing',
                            stageProgress: 0,
                            overallProgress: 0,
                            startTime: new Date(),
                            currentTask: 'Initializing pipeline...',
                            errors: [],
                          },
                          logs: [],
                          startTime: new Date(),
                          status: 'running',
                          config,
                          resourceUsage: {
                            tokensUsed: 0,
                            apiCalls: 0,
                            estimatedCost: 0,
                            duration: 0,
                          },
                        };
                        
                        set(draft => {
                          draft.runningPipelines[pipelineId] = pipelineExecution;
                          draft.activeStage = 'initializing';
                          draft.canCancel = true;
                          draft.loading = false;
                          draft.lastUpdated = new Date();
                        });
                        
                        // Subscribe to pipeline updates
                        get().subscribeToUpdates(pipelineId);
                        
                        return pipelineId;
                      } else {
                        const retryError = await retryResponse.text();
                        throw new Error(`Failed to restart pipeline: ${retryError}`);
                      }
                    } else {
                      throw new Error('Failed to cancel stuck pipeline. Please try manually cancelling from the backend.');
                    }
                  } else {
                    throw new Error('Pipeline is already running. Please cancel it first or wait for it to complete.');
                  }
                } else {
                  throw new Error(`Failed to start pipeline: ${response.status} - ${errorText}`);
                }
              }

              const data = await response.json();
              const pipelineId =
                data.pipelineId || `pipeline-${projectId}-${Date.now()}`;

              const pipelineExecution: PipelineExecution = {
                id: pipelineId,
                projectId,
                progress: {
                  stage: 'initializing',
                  stageProgress: 0,
                  overallProgress: 0,
                  startTime: new Date(),
                  currentTask: 'Initializing pipeline...',
                  errors: [],
                },
                logs: [],
                startTime: new Date(),
                status: 'running',
                config,
                resourceUsage: {
                  tokensUsed: 0,
                  apiCalls: 0,
                  estimatedCost: 0,
                  duration: 0,
                },
              };

              set(draft => {
                draft.runningPipelines[pipelineId] = pipelineExecution;
                draft.activeStage = 'initializing';
                draft.canCancel = true;
                draft.loading = false;
                draft.lastUpdated = new Date();
              });

              // Subscribe to pipeline updates
              get().subscribeToUpdates(pipelineId);

              return pipelineId;
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to start pipeline';
                draft.loading = false;
              });
              throw error;
            }
          },

          pausePipeline: async pipelineId => {
            // Guard against undefined pipelineId
            if (!pipelineId) {
              logger.warn('pausePipeline called with undefined pipelineId');
              return;
            }

            try {
              const response = await fetch(
                `/api/pipeline/${pipelineId}/pause`,
                {
                  method: 'POST',
                }
              );

              if (!response.ok) {
                throw new Error('Failed to pause pipeline');
              }

              set(draft => {
                const pipeline = draft.runningPipelines[pipelineId];
                if (pipeline) {
                  pipeline.status = 'completed'; // Using completed as paused state
                  draft.canCancel = false;
                }
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to pause pipeline';
              });
              throw error;
            }
          },

          resumePipeline: async pipelineId => {
            // Guard against undefined pipelineId
            if (!pipelineId) {
              logger.warn('resumePipeline called with undefined pipelineId');
              return;
            }

            try {
              const response = await fetch(
                `/api/pipeline/${pipelineId}/resume`,
                {
                  method: 'POST',
                }
              );

              if (!response.ok) {
                throw new Error('Failed to resume pipeline');
              }

              set(draft => {
                const pipeline = draft.runningPipelines[pipelineId];
                if (pipeline) {
                  pipeline.status = 'running';
                  draft.canCancel = true;
                }
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to resume pipeline';
              });
              throw error;
            }
          },

          cancelPipeline: async pipelineId => {
            // Guard against undefined pipelineId
            if (!pipelineId) {
              logger.warn('cancelPipeline called with undefined pipelineId');
              return;
            }

            try {
              const response = await fetch(
                `/api/pipeline/${pipelineId}/cancel`,
                {
                  method: 'POST',
                }
              );

              if (!response.ok) {
                throw new Error('Failed to cancel pipeline');
              }

              set(draft => {
                const pipeline = draft.runningPipelines[pipelineId];
                if (pipeline) {
                  pipeline.status = 'cancelled';
                  pipeline.endTime = new Date();
                  draft.canCancel = false;

                  // Move to history
                  draft.pipelineHistory.unshift(pipeline);
                  delete draft.runningPipelines[pipelineId];

                  // Update global state if no more running pipelines
                  if (Object.keys(draft.runningPipelines).length === 0) {
                    draft.activeStage = null;
                    draft.globalProgress = 0;
                  }
                }
              });

              get().unsubscribeFromUpdates(pipelineId);
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to cancel pipeline';
              });
              throw error;
            }
          },

          retryPipeline: async pipelineId => {
            const pipeline = get().getPipelineExecution(pipelineId);
            if (!pipeline) {
              throw new Error('Pipeline not found');
            }

            return get().startPipeline(pipeline.projectId, pipeline.config);
          },

          // Pipeline monitoring
          updatePipelineProgress: (pipelineId, progress) => {
            set(draft => {
              const pipeline = draft.runningPipelines[pipelineId];
              if (pipeline) {
                Object.assign(pipeline.progress, progress);

                // Update estimated end time
                if (progress.stageProgress !== undefined) {
                  const elapsed = Date.now() - pipeline.startTime.getTime();
                  const totalProgress =
                    progress.overallProgress ||
                    pipeline.progress.overallProgress;

                  if (totalProgress > 0) {
                    const estimatedTotal = (elapsed / totalProgress) * 100;
                    const remaining = estimatedTotal - elapsed;
                    pipeline.progress.estimatedEndTime = new Date(
                      Date.now() + remaining
                    );
                  }
                }

                draft.lastUpdated = new Date();
              }
            });

            get().updateGlobalProgress();
          },

          addPipelineLog: (pipelineId, log) => {
            set(draft => {
              const pipeline = draft.runningPipelines[pipelineId];
              if (pipeline) {
                const newLog: PipelineLog = {
                  ...log,
                  id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                };
                pipeline.logs.push(newLog);

                // Keep only last 1000 logs
                if (pipeline.logs.length > 1000) {
                  pipeline.logs = pipeline.logs.slice(-1000);
                }

                draft.lastUpdated = new Date();
              }
            });
          },

          updateResourceUsage: (pipelineId, usage) => {
            set(draft => {
              const pipeline = draft.runningPipelines[pipelineId];
              if (pipeline) {
                Object.assign(pipeline.resourceUsage, usage);

                // Update duration
                pipeline.resourceUsage.duration =
                  Date.now() - pipeline.startTime.getTime();

                draft.lastUpdated = new Date();
              }
            });
          },

          setPipelineStatus: (pipelineId, status) => {
            set(draft => {
              const pipeline = draft.runningPipelines[pipelineId];
              if (pipeline) {
                pipeline.status = status;

                if (
                  status === 'completed' ||
                  status === 'failed' ||
                  status === 'cancelled'
                ) {
                  pipeline.endTime = new Date();

                  // Move to history
                  draft.pipelineHistory.unshift(pipeline);
                  delete draft.runningPipelines[pipelineId];

                  // Update global state
                  if (Object.keys(draft.runningPipelines).length === 0) {
                    draft.activeStage = null;
                    draft.globalProgress = 0;
                    draft.canCancel = false;
                    draft.estimatedTimeRemaining = null;
                  }
                }

                draft.lastUpdated = new Date();
              }
            });

            if (status !== 'running') {
              get().unsubscribeFromUpdates(pipelineId);
            }
          },

          // Pipeline management
          getPipelineExecution: pipelineId => {
            const running = get().runningPipelines[pipelineId];
            if (running) return running;

            return get().pipelineHistory.find(p => p.id === pipelineId) || null;
          },

          removePipelineExecution: pipelineId => {
            set(draft => {
              delete draft.runningPipelines[pipelineId];
              draft.pipelineHistory = draft.pipelineHistory.filter(
                p => p.id !== pipelineId
              );
            });
          },

          clearPipelineHistory: () => {
            set(draft => {
              draft.pipelineHistory = [];
            });
          },

          archivePipeline: pipelineId => {
            set(draft => {
              const pipeline = draft.runningPipelines[pipelineId];
              if (pipeline && pipeline.status !== 'running') {
                draft.pipelineHistory.unshift(pipeline);
                delete draft.runningPipelines[pipelineId];
              }
            });
          },

          // Global pipeline state
          setActiveStage: stage => {
            set(draft => {
              draft.activeStage = stage;
            });
          },

          updateGlobalProgress: () => {
            set(draft => {
              const runningPipelines = Object.values(draft.runningPipelines);

              if (runningPipelines.length === 0) {
                draft.globalProgress = 0;
                draft.estimatedTimeRemaining = null;
                return;
              }

              // Calculate average progress
              const totalProgress = runningPipelines.reduce(
                (sum, pipeline) => sum + pipeline.progress.overallProgress,
                0
              );
              draft.globalProgress = totalProgress / runningPipelines.length;

              // Calculate estimated time remaining (take the maximum)
              const estimates = runningPipelines
                .map(p => p.progress.estimatedEndTime)
                .filter(Boolean) as Date[];

              if (estimates.length > 0) {
                const maxEndTime = Math.max(...estimates.map(d => d.getTime()));
                draft.estimatedTimeRemaining = maxEndTime - Date.now();
              }
            });
          },

          setCanCancel: canCancel => {
            set(draft => {
              draft.canCancel = canCancel;
            });
          },

          setAutoSave: autoSave => {
            set(draft => {
              draft.autoSave = autoSave;
            });
          },

          // Estimation and analytics
          estimateTimeRemaining: pipelineId => {
            const pipeline = get().getPipelineExecution(pipelineId);
            if (!pipeline || pipeline.status !== 'running') return null;

            const elapsed = Date.now() - pipeline.startTime.getTime();
            const progress = pipeline.progress.overallProgress;

            if (progress <= 0) return null;

            const estimatedTotal = (elapsed / progress) * 100;
            return estimatedTotal - elapsed;
          },

          calculateResourceCost: pipelineId => {
            const pipeline = get().getPipelineExecution(pipelineId);
            if (!pipeline) return 0;

            return pipeline.resourceUsage.estimatedCost;
          },

          getPipelineAnalytics: projectId => {
            const state = get();
            let pipelines = state.pipelineHistory;

            if (projectId) {
              pipelines = pipelines.filter(p => p.projectId === projectId);
            }

            const totalExecutions = pipelines.length;
            const successful = pipelines.filter(
              p => p.status === 'completed'
            ).length;
            const successRate =
              totalExecutions > 0 ? (successful / totalExecutions) * 100 : 0;

            const durations = pipelines
              .filter(p => p.endTime)
              .map(p => p.endTime!.getTime() - p.startTime.getTime());

            const averageDuration =
              durations.length > 0
                ? durations.reduce((sum, dur) => sum + dur, 0) /
                  durations.length
                : 0;

            const totalTokensUsed = pipelines.reduce(
              (sum, p) => sum + p.resourceUsage.tokensUsed,
              0
            );

            const totalCost = pipelines.reduce(
              (sum, p) => sum + p.resourceUsage.estimatedCost,
              0
            );

            // Collect error statistics
            const errorCounts: Record<string, number> = {};
            pipelines.forEach(p => {
              p.progress.errors?.forEach(error => {
                const count = errorCounts[error.message] || 0;
                errorCounts[error.message] = count + 1;
              });
            });

            const commonErrors = Object.entries(errorCounts)
              .map(([error, count]) => ({ error, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10);

            // Calculate stage performance
            const stagePerformance: Array<{
              stage: PipelineStage;
              averageDuration: number;
            }> = [];
            const stages: PipelineStage[] = [
              'research',
              'outline_generation',
              'article_generation',
              'polishing',
            ];

            stages.forEach(stage => {
              const stageDurations = pipelines
                .filter(
                  p => p.progress.stage === stage || p.status === 'completed'
                )
                .map(p => p.resourceUsage.duration);

              if (stageDurations.length > 0) {
                const avgDuration =
                  stageDurations.reduce((sum, dur) => sum + dur, 0) /
                  stageDurations.length;
                stagePerformance.push({ stage, averageDuration: avgDuration });
              }
            });

            return {
              totalExecutions,
              successRate,
              averageDuration,
              totalTokensUsed,
              totalCost,
              commonErrors,
              stagePerformance,
            };
          },

          // Batch operations
          cancelAllPipelines: async () => {
            const runningPipelineIds = Object.keys(get().runningPipelines);

            await Promise.allSettled(
              runningPipelineIds.map(id => get().cancelPipeline(id))
            );
          },

          pauseAllPipelines: async () => {
            const runningPipelineIds = Object.keys(get().runningPipelines);

            await Promise.allSettled(
              runningPipelineIds.map(id => get().pausePipeline(id))
            );
          },

          resumeAllPipelines: async () => {
            const pausedPipelineIds = Object.entries(get().runningPipelines)
              .filter(([_, pipeline]) => pipeline.status === 'completed') // Using completed as paused
              .map(([id]) => id);

            await Promise.allSettled(
              pausedPipelineIds.map(id => get().resumePipeline(id))
            );
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
              draft.runningPipelines = {};
            });
          },

          // WebSocket integration
          handlePipelineEvent: event => {
            const { type, pipelineId, data } = event;

            switch (type) {
              case 'progress':
                get().updatePipelineProgress(pipelineId, data);
                break;
              case 'log':
                get().addPipelineLog(pipelineId, data);
                break;
              case 'status':
                get().setPipelineStatus(pipelineId, data.status);
                break;
              case 'error':
                get().addPipelineLog(pipelineId, {
                  timestamp: new Date(),
                  level: 'error',
                  stage: data.stage || 'unknown',
                  message: data.message,
                  data: data.details,
                });
                break;
              case 'complete':
                get().setPipelineStatus(pipelineId, 'completed');
                break;
            }
          },

          subscribeToUpdates: pipelineId => {
            if (!pipelineId) {
              logger.warn(
                'Cannot subscribe to updates: pipelineId is undefined'
              );
              return;
            }
            
            console.log(`[PipelineStore] Subscribing to WebSocket updates for pipeline ${pipelineId}`);
            
            // For now, use polling until WebSocket is fully integrated
            const pollInterval = setInterval(async () => {
              try {
                const pipeline = get().runningPipelines[pipelineId];
                if (!pipeline || pipeline.status !== 'running') {
                  clearInterval(pollInterval);
                  return;
                }
                
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
                const response = await fetch(`${apiUrl}/pipeline/${pipeline.projectId}/status`);
                
                if (response.ok) {
                  const status = await response.json();
                  console.log('[PipelineStore] Poll status:', status);
                  
                  if (status.progress) {
                    // Update pipeline progress
                    set(draft => {
                      if (draft.runningPipelines[pipelineId]) {
                        draft.runningPipelines[pipelineId].progress = {
                          stage: status.progress.stage || 'initializing',
                          stageProgress: status.progress.stage_progress || 0,
                          overallProgress: status.progress.overall_progress || 0,
                          startTime: draft.runningPipelines[pipelineId].progress.startTime,
                          currentTask: status.progress.current_task || '',
                          errors: status.progress.errors || [],
                          estimatedTimeRemaining: status.progress.estimated_time_remaining,
                        };
                        
                        // Update global progress
                        draft.globalProgress = status.progress.overall_progress || 0;
                        draft.activeStage = status.progress.stage || 'initializing';
                        
                        // Check if completed or failed
                        if (status.progress.status === 'completed') {
                          draft.runningPipelines[pipelineId].status = 'completed';
                          clearInterval(pollInterval);
                        } else if (status.progress.status === 'error' || status.progress.status === 'cancelled') {
                          draft.runningPipelines[pipelineId].status = 'failed';
                          clearInterval(pollInterval);
                        }
                      }
                    });
                  }
                }
              } catch (error) {
                console.error('[PipelineStore] Poll error:', error);
              }
            }, 2000); // Poll every 2 seconds
            
            // Store interval ID for cleanup
            set(draft => {
              if (!draft.updateIntervals) {
                draft.updateIntervals = {};
              }
              draft.updateIntervals[pipelineId] = pollInterval;
            });
          },

          unsubscribeFromUpdates: pipelineId => {
            const state = get();
            if (state.updateIntervals && state.updateIntervals[pipelineId]) {
              console.log(`[PipelineStore] Unsubscribing from updates for pipeline ${pipelineId}`);
              clearInterval(state.updateIntervals[pipelineId]);
              set(draft => {
                delete draft.updateIntervals[pipelineId];
              });
            }
          },
        }))
      ),
      {
        name: 'storm-pipeline-store',
        version: 1,
        partialize: createPartialize<PipelineStore>([
          'pipelineHistory',
          'autoSave',
        ]),
      }
    ),
    { name: 'PipelineStore' }
  )
);

// Selectors
export const pipelineSelectors = {
  runningPipelines: (state: PipelineStore) =>
    Object.values(state.runningPipelines),
  pipelineHistory: (state: PipelineStore) => state.pipelineHistory,
  activeStage: (state: PipelineStore) => state.activeStage,
  globalProgress: (state: PipelineStore) => state.globalProgress,
  canCancel: (state: PipelineStore) => state.canCancel,
  isLoading: (state: PipelineStore) => state.loading,
  error: (state: PipelineStore) => state.error,
  estimatedTimeRemaining: (state: PipelineStore) =>
    state.estimatedTimeRemaining,
  autoSave: (state: PipelineStore) => state.autoSave,
  hasRunningPipelines: (state: PipelineStore) =>
    Object.keys(state.runningPipelines).length > 0,
  getPipeline: (pipelineId: string) => (state: PipelineStore) =>
    state.getPipelineExecution(pipelineId),
  getProjectPipelines: (projectId: string) => (state: PipelineStore) =>
    state.pipelineHistory.filter(p => p.projectId === projectId),
  getRunningPipelinesByProject: (projectId: string) => (state: PipelineStore) =>
    Object.values(state.runningPipelines).filter(
      p => p.projectId === projectId
    ),
};

// Pipeline hooks
export const usePipeline = () => {
  const store = usePipelineStore();
  return {
    ...store,
    selectors: pipelineSelectors,
  };
};

export const useRunningPipelines = () =>
  usePipelineStore(pipelineSelectors.runningPipelines);
export const usePipelineHistory = () =>
  usePipelineStore(pipelineSelectors.pipelineHistory);
export const useGlobalProgress = () =>
  usePipelineStore(pipelineSelectors.globalProgress);
export const usePipelineLoading = () =>
  usePipelineStore(pipelineSelectors.isLoading);
export const usePipelineError = () => usePipelineStore(pipelineSelectors.error);
export const useCanCancelPipeline = () =>
  usePipelineStore(pipelineSelectors.canCancel);
export const useHasRunningPipelines = () =>
  usePipelineStore(pipelineSelectors.hasRunningPipelines);
