import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            globals: {
                require: 'readonly',
            },
        },
        rules: {
            // Deine bisherigen Regeln übernehmen:
            'indent': ['error', 4, { SwitchCase: 1 }],
            'no-console': 'off',
            'no-trailing-spaces': 'error',
            'quotes': ['error', 'single', {
                avoidEscape: true,
                allowTemplateLiterals: true,
            }],
            'semi': ['error', 'always'],
        },
    },
];
