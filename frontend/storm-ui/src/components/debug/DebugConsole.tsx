'use client';

import React, { useEffect, useRef } from 'react';
import { useDebugStore, useFilteredLogs } from '@/store/slices/debugStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  X,
  Trash2,
  Download,
  Search,
  Terminal,
  ChevronUp,
  ChevronDown,
  Copy,
  Filter,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export const DebugConsole: React.FC = () => {
  const {
    isVisible,
    filter,
    toggleVisibility,
    clearLogs,
    setFilter,
    exportLogs,
  } = useDebugStore();

  const filteredLogs = useFilteredLogs();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [autoScroll, setAutoScroll] = React.useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [filteredLogs, autoScroll]);

  if (!isVisible) {
    return null;
  }

  const handleExport = () => {
    const data = exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLog = (log: any) => {
    const text = `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}${
      log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''
    }`;
    navigator.clipboard.writeText(text);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'warn':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'info':
        return 'text-blue-500 dark:text-blue-400';
      case 'debug':
        return 'text-gray-500 dark:text-gray-400';
      default:
        return 'text-foreground';
    }
  };

  const getLevelBadgeVariant = (
    level: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warn':
        return 'secondary';
      case 'info':
        return 'default';
      default:
        return 'outline';
    }
  };

  return (
    <Card
      className={cn(
        'fixed bottom-0 right-0 z-50 flex flex-col border-t-2 shadow-2xl',
        'transition-all duration-300 ease-in-out',
        isMinimized ? 'h-12 w-96' : 'h-96 w-[600px]',
        'bg-background/95 backdrop-blur-sm'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/50 p-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <span className="text-sm font-semibold">Debug Console</span>
          <Badge variant="secondary" className="text-xs">
            {filteredLogs.length} logs
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Filter className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={filter.level.includes('log')}
                onCheckedChange={checked => {
                  setFilter({
                    level: checked
                      ? [...filter.level, 'log']
                      : filter.level.filter(l => l !== 'log'),
                  });
                }}
              >
                Log
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filter.level.includes('info')}
                onCheckedChange={checked => {
                  setFilter({
                    level: checked
                      ? [...filter.level, 'info']
                      : filter.level.filter(l => l !== 'info'),
                  });
                }}
              >
                Info
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filter.level.includes('warn')}
                onCheckedChange={checked => {
                  setFilter({
                    level: checked
                      ? [...filter.level, 'warn']
                      : filter.level.filter(l => l !== 'warn'),
                  });
                }}
              >
                Warning
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filter.level.includes('error')}
                onCheckedChange={checked => {
                  setFilter({
                    level: checked
                      ? [...filter.level, 'error']
                      : filter.level.filter(l => l !== 'error'),
                  });
                }}
              >
                Error
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filter.level.includes('debug')}
                onCheckedChange={checked => {
                  setFilter({
                    level: checked
                      ? [...filter.level, 'debug']
                      : filter.level.filter(l => l !== 'debug'),
                  });
                }}
              >
                Debug
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={autoScroll}
                onCheckedChange={setAutoScroll}
              >
                Auto-scroll
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleExport}
            title="Export logs"
          >
            <Download className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={clearLogs}
            title="Clear logs"
          >
            <Trash2 className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={toggleVisibility}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {!isMinimized && (
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={filter.searchQuery}
              onChange={e => setFilter({ searchQuery: e.target.value })}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Logs */}
      {!isMinimized && (
        <ScrollArea className="flex-1 p-2" ref={scrollAreaRef}>
          <div className="space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No logs to display
              </div>
            ) : (
              filteredLogs.map(log => (
                <div
                  key={log.id}
                  className="group flex items-start gap-2 rounded p-2 font-mono text-xs hover:bg-muted/50"
                >
                  <span className="min-w-[140px] text-muted-foreground opacity-50">
                    {log.timestamp.toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      fractionalSecondDigits: 3,
                    } as any)}
                  </span>

                  <Badge
                    variant={getLevelBadgeVariant(log.level)}
                    className="h-5 min-w-[50px] justify-center text-[10px]"
                  >
                    {log.level.toUpperCase()}
                  </Badge>

                  <div className="flex-1 break-all">
                    <span
                      className={cn(
                        'whitespace-pre-wrap',
                        getLevelColor(log.level)
                      )}
                    >
                      {log.message}
                    </span>
                    {log.data && (
                      <div className="mt-1 rounded bg-muted p-1 text-[10px] text-muted-foreground">
                        <pre>{JSON.stringify(log.data, null, 2)}</pre>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => handleCopyLog(log)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};

// Debug console toggle button
export const DebugConsoleToggle: React.FC = () => {
  const { isVisible, toggleVisibility } = useDebugStore();

  // Add keyboard shortcut (Ctrl/Cmd + Shift + D)
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggleVisibility();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleVisibility]);

  if (isVisible) {
    return null; // Console is already visible
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-4 right-4 z-50 border-2 bg-background shadow-lg"
      onClick={toggleVisibility}
      title="Open Debug Console (Cmd+Shift+D)"
    >
      <Terminal className="h-4 w-4" />
    </Button>
  );
};
