import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";
//@ts-ignore
import { fileURLToPath } from "url";
//@ts-ignore
import { dirname } from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    glsl({
      include: [
        "**/*.glsl",
        "**/*.vert",
        "**/*.frag",
        "public/**/*.vert",
        "public/**/*.frag",
      ],
      defaultExtension: "glsl",
      compress: false,
      watch: true,
    }),
  ],
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
  assetsInclude: ["**/*.vert", "**/*.frag"],
});
