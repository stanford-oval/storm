'use client';

// Theme context provider
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useUIStore } from '../slices/uiStore';

// Theme configuration
export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  animation: {
    duration: {
      fast: string;
      normal: string;
      slow: string;
    };
    easing: {
      ease: string;
      easeIn: string;
      easeOut: string;
      easeInOut: string;
    };
  };
}

// Light theme configuration
export const lightTheme: ThemeConfig = {
  colors: {
    primary: '#3b82f6',
    secondary: '#6b7280',
    accent: '#8b5cf6',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#3b82f6',
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },
};

// Dark theme configuration
export const darkTheme: ThemeConfig = {
  ...lightTheme,
  colors: {
    primary: '#60a5fa',
    secondary: '#9ca3af',
    accent: '#a78bfa',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textMuted: '#9ca3af',
    border: '#374151',
    error: '#f87171',
    warning: '#fbbf24',
    success: '#34d399',
    info: '#60a5fa',
  },
};

// Theme context
interface ThemeContextType {
  theme: ThemeConfig;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  themeMode: 'light' | 'dark' | 'system';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
export interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
  customLightTheme?: Partial<ThemeConfig>;
  customDarkTheme?: Partial<ThemeConfig>;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  customLightTheme,
  customDarkTheme,
}) => {
  const {
    theme: themeMode,
    setTheme,
    toggleTheme,
    getEffectiveTheme,
  } = useUIStore();

  // Get the effective theme (resolving 'system' to actual theme)
  const effectiveTheme = getEffectiveTheme();
  const isDark = effectiveTheme === 'dark';

  // Merge custom themes with defaults
  const mergedLightTheme = customLightTheme
    ? mergeTheme(lightTheme, customLightTheme)
    : lightTheme;

  const mergedDarkTheme = customDarkTheme
    ? mergeTheme(darkTheme, customDarkTheme)
    : darkTheme;

  // Current theme object
  const currentTheme = isDark ? mergedDarkTheme : mergedLightTheme;

  // Apply theme to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;

    // Apply color variables
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Apply typography variables
    Object.entries(currentTheme.typography.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--font-size-${key}`, value);
    });

    Object.entries(currentTheme.typography.fontWeight).forEach(
      ([key, value]) => {
        root.style.setProperty(`--font-weight-${key}`, value.toString());
      }
    );

    Object.entries(currentTheme.typography.lineHeight).forEach(
      ([key, value]) => {
        root.style.setProperty(`--line-height-${key}`, value.toString());
      }
    );

    // Apply spacing variables
    Object.entries(currentTheme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    // Apply border radius variables
    Object.entries(currentTheme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });

    // Apply shadow variables
    Object.entries(currentTheme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Apply animation variables
    Object.entries(currentTheme.animation.duration).forEach(([key, value]) => {
      root.style.setProperty(`--duration-${key}`, value);
    });

    Object.entries(currentTheme.animation.easing).forEach(([key, value]) => {
      root.style.setProperty(`--easing-${key}`, value);
    });

    // Apply font family
    root.style.setProperty('--font-family', currentTheme.typography.fontFamily);
  }, [currentTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = () => {
        // Force a re-render by updating the store
        // This will trigger the effect above to update CSS variables
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(getEffectiveTheme());
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode, getEffectiveTheme]);

  const contextValue: ThemeContextType = {
    theme: currentTheme,
    isDark,
    toggleTheme,
    setTheme,
    themeMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Utility function to merge theme objects deeply
function mergeTheme(
  baseTheme: ThemeConfig,
  customTheme: Partial<ThemeConfig>
): ThemeConfig {
  const merged = { ...baseTheme };

  // Deep merge each section
  Object.keys(customTheme).forEach(key => {
    const section = key as keyof ThemeConfig;
    if (
      typeof customTheme[section] === 'object' &&
      customTheme[section] !== null
    ) {
      merged[section] = {
        ...merged[section],
        ...customTheme[section],
      } as any;
    }
  });

  return merged;
}

// Hook for theme-aware styling
export const useThemeStyles = () => {
  const { theme, isDark } = useTheme();

  return {
    theme,
    isDark,

    // Helper functions for common styling patterns
    bg: (variant: keyof ThemeConfig['colors'] = 'background') => ({
      backgroundColor: theme.colors[variant],
    }),

    text: (variant: keyof ThemeConfig['colors'] = 'text') => ({
      color: theme.colors[variant],
    }),

    border: (variant: keyof ThemeConfig['colors'] = 'border') => ({
      borderColor: theme.colors[variant],
    }),

    shadow: (size: keyof ThemeConfig['shadows'] = 'md') => ({
      boxShadow: theme.shadows[size],
    }),

    rounded: (size: keyof ThemeConfig['borderRadius'] = 'md') => ({
      borderRadius: theme.borderRadius[size],
    }),

    p: (size: keyof ThemeConfig['spacing'] = 'md') => ({
      padding: theme.spacing[size],
    }),

    m: (size: keyof ThemeConfig['spacing'] = 'md') => ({
      margin: theme.spacing[size],
    }),

    fontSize: (size: keyof ThemeConfig['typography']['fontSize'] = 'base') => ({
      fontSize: theme.typography.fontSize[size],
    }),

    fontWeight: (
      weight: keyof ThemeConfig['typography']['fontWeight'] = 'normal'
    ) => ({
      fontWeight: theme.typography.fontWeight[weight],
    }),

    // Transition helper
    transition: (
      duration: keyof ThemeConfig['animation']['duration'] = 'normal'
    ) => ({
      transitionDuration: theme.animation.duration[duration],
      transitionTimingFunction: theme.animation.easing.easeInOut,
    }),
  };
};

// Component for theme-aware conditional rendering
export const ThemeConditional: React.FC<{
  light?: ReactNode;
  dark?: ReactNode;
  children?: (theme: ThemeContextType) => ReactNode;
}> = ({ light, dark, children }) => {
  const themeContext = useTheme();

  if (children) {
    return <>{children(themeContext)}</>;
  }

  return <>{themeContext.isDark ? dark : light}</>;
};

// Higher-order component for theme injection
export const withTheme = <P extends object>(
  Component: React.ComponentType<P & { theme: ThemeContextType }>
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const theme = useTheme();
    return <Component {...(props as P)} theme={theme} ref={ref} />;
  });
};

// Theme toggle button component
export const ThemeToggle: React.FC<{
  className?: string;
  showLabel?: boolean;
}> = ({ className, showLabel = false }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={className}
      aria-label="Toggle theme"
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {showLabel && <span>{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
};
