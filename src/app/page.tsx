import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background p-8 text-foreground">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Juntia</h1>
      <p className="text-muted-foreground">Plataforma de eventos y boletos.</p>
      <Button>Empezar</Button>
    </main>
  );
}
