const { injectAxe, checkA11y, configureAxe } = require('axe-playwright');

module.exports = {
  async preRender(page, story) {
    await injectAxe(page);
  },
  async postRender(page, story) {
    // Configure axe for better accessibility testing
    await configureAxe(page, {
      rules: [
        // Disable specific rules that might not be relevant for Storybook
        { id: 'page-has-heading-one', enabled: false },
        { id: 'landmark-one-main', enabled: false },
        { id: 'region', enabled: false },
      ],
    });

    await checkA11y(page, '#storybook-root', {
      verbose: false,
      axeOptions: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        },
      },
    });
  },
};
