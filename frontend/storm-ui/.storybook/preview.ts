import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#1f2937',
        },
        {
          name: 'storm-light',
          value: '#f8fafc',
        },
        {
          name: 'storm-dark',
          value: '#0f172a',
        },
      ],
    },
    layout: 'centered',
    viewport: {
      viewports: {
        mobile1: {
          name: 'Small Mobile',
          styles: { width: '320px', height: '568px' },
        },
        mobile2: {
          name: 'Large Mobile',
          styles: { width: '414px', height: '896px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1024px', height: '768px' },
        },
        largeDesktop: {
          name: 'Large Desktop',
          styles: { width: '1440px', height: '900px' },
        },
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'autocomplete-valid',
            enabled: false,
          },
          {
            id: 'form-field-multiple-labels',
            enabled: false,
          },
        ],
      },
    },
    docs: {
      toc: {
        contentsSelector: '.sbdocs-content',
        headingSelector: 'h1, h2, h3',
        ignoreSelector: '#primary',
        title: 'Table of Contents',
        disable: false,
        unsafeTocbotOptions: {
          orderedList: false,
        },
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme;
      
      return (
        <div className={theme === 'dark' ? 'dark' : ''} data-theme={theme}>
          <div className="bg-background text-foreground min-h-screen">
            <Story />
          </div>
        </div>
      );
    },
  ],
  tags: ['autodocs'],
};