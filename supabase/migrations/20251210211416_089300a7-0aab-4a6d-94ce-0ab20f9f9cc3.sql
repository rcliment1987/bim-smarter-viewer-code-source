-- Add user_id column to bcf_topics
ALTER TABLE public.bcf_topics 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing permissive public policies
DROP POLICY IF EXISTS "Allow public delete on bcf_topics" ON public.bcf_topics;
DROP POLICY IF EXISTS "Allow public insert on bcf_topics" ON public.bcf_topics;
DROP POLICY IF EXISTS "Allow public read on bcf_topics" ON public.bcf_topics;
DROP POLICY IF EXISTS "Allow public update on bcf_topics" ON public.bcf_topics;

-- Create secure RLS policies (owner only)
CREATE POLICY "Users can view their own bcf_topics"
ON public.bcf_topics
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bcf_topics"
ON public.bcf_topics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bcf_topics"
ON public.bcf_topics
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bcf_topics"
ON public.bcf_topics
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);