create extension if not exists pgcrypto;

alter table public.shops
  add column if not exists is_approved boolean not null default false,
  add column if not exists is_enabled boolean not null default true,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text;

update public.shops
set is_approved = true,
    is_enabled = true,
    approved_at = coalesce(approved_at, now()),
    approved_by = coalesce(approved_by, 'system')
where approved_at is null
  and created_at < now() - interval '1 minute';

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'admin@purchasesales.com';
$$;

drop policy if exists "platform admin view shops" on public.shops;
create policy "platform admin view shops" on public.shops for select using (public.is_platform_admin());

drop policy if exists "platform admin update shops" on public.shops;
create policy "platform admin update shops" on public.shops for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "platform admin view profiles" on public.profiles;
create policy "platform admin view profiles" on public.profiles for select using (public.is_platform_admin());

drop policy if exists "platform admin view roles" on public.user_roles;
create policy "platform admin view roles" on public.user_roles for select using (public.is_platform_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid;
  v_shop_name text;
begin
  if lower(new.email) = 'admin@purchasesales.com' then
    return new;
  end if;

  v_shop_name := coalesce(new.raw_user_meta_data->>'shop_name', 'My Shop');
  insert into public.shops (name, owner_name, phone, is_approved, is_enabled)
    values (v_shop_name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone', false, true)
    returning id into v_shop_id;

  insert into public.profiles (id, shop_id, full_name, email)
    values (new.id, v_shop_id, new.raw_user_meta_data->>'full_name', new.email);

  insert into public.user_roles (user_id, shop_id, role) values (new.id, v_shop_id, 'admin');
  return new;
end;
$$;

do $$
declare
  admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = 'admin@purchasesales.com' limit 1;

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'admin@purchasesales.com',
      crypt('Admin@PurchaseSales2026$', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"PurchaseSales Admin"}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      admin_id::text,
      admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@purchasesales.com'),
      'email',
      admin_id::text,
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;
end $$;
