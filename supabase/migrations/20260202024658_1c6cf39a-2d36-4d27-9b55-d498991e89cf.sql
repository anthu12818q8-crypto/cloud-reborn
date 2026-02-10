-- Create RPC to fetch playback URLs without exposing them in movie lists

CREATE OR REPLACE FUNCTION public.get_playback_url(
  p_movie_id uuid,
  p_episode_number integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_can boolean;
  v_url text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT public.can_access_movie(p_movie_id) INTO v_can;
  IF v_can IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_episode_number IS NULL THEN
    SELECT m.video_url INTO v_url
    FROM public.movies m
    WHERE m.id = p_movie_id;
  ELSE
    SELECT e.video_url INTO v_url
    FROM public.episodes e
    WHERE e.movie_id = p_movie_id
      AND e.episode_number = p_episode_number;
  END IF;

  IF v_url IS NULL OR v_url = '' THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_url;
END;
$$;

REVOKE ALL ON FUNCTION public.get_playback_url(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_playback_url(uuid, integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_ad_playback_url(
  p_movie_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_can boolean;
  v_url text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT public.can_access_movie(p_movie_id) INTO v_can;
  IF v_can IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT CASE WHEN m.ad_enabled THEN m.ad_video_url ELSE NULL END
    INTO v_url
  FROM public.movies m
  WHERE m.id = p_movie_id;

  RETURN v_url;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ad_playback_url(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ad_playback_url(uuid) TO authenticated;
