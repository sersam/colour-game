const { FlatCompat } = require('@eslint/eslintrc');
const prettierPlugin = require('eslint-plugin-prettier');

const compat = new FlatCompat();

module.exports = [
  ...compat.extends('expo', 'prettier'),
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
