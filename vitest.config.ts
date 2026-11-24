import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Only what the component tests (P4, ekido-ai/ekido-internal#45) need: the "@/" path alias from tsconfig.json. JSX
// follows tsconfig's "react-jsx". Tests run in Node unless a file asks for `// @vitest-environment happy-dom`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
