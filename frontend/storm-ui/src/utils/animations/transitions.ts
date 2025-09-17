import { Variants, Transition } from 'framer-motion';

// Common easing functions
export const easings = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 100, damping: 20 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
} as const;

// Page transition variants
export const pageTransitions: Record<string, Variants> = {
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
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  scaleCenter: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(4px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(4px)' },
  },
  rotateIn: {
    initial: { opacity: 0, rotate: -10, scale: 0.95 },
    animate: { opacity: 1, rotate: 0, scale: 1 },
    exit: { opacity: 0, rotate: 10, scale: 0.95 },
  },
};

// Modal/Dialog transitions
export const modalTransitions: Record<string, Variants> = {
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
  drawer: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },
  slideModal: {
    initial: { opacity: 0, y: '100%' },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: '100%' },
  },
};

// List animation variants
export const listTransitions: Record<string, Variants> = {
  container: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
    exit: {
      transition: {
        staggerChildren: 0.05,
        staggerDirection: -1,
      },
    },
  },
  item: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.95 },
  },
  itemSlide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  itemFade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
};

// Button/interaction animations
export const buttonAnimations = {
  tap: { scale: 0.98 },
  hover: { scale: 1.02 },
  focus: { scale: 1.01 },
};

// Card animations
export const cardTransitions: Record<string, Variants> = {
  hover: {
    rest: { scale: 1, y: 0, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    hover: {
      scale: 1.02,
      y: -2,
      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
      transition: { duration: 0.2 },
    },
  },
  lift: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  },
  flip: {
    initial: { rotateY: 90, opacity: 0 },
    animate: { rotateY: 0, opacity: 1 },
    exit: { rotateY: -90, opacity: 0 },
  },
};

// Loading animations
export const loadingAnimations: Record<string, Variants> = {
  spinner: {
    animate: {
      rotate: 360,
      transition: { duration: 1, repeat: Infinity, ease: 'linear' },
    },
  },
  pulse: {
    animate: {
      scale: [1, 1.1, 1],
      opacity: [0.7, 1, 0.7],
      transition: { duration: 1.5, repeat: Infinity },
    },
  },
  bounce: {
    animate: {
      y: [0, -10, 0],
      transition: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  wave: {
    animate: {
      scale: [1, 1.2, 1],
      transition: {
        duration: 1,
        repeat: Infinity,
        repeatDelay: 0.5,
        ease: 'easeInOut',
      },
    },
  },
};

// Progress animations
export const progressAnimations: Record<string, Variants> = {
  bar: {
    initial: { width: '0%' },
    animate: (progress: number) => ({
      width: `${progress}%`,
      transition: { duration: 0.5, ease: 'easeOut' },
    }),
  },
  circle: {
    initial: { pathLength: 0 },
    animate: (progress: number) => ({
      pathLength: progress / 100,
      transition: { duration: 0.5, ease: 'easeOut' },
    }),
  },
};

// Notification animations
export const notificationTransitions: Record<string, Variants> = {
  slideInRight: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
  },
  slideInTop: {
    initial: { y: '-100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '-100%', opacity: 0 },
  },
  slideInBottom: {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
  },
  bounce: {
    initial: { scale: 0.3, opacity: 0 },
    animate: {
      scale: 1,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 20 },
    },
    exit: { scale: 0.3, opacity: 0 },
  },
};

// Common transition configurations
export const transitions: Record<string, Transition> = {
  default: { duration: 0.3, ease: easings.easeInOut },
  quick: { duration: 0.2, ease: easings.easeOut },
  slow: { duration: 0.5, ease: easings.easeInOut },
  spring: easings.spring,
  gentle: easings.gentle,
  bouncy: easings.bouncy,
};
