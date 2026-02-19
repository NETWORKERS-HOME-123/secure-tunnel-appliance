import { useEffect } from "react";
import { ArrowRight, Check, Terminal, Zap, Shield, Globe, BarChart3, Users, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { PublicLayout } from "@/components/PublicLayout";
import { useActiveSection } from "@/hooks/useActiveSection";
const features = [
  {
    icon: Terminal,
    title: "One-Command Setup",
    description: "Install and connect in seconds. No config files, no DevOps expertise required.",
  },
  {
    icon: Zap,
    title: "Sub-20ms Latency",
    description: "Multi-region cloud relay ensures blazing-fast tunnels with automatic TLS.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Dashboard",
    description: "Monitor requests, bandwidth, and latency across all tunnels from a single pane.",
  },
  {
    icon: Shield,
    title: "API Key Management",
    description: "Generate, rotate, and revoke API keys with fine-grained access controls.",
  },
  {
    icon: Globe,
    title: "Webhook Integrations",
    description: "Route tunnel events to Slack, Discord, PagerDuty, or any HTTP endpoint.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Share tunnels across your team with role-based access and audit logging.",
  },
];

const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individual devs & students",
    tunnels: "3 tunnels",
    bandwidth: "1 GB / mo",
    features: ["HTTP & TCP tunnels", "Real-time dashboard", "Community support"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$10",
    period: "/ month",
    description: "For professional developers",
    tunnels: "10 tunnels",
    bandwidth: "50 GB / mo",
    features: ["Everything in Free", "API key management", "Webhook integrations", "Priority support"],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Team",
    price: "$25",
    period: "/ user / month",
    description: "For startup teams",
    tunnels: "25 tunnels / user",
    bandwidth: "200 GB / mo",
    features: ["Everything in Pro", "Team management", "Audit logging", "SSO (SAML)"],
    cta: "Contact Sales",
    highlight: false,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = useActiveSection(["features", "pricing", "cli"]);

  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    }
  }, [location.hash]);

  return (
    <PublicLayout activeSection={activeSection}>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 text-primary font-mono text-xs">
            Now in Public Beta
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Expose localhost to
            <br />
            <span className="text-primary text-glow">the internet, instantly</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-10">
            One command. Production-grade tunnels. Real-time observability.
            Replace your VPN and ngrok with UltraSlim.
          </p>

          {/* Terminal block */}
          <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-4 text-left font-mono text-sm glow-primary">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-3 w-3 rounded-full bg-destructive/60" />
              <span className="h-3 w-3 rounded-full bg-[hsl(45,80%,50%)]/60" />
              <span className="h-3 w-3 rounded-full bg-primary/60" />
            </div>
            <p className="text-muted-foreground">
              <span className="text-primary">$</span> curl -fsSL https://get.ultraslim.io | sh
            </p>
            <p className="text-muted-foreground mt-1">
              <span className="text-primary">$</span> ultraslim up --port 3000
            </p>
            <p className="mt-2 text-primary">
              ✓ https://myapp.ultraslim.io — live
            </p>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="gap-2" onClick={() => navigate("/auth")}>
              Start for Free <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="gap-2" onClick={() => navigate("/docs")}>
              <Code className="h-4 w-4" /> Read the Docs
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Everything you need, nothing you don't</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            UltraSlim gives you production-grade tunnels with built-in observability — at half the cost of alternatives.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="border-border bg-card hover:border-primary/20 transition-colors">
              <CardHeader>
                <f.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">{f.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">Start free. Scale when you're ready.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.name}
                className={`flex flex-col border-border bg-card ${
                  tier.highlight ? "ring-2 ring-primary glow-primary" : ""
                }`}
              >
                <CardHeader>
                  {tier.highlight && (
                    <Badge className="w-fit mb-2 bg-primary text-primary-foreground text-xs">Most Popular</Badge>
                  )}
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="pt-2">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground ml-1 text-sm">{tier.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">{tier.tunnels}</p>
                    <p>{tier.bandwidth}</p>
                  </div>
                  <ul className="space-y-2 pt-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={tier.highlight ? "default" : "outline"}
                    onClick={() => navigate("/auth")}
                  >
                    {tier.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CLI Preview */}
      <section id="cli" className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-3">Ready in under 5 minutes</h2>
        <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
          Install the agent, authenticate, and expose your first service — it's that simple.
        </p>
        <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-5 text-left font-mono text-sm space-y-1">
          <p className="text-muted-foreground"><span className="text-primary">$</span> curl -fsSL https://get.ultraslim.io | sh</p>
          <p className="text-muted-foreground"><span className="text-primary">$</span> ultraslim connect --token &lt;YOUR_TOKEN&gt;</p>
          <p className="text-muted-foreground"><span className="text-primary">$</span> ultraslim up --port 8080 --type tcp</p>
          <p className="text-primary mt-2">✓ tcp://relay-us.ultraslim.io:43210 → localhost:8080</p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Stop paying too much for tunnels
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of developers who switched to UltraSlim. Start with 3 free tunnels — no credit card required.
          </p>
          <Button size="lg" className="gap-2" onClick={() => navigate("/auth")}>
            Get Started for Free <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
