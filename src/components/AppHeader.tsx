import { Link, useNavigate } from "@tanstack/react-router";
import { Mic, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function AppHeader() {
  const { firstName, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link to="/new" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mic className="size-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">PrepPilot</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/new">New interview</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/history">History</Link>
          </Button>
          {firstName ? (
            <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">{firstName}</span>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </nav>
      </div>
    </header>
  );
}
