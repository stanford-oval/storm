import { useState, useEffect } from 'react';
import { useWindowSize } from 'react-use';

// Tailwind CSS default breakpoints
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

interface BreakpointState {
  current: Breakpoint | 'xs';
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  is2xl: boolean;
  isSmUp: boolean;
  isMdUp: boolean;
  isLgUp: boolean;
  isXlUp: boolean;
  is2xlUp: boolean;
  isSmDown: boolean;
  isMdDown: boolean;
  isLgDown: boolean;
  isXlDown: boolean;
  is2xlDown: boolean;
}

export const useBreakpoint = (): BreakpointState => {
  const { width } = useWindowSize();
  const [breakpointState, setBreakpointState] = useState<BreakpointState>(
    () => getBreakpointState(width || 1024) // Default to desktop width
  );

  useEffect(() => {
    if (width) {
      setBreakpointState(getBreakpointState(width));
    }
  }, [width]);

  return breakpointState;
};

function getBreakpointState(width: number): BreakpointState {
  // Determine current breakpoint
  let current: Breakpoint | 'xs' = 'xs';
  if (width >= breakpoints['2xl']) current = '2xl';
  else if (width >= breakpoints.xl) current = 'xl';
  else if (width >= breakpoints.lg) current = 'lg';
  else if (width >= breakpoints.md) current = 'md';
  else if (width >= breakpoints.sm) current = 'sm';

  // Helper functions
  const isXs = current === 'xs';
  const isSm = current === 'sm';
  const isMd = current === 'md';
  const isLg = current === 'lg';
  const isXl = current === 'xl';
  const is2xl = current === '2xl';

  // Up breakpoints (current breakpoint and larger)
  const isSmUp = width >= breakpoints.sm;
  const isMdUp = width >= breakpoints.md;
  const isLgUp = width >= breakpoints.lg;
  const isXlUp = width >= breakpoints.xl;
  const is2xlUp = width >= breakpoints['2xl'];

  // Down breakpoints (current breakpoint and smaller)
  const isSmDown = width < breakpoints.md;
  const isMdDown = width < breakpoints.lg;
  const isLgDown = width < breakpoints.xl;
  const isXlDown = width < breakpoints['2xl'];
  const is2xlDown = true; // Always true as it's the largest breakpoint

  return {
    current,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    is2xl,
    isSmUp,
    isMdUp,
    isLgUp,
    isXlUp,
    is2xlUp,
    isSmDown,
    isMdDown,
    isLgDown,
    isXlDown,
    is2xlDown,
  };
}

// Hook for checking specific breakpoint conditions
export const useBreakpointValue = <T>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}): T | undefined => {
  const { current } = useBreakpoint();

  // Return the value for current breakpoint or fallback to smaller breakpoints
  if (current === '2xl' && values['2xl'] !== undefined) return values['2xl'];
  if ((current === '2xl' || current === 'xl') && values.xl !== undefined)
    return values.xl;
  if (
    (current === '2xl' || current === 'xl' || current === 'lg') &&
    values.lg !== undefined
  )
    return values.lg;
  if (
    (current === '2xl' ||
      current === 'xl' ||
      current === 'lg' ||
      current === 'md') &&
    values.md !== undefined
  )
    return values.md;
  if (current !== 'xs' && values.sm !== undefined) return values.sm;
  return values.xs;
};

// Hook for responsive columns/grid
export const useResponsiveColumns = (config: {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  '2xl'?: number;
}): number => {
  const columns = useBreakpointValue(config);
  return columns ?? 1;
};

// Hook for responsive spacing
export const useResponsiveSpacing = (config: {
  xs?: string | number;
  sm?: string | number;
  md?: string | number;
  lg?: string | number;
  xl?: string | number;
  '2xl'?: string | number;
}): string | number | undefined => {
  return useBreakpointValue(config);
};

// Hook to check if we're on mobile/tablet/desktop
export const useDeviceType = () => {
  const { isSmDown, isMdDown, isLgUp } = useBreakpoint();

  return {
    isMobile: isSmDown,
    isTablet: !isSmDown && isMdDown,
    isDesktop: isLgUp,
  };
};

// Hook for responsive font sizes
export const useResponsiveFontSize = (config: {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  '2xl'?: string;
}): string => {
  const fontSize = useBreakpointValue(config);
  return fontSize ?? '1rem';
};

// Custom hook for media query matching
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    // Check if window is available (client-side)
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }, [query]);

  return matches;
};

// Predefined media queries
export const useCommonMediaQueries = () => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTouch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const prefersReducedMotion = useMediaQuery(
    '(prefers-reduced-motion: reduce)'
  );
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const isHighDensity = useMediaQuery(
    '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)'
  );

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouch,
    prefersReducedMotion,
    prefersDarkMode,
    isHighDensity,
  };
};
