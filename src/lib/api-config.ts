import type { CreateClientConfig } from "@/lib/api/client.gen";

// Rutas relativas: next.config.ts reenvía /api al backend.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: "",
  credentials: "include",
});
