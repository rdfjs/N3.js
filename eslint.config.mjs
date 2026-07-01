import globals from 'globals';
import importX from 'eslint-plugin-import-x';
import jest from 'eslint-plugin-jest';

// Flat-config migration of the former .eslintrc files.
// Rules are preserved 1:1; the `import/*` namespace is provided by
// eslint-plugin-import-x as `import-x/*`. The only dropped rule is the
// deprecated core rule `valid-jsdoc` (removed from ESLint, and it was
// already disabled in the previous configuration).
export default [
  {
    ignores: [
      'lib/**',
      'browser/**',
      'docs/**',
      'coverage/**',
      '.nyc_output/**',
      '.rdf-test-suite-cache/**',
      'perf/data/**',
    ],
  },

  // Base configuration (was the root .eslintrc), applied to all sources.
  {
    files: ['**/*.js'],

    plugins: {
      'import-x': importX,
    },

    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },

    rules: {
      // import-x/recommended (was plugin:import/recommended)
      ...importX.flatConfigs.recommended.rules,

      // Possible Errors
      'comma-dangle': [2, 'always-multiline'],
      'no-cond-assign': 0,
      'no-console': 2,
      'no-constant-condition': 0,
      'no-debugger': 2,
      'no-dupe-args': 2,
      'no-dupe-keys': 2,
      'no-duplicate-case': 2,
      'no-empty': 2,
      'no-empty-character-class': 2,
      'no-ex-assign': 2,
      'no-extra-boolean-cast': 2,
      'no-extra-parens': 0,
      'no-extra-semi': 2,
      'no-func-assign': 2,
      'no-inner-declarations': 2,
      'no-invalid-regexp': 2,
      'no-irregular-whitespace': 2,
      'no-negated-in-lhs': 2,
      'no-obj-calls': 2,
      'no-regex-spaces': 2,
      'no-sparse-arrays': 2,
      'no-unreachable': 2,
      'use-isnan': 2,
      'valid-typeof': 2,
      'no-unexpected-multiline': 2,

      // Best Practices
      'accessor-pairs': 2,
      'block-scoped-var': 2,
      complexity: 0,
      'consistent-return': 0,
      curly: 0,
      'default-case': 0,
      'dot-notation': 2,
      'dot-location': [2, 'property'],
      eqeqeq: 2,
      'guard-for-in': 0,
      'no-alert': 2,
      'no-caller': 2,
      'no-div-regex': 2,
      'no-else-return': 0,
      'no-labels': 2,
      'no-eq-null': 2,
      'no-eval': 2,
      'no-extend-native': 2,
      'no-extra-bind': 2,
      'no-fallthrough': 0,
      'no-floating-decimal': 2,
      'no-implicit-coercion': 0,
      'no-implied-eval': 2,
      'no-invalid-this': 2,
      'no-iterator': 2,
      'no-lone-blocks': 2,
      'no-loop-func': 2,
      'no-multi-spaces': 0,
      'no-multi-str': 2,
      'no-native-reassign': 2,
      'no-new-func': 2,
      'no-new-wrappers': 2,
      'no-new': 2,
      'no-octal-escape': 2,
      'no-octal': 2,
      'no-param-reassign': 0,
      'no-process-env': 2,
      'no-proto': 2,
      'no-redeclare': 2,
      'no-return-assign': 0,
      'no-script-url': 2,
      'no-self-compare': 2,
      'no-sequences': 0, // allow the comma operator
      'no-throw-literal': 2,
      'no-unused-expressions': 0,
      'no-useless-call': 2,
      'no-void': 2,
      'no-warning-comments': 2,
      'no-with': 2,
      radix: 2,
      'vars-on-top': 0,
      'wrap-iife': [2, 'inside'],
      yoda: 2,

      // Strict Mode
      strict: [2, 'never'],

      // Variables
      'init-declarations': 0,
      'no-catch-shadow': 2,
      'no-delete-var': 2,
      'no-label-var': 2,
      'no-shadow-restricted-names': 2,
      'no-shadow': 0,
      'no-undef-init': 2,
      'no-undef': 2,
      'no-undefined': 0,
      // `caughtErrors: 'none'` restores the ESLint 8 default (ESLint 9 changed
      // it to 'all'), preserving the previous behaviour of allowing unused
      // catch bindings.
      'no-unused-vars': [2, { args: 'none', caughtErrors: 'none' }],
      'no-use-before-define': [2, { functions: false, classes: false }],

      // Node.js
      'callback-return': 0,
      'handle-callback-err': 2,
      'no-mixed-requires': 2,
      'no-new-require': 2,
      'no-path-concat': 2,
      'no-process-exit': 2,
      'no-restricted-modules': 2,
      'no-sync': 2,

      // Stylistic Issues
      'array-bracket-spacing': 2,
      'arrow-parens': [2, 'as-needed'],
      'block-spacing': 2,
      'brace-style': [2, 'stroustrup', { allowSingleLine: true }],
      camelcase: 2,
      'comma-spacing': 2,
      'comma-style': 2,
      'computed-property-spacing': 2,
      'consistent-this': 0,
      'eol-last': 2,
      'func-names': 0,
      'func-style': [2, 'declaration'],
      'id-length': 0,
      'id-match': 2,
      'indent-legacy': [2, 2, { VariableDeclarator: 2 }],
      'key-spacing': [2, { mode: 'minimum' }],
      'lines-around-comment': 2,
      'linebreak-style': 2,
      'max-nested-callbacks': [2, 1],
      'new-cap': 2,
      'new-parens': 2,
      'newline-after-var': 0,
      'no-array-constructor': 2,
      'no-const-assign': 2,
      'no-continue': 2,
      'no-inline-comments': 0,
      'no-lonely-if': 2,
      'no-mixed-spaces-and-tabs': 2,
      'no-multiple-empty-lines': 0,
      'no-nested-ternary': 0,
      'no-new-object': 2,
      'no-spaced-func': 2,
      'no-ternary': 0,
      'no-trailing-spaces': 2,
      'no-underscore-dangle': 0,
      'no-unneeded-ternary': 2,
      'no-var': 2,
      'object-curly-spacing': [2, 'always'],
      'object-curly-newline': 0,
      'object-property-newline': 0,
      'one-var': 0,
      'operator-assignment': 2,
      'operator-linebreak': [2, 'after', { overrides: { ':': 'ignore' } }],
      'padded-blocks': [2, 'never'],
      'prefer-arrow-callback': 2,
      'prefer-const': 2,
      'prefer-template': 2,
      'quote-props': [2, 'consistent-as-needed'],
      quotes: [2, 'single', 'avoid-escape'],
      'semi-spacing': 2,
      semi: 2,
      'sort-vars': 0,
      'keyword-spacing': 2,
      'space-before-blocks': 2,
      'space-before-function-paren': [2, { anonymous: 'always', named: 'never' }],
      'space-in-parens': 2,
      'space-infix-ops': 2,
      'space-unary-ops': 2,
      'spaced-comment': [2, 'always', { block: { markers: ['!'] } }],
      'template-curly-spacing': 2,
      'wrap-regex': 0,

      // Imports (import/* -> import-x/*)
      'import-x/export': 2,
      'import-x/no-deprecated': 2,
      'import-x/no-empty-named-blocks': 2,
      'import-x/no-extraneous-dependencies': 2,
      'import-x/no-mutable-exports': 2,
      'import-x/no-named-as-default': 2,
      'import-x/no-named-as-default-member': 2,
      // NOTE: ESLint 10 removed the FileEnumerator API this rule relies on, so
      // it is currently a no-op (import-x logs a warning and reports nothing).
      // It was also inert in the previous config (`no-unused-modules: 2` with no
      // `unusedExports`/`missingExports` option reports nothing). Kept enabled
      // with the suppress flag for when import-x restores the API.
      'import-x/no-unused-modules': [2, {
        unusedExports: true,
        suppressMissingFileEnumeratorAPIWarning: true,
      }],
      'import-x/no-amd': 2,
      'import-x/no-commonjs': 2,
      'import-x/no-import-module-exports': 2,
      'import-x/no-nodejs-modules': 0,
      'import-x/unambiguous': 2,
      'import-x/default': 2,
      'import-x/named': 2,
      'import-x/namespace': 2,
      'import-x/no-absolute-path': 2,
      'import-x/no-cycle': 2,
      'import-x/no-dynamic-require': 2,
      'import-x/no-internal-modules': 2,
      'import-x/no-relative-packages': 2,
      'import-x/no-relative-parent-imports': 2,
      'import-x/no-restricted-paths': 2,
      'import-x/no-self-import': 2,
      'import-x/no-unresolved': 2,
      'import-x/no-useless-path-segments': 2,
      'import-x/no-webpack-loader-syntax': 2,
      'import-x/consistent-type-specifier-style': 2,
      'import-x/dynamic-import-chunkname': 2,
      'import-x/exports-last': 0,
      'import-x/extensions': 2,
      'import-x/first': 2,
      'import-x/group-exports': 0,
      'import-x/imports-first': 2,
      'import-x/max-dependencies': [2, { max: 15 }],
      'import-x/newline-after-import': 2,
      'import-x/no-anonymous-default-export': 0,
      'import-x/no-default-export': 0,
      'import-x/no-duplicates': 2,
      'import-x/no-named-default': 0,
      'import-x/no-named-export': 0,
      'import-x/no-namespace': 0,
      'import-x/no-unassigned-import': 2,
      'import-x/order': 2,
      'import-x/prefer-default-export': 0,
    },
  },

  // Tests (was test/.eslintrc). eslint-plugin-jest recommended is applied
  // here only, mirroring the test-only scope of the previous jest rules.
  {
    files: ['test/**'],
    ...jest.configs['flat/recommended'],
  },
  {
    files: ['test/**'],
    languageOptions: {
      globals: {
        describe: true,
        it: true,
        before: true,
        after: true,
        beforeEach: true,
        beforeAll: true,
        afterEach: true,
        expect: true,
      },
    },
    rules: {
      // jest rule overrides (was in the root .eslintrc)
      'jest/no-standalone-expect': 0,
      'jest/expect-expect': 0,
      'jest/no-done-callback': 0,
      'jest/no-identical-title': 0,

      'max-nested-callbacks': 0, // Mocha works with deeply nested callbacks
      'new-cap': 0, // test constructors as regular functions

      'import-x/no-commonjs': 0,
      'import-x/no-internal-modules': 0,
      'import-x/no-nodejs-modules': 0,
      'import-x/no-relative-parent-imports': 0,
      'import-x/unambiguous': 0,
      'import-x/order': [2, {
        groups: [
          'index',
          'sibling',
          'parent',
          'internal',
          'external',
          'builtin',
          'object',
          'type',
        ],
      }],
    },
  },

  // Performance scripts (was perf/.eslintrc)
  {
    files: ['perf/**'],
    rules: {
      'no-console': 0,
      'no-process-exit': 0,

      'import-x/no-commonjs': 0,
      'import-x/no-nodejs-modules': 0,
      'import-x/unambiguous': 0,
    },
  },

  // Spec runner (was spec/.eslintrc)
  {
    files: ['spec/**'],
    rules: {
      'max-nested-callbacks': 0,
      'no-console': 0,
      'no-loop-func': 0,
      'no-process-exit': 0,
      'no-shadow': 0,
      'no-sync': 0,

      'import-x/no-commonjs': 0,
      'import-x/unambiguous': 0,
    },
  },
];
