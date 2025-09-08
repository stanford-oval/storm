import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/store/contexts/StoreProvider';
import { ThemeProvider } from '@/store/contexts/ThemeContext';
import { ConfigProvider } from '@/store/contexts/ConfigContext';
import { WebSocketProvider } from '@/store/contexts/WebSocketContext';
import { ToastProvider } from '@/components/ux/ToastSystem';
import { TourGuide } from '@/components/ux/TourGuide';
import { KeyboardShortcutsWrapper } from '@/components/layout/KeyboardShortcutsWrapper';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { DebugConsole, DebugConsoleToggle } from '@/components/debug/DebugConsole';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'STORM - Knowledge Curation System',
  description: 'LLM-powered knowledge curation system that generates Wikipedia-like articles',
  keywords: ['AI', 'LLM', 'Knowledge', 'Research', 'Article Generation'],
  authors: [{ name: 'Stanford OVAL' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0f' },
  ],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, 'min-h-screen bg-background font-sans antialiased')}>
        <StoreProvider>
          <ThemeProvider>
            <ConfigProvider>
              <WebSocketProvider>
                <ToastProvider>
                <div className="flex h-screen overflow-hidden">
                  <Suspense fallback={<div className="w-64 bg-muted/30" />}>
                    <Sidebar />
                  </Suspense>
                  
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <Suspense fallback={<div className="h-16 bg-background border-b" />}>
                      <TopBar />
                    </Suspense>
                    
                    <main className="flex-1 overflow-auto bg-background">
                      <Suspense 
                        fallback={
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
                          </div>
                        }
                      >
                        {children}
                      </Suspense>
                    </main>
                  </div>
                </div>

                {/* Global UI Components */}
                <TourGuide />
                <KeyboardShortcutsWrapper />
                <DebugConsole />
                <DebugConsoleToggle />
                </ToastProvider>
              </WebSocketProvider>
            </ConfigProvider>
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}