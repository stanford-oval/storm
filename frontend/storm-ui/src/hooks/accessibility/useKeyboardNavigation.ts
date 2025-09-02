import { useCallback, useEffect, RefObject } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface KeyboardNavigationOptions {
  enabled?: boolean;
  enableArrowKeys?: boolean;
  enableHomeEnd?: boolean;
  enablePageUpDown?: boolean;
  enableEnterSpace?: boolean;
  orientation?: 'horizontal' | 'vertical' | 'both';
  wrap?: boolean;
  itemSelector?: string;
  onNavigate?: (index: number, element: HTMLElement) => void;
  onActivate?: (index: number, element: HTMLElement) => void;
}

interface KeyboardNavigationAPI {
  focusItem: (index: number) => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focusFirst: () => void;
  focusLast: () => void;
  activateItem: (index: number) => void;
  getCurrentIndex: () => number;
  getItems: () => HTMLElement[];
}

export const useKeyboardNavigation = (
  containerRef: RefObject<HTMLElement>,
  options: KeyboardNavigationOptions = {}
): KeyboardNavigationAPI => {
  const {
    enabled = true,
    enableArrowKeys = true,
    enableHomeEnd = true,
    enablePageUpDown = false,
    enableEnterSpace = true,
    orientation = 'vertical',
    wrap = false,
    itemSelector = '[role="option"], [role="menuitem"], [role="listitem"], button, a[href]',
    onNavigate,
    onActivate,
  } = options;

  // Get all navigable items
  const getItems = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(itemSelector)
    ).filter(item => {
      const style = window.getComputedStyle(item);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !item.hasAttribute('disabled') &&
        item.tabIndex !== -1
      );
    });
  }, [containerRef, itemSelector]);

  // Get current focused item index
  const getCurrentIndex = useCallback((): number => {
    const items = getItems();
    const activeElement = document.activeElement as HTMLElement;
    return items.indexOf(activeElement);
  }, [getItems]);

  // Focus specific item
  const focusItem = useCallback((index: number) => {
    const items = getItems();
    if (index >= 0 && index < items.length) {
      items[index].focus();
      onNavigate?.(index, items[index]);
    }
  }, [getItems, onNavigate]);

  // Focus next item
  const focusNext = useCallback(() => {
    const items = getItems();
    const currentIndex = getCurrentIndex();
    let nextIndex = currentIndex + 1;

    if (nextIndex >= items.length) {
      nextIndex = wrap ? 0 : items.length - 1;
    }

    focusItem(nextIndex);
  }, [getCurrentIndex, getItems, wrap, focusItem]);

  // Focus previous item
  const focusPrevious = useCallback(() => {
    const items = getItems();
    const currentIndex = getCurrentIndex();
    let previousIndex = currentIndex - 1;

    if (previousIndex < 0) {
      previousIndex = wrap ? items.length - 1 : 0;
    }

    focusItem(previousIndex);
  }, [getCurrentIndex, getItems, wrap, focusItem]);

  // Focus first item
  const focusFirst = useCallback(() => {
    focusItem(0);
  }, [focusItem]);

  // Focus last item
  const focusLast = useCallback(() => {
    const items = getItems();
    focusItem(items.length - 1);
  }, [getItems, focusItem]);

  // Activate current item
  const activateItem = useCallback((index: number) => {
    const items = getItems();
    if (index >= 0 && index < items.length) {
      const item = items[index];
      
      // Trigger click event
      if (item.tagName.toLowerCase() === 'button' || item.tagName.toLowerCase() === 'a') {
        item.click();
      } else {
        // For other elements, dispatch a custom activate event
        const event = new CustomEvent('activate', { bubbles: true });
        item.dispatchEvent(event);
      }
      
      onActivate?.(index, item);
    }
  }, [getItems, onActivate]);

  // Arrow key navigation
  const handleArrowKeys = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!enableArrowKeys || !enabled) return;

    switch (orientation) {
      case 'vertical':
        if (direction === 'up') focusPrevious();
        if (direction === 'down') focusNext();
        break;
      case 'horizontal':
        if (direction === 'left') focusPrevious();
        if (direction === 'right') focusNext();
        break;
      case 'both':
        if (direction === 'up' || direction === 'left') focusPrevious();
        if (direction === 'down' || direction === 'right') focusNext();
        break;
    }
  }, [enableArrowKeys, enabled, orientation, focusNext, focusPrevious]);

  // Keyboard event handlers
  useHotkeys('up', () => handleArrowKeys('up'), {
    enabled: enabled && enableArrowKeys,
    preventDefault: true,
    enableOnFormTags: true,
    scopes: ['navigation'],
  });

  useHotkeys('down', () => handleArrowKeys('down'), {
    enabled: enabled && enableArrowKeys,
    preventDefault: true,
    enableOnFormTags: true,
    scopes: ['navigation'],
  });

  useHotkeys('left', () => handleArrowKeys('left'), {
    enabled: enabled && enableArrowKeys,
    preventDefault: true,
    enableOnFormTags: true,
    scopes: ['navigation'],
  });

  useHotkeys('right', () => handleArrowKeys('right'), {
    enabled: enabled && enableArrowKeys,
    preventDefault: true,
    enableOnFormTags: true,
    scopes: ['navigation'],
  });

  useHotkeys('home', focusFirst, {
    enabled: enabled && enableHomeEnd,
    preventDefault: true,
    enableOnFormTags: true,
    scopes: ['navigation'],
  });

  useHotkeys('end', focusLast, {
    enabled: enabled && enableHomeEnd,
    preventDefault: true,
    enableOnFormTags: true,
    scopes: ['navigation'],
  });

  useHotkeys('pageup', () => {
    const items = getItems();
    const currentIndex = getCurrentIndex();
    const pageSize = Math.floor(items.length / 4) || 1;
    const newIndex = Math.max(0, currentIndex - pageSize);
    focusItem(newIndex);
  }, {
    enabled: enabled && enablePageUpDown,
    preventDefault: true,
    enableOnFormTags: true,
    scopes: ['navigation'],
  });

  useHotkeys('pagedown', () => {
    const items = getItems();
    const currentIndex = getCurrentIndex();
    const pageSize = Math.floor(items.length / 4) || 1;
    const newIndex = Math.min(items.length - 1, currentIndex + pageSize);
    focusItem(newIndex);
  }, {
    enabled: enabled && enablePageUpDown,
    preventDefault: true,
    enableOnFormTags: true,
    scopes: ['navigation'],
  });

  useHotkeys('enter', () => {
    const currentIndex = getCurrentIndex();
    if (currentIndex >= 0) {
      activateItem(currentIndex);
    }
  }, {
    enabled: enabled && enableEnterSpace,
    preventDefault: true,
    enableOnFormTags: false,
    scopes: ['navigation'],
  });

  useHotkeys('space', () => {
    const currentIndex = getCurrentIndex();
    if (currentIndex >= 0) {
      activateItem(currentIndex);
    }
  }, {
    enabled: enabled && enableEnterSpace,
    preventDefault: true,
    enableOnFormTags: false,
    scopes: ['navigation'],
  });

  // Auto-focus management
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const items = getItems();
      const index = items.indexOf(target);
      
      if (index >= 0) {
        onNavigate?.(index, target);
      }
    };

    container.addEventListener('focusin', handleFocusIn);
    
    return () => {
      container.removeEventListener('focusin', handleFocusIn);
    };
  }, [enabled, containerRef, getItems, onNavigate]);

  return {
    focusItem,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    activateItem,
    getCurrentIndex,
    getItems,
  };
};

