# STORM UI Visualization & UX Components Guide

This guide provides comprehensive documentation for the interactive visualization and advanced UX components implemented for the STORM application.

## 🗺️ Overview

The STORM UI now includes a complete suite of interactive visualization and UX components designed to enhance the user experience:

- **Interactive Mind Map**: D3.js-powered knowledge space visualization
- **Analytics Dashboard**: Comprehensive metrics and performance monitoring
- **Advanced UX Features**: Command palette, keyboard shortcuts, guided tours
- **Animation System**: Smooth, accessible animations with Framer Motion
- **Accessibility Features**: Screen reader support, keyboard navigation, focus management
- **Responsive Design**: Mobile-first components with breakpoint-based styling

## 📦 Component Categories

### 1. Visualization Components (`src/components/visualization/`)

#### MindMap

- **Location**: `src/components/visualization/MindMap.tsx`
- **Purpose**: Interactive D3.js-based mind map for Co-STORM knowledge spaces
- **Key Features**:
  - Force-directed graph layout with customizable physics
  - Interactive node expansion/collapse
  - Real-time updates during discourse
  - Zoom, pan, and search functionality
  - Node clustering and filtering
  - Minimap for navigation
  - Export/import capabilities

**Usage Example**:

```tsx
import { MindMap } from '@/components/visualization/MindMap';

<MindMap
  initialNodes={nodes}
  initialLinks={links}
  width={800}
  height={600}
  onNodeClick={handleNodeClick}
  showControls={true}
  showMinimap={true}
/>;
```

### 2. Analytics Components (`src/components/analytics/`)

#### AnalyticsDashboard

- **Location**: `src/components/analytics/AnalyticsDashboard.tsx`
- **Purpose**: Comprehensive analytics and metrics visualization
- **Key Features**:
  - Pipeline progress visualization
  - Token usage and cost analysis
  - Research statistics tracking
  - Performance monitoring charts
  - Interactive filtering and time range selection
  - Export functionality
  - Real-time updates

**Chart Types Included**:

- Bar charts for stage duration comparison
- Line charts for token consumption trends
- Pie charts for model usage distribution
- Area charts for performance metrics
- Composed charts for correlation analysis

### 3. UX Components (`src/components/ux/`)

#### CommandPalette

- **Location**: `src/components/ux/CommandPalette.tsx`
- **Purpose**: Quick access to application features
- **Key Features**:
  - Fuzzy search across commands
  - Keyboard navigation (arrows, enter, escape)
  - Categorized commands with icons
  - Custom shortcuts display
  - Extensible command system

#### KeyboardShortcuts

- **Location**: `src/components/ux/KeyboardShortcuts.tsx`
- **Purpose**: Help dialog showing all keyboard shortcuts
- **Key Features**:
  - Categorized shortcuts (General, Navigation, Editing, Pipeline, System)
  - Search and filtering
  - Responsive layout
  - Dynamic shortcut registration

#### TourGuide

- **Location**: `src/components/ux/TourGuide.tsx`
- **Purpose**: Interactive onboarding and feature tours
- **Key Features**:
  - Step-by-step guided tours
  - Spotlight highlighting of UI elements
  - Customizable tour steps with images/videos
  - Progress tracking and navigation
  - Keyboard navigation support

#### ToastSystem

- **Location**: `src/components/ux/ToastSystem.tsx`
- **Purpose**: Comprehensive notification system
- **Key Features**:
  - Multiple toast types (success, error, warning, info, loading)
  - Action buttons within toasts
  - Progress indicators for long operations
  - Auto-dismiss and persistent options
  - Stacked notifications with animations

#### ResponsiveContainer

- **Location**: `src/components/ux/ResponsiveContainer.tsx`
- **Purpose**: Flexible responsive layout system
- **Key Features**:
  - Responsive padding, margin, max-width
  - Responsive grid/flex layouts
  - Breakpoint-based styling
  - Show/hide components by breakpoint
  - Predefined container types (Flex, Grid, Centered, Stack)

### 4. Animation Utilities (`src/utils/animations/`)

#### Core Animation Components

- **AnimatedPage**: Page transition wrapper with variants
- **AnimatedCard**: Interactive cards with hover effects
- **AnimatedButton**: Enhanced buttons with micro-interactions
- **AnimatedList/ListItem**: Staggered list animations
- **LoadingSpinner**: Customizable loading indicators
- **AnimatedProgress**: Smooth progress bar animations
- **FloatingActionButton**: Animated FAB with ripple effects
- **AnimatedCounter**: Number counter with smooth transitions
- **Skeleton**: Loading skeleton with pulse animation

#### Animation Variants

- Page transitions (fadeIn, slideUp, scale, blur, etc.)
- Modal transitions (backdrop, modal, drawer)
- List animations with staggered children
- Loading animations (spinner, pulse, bounce, wave)
- Progress animations (bar, circle)

## 🔧 Hooks & Utilities

### Accessibility Hooks (`src/hooks/accessibility/`)

#### useFocusManagement

- Focus trapping for modals and dialogs
- Focus restoration on close
- Auto-focus on open
- Skip link support

#### useAriaLive

- Screen reader announcements
- Multiple politeness levels
- Specialized hooks for forms, loading, navigation
- Global live region management

#### useKeyboardNavigation

- Arrow key navigation for lists, menus, tabs
- Home/End navigation
- Page up/down support
- Enter/Space activation
- Orientation support (horizontal/vertical)

### Responsive Hooks (`src/hooks/responsive/`)

#### useBreakpoint

- Current breakpoint detection
- Up/down breakpoint queries
- Device type detection (mobile, tablet, desktop)
- Media query matching

#### useBreakpointValue

