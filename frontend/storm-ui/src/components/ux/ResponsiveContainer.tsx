'use client';

import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import {
  useBreakpoint,
  useBreakpointValue,
  Breakpoint,
} from '../../hooks/responsive/useBreakpoint';

interface ResponsiveContainerProps
  extends Omit<HTMLMotionProps<'div'>, 'className'> {
  // Responsive padding
  padding?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  };

  // Responsive margin
  margin?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  };

  // Responsive max width
  maxWidth?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  };

  // Grid columns
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };

  // Gap between items
  gap?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  };

  // Display type
  display?: {
    xs?:
      | 'block'
      | 'flex'
      | 'grid'
      | 'inline'
      | 'inline-block'
      | 'inline-flex'
      | 'none';
    sm?:
      | 'block'
      | 'flex'
      | 'grid'
      | 'inline'
      | 'inline-block'
      | 'inline-flex'
      | 'none';
    md?:
      | 'block'
      | 'flex'
      | 'grid'
      | 'inline'
      | 'inline-block'
      | 'inline-flex'
      | 'none';
    lg?:
      | 'block'
      | 'flex'
      | 'grid'
      | 'inline'
      | 'inline-block'
      | 'inline-flex'
      | 'none';
    xl?:
      | 'block'
      | 'flex'
      | 'grid'
      | 'inline'
      | 'inline-block'
      | 'inline-flex'
      | 'none';
    '2xl'?:
      | 'block'
      | 'flex'
      | 'grid'
      | 'inline'
      | 'inline-block'
      | 'inline-flex'
      | 'none';
  };

  // Responsive className
  className?:
    | {
        xs?: string;
        sm?: string;
        md?: string;
        lg?: string;
        xl?: string;
        '2xl'?: string;
      }
    | string;

  // Layout direction
  direction?: {
    xs?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    sm?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    md?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    lg?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    xl?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    '2xl'?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  };

  // Justify content
  justify?: {
    xs?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
    sm?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
    md?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
    lg?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
    xl?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
    '2xl'?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  };

  // Align items
  align?: {
    xs?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
    sm?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
    md?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
    lg?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
    xl?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
    '2xl'?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
  };

  // Whether to center the container
  center?: boolean;

  children: React.ReactNode;
}

export const ResponsiveContainer = forwardRef<
  HTMLDivElement,
  ResponsiveContainerProps
