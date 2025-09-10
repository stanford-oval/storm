import { useRef, useCallback, useEffect } from 'react';

type AriaPoliteness = 'polite' | 'assertive' | 'off';

interface AriaLiveOptions {
  politeness?: AriaPoliteness;
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  delay?: number;
}

interface AriaLiveRegion {
  announce: (message: string, options?: Partial<AriaLiveOptions>) => void;
  clear: () => void;
  element: HTMLElement | null;
}

// Global live region manager
class LiveRegionManager {
  private regions: Map<AriaPoliteness, HTMLElement> = new Map();

  private createRegion(politeness: AriaPoliteness): HTMLElement {
    const element = document.createElement('div');
    element.setAttribute('aria-live', politeness);
    element.setAttribute('aria-atomic', 'true');
    element.setAttribute('aria-relevant', 'additions text');
    element.style.position = 'absolute';
    element.style.left = '-10000px';
    element.style.width = '1px';
    element.style.height = '1px';
    element.style.overflow = 'hidden';

    document.body.appendChild(element);
    return element;
  }

  getRegion(politeness: AriaPoliteness): HTMLElement {
    if (!this.regions.has(politeness)) {
      this.regions.set(politeness, this.createRegion(politeness));
    }
    return this.regions.get(politeness)!;
  }

  announce(
    message: string,
    politeness: AriaPoliteness = 'polite',
    delay: number = 0
  ) {
    const region = this.getRegion(politeness);

    if (delay > 0) {
      setTimeout(() => {
        region.textContent = message;
      }, delay);
    } else {
      region.textContent = message;
    }

    // Clear the message after a short delay to allow for repeated announcements
    setTimeout(
      () => {
        if (region.textContent === message) {
          region.textContent = '';
        }
      },
      Math.max(1000, message.length * 50)
    );
  }

  clear(politeness?: AriaPoliteness) {
    if (politeness) {
      const region = this.regions.get(politeness);
      if (region) {
        region.textContent = '';
      }
    } else {
      this.regions.forEach(region => {
        region.textContent = '';
      });
    }
  }

  cleanup() {
    this.regions.forEach(region => {
      if (region.parentNode) {
        document.body.removeChild(region);
      }
    });
    this.regions.clear();
  }
}

// Singleton instance
const liveRegionManager = new LiveRegionManager();

// Hook for using ARIA live regions
export const useAriaLive = (
  defaultOptions: AriaLiveOptions = {}
): AriaLiveRegion => {
  const {
    politeness = 'polite',
    atomic = true,
    relevant = 'additions',
    delay = 0,
  } = defaultOptions;

  const currentRegionRef = useRef<HTMLElement | null>(null);

  // Get or create the live region
  useEffect(() => {
    currentRegionRef.current = liveRegionManager.getRegion(politeness);

    if (currentRegionRef.current) {
      currentRegionRef.current.setAttribute('aria-atomic', atomic.toString());
      currentRegionRef.current.setAttribute('aria-relevant', relevant);
    }
  }, [politeness, atomic, relevant]);

  const announce = useCallback(
    (message: string, options: Partial<AriaLiveOptions> = {}) => {
      const finalPoliteness = options.politeness ?? politeness;
      const finalDelay = options.delay ?? delay;

      liveRegionManager.announce(message, finalPoliteness, finalDelay);
    },
    [politeness, delay]
  );

  const clear = useCallback(() => {
    liveRegionManager.clear(politeness);
  }, [politeness]);

  return {
    announce,
    clear,
    element: currentRegionRef.current,
  };
};

// Convenience hooks for specific use cases
export const usePoliteAnnouncements = () => {
  return useAriaLive({ politeness: 'polite' });
};

export const useAssertiveAnnouncements = () => {
  return useAriaLive({ politeness: 'assertive' });
};

// Hook for form validation announcements
export const useFormAnnouncements = () => {
  const { announce } = useAriaLive({ politeness: 'assertive', delay: 100 });

  const announceError = useCallback(
    (fieldName: string, error: string) => {
      announce(`Error in ${fieldName}: ${error}`);
    },
    [announce]
  );

  const announceSuccess = useCallback(
    (message: string) => {
      announce(`Success: ${message}`);
    },
    [announce]
  );

  const announceValidation = useCallback(
    (fieldName: string, isValid: boolean, message?: string) => {
      if (isValid) {
        announce(`${fieldName} is valid`);
      } else if (message) {
        announce(`${fieldName} error: ${message}`);
      }
    },
    [announce]
  );

  return {
    announce,
    announceError,
    announceSuccess,
    announceValidation,
  };
};

// Hook for loading state announcements
export const useLoadingAnnouncements = () => {
  const { announce } = useAriaLive({ politeness: 'polite' });

  const announceLoading = useCallback(
    (resource: string) => {
      announce(`Loading ${resource}...`);
    },
    [announce]
  );

  const announceLoaded = useCallback(
    (resource: string) => {
      announce(`${resource} loaded successfully`);
    },
    [announce]
  );

  const announceError = useCallback(
    (resource: string, error?: string) => {
      const message = error
        ? `Failed to load ${resource}: ${error}`
        : `Failed to load ${resource}`;
      announce(message);
    },
    [announce]
  );

  return {
    announceLoading,
    announceLoaded,
    announceError,
  };
};

// Hook for navigation announcements
export const useNavigationAnnouncements = () => {
  const { announce } = useAriaLive({ politeness: 'polite', delay: 200 });

  const announceNavigation = useCallback(
    (destination: string) => {
      announce(`Navigated to ${destination}`);
    },
    [announce]
  );

  const announceRouteChange = useCallback(
    (from: string, to: string) => {
      announce(`Navigated from ${from} to ${to}`);
    },
    [announce]
  );

  const announceBreadcrumb = useCallback(
    (breadcrumbs: string[]) => {
      const breadcrumbText = breadcrumbs.join(' > ');
      announce(`Current location: ${breadcrumbText}`);
    },
    [announce]
  );

  return {
    announceNavigation,
    announceRouteChange,
    announceBreadcrumb,
  };
};

// Cleanup function (call this when your app unmounts)
export const cleanupLiveRegions = () => {
  liveRegionManager.cleanup();
};
