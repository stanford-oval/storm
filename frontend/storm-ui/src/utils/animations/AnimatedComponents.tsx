'use client';

import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import {
  cardTransitions,
  buttonAnimations,
  loadingAnimations,
  listTransitions,
  transitions,
} from './transitions';

// Animated Card Component
interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  hover?: boolean;
  lift?: boolean;
  flip?: boolean;
  children: React.ReactNode;
}

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    {
      hover = false,
      lift = false,
      flip = false,
      children,
      className,
      ...props
    },
    ref
  ) => {
    let variants: Variants = {};

    if (hover) variants = cardTransitions.hover;
    if (lift) variants = { ...variants, ...cardTransitions.lift };
    if (flip) variants = { ...variants, ...cardTransitions.flip };

    return (
      <motion.div
        ref={ref}
        variants={variants}
        initial={lift || flip ? 'initial' : hover ? 'rest' : undefined}
        animate={lift || flip ? 'animate' : hover ? 'rest' : undefined}
        whileHover={hover ? 'hover' : undefined}
        exit={lift || flip ? 'exit' : undefined}
        transition={transitions.default}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';

// Animated Button Component
interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
  tap?: boolean;
  hover?: boolean;
  focus?: boolean;
  children: React.ReactNode;
}

export const AnimatedButton = forwardRef<
  HTMLButtonElement,
  AnimatedButtonProps
>(({ tap = true, hover = true, focus = true, children, ...props }, ref) => {
  return (
    <motion.button
      ref={ref}
      whileTap={tap ? buttonAnimations.tap : undefined}
      whileHover={hover ? buttonAnimations.hover : undefined}
      whileFocus={focus ? buttonAnimations.focus : undefined}
      transition={transitions.quick}
      {...props}
    >
      {children}
    </motion.button>
  );
});

AnimatedButton.displayName = 'AnimatedButton';

// Animated List Container
interface AnimatedListProps extends HTMLMotionProps<'div'> {
  stagger?: boolean;
  staggerDelay?: number;
  children: React.ReactNode;
}

export const AnimatedList = forwardRef<HTMLDivElement, AnimatedListProps>(
  ({ stagger = true, staggerDelay = 0.1, children, ...props }, ref) => {
    const variants = stagger
      ? {
          ...listTransitions.container,
          animate: {
            ...listTransitions.container.animate,
            transition: {
              staggerChildren: staggerDelay,
              delayChildren: 0.1,
            },
          },
        }
      : {};

    return (
      <motion.div
        ref={ref}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedList.displayName = 'AnimatedList';

// Animated List Item
interface AnimatedListItemProps extends HTMLMotionProps<'div'> {
  variant?: 'item' | 'itemSlide' | 'itemFade';
  children: React.ReactNode;
}

export const AnimatedListItem = forwardRef<
  HTMLDivElement,
  AnimatedListItemProps
>(({ variant = 'item', children, ...props }, ref) => {
  return (
    <motion.div
      ref={ref}
      variants={listTransitions[variant]}
      transition={transitions.default}
      {...props}
    >
      {children}
    </motion.div>
  );
});

AnimatedListItem.displayName = 'AnimatedListItem';

// Loading Spinner
interface LoadingSpinnerProps extends HTMLMotionProps<'div'> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'pulse' | 'bounce' | 'wave';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'spinner',
  className,
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const baseClasses =
    variant === 'spinner'
      ? `${sizeClasses[size]} border-2 border-gray-200 border-t-blue-500 rounded-full`
      : `${sizeClasses[size]} bg-blue-500 rounded-full`;

  return (
    <motion.div
      variants={loadingAnimations[variant]}
      animate="animate"
      className={`${baseClasses} ${className || ''}`}
      {...props}
    />
  );
};

// Animated Progress Bar
interface AnimatedProgressProps extends HTMLMotionProps<'div'> {
  progress: number;
  height?: string;
  color?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  labelPosition?: 'inside' | 'outside';
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  progress,
  height = '8px',
  color = '#3b82f6',
  backgroundColor = '#e5e7eb',
  showLabel = false,
  labelPosition = 'outside',
  className,
  ...props
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`relative ${className || ''}`}>
      {showLabel && labelPosition === 'outside' && (
        <div className="mb-1 flex justify-between text-sm text-gray-600">
          <span>Progress</span>
          <span>{Math.round(clampedProgress)}%</span>
        </div>
      )}

      <div
        className="w-full overflow-hidden rounded-full"
        style={{ height, backgroundColor }}
      >
        <motion.div
          className="relative flex h-full items-center justify-center rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: '0%' }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          {...props}
        >
          {showLabel && labelPosition === 'inside' && (
            <span className="px-2 text-xs font-medium text-white">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </motion.div>
      </div>
    </div>
  );
};

// Floating Action Button with ripple effect
interface FloatingActionButtonProps extends HTMLMotionProps<'button'> {
  icon: React.ReactNode;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon,
  label,
  position = 'bottom-right',
  className,
  ...props
}) => {
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  return (
    <motion.button
      className={`fixed ${positionClasses[position]} z-50 rounded-full bg-blue-500 p-4 text-white shadow-lg hover:bg-blue-600 ${className || ''}`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={transitions.spring}
      title={label}
      {...props}
    >
      <motion.div whileHover={{ rotate: 15 }} transition={transitions.quick}>
        {icon}
      </motion.div>

      {/* Ripple effect on click */}
      <motion.div
        className="absolute inset-0 rounded-full bg-white opacity-20"
        initial={{ scale: 0 }}
        whileTap={{ scale: 1 }}
        transition={{ duration: 0.2 }}
      />
    </motion.button>
  );
};

// Animated Counter
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1,
  format = val => Math.round(val).toString(),
  className,
}) => {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: duration * 0.3 }}
    >
      <motion.span
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: duration * 0.5 }}
      >
        {format(value)}
      </motion.span>
    </motion.span>
  );
};

// Skeleton Loading Component
interface SkeletonProps extends HTMLMotionProps<'div'> {
  width?: string;
  height?: string;
  rounded?: boolean;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height = '1rem',
  rounded = true,
  lines = 1,
  className,
  ...props
}) => {
  const skeletons = Array.from({ length: lines }, (_, i) => (
    <motion.div
      key={i}
      className={`bg-gray-200 ${rounded ? 'rounded' : ''} ${className || ''}`}
      style={{ width: width || '100%', height }}
      variants={loadingAnimations.pulse}
      animate="animate"
      {...props}
    />
  ));

  return lines > 1 ? (
    <div className="space-y-2">{skeletons}</div>
  ) : (
    skeletons[0]
  );
};
