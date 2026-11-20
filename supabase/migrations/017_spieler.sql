-- Spielersuche (Kreo): Spieler, die Nutzer eintragen – ganz Deutschland, an einem Verein aus der Vereinssuche (Migration 015).
-- Woher die Daten kommen: nur aus Kreo selbst (eingetragen von angemeldeten Nutzern). Nichts von fussball.de/FuPa.
-- Datenschutz (Spieler sind Privatleute):
--   * nur Vor- und Nachname, Verein, Mannschaft, Position, Rückennummer – kein Geburtsdatum, kein Foto, keine Kontaktdaten
--   * nur Erwachsenen-Mannschaften (Herren, Frauen, Alte Herren) – keine Jugend, keine Minderjährigen
--   * wer einträgt, bestätigt: volljährig und Bescheid gegeben (Spalte bestaetigt)
--   * jeder Angemeldete kann einen Spieler sofort ausblenden lassen (rpc/spieler_ausblenden), z. B. weil er es selbst ist.
--     Ausgeblendete Spieler verschwinden überall (auch ihre Spiele), der Name kann am Verein nicht neu angelegt werden.
--     Endgültig löschen: Admin per SQL (siehe unten).
-- Nur neue Tabellen und Funktionen – an bestehenden Tabellen ändert sich nichts (Version 1 merkt nichts davon).
-- Spiele dieser Spieler landen wie alle anderen in „spiele“ (player = id dieser Tabelle); Version 1 kennt die IDs nicht und blendet sie aus.
-- Mehrfach ausführen schadet nicht. Rückgängig machen (löscht alle eingetragenen Spieler):
--   drop table if exists public.spieler_meldungen, public.spieler cascade;
--   drop function if exists public.spieler_suche(text, text, int), public.spieler_ausblenden(text, text), public.spieler_vor_insert();
-- Einen Spieler endgültig löschen (Admin, z. B. auf Löschantrag):
--   delete from public.spiele where player = 'sp…'; delete from public.spieler where id = 'sp…';

create extension if not exists pg_trgm with schema extensions;

