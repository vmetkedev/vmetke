import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // тесты намеренно мокают файлы внутри слайсов, поэтому их не проверяем
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
  },
]);