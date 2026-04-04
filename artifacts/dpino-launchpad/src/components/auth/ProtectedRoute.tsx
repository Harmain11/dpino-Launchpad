import { useUser } from "@clerk/react";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = "/sign-in" }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to={redirectTo} />;
  }

  return <>{children}</>;
}
