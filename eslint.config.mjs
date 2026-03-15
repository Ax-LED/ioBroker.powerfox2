import config from "@iobroker/eslint-config";

export default [
  ...config,
  {
    ignores: ["admin/**", "test/**", "*.test.js", "lib/**", "**/*.d.ts"],
  },
  {
    rules: {
      "no-console": "off",
      "no-trailing-spaces": "error",
      semi: ["error", "always"],
    },
  },
];
