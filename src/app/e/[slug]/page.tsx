import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import type { PublicEventResponse } from "@/lib/api";
import { formatRange } from "@/lib/datetime";
import { TicketPurchase } from "@/components/buyer/ticket-purchase";

// Página pública: se renderiza en el servidor en cada visita (el organizador puede publicar o cancelar en cualquier momento).
export const instant = false;

const API_URL = process.env.API_URL ?? "http://localhost:8080";

async function fetchEvent(slug: string): Promise<PublicEventResponse | null> {
  const res = await fetch(`${API_URL}/api/public/events/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo cargar el evento (${res.status})`);
  return res.json();
}

function summary(text: string | undefined, fallback: string) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) return { title: "Evento no encontrado", robots: { index: false } };

  const description = summary(event.description, `${event.title} — organizado por ${event.organizationName}`);
  const images = event.coverUrl ? [{ url: event.coverUrl }] : undefined;
  return {
    title: event.title,
    description,
    alternates: { canonical: `/e/${event.slug}` },
    openGraph: { type: "website", title: event.title, description, url: `/e/${event.slug}`, images },
    twitter: { card: event.coverUrl ? "summary_large_image" : "summary", title: event.title, description },
  };
}

export default async function PublicEventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) notFound();

  const cancelled = event.status === "CANCELLED";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: summary(event.description, event.title),
    eventStatus: cancelled ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    startDate: event.sessions[0]?.startsAt,
    endDate: event.sessions.at(-1)?.endsAt,
    organizer: { "@type": "Organization", name: event.organizationName },
    ...(event.sessions[0]?.venue && {
      location: {
        "@type": "Place",
        name: event.sessions[0].venue.name,
        address: [event.sessions[0].venue.address, event.sessions[0].venue.city, event.sessions[0].venue.country].filter(Boolean).join(", "),
      },
    }),
  };

  return (
    <main className="flex-1 bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Juntia</span>
          <ThemeToggle />
        </div>

        {event.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt={`Portada de ${event.title}`} className="max-h-96 w-full rounded-xl border object-cover" />
        )}

        <header className="space-y-2">
          {cancelled && (
            <p role="status" className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              Este evento fue cancelado.{event.cancelReason ? ` ${event.cancelReason}` : ""}
            </p>
          )}
          <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
          <p className="text-muted-foreground">Organiza {event.organizationName}</p>
        </header>

        {event.description && <p className="whitespace-pre-line leading-7">{event.description}</p>}

        <section aria-labelledby="sessions" className="space-y-3">
          <h2 id="sessions" className="text-xl font-semibold">
            {event.sessions.length > 1 ? "Programa" : "Fecha y lugar"}
          </h2>
          <ul className="divide-y rounded-lg border">
            {event.sessions.map((s) => (
              <li key={s.id} className="space-y-1 p-4">
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{formatRange(s.startsAt, s.endsAt, event.timezone)}</p>
                {s.venue && (
                  <p className="text-sm">
                    {s.venue.name}
                    {[s.venue.address, s.venue.city].filter(Boolean).length > 0 && (
                      <span className="text-muted-foreground"> · {[s.venue.address, s.venue.city].filter(Boolean).join(", ")}</span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Horario de {event.timezone}.</p>
        </section>

        {event.ticketTypes.length > 0 && !cancelled && (
          <TicketPurchase slug={event.slug} timezone={event.timezone} sessions={event.sessions} ticketTypes={event.ticketTypes} />
        )}
      </div>
    </main>
  );
}
