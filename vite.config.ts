import { defineConfig, loadEnv } from "vite";
import { allowedRead } from "./src/lib/core.mjs";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.AGENT_BACKEND_URL || "http://127.0.0.1:8000";
  return {
    base: process.env.BUILD_BASE_PATH || "/",
    define: { __BACKEND_ID__: JSON.stringify(target) },
    plugins: [
      {
        name: "read-only-backend",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (
              req.url?.startsWith("/agent-api") &&
              !allowedRead(
                req.method || "",
                req.url.replace(/^\/agent-api/, ""),
              )
            ) {
              res.writeHead(405, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  detail:
                    "This connection permits catalog and package reads only.",
                }),
              );
              return;
            }
            next();
          });
        },
      },
    ],
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy: {
        "/agent-api": {
          target,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/agent-api/, ""),
        },
      },
    },
  };
});
