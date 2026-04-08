module.exports = [
  {
    extends: ['expo', 'prettier'],
    plugins: {
      prettier: require('eslint-plugin-prettier'),
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
