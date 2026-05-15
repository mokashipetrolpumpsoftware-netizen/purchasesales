
-- Enums
create type public.app_role as enum ('admin', 'staff');

-- Shops
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  license text,
  gst text,
  address text,
  phone text,
  created_at timestamptz not null default now()
);

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, shop_id, role)
);

-- Helper: get current user's shop_id
create or replace function public.current_shop_id()
returns uuid language sql stable security definer set search_path = public as $$
  select shop_id from public.profiles where id = auth.uid();
$$;

-- Helper: has role in shop
create or replace function public.has_role(_user_id uuid, _shop_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and shop_id = _shop_id and role = _role);
$$;

-- Domain tables
create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  category text not null,
  batch text,
  expiry date,
  mrp numeric(12,2) not null default 0,
  purchase_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  stock numeric(12,2) not null default 0,
  unit text,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  due numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  due numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  invoice_no text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  date date not null default current_date,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'Paid',
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  qty numeric(12,2) not null default 1,
  price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  bill_no text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  date date not null default current_date,
  total numeric(12,2) not null default 0,
  status text not null default 'Received',
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  batch text,
  expiry date,
  qty numeric(12,2) not null default 1,
  price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  date date not null default current_date,
  party text not null,
  type text not null check (type in ('Debit','Credit')),
  amount numeric(12,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.ledger_entries enable row level security;

-- Shops policies
create policy "members view shop" on public.shops for select using (id = public.current_shop_id());
create policy "admins update shop" on public.shops for update using (public.has_role(auth.uid(), id, 'admin'));

-- Profiles policies
create policy "view profiles in shop" on public.profiles for select using (shop_id = public.current_shop_id());
create policy "users update own profile" on public.profiles for update using (id = auth.uid());

-- User roles policies
create policy "view roles in shop" on public.user_roles for select using (shop_id = public.current_shop_id());
create policy "admins manage roles" on public.user_roles for all
  using (public.has_role(auth.uid(), shop_id, 'admin'))
  with check (public.has_role(auth.uid(), shop_id, 'admin'));

-- Generic per-shop policy macro for the rest
do $$
declare t text;
begin
  foreach t in array array['products','customers','suppliers','sales','purchases','ledger_entries']
  loop
    execute format($f$
      create policy "shop members read %1$s" on public.%1$I for select using (shop_id = public.current_shop_id());
      create policy "shop members insert %1$s" on public.%1$I for insert with check (shop_id = public.current_shop_id());
      create policy "shop members update %1$s" on public.%1$I for update using (shop_id = public.current_shop_id());
      create policy "shop members delete %1$s" on public.%1$I for delete using (shop_id = public.current_shop_id());
    $f$, t);
  end loop;
end $$;

-- sale_items / purchase_items via parent shop check
create policy "read sale_items" on public.sale_items for select using (
  exists (select 1 from public.sales s where s.id = sale_id and s.shop_id = public.current_shop_id())
);
create policy "write sale_items" on public.sale_items for all using (
  exists (select 1 from public.sales s where s.id = sale_id and s.shop_id = public.current_shop_id())
) with check (
  exists (select 1 from public.sales s where s.id = sale_id and s.shop_id = public.current_shop_id())
);

create policy "read purchase_items" on public.purchase_items for select using (
  exists (select 1 from public.purchases p where p.id = purchase_id and p.shop_id = public.current_shop_id())
);
create policy "write purchase_items" on public.purchase_items for all using (
  exists (select 1 from public.purchases p where p.id = purchase_id and p.shop_id = public.current_shop_id())
) with check (
  exists (select 1 from public.purchases p where p.id = purchase_id and p.shop_id = public.current_shop_id())
);

-- Signup trigger: create shop, profile, admin role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid;
  v_shop_name text;
begin
  v_shop_name := coalesce(new.raw_user_meta_data->>'shop_name', 'My Shop');
  insert into public.shops (name, owner_name, phone)
    values (v_shop_name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
    returning id into v_shop_id;

  insert into public.profiles (id, shop_id, full_name, email)
    values (new.id, v_shop_id, new.raw_user_meta_data->>'full_name', new.email);

  insert into public.user_roles (user_id, shop_id, role) values (new.id, v_shop_id, 'admin');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
