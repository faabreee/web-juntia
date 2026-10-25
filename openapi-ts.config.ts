import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: process.env.OPENAPI_URL ?? "http://localhost:8080/v3/api-docs",
  output: "src/lib/api",
  plugins: [
    { name: "@hey-api/client-fetch", runtimeConfigPath: "@/lib/api-config" },
  ],
});
