import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    // Build output only. `.open-next` in particular can hold tens of thousands of
    // generated files, and linting them is both meaningless and very slow.
    ignores: [
      ".next/**",
      ".open-next/**",
      "node_modules/**",
      "uploads/**",
      "public/**",
      "prisma/generated/**",
      "next-env.d.ts",
      "cloudflare-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Server components legitimately pass `unknown`/`any` shaped rows out of Prisma
      // raw queries; keep this a warning so it does not block the build.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
