import * as React from 'react';
import {
  Search,
  Filter,
  Users,
  MessageCircle,
  ExternalLink,
  Clock,
  Star,
  Eye,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Globe,
  User,
  Bot,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { cn, formatRelativeTime, truncateText } from '@/lib/utils';
import type {
  ResearchViewProps,
  ResearchData,
  ConversationData,
  ConversationTurn,
  SourceData,
} from '@/types';

interface ConversationCardProps {
  conversation: ConversationData;
  onSelect: (conversation: ConversationData) => void;
  isSelected?: boolean;
}

const ConversationCard: React.FC<ConversationCardProps> = ({
  conversation,
  onSelect,
  isSelected = false,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const duration = conversation.endTime
    ? new Date(conversation.endTime).getTime() -
      new Date(conversation.startTime).getTime()
    : Date.now() - new Date(conversation.startTime).getTime();

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect(conversation)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center text-sm font-medium">
              <Users className="mr-2 h-4 w-4" />
              {conversation.perspective}
            </CardTitle>
            <CardDescription className="text-xs">
              {conversation.turns.length} turn
              {conversation.turns.length !== 1 ? 's' : ''} •{' '}
              {Math.round(duration / 1000 / 60)}m
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                conversation.status === 'completed'
                  ? 'success'
                  : conversation.status === 'failed'
                    ? 'error'
                    : 'info'
              }
              className="text-xs"
            >
              {conversation.status}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={e => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="storm-scrollbar max-h-64 space-y-3 overflow-y-auto">
            {conversation.turns.slice(0, 3).map((turn, index) => (
              <div key={turn.id} className="border-l-2 border-muted pl-3">
                <div className="mb-1 flex items-center space-x-2">
                  {turn.speaker === 'user' ? (
                    <User className="h-3 w-3 text-primary" />
                  ) : (
                    <Bot className="h-3 w-3 text-green-600" />
                  )}
                  <span className="text-xs font-medium">
                    {turn.speaker === 'user' ? 'Researcher' : 'AI Expert'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(turn.timestamp)}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {truncateText(turn.content, 120)}
                </p>
                {turn.sources && turn.sources.length > 0 && (
                  <div className="mt-1 flex items-center text-xs text-muted-foreground">
                    <ExternalLink className="mr-1 h-2 w-2" />
                    <span>
                      {turn.sources.length} source
                      {turn.sources.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {conversation.turns.length > 3 && (
              <div className="text-center">
                <span className="text-xs text-muted-foreground">
                  +{conversation.turns.length - 3} more turns
                </span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

interface SourceCardProps {
  source: SourceData;
  onSelect: (source: SourceData) => void;
  isSelected?: boolean;
}

const SourceCard: React.FC<SourceCardProps> = ({
  source,
  onSelect,
  isSelected = false,
}) => {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect(source)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="line-clamp-2 text-sm font-medium">
              {source.title}
            </CardTitle>
            <div className="mt-1 flex items-center space-x-2">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="truncate text-xs text-muted-foreground">
                {new URL(source.url).hostname}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(source.retrievedAt)}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {source.relevanceScore && (
              <Badge variant="outline" className="text-xs">
                {Math.round(source.relevanceScore * 100)}%
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={e => {
                e.stopPropagation();
                window.open(source.url, '_blank');
              }}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="line-clamp-3 text-xs text-muted-foreground">
          {source.snippet}
        </p>
        {source.usedInSections && source.usedInSections.length > 0 && (
          <div className="mt-2 flex items-center text-xs text-muted-foreground">
            <BookOpen className="mr-1 h-3 w-3" />
            <span>
              Used in {source.usedInSections.length} section
              {source.usedInSections.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const ResearchView: React.FC<ResearchViewProps> = ({
  research,
  onSourceSelect,
  onConversationSelect,
  showFilters = true,
  className,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedConversation, setSelectedConversation] =
    React.useState<ConversationData | null>(null);
  const [selectedSource, setSelectedSource] = React.useState<SourceData | null>(
    null
  );
  const [conversationStatusFilter, setConversationStatusFilter] =
    React.useState<string>('all');
  const [sourceRelevanceFilter, setSourceRelevanceFilter] =
    React.useState<string>('all');

  const handleConversationSelect = (conversation: ConversationData) => {
    setSelectedConversation(conversation);
    setSelectedSource(null);
    onConversationSelect?.(conversation);
  };

  const handleSourceSelect = (source: SourceData) => {
    setSelectedSource(source);
    setSelectedConversation(null);
    onSourceSelect?.(source);
  };

  // Filter conversations
  const filteredConversations = React.useMemo(() => {
    return research.conversations.filter(conversation => {
      const matchesSearch =
        !searchQuery ||
        conversation.perspective
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        conversation.turns.some(turn =>
          turn.content.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesStatus =
        conversationStatusFilter === 'all' ||
        conversation.status === conversationStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [research.conversations, searchQuery, conversationStatusFilter]);

  // Filter sources
  const filteredSources = React.useMemo(() => {
    return research.sources.filter(source => {
      const matchesSearch =
        !searchQuery ||
        source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.snippet.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRelevance =
        sourceRelevanceFilter === 'all' ||
        (sourceRelevanceFilter === 'high' &&
          (source.relevanceScore || 0) >= 0.8) ||
        (sourceRelevanceFilter === 'medium' &&
          (source.relevanceScore || 0) >= 0.5 &&
          (source.relevanceScore || 0) < 0.8) ||
        (sourceRelevanceFilter === 'low' && (source.relevanceScore || 0) < 0.5);

      return matchesSearch && matchesRelevance;
    });
  }, [research.sources, searchQuery, sourceRelevanceFilter]);

  const DetailView: React.FC = () => {
    if (selectedConversation) {
      return (
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Users className="mr-2 h-5 w-5" />
              {selectedConversation.perspective}
            </CardTitle>
            <CardDescription>
              Conversation • {selectedConversation.turns.length} turns • Started{' '}
              {formatRelativeTime(selectedConversation.startTime)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <div className="storm-scrollbar h-full space-y-4 overflow-y-auto">
              {selectedConversation.turns.map((turn, index) => (
                <div key={turn.id} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    {turn.speaker === 'user' ? (
                      <User className="h-4 w-4 text-primary" />
                    ) : (
                      <Bot className="h-4 w-4 text-green-600" />
                    )}
                    <span className="text-sm font-medium">
                      {turn.speaker === 'user' ? 'Researcher' : 'AI Expert'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(turn.timestamp)}
                    </span>
                  </div>
                  <div className="space-y-2 pl-6">
                    <p className="text-sm">{turn.content}</p>
                    {turn.sources && turn.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {turn.sources.map(sourceId => {
                          const source = research.sources.find(
                            s => s.id === sourceId
                          );
                          return source ? (
                            <Button
                              key={sourceId}
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleSourceSelect(source)}
                            >
                              <ExternalLink className="mr-1 h-2 w-2" />
                              {truncateText(source.title, 30)}
                            </Button>
                          ) : null;
                        })}
                      </div>
                    )}
                    {turn.queries && turn.queries.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Queries:</strong> {turn.queries.join(', ')}
                      </div>
                    )}
                  </div>
                  {index < selectedConversation.turns.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (selectedSource) {
      return (
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="line-clamp-2 text-lg">
              {selectedSource.title}
            </CardTitle>
            <CardDescription className="flex items-center space-x-4">
              <span className="flex items-center">
                <Globe className="mr-1 h-3 w-3" />
                {new URL(selectedSource.url).hostname}
              </span>
              <span className="flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                {formatRelativeTime(selectedSource.retrievedAt)}
              </span>
              {selectedSource.relevanceScore && (
                <Badge variant="outline">
                  {Math.round(selectedSource.relevanceScore * 100)}% relevant
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Snippet</h4>
              <p className="text-sm text-muted-foreground">
                {selectedSource.snippet}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={() => window.open(selectedSource.url, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit Source
              </Button>
            </div>

            {selectedSource.usedInSections &&
              selectedSource.usedInSections.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Used in Sections</h4>
                  <div className="space-y-1">
                    {selectedSource.usedInSections.map(sectionId => (
                      <Badge
                        key={sectionId}
                        variant="secondary"
                        className="mr-1"
                      >
                        Section {sectionId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-2 text-lg font-medium">
              Select an item to view details
            </p>
            <p className="text-sm">
              Choose a conversation or source from the left panel
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn('flex h-full space-x-4', className)}>
      {/* Left Panel - Lists */}
      <div className="flex min-h-0 w-1/2 flex-col">
        {/* Research Overview */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Research Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {research.conversations.length}
                </div>
                <div className="text-muted-foreground">Conversations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {research.sources.length}
                </div>
                <div className="text-muted-foreground">Sources</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {research.perspectives.length}
                </div>
                <div className="text-muted-foreground">Perspectives</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {research.totalQueries}
                </div>
                <div className="text-muted-foreground">Queries</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        {showFilters && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                  <Input
                    placeholder="Search conversations and sources..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex space-x-2">
                  <Select
                    value={conversationStatusFilter}
                    onValueChange={setConversationStatusFilter}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={sourceRelevanceFilter}
                    onValueChange={setSourceRelevanceFilter}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="high">High Relevance</SelectItem>
                      <SelectItem value="medium">Medium Relevance</SelectItem>
                      <SelectItem value="low">Low Relevance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Conversations and Sources */}
        <Card className="flex min-h-0 flex-1 flex-col">
          <Tabs defaultValue="conversations" className="flex flex-1 flex-col">
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="conversations">
                  Conversations ({filteredConversations.length})
                </TabsTrigger>
                <TabsTrigger value="sources">
                  Sources ({filteredSources.length})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden">
              <TabsContent value="conversations" className="h-full">
                <div className="storm-scrollbar h-full space-y-3 overflow-y-auto">
                  {filteredConversations.map(conversation => (
                    <ConversationCard
                      key={conversation.id}
                      conversation={conversation}
                      onSelect={handleConversationSelect}
                      isSelected={selectedConversation?.id === conversation.id}
                    />
                  ))}
                  {filteredConversations.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      <MessageCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>No conversations found</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="sources" className="h-full">
                <div className="storm-scrollbar h-full space-y-3 overflow-y-auto">
                  {filteredSources.map(source => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      onSelect={handleSourceSelect}
                      isSelected={selectedSource?.id === source.id}
                    />
                  ))}
                  {filteredSources.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      <Globe className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>No sources found</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Right Panel - Detail View */}
      <div className="flex min-h-0 w-1/2 flex-col">
        <DetailView />
      </div>
    </div>
  );
};

ResearchView.displayName = 'ResearchView';
