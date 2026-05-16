create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(email) = 'admin@purchasesales.com'
  );
$$;

drop policy if exists "platform admin view shops" on public.shops;
create policy "platform admin view shops"
on public.shops
for select
using (public.is_platform_admin());

drop policy if exists "platform admin update shops" on public.shops;
create policy "platform admin update shops"
on public.shops
for update
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform admin view profiles" on public.profiles;
create policy "platform admin view profiles"
on public.profiles
for select
using (public.is_platform_admin());

notify pgrst, 'reload schema';
