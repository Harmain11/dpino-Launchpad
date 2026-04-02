import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <h1 className="text-8xl font-black text-primary mb-4 glow-gold">404</h1>
      <h2 className="text-3xl font-bold uppercase tracking-widest mb-6">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mb-8 text-lg">
        The page you are looking for has been moved, deleted, or never existed in the syndicate.
      </p>
      <Link href="/">
        <Button className="h-12 px-8 font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm">
          Return to Home
        </Button>
      </Link>
    </div>
  );
}
