const plugin = require('tailwindcss/plugin');

module.exports = plugin(function ({ addUtilities, addComponents, theme }) {
  addUtilities({
    '.animate-in': {
      animationName: 'enter',
      animationDuration: theme('transitionDuration.150'),
      '--tw-enter-opacity': 'initial',
      '--tw-enter-scale': 'initial',
      '--tw-enter-rotate': 'initial',
      '--tw-enter-translate-x': 'initial',
      '--tw-enter-translate-y': 'initial',
    },
    '.animate-out': {
      animationName: 'exit',
      animationDuration: theme('transitionDuration.150'),
      '--tw-exit-opacity': 'initial',
      '--tw-exit-scale': 'initial',
      '--tw-exit-rotate': 'initial',
      '--tw-exit-translate-x': 'initial',
      '--tw-exit-translate-y': 'initial',
    },
    '.fade-in-0': {
      '--tw-enter-opacity': '0',
    },
    '.fade-out-0': {
      '--tw-exit-opacity': '0',
    },
    '.zoom-in-95': {
      '--tw-enter-scale': '.95',
    },
    '.zoom-out-95': {
      '--tw-exit-scale': '.95',
    },
    '.slide-in-from-top-2': {
      '--tw-enter-translate-y': '-0.5rem',
    },
    '.slide-in-from-bottom-2': {
      '--tw-enter-translate-y': '0.5rem',
    },
    '.slide-in-from-left-2': {
      '--tw-enter-translate-x': '-0.5rem',
    },
    '.slide-in-from-right-2': {
      '--tw-enter-translate-x': '0.5rem',
    },
  });

  addUtilities({
    '@keyframes enter': {
      from: {
        opacity: 'var(--tw-enter-opacity, 1)',
        transform:
          'translate3d(var(--tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0) scale3d(var(--tw-enter-scale, 1), var(--tw-enter-scale, 1), var(--tw-enter-scale, 1)) rotate(var(--tw-enter-rotate, 0))',
      },
    },
    '@keyframes exit': {
      to: {
        opacity: 'var(--tw-exit-opacity, 1)',
        transform:
          'translate3d(var(--tw-exit-translate-x, 0), var(--tw-exit-translate-y, 0), 0) scale3d(var(--tw-exit-scale, 1), var(--tw-exit-scale, 1), var(--tw-exit-scale, 1)) rotate(var(--tw-exit-rotate, 0))',
      },
    },
  });
});