// Specialized hooks for common patterns

// Menu navigation
export const useMenuNavigation = (containerRef: RefObject<HTMLElement>) => {
  return useKeyboardNavigation(containerRef, {
    itemSelector: '[role="menuitem"]',
    orientation: 'vertical',
    wrap: true,
    enableArrowKeys: true,
    enableHomeEnd: true,
  });
};

// List navigation  
export const useListNavigation = (containerRef: RefObject<HTMLElement>) => {
  return useKeyboardNavigation(containerRef, {
    itemSelector: '[role="listitem"], [role="option"]',
    orientation: 'vertical',
    wrap: false,
    enableArrowKeys: true,
    enableHomeEnd: true,
    enablePageUpDown: true,
  });
};

// Tab navigation
export const useTabNavigation = (containerRef: RefObject<HTMLElement>) => {
  return useKeyboardNavigation(containerRef, {
    itemSelector: '[role="tab"]',
    orientation: 'horizontal',
    wrap: false,
    enableArrowKeys: true,
    enableHomeEnd: true,
  });
};

// Toolbar navigation
export const useToolbarNavigation = (containerRef: RefObject<HTMLElement>) => {
  return useKeyboardNavigation(containerRef, {
    itemSelector: 'button, [role="button"]',
    orientation: 'horizontal',
    wrap: false,
    enableArrowKeys: true,
    enableHomeEnd: true,
  });
};