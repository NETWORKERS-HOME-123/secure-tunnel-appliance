import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/PublicLayout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center p-4 grid-bg">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-mono text-lg font-bold tracking-tight">UltraSlim</span>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <p className="font-mono text-6xl font-bold text-primary">404</p>
            <p className="text-sm text-muted-foreground">
              The route <span className="font-mono text-foreground">{location.pathname}</span> does not exist.
            </p>
            <Link to="/">
              <Button variant="outline" className="w-full">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default NotFound;