- Responsive value selection
- Mobile-first approach
- Fallback value support

### Mind Map Hook (`src/hooks/useMindMap.ts`)

- D3.js simulation management
- Node and link state management
- Clustering algorithms
- Search and filtering
- Export/import functionality

## 🎨 Styling & Themes

### Tailwind Integration

All components are built with Tailwind CSS classes and support:

- Dark/light mode
- Custom color schemes
- Responsive breakpoints
- Animation utilities

### Chart Themes

Analytics components support customizable themes:

```tsx
const customTheme = {
  primary: '#3b82f6',
  secondary: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  background: '#ffffff',
  text: '#1f2937',
  grid: '#e5e7eb',
};
```

## 🚀 Getting Started

### 1. Install Dependencies

The following packages are already installed:

- `d3` & `@types/d3`: For mind map visualization
- `recharts`: For analytics charts
- `framer-motion`: For animations
- `cmdk`: For command palette
- `react-hotkeys-hook`: For keyboard shortcuts
- `react-intersection-observer`: For visibility detection
- `react-use`: For utility hooks

### 2. Import Components

```tsx
// Visualization
import { MindMap } from '@/components/visualization/MindMap';

// Analytics
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

// UX Components
import {
  CommandPalette,
  KeyboardShortcuts,
  TourGuide,
  ToastProvider,
  useToastActions,
} from '@/components/ux';

// Animation utilities
import { AnimatedPage, AnimatedCard, LoadingSpinner } from '@/utils/animations';

// Responsive components
import {
  ResponsiveContainer,
  FlexContainer,
  GridContainer,
} from '@/components/ux/ResponsiveContainer';

// Hooks
import { useBreakpoint } from '@/hooks/responsive';
import { useFocusManagement } from '@/hooks/accessibility';
```

### 3. Wrap Your App

Some components require providers:

```tsx
import { ToastProvider } from '@/components/ux/ToastSystem';

function App() {
  return <ToastProvider>{/* Your app content */}</ToastProvider>;
}
```

### 4. Use Components

```tsx
function Dashboard() {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { showSuccess } = useToastActions();

  return (
    <AnimatedPage variant="fadeIn">
      <ResponsiveContainer
        padding={{ xs: '1rem', lg: '2rem' }}
        maxWidth={{ lg: '1200px' }}
        center
      >
        {/* Analytics Dashboard */}
        <AnalyticsDashboard
          data={analyticsData}
          config={{ timeRange: '24h', autoRefresh: true }}
        />

        {/* Mind Map */}
        <MindMap
          initialNodes={nodes}
          initialLinks={links}
          onNodeClick={node => showSuccess(`Selected: ${node.label}`)}
        />

        {/* Command Palette */}
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
        />
      </ResponsiveContainer>
    </AnimatedPage>
  );
}
```

## 📱 Responsive Breakpoints

The system uses Tailwind CSS breakpoints:

- `xs`: < 640px
- `sm`: ≥ 640px
- `md`: ≥ 768px
- `lg`: ≥ 1024px
- `xl`: ≥ 1280px
- `2xl`: ≥ 1536px

## ♿ Accessibility Features

All components include:

- ARIA labels and descriptions
- Keyboard navigation
- Screen reader announcements
- Focus management
- High contrast mode support
- Reduced motion respect
- Proper semantic HTML

## 🔧 Configuration

### Mind Map Configuration

```tsx
const mindMapConfig = {
  forceStrength: -300,
  linkDistance: 100,
  collideRadius: 30,
  centerForce: 0.1,
  nodeColors: {
    topic: '#3b82f6',
    subtopic: '#06b6d4',
    research: '#10b981',
    expert: '#f59e0b',
    concept: '#8b5cf6',
  },
  clustering: {
    enabled: true,
    algorithm: 'kmeans',
    minClusterSize: 3,
  },
};
```

### Dashboard Configuration

```tsx
const dashboardConfig = {
  timeRange: '24h',
  refreshInterval: 30000,
  autoRefresh: true,
  widgets: {
    pipelineProgress: true,
    tokenUsage: true,
    researchStats: true,
    performance: true,
    userActivity: true,
    costAnalysis: true,
  },
};
```

## 🎯 Best Practices

1. **Performance**: Use React.memo for expensive components, implement virtual scrolling for large datasets
2. **Accessibility**: Always provide alt text, use semantic HTML, implement keyboard navigation
3. **Responsive Design**: Design mobile-first, test on various screen sizes
4. **Animation**: Respect `prefers-reduced-motion`, use transform properties for GPU acceleration
5. **Error Handling**: Provide fallback states, implement error boundaries
6. **Testing**: Write tests for interactive components, test keyboard navigation

## 🐛 Troubleshooting

### Common Issues

1. **D3 not updating**: Ensure proper dependency arrays in useEffect hooks
2. **Charts not responsive**: Wrap charts in ResponsiveContainer from Recharts
3. **Animations stuttering**: Check for performance bottlenecks, reduce complexity
4. **Keyboard navigation not working**: Ensure proper focus management and ARIA attributes
5. **Toast notifications not appearing**: Make sure ToastProvider wraps your app

### Performance Optimization

1. **Large datasets**: Implement virtualization or pagination
2. **Real-time updates**: Use debouncing or throttling
3. **Complex animations**: Use `transform3d` for GPU acceleration
4. **Memory leaks**: Clean up event listeners and subscriptions

## 📚 Additional Resources

- [D3.js Documentation](https://d3js.org/)
- [Recharts Documentation](https://recharts.org/)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [React Accessibility Guidelines](https://react.dev/learn/accessibility)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

This comprehensive visualization and UX system provides STORM with professional-grade interactive components that enhance user experience while maintaining accessibility and performance standards.
