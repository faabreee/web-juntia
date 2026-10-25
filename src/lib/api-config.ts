import type { CreateClientConfig } from "@/lib/api/client.gen";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
});
