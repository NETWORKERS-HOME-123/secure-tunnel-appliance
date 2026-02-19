
-- Webhook delivery logs table
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event text NOT NULL,
  status_code integer,
  response_body text,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhook deliveries"
  ON public.webhook_deliveries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_webhook_deliveries_webhook_id ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_created_at ON public.webhook_deliveries(created_at DESC);

-- Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team RLS: members can view their teams
CREATE POLICY "Team members can view teams"
  ON public.teams FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_id = teams.id AND user_id = auth.uid()));

CREATE POLICY "Team owners can update teams"
  ON public.teams FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Team owners can delete teams"
  ON public.teams FOR DELETE
  USING (owner_id = auth.uid());

-- Team members RLS
CREATE POLICY "Team members can view members"
  ON public.team_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid()));

CREATE POLICY "Team admins can manage members"
  ON public.team_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')));

CREATE POLICY "Team admins can update members"
  ON public.team_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')));

CREATE POLICY "Team admins can remove members"
  ON public.team_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')));

-- Status incidents table for public status page
CREATE TABLE public.status_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
  affected_component text NOT NULL DEFAULT 'relay',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;

-- Status incidents are publicly readable
CREATE POLICY "Anyone can view status incidents"
  ON public.status_incidents FOR SELECT
  USING (true);

-- Only superadmins can manage incidents
CREATE POLICY "Superadmins can manage incidents"
  ON public.status_incidents FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Custom subdomains table
CREATE TABLE public.subdomain_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subdomain text NOT NULL UNIQUE,
  tunnel_id uuid REFERENCES public.tunnels(id) ON DELETE SET NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subdomain_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subdomains"
  ON public.subdomain_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subdomains"
  ON public.subdomain_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subdomains"
  ON public.subdomain_claims FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subdomains"
  ON public.subdomain_claims FOR DELETE
  USING (auth.uid() = user_id);

-- Add onboarding_completed to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system';

-- Triggers for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_status_incidents_updated_at BEFORE UPDATE ON public.status_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for status incidents
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_incidents;
