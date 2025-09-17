import { useState, useCallback } from 'react';
import { sessionService } from '../../services/session';
import { CoStormSession, CreateSessionRequest } from '../../types/api';
import { useToast } from '../useToast';

export function useSession(sessionId?: string) {
  const [session, setSession] = useState<CoStormSession | null>(null);
  const [sessions, setSessions] = useState<CoStormSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSession = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await sessionService.getSession(id);
      if (response.success && response.data) {
        setSession(response.data);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch session';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(
    async (request: CreateSessionRequest) => {
      setLoading(true);
      try {
        const response = await sessionService.createSession(request);
        if (response.success && response.data) {
          toast({
            title: 'Success',
            description: 'Session created successfully',
            variant: 'success',
          });
          return response.data;
        }
        return null;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create session';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const joinSession = useCallback(
    async (sessionId: string, participantName: string, role?: string) => {
      setLoading(true);
      try {
        const response = await sessionService.joinSession({
          sessionId,
          participantName,
          role,
        });
        if (response.success && response.data) {
          toast({
            title: 'Success',
            description: 'Joined session successfully',
            variant: 'success',
          });
          return response.data;
        }
        return null;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to join session';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  return {
    session,
    sessions,
    loading,
    error,
    fetchSession,
    createSession,
    joinSession,
  };
}
