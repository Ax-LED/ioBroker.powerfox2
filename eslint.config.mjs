import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        ignores: [
            'admin/**',        // NEU - admin Ordner ignorieren
            'test/**',         // NEU - test Ordner ignorieren
            '*.d.ts',          // NEU - TypeScript Definition Files ignorieren
        ],
    },
    {
        rules: {
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
