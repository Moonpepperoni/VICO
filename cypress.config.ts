// cypress.config.ts
import { defineConfig } from "cypress";

export default defineConfig({
    e2e: {
        baseUrl: "http://localhost:5173", // Anpassen an den Port deines Vite-Servers
        viewportWidth: 1280,
        viewportHeight: 800,
        video: false,
        screenshotOnRunFailure: true,
        screenshotsFolder: "cypress/screenshots",
        supportFile: "cypress/support/e2e.ts",
    },
});