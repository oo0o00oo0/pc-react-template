import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

//@ts-ignore
import { fileURLToPath } from "url";
//@ts-ignore
import { dirname } from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    open: true,
    fs: {
      // Allow serving files from one level up to the project root
      allow: [
        "public",
        "src",
        "viewer",
        // Add the project root
        dirname(fileURLToPath(import.meta.url)),
      ],
    },
  },
});
