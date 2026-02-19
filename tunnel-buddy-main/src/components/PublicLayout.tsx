import { useState, useCallback, useMemo, type ReactNode } from "react";
import { Terminal, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function PublicLayout({ children, activeSection }: { children: ReactNode; activeSection?: string | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLanding = location.pathname === "/landing" || location.pathname === "/";

  const isActive = useCallback((path: string, hash?: string) => {
    // On landing page, prefer intersection observer result
    if (hash && isLanding && activeSection) {
      return `#${activeSection}` === hash;
    }
    if (hash) {
      return isLanding && location.hash === hash;
    }
    return location.pathname === path;
  }, [location.pathname, location.hash, isLanding, activeSection]);

  const linkClass = useCallback((path: string, hash?: string) =>
    cn("transition-colors", isActive(path, hash) ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"),
    [isActive]
  );

  const handleHashLink = useCallback((e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (location.pathname === "/landing" || location.pathname === "/") {
      e.preventDefault();
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/landing" className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold font-mono tracking-tight">UltraSlim</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <Link to="/landing#features" onClick={(e) => handleHashLink(e, "#features")} className={linkClass("/landing", "#features")}>Features</Link>
            <Link to="/landing#pricing" onClick={(e) => handleHashLink(e, "#pricing")} className={linkClass("/landing", "#pricing")}>Pricing</Link>
            <Link to="/status" className={linkClass("/status")}>Status</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md px-6 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-3 text-sm">
              <Link to="/landing#features" onClick={(e) => { setMobileOpen(false); handleHashLink(e, "#features"); }} className={cn("py-2", linkClass("/landing", "#features"))}>Features</Link>
              <Link to="/landing#pricing" onClick={(e) => { setMobileOpen(false); handleHashLink(e, "#pricing"); }} className={cn("py-2", linkClass("/landing", "#pricing"))}>Pricing</Link>
              <Link to="/status" onClick={() => setMobileOpen(false)} className={cn("py-2", linkClass("/status"))}>Status</Link>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <Button variant="ghost" className="w-full justify-center" onClick={() => { setMobileOpen(false); navigate("/auth"); }}>
                Sign In
              </Button>
              <Button className="w-full justify-center" onClick={() => { setMobileOpen(false); navigate("/auth"); }}>
                Get Started
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <div className="flex-1">{children}</div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="font-mono font-semibold text-foreground">UltraSlim</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/status" className="hover:text-foreground transition-colors">Status</Link>
            <Link to="/landing#pricing" onClick={(e) => handleHashLink(e, "#pricing")} className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
          <p>© 2026 UltraSlim. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
