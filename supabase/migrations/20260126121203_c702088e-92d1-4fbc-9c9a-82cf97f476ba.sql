-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'payment_approved', 'payment_rejected', 'complaint_response'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID, -- payment_request_id or movie_id
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Create complaints table
CREATE TABLE public.payment_complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'rejected'
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_complaints ENABLE ROW LEVEL SECURITY;

-- RLS policies for complaints
CREATE POLICY "Users can view their own complaints"
  ON public.payment_complaints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create complaints"
  ON public.payment_complaints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all complaints"
  ON public.payment_complaints FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update complaints"
  ON public.payment_complaints FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create storage bucket for complaint images if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('complaint-images', 'complaint-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for complaint images
CREATE POLICY "Anyone can view complaint images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'complaint-images');

CREATE POLICY "Authenticated users can upload complaint images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'complaint-images' AND auth.role() = 'authenticated');

-- Fix payment-proofs bucket - make it public for viewing
UPDATE storage.buckets SET public = true WHERE id = 'payment-proofs';

-- Storage policies for payment proofs
CREATE POLICY "Anyone can view payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');