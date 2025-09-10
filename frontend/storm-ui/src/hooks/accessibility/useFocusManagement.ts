import { useRef, useEffect, useCallback, RefObject } from 'react';

interface FocusManagementOptions {
  trapFocus?: boolean;
  restoreFocus?: boolean;
  autoFocus?: boolean;
  skipLinks?: string[];
  onEscape?: () => void;
}

interface FocusableElements {
  first: HTMLElement | null;
  last: HTMLElement | null;
  all: HTMLElement[];
}

// Selector for focusable elements
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

export const useFocusManagement = (
  containerRef: RefObject<HTMLElement>,
  options: FocusManagementOptions = {}
) => {
  const {
    trapFocus = false,
    restoreFocus = false,
    autoFocus = false,
    skipLinks = [],
    onEscape,
  } = options;

  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): FocusableElements => {
    if (!containerRef.current) {
      return { first: null, last: null, all: [] };
    }

    const elements = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(element => {
      // Filter out elements that should be skipped
      if (skipLinks.some(selector => element.matches(selector))) {
        return false;
      }

      // Check if element is visible and not disabled
      const style = window.getComputedStyle(element);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !element.hasAttribute('disabled') &&
        element.tabIndex !== -1
      );
    });

    return {
      first: elements[0] || null,
      last: elements[elements.length - 1] || null,
      all: elements,
    };
  }, [containerRef, skipLinks]);

  // Handle tab key for focus trapping
  const handleTabKey = useCallback(
    (event: KeyboardEvent) => {
      if (!trapFocus || !containerRef.current) return;

      const { first, last, all } = getFocusableElements();

      if (all.length === 0) return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    },
    [trapFocus, containerRef, getFocusableElements]
  );

  // Setup focus trap
  useEffect(() => {
    if (!trapFocus) return;

    const container = containerRef.current;
    if (!container) return;

    // Store previously focused element
    if (restoreFocus) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
    }

    // Auto-focus first element if requested
    if (autoFocus) {
      const { first } = getFocusableElements();
      first?.focus();
    }

    // Add event listener for tab key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        handleTabKey(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to previously focused element
      if (restoreFocus && previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [
    trapFocus,
    restoreFocus,
    autoFocus,
    handleTabKey,
    getFocusableElements,
    containerRef,
  ]);

  // Handle escape key
  useEffect(() => {
    if (!onEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onEscape]);

  // Focus management utilities
  const focusFirst = useCallback(() => {
    const { first } = getFocusableElements();
    first?.focus();
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const { last } = getFocusableElements();
    last?.focus();
  }, [getFocusableElements]);

  const focusNext = useCallback(() => {
    const { all } = getFocusableElements();
    const currentIndex = all.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % all.length;
    all[nextIndex]?.focus();
  }, [getFocusableElements]);

  const focusPrevious = useCallback(() => {
    const { all } = getFocusableElements();
    const currentIndex = all.indexOf(document.activeElement as HTMLElement);
    const previousIndex =
      currentIndex === 0 ? all.length - 1 : currentIndex - 1;
    all[previousIndex]?.focus();
  }, [getFocusableElements]);

  const contains = useCallback(
    (element: Element): boolean => {
      return containerRef.current?.contains(element) ?? false;
    },
    [containerRef]
  );

  const isFocusWithin = useCallback((): boolean => {
    return contains(document.activeElement!);
  }, [contains]);

  return {
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    getFocusableElements,
    contains,
    isFocusWithin,
  };
};
