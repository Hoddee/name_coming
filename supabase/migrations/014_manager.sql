-- Manager-Spiel (Kreo): Wechsel und Teamnamen für die Manager-Liga.
-- Nur anlegen, nichts an bestehenden Tabellen ändern (gemeinsame Datenbank mit Version 1).
-- Wechsel werden nur angefügt: kein Ändern, kein Löschen. Der Zeitpunkt (created_at) kommt vom Server,
-- Preise werden nie gespeichert – die App rechnet sie aus den Spielen nach, die zu diesem Zeitpunkt schon gespeichert waren.
-- Mehrfach ausführen schadet nicht. Rückgängig machen (löscht alle Manager-Daten):
--   drop table if exists public.manager_moves, public.manager_teams; drop function if exists public.manager_moves_limit();

create table if not exists public.manager_moves (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  season text not null,
  p text not null,
  a text not null,
  created_at timestamptz not null default now()
);
alter table public.manager_moves drop constraint if exists manager_moves_chk;
alter table public.manager_moves add constraint manager_moves_chk
  check (a in ('buy', 'sell') and p ~ '^[A-Za-z0-9_-]{1,64}$' and char_length(season) between 4 and 20);
create index if not exists manager_moves_season_idx on public.manager_moves (season, created_at);

alter table public.manager_moves enable row level security;
drop policy if exists manager_moves_read on public.manager_moves;
create policy manager_moves_read on public.manager_moves for select using (true);
drop policy if exists manager_moves_insert on public.manager_moves;
create policy manager_moves_insert on public.manager_moves for insert to authenticated
  with check (user_id = auth.uid());
-- Supabase gibt neuen Tabellen alle Rechte (auch Ändern/Löschen/Leeren) – erst alles weg, dann nur Lesen und Einfügen.
-- Einfügen nur mit season, p, a: created_at und user_id kann niemand mitschicken (sonst könnte man rückdatieren).
revoke all on public.manager_moves from anon, authenticated;
grant select on public.manager_moves to anon, authenticated;
grant insert (season, p, a) on public.manager_moves to authenticated;

-- Höchstens 40 Wechsel pro Tag und Nutzer (Schutz vor Spam)
create or replace function public.manager_moves_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.manager_moves where user_id = new.user_id and created_at > now() - interval '1 day') >= 40 then
    raise exception 'zu viele Wechsel heute';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists manager_moves_limit on public.manager_moves;
revoke all on function public.manager_moves_limit() from public, anon, authenticated;
create trigger manager_moves_limit before insert on public.manager_moves for each row execute function public.manager_moves_limit();

create table if not exists public.manager_teams (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  season text not null,
  name text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, season)
);
alter table public.manager_teams drop constraint if exists manager_teams_chk;
alter table public.manager_teams add constraint manager_teams_chk check (char_length(name) between 1 and 24);

alter table public.manager_teams enable row level security;
drop policy if exists manager_teams_read on public.manager_teams;
create policy manager_teams_read on public.manager_teams for select using (true);
drop policy if exists manager_teams_insert on public.manager_teams;
create policy manager_teams_insert on public.manager_teams for insert to authenticated with check (user_id = auth.uid());
drop policy if exists manager_teams_update on public.manager_teams;
create policy manager_teams_update on public.manager_teams for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.manager_teams from anon, authenticated;
grant select on public.manager_teams to anon, authenticated;
-- update auch auf season: das Upsert der App (on_conflict) setzt alle mitgeschickten Spalten
grant insert (season, name), update (season, name) on public.manager_teams to authenticated;