-- Gleiche Vereinfachung wie in Migration 015 (hier noch einmal, damit 017 auch allein läuft)
create or replace function public.vereine_suchname(t text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(replace(replace(replace(replace(lower(coalesce(t, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), '[^a-z0-9]+', ' ', 'g'))
$$;

create table if not exists public.spieler (
  id text primary key default ('sp' || substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
  vorname text not null,
  nachname text not null,
  verein_id text not null,   -- Verein aus der Vereinssuche (o… Grundbestand, u… angelegt, k-… Kreisliga)
  verein_name text not null, -- Name zum Anzeigen (damit Profile ohne Vereinsliste gehen)
  team_id text,              -- Mannschaft aus clubs.js (Kreisliga mit Wappen), falls bekannt
  team_art text not null default 'herren',
  team_nr smallint not null default 1,
  pos text not null default 'MIT',
  nummer smallint,
  bestaetigt boolean not null,
  status text not null default 'neu', -- neu, ok, doppelt, ausgeblendet, weg
  doppelt_von text,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  suchname text generated always as (public.vereine_suchname(vorname || ' ' || nachname)) stored
);
alter table public.spieler drop constraint if exists spieler_chk;
alter table public.spieler add constraint spieler_chk check (
  id ~ '^sp[a-f0-9]{10}$'
  and vorname ~ '^[[:alpha:]][[:alpha:] ''.-]{1,29}$' and nachname ~ '^[[:alpha:]][[:alpha:] ''.-]{1,29}$'
  and verein_id ~ '^[a-z0-9_-]{2,40}$' and char_length(verein_name) between 2 and 60 and verein_name !~ '[<>"]'
  and coalesce(team_id, '') ~ '^([a-z0-9_-]{2,40})?$'
  and team_art in ('herren', 'frauen', 'ah') and team_nr between 1 and 9
  and pos in ('TW', 'ABW', 'MIT', 'ANG') and (nummer is null or nummer between 1 and 99)
  and bestaetigt
  and status in ('neu', 'ok', 'doppelt', 'ausgeblendet', 'weg') and coalesce(doppelt_von, '') ~ '^([A-Za-z0-9_-]{1,64})?$'
);
create index if not exists spieler_such_idx on public.spieler using gin (suchname extensions.gin_trgm_ops);
create index if not exists spieler_verein_idx on public.spieler (verein_id);
-- Gleicher Name am gleichen Verein nur einmal – auch nicht neu, wenn er ausgeblendet wurde
create unique index if not exists spieler_einmal_idx on public.spieler (verein_id, suchname) where status in ('neu', 'ok', 'ausgeblendet');

alter table public.spieler enable row level security;
drop policy if exists spieler_read on public.spieler;
create policy spieler_read on public.spieler for select using (status in ('neu', 'ok', 'doppelt') or public.is_admin());
drop policy if exists spieler_insert on public.spieler;
create policy spieler_insert on public.spieler for insert to authenticated with check (user_id = auth.uid());
drop policy if exists spieler_admin on public.spieler;
create policy spieler_admin on public.spieler for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists spieler_admin_del on public.spieler;
create policy spieler_admin_del on public.spieler for delete to authenticated using (public.is_admin());
-- Lesen ohne user_id (wer eingetragen hat, bleibt privat)
revoke all on public.spieler from anon, authenticated;
grant select (id, vorname, nachname, verein_id, verein_name, team_id, team_art, team_nr, pos, nummer, status, doppelt_von, created_at) on public.spieler to anon, authenticated;
grant insert (vorname, nachname, verein_id, verein_name, team_id, team_art, team_nr, pos, nummer, bestaetigt) on public.spieler to authenticated;
grant update (vorname, nachname, verein_id, verein_name, team_id, team_art, team_nr, pos, nummer, status, doppelt_von) on public.spieler to authenticated;
grant delete on public.spieler to authenticated;

-- Höchstens 25 neue Spieler pro Tag und Nutzer; Zeitpunkt, Konto und Status setzt der Server
create or replace function public.spieler_vor_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.spieler where user_id = auth.uid() and created_at > now() - interval '1 day') >= 25 then
    raise exception 'zu viele neue Spieler heute';
  end if;
  new.user_id := auth.uid();
  new.created_at := now();
  new.status := 'neu';
  new.doppelt_von := null;
  return new;
end $$;
revoke all on function public.spieler_vor_insert() from public, anon, authenticated;
drop trigger if exists spieler_vor_insert on public.spieler;
create trigger spieler_vor_insert before insert on public.spieler for each row execute function public.spieler_vor_insert();

-- Suche: q = Name (auch Teil), v = nur dieser Verein (optional), n = Anzahl
create or replace function public.spieler_suche(q text, v text default null, n int default 20)
returns table (id text, vorname text, nachname text, verein_id text, verein_name text, team_id text, team_art text, team_nr smallint, pos text, nummer smallint, status text, doppelt_von text)
language sql stable set search_path = public, extensions as $$
  with s as (select public.vereine_suchname(q) as t)
  select p.id, p.vorname, p.nachname, p.verein_id, p.verein_name, p.team_id, p.team_art, p.team_nr, p.pos, p.nummer, p.status, p.doppelt_von
  from public.spieler p, s
  where p.status in ('neu', 'ok') and (v is null or p.verein_id = v)
    and (char_length(s.t) = 0 and v is not null
      or char_length(s.t) >= 2 and (p.suchname like '%' || s.t || '%' or word_similarity(s.t, p.suchname) > 0.4))
  order by (p.suchname like s.t || '%') desc, word_similarity(s.t, p.suchname) desc, p.nachname, p.vorname
  limit least(greatest(coalesce(n, 20), 1), 60)
$$;
grant execute on function public.spieler_suche(text, text, int) to anon, authenticated;

-- ---------- Meldungen und Ausblenden ----------
create table if not exists public.spieler_meldungen (
  id bigint generated always as identity primary key,
  spieler_id text not null,
  art text not null,         -- ausblenden (sofort wirksam), doppelt, falsch, sonstiges
  text text,
  erledigt boolean not null default false,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.spieler_meldungen drop constraint if exists spieler_meldungen_chk;
alter table public.spieler_meldungen add constraint spieler_meldungen_chk check (
  spieler_id ~ '^sp[a-f0-9]{10}$' and art in ('ausblenden', 'doppelt', 'falsch', 'sonstiges') and char_length(coalesce(text, '')) <= 200
);
alter table public.spieler_meldungen enable row level security;
drop policy if exists spieler_meldungen_read on public.spieler_meldungen;
create policy spieler_meldungen_read on public.spieler_meldungen for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists spieler_meldungen_insert on public.spieler_meldungen;
create policy spieler_meldungen_insert on public.spieler_meldungen for insert to authenticated with check (user_id = auth.uid() and art <> 'ausblenden');
drop policy if exists spieler_meldungen_admin on public.spieler_meldungen;
create policy spieler_meldungen_admin on public.spieler_meldungen for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.spieler_meldungen from anon, authenticated;
grant select on public.spieler_meldungen to authenticated;
grant insert (spieler_id, art, text) on public.spieler_meldungen to authenticated;
grant update (erledigt) on public.spieler_meldungen to authenticated;

-- Ausblenden: wirkt sofort (Datenschutz geht vor). Höchstens 5 pro Tag und Nutzer; ein Admin kann es rückgängig machen
-- (update public.spieler set status = 'ok' where id = 'sp…').
create or replace function public.spieler_ausblenden(p_id text, p_grund text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  if (select count(*) from public.spieler_meldungen where user_id = auth.uid() and art = 'ausblenden' and created_at > now() - interval '1 day') >= 5 then
    raise exception 'zu viele heute';
  end if;
  update public.spieler set status = 'ausgeblendet' where id = p_id and status in ('neu', 'ok', 'doppelt');
  if not found then return false; end if;
  insert into public.spieler_meldungen (spieler_id, art, text, user_id) values (p_id, 'ausblenden', left(p_grund, 200), auth.uid());
  return true;
end $$;
revoke all on function public.spieler_ausblenden(text, text) from public, anon;
grant execute on function public.spieler_ausblenden(text, text) to authenticated;
