
-- Table for global announcements
CREATE TABLE public.global_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  block_site BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.global_announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read active announcements
CREATE POLICY "Anyone can view active announcements"
ON public.global_announcements
FOR SELECT
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage announcements"
ON public.global_announcements
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
));

CREATE TRIGGER update_global_announcements_updated_at
BEFORE UPDATE ON public.global_announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
