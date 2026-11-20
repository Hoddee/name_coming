-- Vereinsdatenbank (Kreo): Vereine, Mannschaften und Staffeln für ganz Deutschland.
-- Der Grundbestand (offene Daten aus OpenStreetMap) liegt als Datei im Repo (assets/data/vereine.json) und kostet keinen Supabase-Traffic.
-- Hier liegt nur, was Nutzer ergänzen: fehlende Vereine, Mannschaften (I, II, Frauen …) mit Liga/Staffel, Meldungen (doppelt, falsch).
-- Nur neue Tabellen und Funktionen – an bestehenden Tabellen ändert sich nichts (gemeinsame Datenbank mit Version 1).
-- Mehrfach ausführen schadet nicht. Rückgängig machen (löscht alle Vereinsdaten der Nutzer):
--   drop table if exists public.vereine_meldungen, public.mannschaften, public.staffeln, public.vereine cascade;
--   drop function if exists public.vereine_suche(text, int), public.mannschaft_anlegen(text, text, int, text, text, text, text, text, text), public.vereine_vor_insert(), public.vereine_suchname(text);

create extension if not exists pg_trgm with schema extensions;

-- Suchname: klein, Umlaute ausgeschrieben, nur Buchstaben/Ziffern (gleich wie simple() in js/core/vsearch.js)
create or replace function public.vereine_suchname(t text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(replace(replace(replace(replace(lower(coalesce(t, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), '[^a-z0-9]+', ' ', 'g'))
$$;

-- ---------- Vereine (von Nutzern angelegt) ----------
create table if not exists public.vereine (
  id text primary key default ('u' || substr(md5(random()::text || clock_timestamp()::text), 1, 11)),
  name text not null,
  ort text,
  plz text,
  land text,                 -- Bundesland-Kürzel (BW, BY, …)
  verband text,              -- Landesverband-Kürzel (WFV, BFV, …)
  lat double precision,
  lon double precision,
  osm text,                  -- geprüfter Ort aus OpenStreetMap (z. B. N123 / W123 / R123)
  web text,                  -- Vereinsseite oder Link zur Vereinsseite bei fussball.de/FuPa (nur der Link)
  status text not null default 'neu',
  doppelt_von text,          -- bei status 'doppelt': ID des richtigen Vereins (auch aus dem Grundbestand)
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  suchname text generated always as (public.vereine_suchname(name || ' ' || coalesce(ort, ''))) stored
);
alter table public.vereine drop constraint if exists vereine_chk;
alter table public.vereine add constraint vereine_chk check (
  id ~ '^[a-z0-9_-]{2,40}$' and char_length(name) between 3 and 60 and char_length(coalesce(ort, '')) <= 50
  and coalesce(plz, '') ~ '^([0-9]{5})?$' and coalesce(land, '') ~ '^([A-Z]{2})?$' and char_length(coalesce(verband, '')) <= 8
  and (lat is null or lat between 47 and 55.2) and (lon is null or lon between 5.5 and 15.5)
  and coalesce(osm, '') ~ '^([NWR][0-9]{1,12})?$' and char_length(coalesce(web, '')) <= 200 and coalesce(web, '') !~* '^\s*javascript:'
  and status in ('neu', 'ok', 'doppelt', 'weg') and coalesce(doppelt_von, '') ~ '^([a-z0-9_-]{2,40})?$'
);
create index if not exists vereine_such_idx on public.vereine using gin (suchname extensions.gin_trgm_ops);
create unique index if not exists vereine_einmal_idx on public.vereine (suchname) where status in ('neu', 'ok');

alter table public.vereine enable row level security;
drop policy if exists vereine_read on public.vereine;
create policy vereine_read on public.vereine for select using (status <> 'weg' or public.is_admin());
drop policy if exists vereine_insert on public.vereine;
create policy vereine_insert on public.vereine for insert to authenticated with check (user_id = auth.uid());
drop policy if exists vereine_admin on public.vereine;
create policy vereine_admin on public.vereine for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.vereine from anon, authenticated;
grant select on public.vereine to anon, authenticated;
grant insert (name, ort, plz, land, verband, lat, lon, osm, web) on public.vereine to authenticated;
grant update (name, ort, plz, land, verband, web, status, doppelt_von) on public.vereine to authenticated;

-- Höchstens 10 neue Vereine pro Tag und Nutzer; Zeitpunkt und Status setzt der Server
create or replace function public.vereine_vor_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.vereine where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'zu viele neue Vereine heute';
  end if;
  new.user_id := auth.uid();
  new.created_at := now();
  new.status := 'neu';
  new.doppelt_von := null;
  return new;
end $$;
revoke all on function public.vereine_vor_insert() from public, anon, authenticated;
drop trigger if exists vereine_vor_insert on public.vereine;
create trigger vereine_vor_insert before insert on public.vereine for each row execute function public.vereine_vor_insert();

-- Suche über die Nutzer-Vereine (der Grundbestand wird in der App durchsucht). q = Suchtext, n = Anzahl
create or replace function public.vereine_suche(q text, n int default 15)
returns table (id text, name text, ort text, plz text, land text, verband text, lat double precision, lon double precision, web text, status text)
language sql stable set search_path = public, extensions as $$
  with s as (select public.vereine_suchname(q) as t)
  select v.id, v.name, v.ort, v.plz, v.land, v.verband, v.lat, v.lon, v.web, v.status
  from public.vereine v, s
  where v.status in ('neu', 'ok') and char_length(s.t) >= 2
    and (v.suchname like '%' || s.t || '%' or word_similarity(s.t, v.suchname) > 0.35)
  order by (v.suchname like s.t || '%') desc, word_similarity(s.t, v.suchname) desc, v.name
  limit least(greatest(coalesce(n, 15), 1), 30)
$$;
grant execute on function public.vereine_suche(text, int) to anon, authenticated;

-- ---------- Staffeln (Liga einer Saison, z. B. „Kreisliga B2“ im Bezirk Rems/Murr) ----------
-- Vorbereitung für Spielpläne: später hängen Spiele an staffel_id und mannschaften.
create table if not exists public.staffeln (
  id bigint generated always as identity primary key,
  saison text not null,
  verband text,
  kreis text,                -- Bezirk/Kreis, wie ihn der Verband nennt (frei)
  klasse text not null,      -- Spielklasse (Kreisliga, Kreisklasse, Bezirksliga …)
  nummer text,               -- Staffel innerhalb der Klasse (A, B2, 3 …)
  status text not null default 'neu',
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.staffeln drop constraint if exists staffeln_chk;
alter table public.staffeln add constraint staffeln_chk check (
  char_length(saison) between 4 and 20 and char_length(coalesce(verband, '')) <= 8 and char_length(coalesce(kreis, '')) <= 40
  and char_length(klasse) between 2 and 30 and char_length(coalesce(nummer, '')) <= 6 and status in ('neu', 'ok', 'weg')
);
create unique index if not exists staffeln_einmal_idx on public.staffeln (saison, coalesce(verband, ''), lower(coalesce(kreis, '')), lower(klasse), lower(coalesce(nummer, '')));
alter table public.staffeln enable row level security;
drop policy if exists staffeln_read on public.staffeln;
create policy staffeln_read on public.staffeln for select using (true);
drop policy if exists staffeln_admin on public.staffeln;
create policy staffeln_admin on public.staffeln for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.staffeln from anon, authenticated;
grant select on public.staffeln to anon, authenticated;
grant update (kreis, klasse, nummer, status) on public.staffeln to authenticated;

-- ---------- Mannschaften eines Vereins (Verein aus dem Grundbestand oder aus „vereine“) ----------
create table if not exists public.mannschaften (
  id bigint generated always as identity primary key,
  verein_id text not null,   -- ID aus vereine.json (o…, q…) oder aus der Tabelle vereine (u…)
  art text not null default 'herren',
  nr smallint not null default 1,
  jugend text,               -- nur bei art = 'jugend': U19, U17 …
  saison text not null,
  staffel_id bigint references public.staffeln (id) on delete set null,
  status text not null default 'neu',
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.mannschaften drop constraint if exists mannschaften_chk;
alter table public.mannschaften add constraint mannschaften_chk check (
  verein_id ~ '^[a-z0-9_-]{2,40}$' and art in ('herren', 'frauen', 'ah', 'jugend') and nr between 1 and 9
  and coalesce(jugend, '') ~ '^(U[0-9]{1,2})?$' and char_length(saison) between 4 and 20 and status in ('neu', 'ok', 'weg')
);
create unique index if not exists mannschaften_einmal_idx on public.mannschaften (verein_id, art, nr, coalesce(jugend, ''), saison);
create index if not exists mannschaften_verein_idx on public.mannschaften (verein_id, saison);
alter table public.mannschaften enable row level security;
drop policy if exists mannschaften_read on public.mannschaften;
create policy mannschaften_read on public.mannschaften for select using (status <> 'weg' or public.is_admin());
drop policy if exists mannschaften_admin on public.mannschaften;
create policy mannschaften_admin on public.mannschaften for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.mannschaften from anon, authenticated;
grant select on public.mannschaften to anon, authenticated;
grant update (staffel_id, status) on public.mannschaften to authenticated;

-- Mannschaft anlegen oder ihre Liga ändern (eine Funktion, damit Staffel und Mannschaft zusammenpassen).
-- Nur angemeldet, höchstens 30 Änderungen pro Tag. Die Liga einer bestehenden Mannschaft darf ihr Ersteller oder ein Admin ändern.
create or replace function public.mannschaft_anlegen(p_verein text, p_art text, p_nr int, p_jugend text, p_saison text,
  p_klasse text, p_nummer text, p_kreis text, p_verband text)
returns bigint language plpgsql security definer set search_path = public as $$
declare st bigint; m bigint; owner uuid;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  if (select count(*) from public.mannschaften where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'zu viele Mannschaften heute';
  end if;
  if nullif(trim(p_klasse), '') is not null then
    insert into public.staffeln (saison, verband, kreis, klasse, nummer)
      values (p_saison, nullif(trim(p_verband), ''), nullif(trim(p_kreis), ''), trim(p_klasse), nullif(upper(trim(p_nummer)), ''))
      on conflict (saison, coalesce(verband, ''), lower(coalesce(kreis, '')), lower(klasse), lower(coalesce(nummer, ''))) do nothing;
    select id into st from public.staffeln
      where saison = p_saison and coalesce(verband, '') = coalesce(nullif(trim(p_verband), ''), '') and lower(coalesce(kreis, '')) = lower(coalesce(nullif(trim(p_kreis), ''), ''))
        and lower(klasse) = lower(trim(p_klasse)) and lower(coalesce(nummer, '')) = lower(coalesce(nullif(upper(trim(p_nummer)), ''), ''));
  end if;
  select id, user_id into m, owner from public.mannschaften
    where verein_id = p_verein and art = p_art and nr = p_nr and coalesce(jugend, '') = coalesce(nullif(p_jugend, ''), '') and saison = p_saison;
  if m is null then
    insert into public.mannschaften (verein_id, art, nr, jugend, saison, staffel_id, user_id)
      values (p_verein, p_art, p_nr, nullif(p_jugend, ''), p_saison, st, auth.uid()) returning id into m;
  elsif owner = auth.uid() or public.is_admin() then
    update public.mannschaften set staffel_id = st where id = m;
  else
    raise exception 'Mannschaft gibt es schon';
  end if;
  return m;
end $$;
revoke all on function public.mannschaft_anlegen(text, text, int, text, text, text, text, text, text) from public, anon;
grant execute on function public.mannschaft_anlegen(text, text, int, text, text, text, text, text, text) to authenticated;

-- ---------- Meldungen (Verein doppelt, falsch, gibt es nicht) – sehen nur Admins und der Meldende ----------
create table if not exists public.vereine_meldungen (
  id bigint generated always as identity primary key,
  verein_id text not null,
  art text not null,
  text text,
  erledigt boolean not null default false,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.vereine_meldungen drop constraint if exists vereine_meldungen_chk;
alter table public.vereine_meldungen add constraint vereine_meldungen_chk check (
  verein_id ~ '^[a-z0-9_-]{2,40}$' and art in ('doppelt', 'falsch', 'gibts_nicht', 'sonstiges') and char_length(coalesce(text, '')) <= 200
);
alter table public.vereine_meldungen enable row level security;
drop policy if exists vereine_meldungen_read on public.vereine_meldungen;
create policy vereine_meldungen_read on public.vereine_meldungen for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists vereine_meldungen_insert on public.vereine_meldungen;
create policy vereine_meldungen_insert on public.vereine_meldungen for insert to authenticated with check (user_id = auth.uid());
drop policy if exists vereine_meldungen_admin on public.vereine_meldungen;
create policy vereine_meldungen_admin on public.vereine_meldungen for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.vereine_meldungen from anon, authenticated;
grant select on public.vereine_meldungen to authenticated;
grant insert (verein_id, art, text) on public.vereine_meldungen to authenticated;
grant update (erledigt) on public.vereine_meldungen to authenticated;
