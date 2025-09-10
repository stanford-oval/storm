/**
 * Status utility functions
 * Centralized status-related helpers to avoid code duplication
 */

import React from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  XCircle,
  Loader2,
} from 'lucide-react';

// Project status types
export type ProjectStatus =
  | 'draft'
  | 'completed'
  | 'failed'
  | 'in_progress'
  | 'researching'
  | 'writing'
  | 'error';

// Pipeline status types
export type PipelineStatus =
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

// WebSocket connection states
export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'error'
  | 'disconnected';

/**
 * Get the appropriate icon for a project status
 */
export const getProjectStatusIcon = (status?: string, size = 16) => {
  const className = `h-${size / 4} w-${size / 4}`;
  const normalizedStatus = status?.toLowerCase() || 'draft';

  switch (normalizedStatus) {
    case 'completed':
      return <CheckCircle className={`${className} text-green-500`} />;
    case 'failed':
    case 'error':
      return <AlertCircle className={`${className} text-red-500`} />;
    case 'in_progress':
    case 'researching':
    case 'writing':
      return (
        <Activity className={`${className} animate-pulse text-blue-500`} />
      );
    case 'draft':
      return <Clock className={`${className} text-gray-500`} />;
    default:
      return <Clock className={`${className} text-gray-500`} />;
  }
};

/**
 * Get the appropriate color classes for a project status badge
 */
export const getProjectStatusColor = (status?: string): string => {
  const normalizedStatus = status?.toLowerCase() || 'draft';

  switch (normalizedStatus) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'in_progress':
    case 'researching':
    case 'writing':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
};

/**
 * Get human-readable label for project status
 */
export const getProjectStatusLabel = (status?: string): string => {
  const normalizedStatus = status?.toLowerCase() || 'draft';

  switch (normalizedStatus) {
    case 'in_progress':
      return 'In Progress';
    case 'researching':
      return 'Researching';
    case 'writing':
      return 'Writing';
    default:
      // Capitalize first letter
      return (
        normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
      );
  }
};

/**
 * Get the appropriate icon for a pipeline status
 */
export const getPipelineStatusIcon = (status?: string, size = 16) => {
  const className = `h-${size / 4} w-${size / 4}`;
  const normalizedStatus = status?.toLowerCase() || 'ready';

  switch (normalizedStatus) {
    case 'running':
      return <Loader2 className={`${className} animate-spin text-blue-500`} />;
    case 'completed':
      return <CheckCircle className={`${className} text-green-500`} />;
    case 'failed':
      return <XCircle className={`${className} text-red-500`} />;
    case 'cancelled':
      return <XCircle className={`${className} text-orange-500`} />;
    case 'paused':
      return <Clock className={`${className} text-yellow-500`} />;
    case 'ready':
    default:
      return <Clock className={`${className} text-gray-500`} />;
  }
};

/**
 * Get the appropriate color for WebSocket connection status
 */
export const getConnectionStatusColor = (state?: ConnectionStatus): string => {
  switch (state) {
    case 'connected':
      return '#10b981'; // green
    case 'connecting':
    case 'reconnecting':
      return '#f59e0b'; // yellow
    case 'error':
      return '#ef4444'; // red
    case 'disconnected':
    default:
      return '#6b7280'; // gray
  }
};

/**
 * Get human-readable text for WebSocket connection status
 */
export const getConnectionStatusText = (
  state?: ConnectionStatus,
  reconnectAttempt?: number
): string => {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'reconnecting':
      return reconnectAttempt
        ? `Reconnecting... (${reconnectAttempt})`
        : 'Reconnecting...';
    case 'error':
      return 'Error';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
};

/**
 * Get test result status color for badges
 */
export const getTestResultColor = (
  success: boolean
): 'default' | 'destructive' => {
  return success ? 'default' : 'destructive';
};

/**
 * Get test result status text
 */
export const getTestResultText = (success: boolean): string => {
  return success ? 'PASS' : 'FAIL';
};

/**
 * Check if a status indicates an active/running state
 */
export const isActiveStatus = (status?: string): boolean => {
  const normalizedStatus = status?.toLowerCase();
  return ['in_progress', 'researching', 'writing', 'running'].includes(
    normalizedStatus || ''
  );
};

/**
 * Check if a status indicates a completed state
 */
export const isCompletedStatus = (status?: string): boolean => {
  const normalizedStatus = status?.toLowerCase();
  return normalizedStatus === 'completed';
};

/**
 * Check if a status indicates an error state
 */
export const isErrorStatus = (status?: string): boolean => {
  const normalizedStatus = status?.toLowerCase();
  return ['failed', 'error', 'cancelled'].includes(normalizedStatus || '');
};

/**
 * Get a status badge variant based on status
 */
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const getStatusBadgeVariant = (status?: string): BadgeVariant => {
  const normalizedStatus = status?.toLowerCase();

  if (isCompletedStatus(normalizedStatus)) return 'default';
  if (isErrorStatus(normalizedStatus)) return 'destructive';
  if (isActiveStatus(normalizedStatus)) return 'secondary';
  return 'outline';
};