>(
  (
    {
      padding,
      margin,
      maxWidth,
      columns,
      gap,
      display,
      className,
      direction,
      justify,
      align,
      center = false,
      children,
      ...props
    },
    ref
  ) => {
    const breakpoint = useBreakpoint();

    // Always call all hooks to maintain consistent order
    const currentPadding = useBreakpointValue(padding || {});
    const currentMargin = useBreakpointValue(margin || {});
    const currentMaxWidth = useBreakpointValue(maxWidth || {});
    const currentColumns = useBreakpointValue(columns || {});
    const currentGap = useBreakpointValue(gap || {});
    const currentDisplay = useBreakpointValue(display || {});
    const currentDirection = useBreakpointValue(direction || {});
    const currentJustify = useBreakpointValue(justify || {});
    const currentAlign = useBreakpointValue(align || {});
    const responsiveClassName = useBreakpointValue(
      typeof className === 'object' ? className : {}
    );

    // Handle responsive className
    const currentClassName =
      typeof className === 'string' ? className : responsiveClassName;

    // Build styles object
    const styles: React.CSSProperties = {
      ...(currentPadding && { padding: currentPadding }),
      ...(currentMargin && { margin: currentMargin }),
      ...(currentMaxWidth && { maxWidth: currentMaxWidth }),
      ...(currentGap && { gap: currentGap }),
      ...(currentDisplay && { display: currentDisplay }),
      ...(center && { marginLeft: 'auto', marginRight: 'auto' }),
    };

    // Handle grid layout
    if (currentColumns && currentDisplay === 'grid') {
      styles.gridTemplateColumns = `repeat(${currentColumns}, 1fr)`;
    }

    // Handle flex layout
    if (currentDisplay === 'flex' || currentDisplay === 'inline-flex') {
      if (currentDirection) {
        styles.flexDirection =
          currentDirection as React.CSSProperties['flexDirection'];
      }
      if (currentJustify) {
        const justifyMap = {
          start: 'flex-start',
          end: 'flex-end',
          center: 'center',
          between: 'space-between',
          around: 'space-around',
          evenly: 'space-evenly',
        };
        styles.justifyContent = justifyMap[currentJustify];
      }
      if (currentAlign) {
        const alignMap = {
          start: 'flex-start',
          end: 'flex-end',
          center: 'center',
          baseline: 'baseline',
          stretch: 'stretch',
        };
        styles.alignItems = alignMap[currentAlign];
      }
    }

    return (
      <motion.div
        ref={ref}
        style={styles}
        className={currentClassName}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

ResponsiveContainer.displayName = 'ResponsiveContainer';

// Predefined container components
export const FlexContainer = forwardRef<
  HTMLDivElement,
  Omit<ResponsiveContainerProps, 'display'> & {
    wrap?: boolean;
  }
>((props, ref) => (
  <ResponsiveContainer
    ref={ref}
    display={{
      xs: 'flex',
      sm: 'flex',
      md: 'flex',
      lg: 'flex',
      xl: 'flex',
      '2xl': 'flex',
    }}
    style={{
      ...(props.style || {}),
      ...(props.wrap && { flexWrap: 'wrap' }),
    }}
    {...props}
  />
));

FlexContainer.displayName = 'FlexContainer';

export const GridContainer = forwardRef<
  HTMLDivElement,
  Omit<ResponsiveContainerProps, 'display'>
>((props, ref) => (
  <ResponsiveContainer
    ref={ref}
    display={{
      xs: 'grid',
      sm: 'grid',
      md: 'grid',
      lg: 'grid',
      xl: 'grid',
      '2xl': 'grid',
    }}
    {...props}
  />
));

GridContainer.displayName = 'GridContainer';

export const CenteredContainer = forwardRef<
  HTMLDivElement,
  ResponsiveContainerProps
>((props, ref) => (
  <ResponsiveContainer
    ref={ref}
    center
    maxWidth={{
      xs: '100%',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    }}
    padding={{
      xs: '1rem',
      sm: '1.5rem',
      md: '2rem',
      lg: '2rem',
      xl: '2rem',
      '2xl': '2rem',
    }}
    {...props}
  />
));

CenteredContainer.displayName = 'CenteredContainer';

// Responsive Stack component
interface StackProps
  extends Omit<ResponsiveContainerProps, 'display' | 'direction'> {
  spacing?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  };
  horizontal?: {
    xs?: boolean;
    sm?: boolean;
    md?: boolean;
    lg?: boolean;
    xl?: boolean;
    '2xl'?: boolean;
  };
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({ spacing, horizontal, children, ...props }, ref) => {
    const isHorizontal = useBreakpointValue(horizontal || {});
    const currentSpacing = useBreakpointValue(spacing || { xs: '1rem' });

    return (
      <ResponsiveContainer
        ref={ref}
        display={{
          xs: 'flex',
          sm: 'flex',
          md: 'flex',
          lg: 'flex',
          xl: 'flex',
          '2xl': 'flex',
        }}
        direction={
          isHorizontal
            ? {
                xs: 'row',
                sm: 'row',
                md: 'row',
                lg: 'row',
                xl: 'row',
                '2xl': 'row',
              }
            : {
                xs: 'column',
                sm: 'column',
                md: 'column',
                lg: 'column',
                xl: 'column',
                '2xl': 'column',
              }
        }
        gap={spacing || { xs: '1rem' }}
        {...props}
      >
        {children}
      </ResponsiveContainer>
    );
  }
);

Stack.displayName = 'Stack';

// Responsive Show/Hide components
interface ShowHideProps {
  children: React.ReactNode;
  above?: Breakpoint;
  below?: Breakpoint;
  only?: Breakpoint | Breakpoint[];
}

export const Show: React.FC<ShowHideProps> = ({
  children,
  above,
  below,
  only,
}) => {
  const { current, isSmUp, isMdUp, isLgUp, isXlUp, is2xlUp } = useBreakpoint();

  let shouldShow = true;

  if (above) {
    const breakpointMap = {
      sm: isSmUp,
      md: isMdUp,
      lg: isLgUp,
      xl: isXlUp,
      '2xl': is2xlUp,
    };
    shouldShow = breakpointMap[above];
  }

  if (below) {
    const breakpointMap = {
      sm: current === 'xs',
      md: current === 'xs' || current === 'sm',
      lg: current === 'xs' || current === 'sm' || current === 'md',
      xl:
        current === 'xs' ||
        current === 'sm' ||
        current === 'md' ||
        current === 'lg',
      '2xl': current !== '2xl',
    };
    shouldShow = shouldShow && breakpointMap[below];
  }

  if (only) {
    const targets = Array.isArray(only) ? only : [only];
    shouldShow = targets.includes(current as Breakpoint);
  }

  return shouldShow ? <>{children}</> : null;
};

export const Hide: React.FC<ShowHideProps> = props => {
  return <Show {...props}>{null}</Show>;
};
