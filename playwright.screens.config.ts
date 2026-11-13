import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Capturas del clon para replica-diff: npx playwright test -c playwright.screens.config.ts
export default defineConfig({ ...base, testMatch: "**/*.capture.ts", reporter: "list" });
