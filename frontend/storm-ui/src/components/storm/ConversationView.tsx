import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Bot,
  Search,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Globe,
  FileText,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  url: string;
  title: string;
  description: string;
  snippets: string[];
}

interface DialogueTurn {
  user_utterance: string;
  agent_utterance: string;
  search_queries: string[];
  search_results: SearchResult[];
}

interface Conversation {
  perspective: string;
  dlg_turns: DialogueTurn[];
}

interface ConversationViewProps {
  projectId: string;
  className?: string;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  projectId,
  className,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPerspectives, setExpandedPerspectives] = useState<Set<number>>(
    new Set([0])
  );
  const [selectedPerspective, setSelectedPerspective] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchConversations();

    // Set up polling for live updates during research
    pollIntervalRef.current = setInterval(() => {
      fetchConversations(true);
    }, 3000); // Poll every 3 seconds

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [projectId]);

  const fetchConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // Also check project status to see if pipeline is still running
      const [convResponse, projectResponse] = await Promise.all([
        fetch(
          `http://localhost:8000/api/projects/${projectId}/conversations?live=true`
        ),
        fetch(`http://localhost:8000/api/projects/${projectId}`),
      ]);

      if (!convResponse.ok) throw new Error('Failed to fetch conversations');

      const data = await convResponse.json();
      const newConversations = data.conversations || [];

      let pipelineCompleted = false;
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        // Check if project status indicates completion
        pipelineCompleted =
          projectData.status === 'completed' ||
          projectData.pipeline_status === 'completed' ||
          projectData.pipeline_status === 'idle';
      }

      // Check if we're getting live updates (conversations are being added)
      if (
        !pipelineCompleted &&
        newConversations.length > conversations.length
      ) {
        setIsLive(true);
      } else if (
        pipelineCompleted ||
        (conversations.length > 0 &&
          newConversations.length === conversations.length)
      ) {
        // Pipeline completed or no new conversations being added
        setIsLive(false);
        // Stop polling when pipeline is complete
        if (pollIntervalRef.current && pipelineCompleted) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }

      setConversations(newConversations);
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error ? err.message : 'Failed to load conversations'
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const togglePerspective = (index: number) => {
    const newExpanded = new Set(expandedPerspectives);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedPerspectives(newExpanded);
  };

  const extractPerspectiveName = (perspective: string) => {
    const colonIndex = perspective.indexOf(':');
    return colonIndex > -1 ? perspective.substring(0, colonIndex) : perspective;
  };

  const extractPerspectiveDescription = (perspective: string) => {
    const colonIndex = perspective.indexOf(':');
    return colonIndex > -1 ? perspective.substring(colonIndex + 1).trim() : '';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">
              Loading research conversations...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="space-y-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              onClick={() => fetchConversations()}
              variant="outline"
              size="sm"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="space-y-4 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-sm font-medium">No Research Conversations</p>
              <p className="text-xs text-muted-foreground">
                Conversations will appear here once the research phase begins
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Multi-Perspective Research Conversations
                {isLive && (
                  <Badge variant="default" className="ml-2 animate-pulse">
                    <div className="mr-1 h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    Live Updates
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {conversations.length} expert perspectives explored this topic
                through{' '}
                {conversations.reduce(
                  (acc, conv) => acc + conv.dlg_turns.length,
                  0
                )}{' '}
                dialogue turns
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              <MessageCircle className="mr-1 h-3 w-3" />
              {conversations.reduce(
                (acc, conv) => acc + conv.dlg_turns.length,
                0
              )}{' '}
              Exchanges
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Conversations */}
      <Tabs defaultValue="0" className="w-full">
        <TabsList
          className={
            conversations.length <= 6 ? 'grid w-full' : 'flex flex-wrap gap-1'
          }
          style={
            conversations.length <= 6
              ? { gridTemplateColumns: `repeat(${conversations.length}, 1fr)` }
              : {}
          }
        >
          {conversations.map((conv, index) => (
            <TabsTrigger
              key={index}
              value={index.toString()}
              className="text-xs"
            >
              {extractPerspectiveName(conv.perspective)}
            </TabsTrigger>
          ))}
        </TabsList>

        {conversations.map((conversation, convIndex) => (
          <TabsContent
            key={convIndex}
            value={convIndex.toString()}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <Bot className="h-5 w-5 text-primary" />
                        {extractPerspectiveName(conversation.perspective)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {extractPerspectiveDescription(
                          conversation.perspective
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-4">
                      {conversation.dlg_turns.length} turns
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-6">
                    {conversation.dlg_turns.map((turn, turnIndex) => (
                      <div key={turnIndex} className="space-y-4">
                        {/* Question */}
                        <div className="flex gap-3">
                          <div className="mt-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Question
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                Turn {turnIndex + 1}
                              </Badge>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3">
                              <p className="text-sm">{turn.user_utterance}</p>
                            </div>
                          </div>
                        </div>

                        {/* Search Queries */}
                        {turn.search_queries &&
                          turn.search_queries.length > 0 && (
                            <div className="ml-11 space-y-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Search className="h-3 w-3" />
                                <span>Search Queries Used:</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {turn.search_queries.map((query, qIndex) => (
                                  <Badge
                                    key={qIndex}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {query}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Response */}
                        <div className="flex gap-3">
                          <div className="mt-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                              <Bot className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Response
                              </span>
                              {turn.search_results &&
                                turn.search_results.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    <Globe className="mr-1 h-3 w-3" />
                                    {turn.search_results.length} sources
                                  </Badge>
                                )}
                            </div>
                            <div className="rounded-lg bg-secondary/30 p-3">
                              <p className="whitespace-pre-wrap text-sm">
                                {turn.agent_utterance}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Sources */}
                        {turn.search_results &&
                          turn.search_results.length > 0 && (
                            <div className="ml-11 space-y-2">
                              <details className="group">
                                <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                                  <FileText className="h-3 w-3" />
                                  <span>
                                    View {turn.search_results.length} sources
                                    used
                                  </span>
                                </summary>
                                <div className="mt-3 space-y-2 pl-5">
                                  {turn.search_results
                                    .slice(0, 5)
                                    .map((result, rIndex) => (
                                      <div
                                        key={rIndex}
                                        className="border-l-2 border-muted py-1 pl-3"
                                      >
                                        <a
                                          href={result.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block truncate text-xs text-blue-600 hover:underline"
                                        >
                                          {result.title || result.url}
                                        </a>
                                        {result.snippets &&
                                          result.snippets[0] && (
                                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                              {result.snippets[0]}
                                            </p>
                                          )}
                                      </div>
                                    ))}
                                </div>
                              </details>
                            </div>
                          )}

                        {turnIndex < conversation.dlg_turns.length - 1 && (
                          <Separator className="my-6" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ConversationView;
