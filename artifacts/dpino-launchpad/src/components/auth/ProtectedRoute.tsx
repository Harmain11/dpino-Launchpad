import { useWallet } from "@solana/wallet-adapter-react";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = "/" }: ProtectedRouteProps) {
  const { connected } = useWallet();
  if (!connected) return <Redirect to={redirectTo} />;
  return <>{children}</>;
}
