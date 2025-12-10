-- Add user_id column to audit_results
ALTER TABLE public.audit_results 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing permissive public policies
DROP POLICY IF EXISTS "Allow public delete on audit_results" ON public.audit_results;
DROP POLICY IF EXISTS "Allow public insert on audit_results" ON public.audit_results;
DROP POLICY IF EXISTS "Allow public read on audit_results" ON public.audit_results;

-- Create secure RLS policies (owner only)
CREATE POLICY "Users can view their own audit_results"
ON public.audit_results
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own audit_results"
ON public.audit_results
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audit_results"
ON public.audit_results
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);