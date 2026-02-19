
-- Audit log table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Superadmins can read all audit logs
CREATE POLICY "Superadmins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow insert from authenticated users (for logging their own actions)
CREATE POLICY "Authenticated users can create audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Connection logs table for per-tunnel request tracking
CREATE TABLE public.connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tunnel_id UUID NOT NULL REFERENCES public.tunnels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT,
  path TEXT,
  status_code INTEGER,
  latency_ms INTEGER,
  bytes_transferred BIGINT DEFAULT 0,
  source_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.connection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connection logs"
  ON public.connection_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connection logs"
  ON public.connection_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Superadmins can view all connection logs
CREATE POLICY "Superadmins can view all connection logs"
  ON public.connection_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX idx_connection_logs_tunnel_id ON public.connection_logs(tunnel_id);
CREATE INDEX idx_connection_logs_created_at ON public.connection_logs(created_at DESC);

-- Enable realtime for connection logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_logs;

-- Add max_tunnels limit to profiles
ALTER TABLE public.profiles ADD COLUMN max_tunnels INTEGER NOT NULL DEFAULT 5;

-- Add expires_at to tunnels for auto-expiry
ALTER TABLE public.tunnels ADD COLUMN expires_at TIMESTAMPTZ;

-- Function to enforce tunnel rate limit
CREATE OR REPLACE FUNCTION public.check_tunnel_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.tunnels
  WHERE user_id = NEW.user_id;

  SELECT COALESCE(max_tunnels, 5) INTO max_allowed
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Tunnel limit reached. Maximum % tunnels allowed.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_tunnel_limit
  BEFORE INSERT ON public.tunnels
  FOR EACH ROW EXECUTE FUNCTION public.check_tunnel_limit();

-- Function to log audit events via trigger
CREATE OR REPLACE FUNCTION public.log_tunnel_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, target_type, target_id, metadata)
    VALUES (NEW.user_id, 'tunnel.created', 'tunnel', NEW.id::text, jsonb_build_object('type', NEW.type, 'local_port', NEW.local_port, 'public_endpoint', NEW.public_endpoint));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, target_type, target_id, metadata)
    VALUES (OLD.user_id, 'tunnel.deleted', 'tunnel', OLD.id::text, jsonb_build_object('tunnel_id', OLD.tunnel_id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_tunnel_changes
  AFTER INSERT OR DELETE ON public.tunnels
  FOR EACH ROW EXECUTE FUNCTION public.log_tunnel_audit();
