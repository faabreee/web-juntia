import { client } from "@/lib/api/client.gen";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCsrfCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith("XSRF-TOKEN="))
    ?.split("=")[1];
}

let configured = false;

/** Añade el token CSRF (cookie XSRF-TOKEN -> cabecera X-XSRF-TOKEN) a las peticiones que cambian estado. */
export function configureApiClient() {
  if (configured) return;
  configured = true;
  client.interceptors.request.use(async (request) => {
    if (SAFE_METHODS.has(request.method.toUpperCase())) return request;
    let token = readCsrfCookie();
    if (!token) {
      await fetch("/api/auth/csrf", { credentials: "include" });
      token = readCsrfCookie();
    }
    if (token) request.headers.set("X-XSRF-TOKEN", decodeURIComponent(token));
    return request;
  });
}

/** Extrae un mensaje legible de una respuesta de error (ProblemDetail del backend). */
export function errorMessage(error: unknown, fallback = "Algo salió mal. Inténtalo de nuevo."): string {
  if (error && typeof error === "object") {
    const e = error as { detail?: unknown; message?: unknown; errors?: { defaultMessage?: string }[] };
    if (e.errors?.[0]?.defaultMessage) return e.errors[0].defaultMessage;
    if (typeof e.detail === "string" && e.detail) return e.detail;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return fallback;
}
