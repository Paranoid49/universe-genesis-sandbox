export const uiRuntimeAliases = [
  { find: "react-dom/test-utils", replacement: "preact/test-utils" },
  { find: "react-dom/client", replacement: "preact/compat/client" },
  { find: "react-dom", replacement: "preact/compat" },
  { find: "react/jsx-runtime", replacement: "preact/jsx-runtime" },
  { find: "react", replacement: "preact/compat" },
];
