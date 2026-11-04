import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL || env.CERCAGO_API_URL || "";

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    resolve: {
      alias: {
        "react-native": "react-native-web",
        "@react-native/assets-registry/registry": "react-native-web/dist/modules/AssetRegistry/index.js",
      },
      extensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".json"],
    },
    define: {
      global: "globalThis",
      "process.env.CERCAGO_API_URL": JSON.stringify(apiUrl),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
