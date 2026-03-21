CREATE TABLE public.user_feedbacks (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL,
    reporter_name text NOT NULL,
    reporter_email text NOT NULL,
    rating smallint,
    status text NOT NULL DEFAULT 'new'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT user_feedbacks_pkey PRIMARY KEY (id)
);

ALTER TABLE public.user_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for anonymous users" ON public.user_feedbacks FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Enable view for users based on profile_id" ON public.user_feedbacks FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Enable update for users based on profile_id" ON public.user_feedbacks FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = profile_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Enable delete for users based on profile_id" ON public.user_feedbacks FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = profile_id));
