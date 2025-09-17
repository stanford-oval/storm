'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { CommandPalette } from '@/components/ux/CommandPalette';
import {
  useUIStore,
  useNotificationStore,
  usePipelineStore,
  useAuthStore,
} from '@/store';
import {
  Bell,
  Settings,
  HelpCircle,
  User,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Search,
  Zap,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function TopBar() {
  const router = useRouter();
  const { theme, setTheme, openCommandPalette, getEffectiveTheme } =
    useUIStore();

  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotificationStore();

  const { runningPipelines } = usePipelineStore();
  const { user, logout } = useAuthStore();

  const runningPipelinesCount = Object.keys(runningPipelines).length;
  const recentNotifications = notifications.slice(0, 5);
  const hasErrors = notifications.some(n => n.type === 'error' && !n.read);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const getThemeIcon = () => {
    const effectiveTheme = getEffectiveTheme();
    switch (effectiveTheme) {
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'light':
        return <Sun className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Left side - Search */}
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            className="relative w-64 justify-start text-sm text-muted-foreground"
            onClick={openCommandPalette}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Search projects, articles...</span>
            <kbd className="pointer-events-none absolute right-1.5 top-1.5 h-5 select-none rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              ⌘K
            </kbd>
          </Button>
        </div>

        {/* Right side - Status and User */}
        <div className="flex items-center space-x-2">
          {/* Pipeline Status */}
          {runningPipelinesCount > 0 && (
            <div className="flex items-center space-x-2 rounded-lg border bg-primary/10 px-3 py-2">
              <Activity className="h-4 w-4 animate-pulse text-primary" />
              <span className="text-sm font-medium text-primary">
                {runningPipelinesCount} Running
              </span>
            </div>
          )}

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell
                  className={cn('h-4 w-4', hasErrors && 'text-destructive')}
                />
                {unreadCount > 0 && (
                  <Badge
                    variant={hasErrors ? 'destructive' : 'default'}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1 text-xs"
                    onClick={markAllAsRead}
                  >
                    Mark all read
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {recentNotifications.length === 0 ? (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">
                    No notifications
                  </span>
                </DropdownMenuItem>
              ) : (
                recentNotifications.map(notification => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex-col items-start p-3"
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex w-full items-center">
                      {notification.type === 'error' && (
                        <AlertCircle className="mr-2 h-4 w-4 text-destructive" />
                      )}
                      {notification.type === 'success' && (
                        <Zap className="mr-2 h-4 w-4 text-green-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {notification.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="ml-2 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <time className="mt-1 text-xs text-muted-foreground">
                      {notification.timestamp.toLocaleTimeString()}
                    </time>
                  </DropdownMenuItem>
                ))
              )}

              {notifications.length > 5 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-center"
                    onClick={() => router.push('/notifications')}
                  >
                    View all notifications
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {getThemeIcon()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleThemeChange('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleThemeChange('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleThemeChange('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.name || 'Guest User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || 'guest@storm.local'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/help')}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help & Support
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Command Palette */}
      <CommandPalette
        isOpen={useUIStore(state =>
          state.openDialogs.includes('commandPalette')
        )}
        onClose={() => useUIStore.getState().closeDialog('commandPalette')}
      />
    </>
  );
}
