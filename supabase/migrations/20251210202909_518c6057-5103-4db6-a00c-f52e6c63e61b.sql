-- Create bcf_topics table for BCF collaboration
CREATE TABLE public.bcf_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  priority TEXT NOT NULL DEFAULT 'Medium',
  assignee TEXT,
  element_id TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_results table for GID audit results
CREATE TABLE public.audit_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  rule_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bcf_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_results ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (for demo purposes - no auth required)
CREATE POLICY "Allow public read on bcf_topics" ON public.bcf_topics
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert on bcf_topics" ON public.bcf_topics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on bcf_topics" ON public.bcf_topics
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on bcf_topics" ON public.bcf_topics
  FOR DELETE USING (true);

CREATE POLICY "Allow public read on audit_results" ON public.audit_results
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert on audit_results" ON public.audit_results
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete on audit_results" ON public.audit_results
  FOR DELETE USING (true);

-- Enable realtime for bcf_topics
ALTER PUBLICATION supabase_realtime ADD TABLE public.bcf_topics;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bcf_topics_updated_at
  BEFORE UPDATE ON public.bcf_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();