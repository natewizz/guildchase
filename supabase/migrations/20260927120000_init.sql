-- Guildchase schema for Supabase Postgres.
-- Run this once in the Supabase SQL editor, or with `supabase db push`.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('owner', 'viewer')),
  created_at timestamptz not null default now()
);

create table public.sets (
  id bigint generated always as identity primary key,
  code text,
  name text not null,
  edition text,
  release_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id bigint generated always as identity primary key,
  set_id bigint not null references public.sets (id) on delete cascade,
  collector_number text not null,
  name text not null,
  artist text not null default '',
  land_type text not null check (land_type in ('Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes', 'Snow')),
  variant_type text not null check (variant_type in ('regular', 'full_art', 'foil_regular', 'foil_full_art')),
  image_url text,
  rarity text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (set_id, collector_number, variant_type)
);

create table public.ownership (
  id bigint generated always as identity primary key,
  card_id bigint not null references public.cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  quantity integer not null default 0,
  is_owned boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, user_id)
);

create index sets_code_idx on public.sets (code);
create index cards_set_collector_idx on public.cards (set_id, collector_number);
create index cards_land_variant_idx on public.cards (land_type, variant_type);
create index ownership_user_owned_idx on public.ownership (user_id, is_owned);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The public site always shows this one collection.
create or replace function public.collection_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where role = 'owner' order by created_at limit 1
$$;

create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with owner as (
    select public.collection_owner_id() as id
  ),
  card_owned as (
    select
      c.set_id,
      c.variant_type,
      c.land_type,
      coalesce(o.is_owned, false) as is_owned
    from public.cards c
    join public.sets s on s.id = c.set_id and s.is_active
    left join public.ownership o
      on o.card_id = c.id
     and o.user_id = (select id from owner)
  ),
  set_variant as (
    select
      set_id,
      variant_type,
      count(*)::int as total,
      count(*) filter (where is_owned)::int as owned
    from card_owned
    group by set_id, variant_type
  ),
  set_rows as (
    select
      s.id,
      s.code,
      s.name,
      coalesce(sum(sv.total), 0)::int as total_cards,
      coalesce(sum(sv.owned), 0)::int as owned_cards,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'type', sv.variant_type,
            'total', sv.total,
            'owned', sv.owned
          )
          order by sv.variant_type
        ) filter (where sv.variant_type is not null),
        '[]'::jsonb
      ) as variants
    from public.sets s
    left join set_variant sv on sv.set_id = s.id
    where s.is_active
    group by s.id
  )
  select jsonb_build_object(
    'sets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'code', r.code,
        'name', r.name,
        'total_cards', r.total_cards,
        'owned_cards', r.owned_cards,
        'variants', r.variants
      ) order by r.name)
      from set_rows r
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', variant_type,
        'total', total,
        'owned', owned
      ))
      from (
        select variant_type, count(*)::int as total, count(*) filter (where is_owned)::int as owned
        from card_owned
        group by variant_type
      ) v
    ), '[]'::jsonb),
    'lands', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', land_type,
        'total', total,
        'owned', owned
      ))
      from (
        select land_type, count(*)::int as total, count(*) filter (where is_owned)::int as owned
        from card_owned
        group by land_type
      ) l
    ), '[]'::jsonb)
  );
$$;

create or replace function public.set_cards(p_set_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'collector_number', c.collector_number,
    'name', c.name,
    'artist', c.artist,
    'land_type', c.land_type,
    'variant_type', c.variant_type,
    'image_url', c.image_url,
    'is_owned', coalesce(o.is_owned, false)
  ) order by c.collector_number, c.variant_type), '[]'::jsonb)
  from public.cards c
  join public.sets s on s.id = c.set_id and s.is_active
  left join public.ownership o
    on o.card_id = c.id
   and o.user_id = public.collection_owner_id()
  where c.set_id = p_set_id;
$$;

create or replace function public.prune_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  excluded text[] := array[
    'FBB', '4BB',
    'PMPS', 'PMPS07', 'PMPS08', 'PMPS09', 'PMPS10', 'PMPS11',
    'PSAL', 'PS11',
    'PDGM',
    'SLD'
  ];
  removed_non_common int := 0;
  removed_star int := 0;
  removed_excluded int := 0;
  deactivated int := 0;
begin
  delete from public.cards
  where rarity is not null
    and rarity <> 'common';
  get diagnostics removed_non_common = row_count;

  delete from public.cards where collector_number like '%★%';
  get diagnostics removed_star = row_count;

  delete from public.cards
  where set_id in (select id from public.sets where upper(code) = any (excluded));
  get diagnostics removed_excluded = row_count;

  update public.sets
  set is_active = false, updated_at = now()
  where upper(code) = any (excluded);

  update public.sets
  set is_active = false, updated_at = now()
  where is_active
    and not exists (select 1 from public.cards c where c.set_id = sets.id);
  get diagnostics deactivated = row_count;

  return jsonb_build_object(
    'removed_non_common', removed_non_common,
    'removed_star', removed_star,
    'removed_excluded', removed_excluded,
    'deactivated', deactivated
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.ownership enable row level security;

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "read active sets"
  on public.sets for select
  to anon, authenticated
  using (is_active);

create policy "read cards in active sets"
  on public.cards for select
  to anon, authenticated
  using (exists (
    select 1 from public.sets s where s.id = set_id and s.is_active
  ));

create policy "read the owner collection"
  on public.ownership for select
  to anon, authenticated
  using (user_id = public.collection_owner_id());

create policy "owner inserts own ownership"
  on public.ownership for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'
    )
  );

create policy "owner updates own ownership"
  on public.ownership for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (user_id = auth.uid());

grant select on public.profiles to authenticated;
grant select on public.sets, public.cards to anon, authenticated;
grant select on public.ownership to anon, authenticated;
grant insert, update on public.ownership to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on public.profiles, public.sets, public.cards, public.ownership to service_role;
grant all on all sequences in schema public to service_role;

revoke all on function public.dashboard_stats() from public;
revoke all on function public.set_cards(bigint) from public;
revoke all on function public.collection_owner_id() from public;
revoke all on function public.prune_catalog() from public;
revoke all on function public.handle_new_user() from public;

grant execute on function public.dashboard_stats() to anon, authenticated;
grant execute on function public.set_cards(bigint) to anon, authenticated;
grant execute on function public.collection_owner_id() to anon, authenticated;
grant execute on function public.prune_catalog() to service_role;
