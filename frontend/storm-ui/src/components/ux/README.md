# UX Components

Advanced user experience components for enhanced interaction and accessibility.

## Components

### CommandPalette

A searchable command palette for quick access to application features.

**Features:**

- Fuzzy search across commands
- Keyboard navigation
- Categorized commands
- Custom shortcuts display
- Extensible command system

**Usage:**

```tsx
import { CommandPalette } from '@/components/ux/CommandPalette';

const customCommands = [
  {
    id: 'create-project',
    label: 'Create New Project',
    description: 'Start a new STORM project',
    icon: Plus,
    category: 'creation',
    shortcut: 'cmd+n',
    action: () => createProject(),
    keywords: ['new', 'create', 'project'],
  },
];

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Command Palette</button>
      <CommandPalette
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        commands={customCommands}
      />
    </>
  );
}
```

### KeyboardShortcuts

A comprehensive keyboard shortcuts help dialog.

**Features:**

- Categorized shortcuts display
- Search and filtering
- Responsive layout
- Dynamic shortcut registration

**Usage:**

```tsx
import { KeyboardShortcuts } from '@/components/ux/KeyboardShortcuts';

function App() {
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <KeyboardShortcuts
      isOpen={showShortcuts}
      onClose={() => setShowShortcuts(false)}
    />
  );
}
```

### TourGuide

Interactive onboarding and feature tours.

**Features:**

- Step-by-step guided tours
- Spotlight highlighting
- Customizable tour steps
- Keyboard navigation
- Progress tracking

**Usage:**

```tsx
import { TourGuide } from '@/components/ux/TourGuide';

const tourSteps = [
  {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome to our application!',
    placement: 'center',
  },
  {
    id: 'feature1',
    title: 'Feature 1',
    content: 'This is an important feature',
    target: '[data-tour="feature1"]',
    placement: 'bottom',
  },
];

function App() {
  const [showTour, setShowTour] = useState(false);

  return (
    <>
      <div data-tour="feature1">Important Feature</div>
      <TourGuide
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        steps={tourSteps}
        title="Getting Started"
      />
    </>
  );
}
```

### ToastSystem

Comprehensive toast notification system.

**Features:**

- Multiple toast types (success, error, warning, info, loading)
- Action buttons in toasts
- Progress indicators
- Auto-dismiss and persistent options
- Stacked notifications

**Usage:**

```tsx
import { ToastProvider, useToastActions } from '@/components/ux/ToastSystem';

// Wrap your app
function App() {
  return (
    <ToastProvider>
      <YourAppContent />
    </ToastProvider>
  );
}

// Use in components
function MyComponent() {
  const { showSuccess, showError, showLoading, showProgress } =
    useToastActions();

  const handleSuccess = () => {
    showSuccess('Operation completed successfully!');
  };

  const handleLongProcess = async () => {
    const { updateProgress, complete } = showProgress(
      'Processing...',
      'This may take a while'
    );

    // Update progress
    for (let i = 0; i <= 100; i += 10) {
      updateProgress(i, `${i}% complete`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    complete('Process finished!');
  };

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleLongProcess}>Start Process</button>
    </div>
  );
}
```

### ResponsiveContainer

Flexible container with responsive properties.

**Features:**

- Responsive padding, margin, max-width
- Responsive grid/flex layouts
- Breakpoint-based styling
- Show/hide components by breakpoint

**Usage:**

```tsx
import {
  ResponsiveContainer,
  FlexContainer,
  GridContainer,
  Show,
  Hide,
} from '@/components/ux/ResponsiveContainer';

function MyComponent() {
  return (
    <ResponsiveContainer
      padding={{
        xs: '1rem',
        md: '2rem',
        lg: '3rem',
      }}
      maxWidth={{
        xs: '100%',
        lg: '1200px',
      }}
      center
    >
      <GridContainer
        columns={{
          xs: 1,
          md: 2,
          lg: 3,
        }}
        gap={{
          xs: '1rem',
          lg: '2rem',
        }}
      >
        <div>Item 1</div>
        <div>Item 2</div>
        <Show above="md">
          <div>Item 3 (desktop only)</div>
        </Show>
      </GridContainer>
    </ResponsiveContainer>
  );
}
```

## Hooks

### Accessibility Hooks

- `useFocusManagement`: Focus trapping and restoration
- `useAriaLive`: Screen reader announcements
- `useKeyboardNavigation`: Arrow key navigation

### Responsive Hooks

- `useBreakpoint`: Current breakpoint detection
- `useBreakpointValue`: Responsive value selection
- `useDeviceType`: Device type detection

## Best Practices

1. **Accessibility First**: All components include proper ARIA attributes and keyboard navigation
2. **Progressive Enhancement**: Components work without JavaScript where possible
3. **Responsive Design**: Built mobile-first with responsive breakpoints
4. **Performance**: Optimized animations and efficient re-renders
5. **Customization**: Extensive theming and configuration options
