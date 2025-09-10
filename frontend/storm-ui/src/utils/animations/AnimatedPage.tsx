'use client';

import React from 'react';
import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { pageTransitions, transitions } from './transitions';

interface AnimatedPageProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  variant?: keyof typeof pageTransitions;
  stagger?: boolean;
  staggerDelay?: number;
  customVariants?: Variants;
  children: React.ReactNode;
}

export const AnimatedPage: React.FC<AnimatedPageProps> = ({
  variant = 'fadeIn',
  stagger = false,
  staggerDelay = 0.1,
  customVariants,
  children,
  ...props
}) => {
  const variants = customVariants || pageTransitions[variant];

  const containerVariants: Variants = stagger
    ? {
        ...variants,
        animate: {
          ...(typeof variants.animate === 'object' ? variants.animate : {}),
          transition: {
            ...(typeof variants.animate === 'object' &&
            'transition' in variants.animate
              ? (variants.animate as any).transition
              : {}),
            staggerChildren: staggerDelay,
            delayChildren: 0.2,
          },
        },
      }
    : variants;

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={containerVariants}
      transition={transitions.default}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Animated component for staggered children
export const AnimatedChild: React.FC<
  HTMLMotionProps<'div'> & {
    children: React.ReactNode;
  }
> = ({ children, ...props }) => {
  return (
    <motion.div
      variants={{
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
      }}
      transition={transitions.default}
      {...props}
    >
      {children}
    </motion.div>
  );
};
