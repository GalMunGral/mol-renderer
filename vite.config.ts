import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  base: "/mol-renderer/",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});