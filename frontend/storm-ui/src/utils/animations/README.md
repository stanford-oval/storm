# Animation Utilities

Comprehensive animation utilities built with Framer Motion for smooth, accessible animations.

## Components

### AnimatedPage

Page transition wrapper with predefined animation variants.

**Usage:**

```tsx
import { AnimatedPage } from '@/utils/animations/AnimatedPage';

function MyPage() {
  return (
    <AnimatedPage variant="fadeIn" stagger>
      <h1>Page Title</h1>
      <p>Page content</p>
    </AnimatedPage>
  );
}
```

**Variants:**

- `fadeIn`: Simple opacity transition
- `slideUp/Down/Left/Right`: Slide animations
- `scale`: Scale-based transitions
- `blur`: Blur effect transitions
- `rotateIn`: Rotation with scale

### Animated Components

#### AnimatedCard

Interactive card with hover and interaction effects.

```tsx
import { AnimatedCard } from '@/utils/animations/AnimatedComponents';

<AnimatedCard hover lift>
  <h3>Card Title</h3>
  <p>Card content</p>
</AnimatedCard>;
```

#### AnimatedButton

Enhanced button with micro-interactions.

```tsx
import { AnimatedButton } from '@/utils/animations/AnimatedComponents';

<AnimatedButton
  tap
  hover
  focus
  onClick={handleClick}
  className="rounded bg-blue-500 px-4 py-2 text-white"
>
  Click Me
</AnimatedButton>;
```

#### AnimatedList / AnimatedListItem

Staggered list animations.

```tsx
import {
  AnimatedList,
  AnimatedListItem,
} from '@/utils/animations/AnimatedComponents';

<AnimatedList stagger staggerDelay={0.1}>
  {items.map((item, index) => (
    <AnimatedListItem key={item.id} variant="item">
      {item.content}
    </AnimatedListItem>
  ))}
</AnimatedList>;
```

#### LoadingSpinner

Customizable loading indicators.

```tsx
import { LoadingSpinner } from '@/utils/animations/AnimatedComponents';

<LoadingSpinner size="lg" variant="bounce" />;
```

**Variants:**

- `spinner`: Rotating circle
- `pulse`: Pulsing effect
- `bounce`: Bouncing animation
- `wave`: Wave-like animation

#### AnimatedProgress

Smooth progress bar animations.

```tsx
import { AnimatedProgress } from '@/utils/animations/AnimatedComponents';

<AnimatedProgress
  progress={75}
  height="12px"
  color="#3b82f6"
  showLabel
  labelPosition="inside"
/>;
```

#### FloatingActionButton

Animated floating action button with ripple effects.

```tsx
import { FloatingActionButton } from '@/utils/animations/AnimatedComponents';
import { Plus } from 'lucide-react';

<FloatingActionButton
  icon={<Plus size={24} />}
  label="Add New Item"
  position="bottom-right"
  onClick={handleAdd}
/>;
```

#### AnimatedCounter

Number counter with smooth transitions.

```tsx
import { AnimatedCounter } from '@/utils/animations/AnimatedComponents';

<AnimatedCounter
  value={1234}
  duration={2}
  format={val => val.toLocaleString()}
/>;
```

#### Skeleton

Loading skeleton with pulse animation.

```tsx
import { Skeleton } from '@/utils/animations/AnimatedComponents';

<Skeleton width="200px" height="20px" lines={3} />;
```

## Animation Variants

### Page Transitions

```typescript
const pageTransitions = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  // ... more variants
};
```

### Modal Transitions

```typescript
const modalTransitions = {
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  modal: {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  },
};
```

### List Animations

```typescript
const listTransitions = {
  container: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.95 },
  },
};
```

## Easing Functions

Predefined easing curves for consistent animations:

```typescript
const easings = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 100, damping: 20 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
};
```

## Usage Examples

### Page Navigation

```tsx
import { AnimatedPage } from '@/utils/animations';
import { AnimatePresence } from 'framer-motion';

function App() {
  return (
    <AnimatePresence mode="wait">
      <AnimatedPage key={router.pathname} variant="slideUp">
        <Component {...pageProps} />
      </AnimatedPage>
    </AnimatePresence>
  );
}
```

### Modal Implementation

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { modalTransitions } from '@/utils/animations';

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            variants={modalTransitions.backdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            variants={modalTransitions.modal}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### Staggered Grid

```tsx
import { motion } from 'framer-motion';
import { listTransitions } from '@/utils/animations';

function Grid({ items }) {
  return (
    <motion.div
      variants={listTransitions.container}
      initial="initial"
      animate="animate"
      className="grid grid-cols-3 gap-4"
    >
      {items.map(item => (
        <motion.div
          key={item.id}
          variants={listTransitions.item}
          className="rounded-lg bg-white p-4 shadow"
        >
          {item.content}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

## Accessibility

All animations respect user preferences:

```typescript
// Automatically disabled if user prefers reduced motion
const shouldAnimate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Use in components
<motion.div
  initial={shouldAnimate ? "initial" : false}
  animate={shouldAnimate ? "animate" : false}
  // ...
/>
```

## Performance Tips

1. **Use transform properties**: Animate `x`, `y`, `scale`, `rotate` for GPU acceleration
2. **Avoid animating layout properties**: Don't animate `width`, `height`, `top`, `left`
3. **Use `layoutId` for shared element transitions**
4. **Implement proper cleanup**: Remove event listeners and cancel animations
5. **Use `will-change` sparingly**: Only when needed for smooth animations

## Best Practices

1. **Consistent timing**: Use standardized durations and easing
2. **Meaningful motion**: Animations should enhance UX, not distract
3. **Responsive animations**: Scale complexity based on device capabilities
4. **Progressive enhancement**: Ensure functionality without animations
5. **Test on low-end devices**: Verify performance across device range
