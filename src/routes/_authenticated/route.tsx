import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking your session…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <Outlet />
    </div>
  );
}
