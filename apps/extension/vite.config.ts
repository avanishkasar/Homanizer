import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()], build: { outDir: "dist", rollupOptions: { input: { popup: "popup.html", content: "src/content.ts" }, output: { entryFileNames: "[name].js" } } } });

