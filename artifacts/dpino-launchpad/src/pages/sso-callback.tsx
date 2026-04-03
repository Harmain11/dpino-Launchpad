import { AuthenticateWithRedirectCallback } from "@clerk/react";

export default function SsoCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060606]">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-sm text-zinc-500 uppercase tracking-widest">Signing you in…</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
