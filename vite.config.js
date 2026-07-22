import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Alleen voor lokaal ontwikkelen: stuur /api door naar `vercel dev` (poort 3000).
  // In productie op Vercel is dit niet nodig; daar draait alles op één domein.
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
