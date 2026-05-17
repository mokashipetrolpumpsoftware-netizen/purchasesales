alter table public.shops
  add column if not exists logo_url text;

notify pgrst, 'reload schema';
