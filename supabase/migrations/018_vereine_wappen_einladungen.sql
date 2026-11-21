-- Kreo: Vereinsverwalter + eigenes Wappen, Mannschafts-Einladungen (Link/QR), Spieler übernehmen ihr Profil (mit eigenem Foto).
-- Nur neue Tabellen, Spalten und Funktionen – an bestehenden Daten ändert sich nichts (Version 1 merkt nichts davon).
-- Mehrfach ausführen schadet nicht. Braucht 015 (vereine) und 017 (spieler).
--
-- Datenschutz:
--   * Ein Foto gibt es nur, wenn der Spieler selbst sein Profil übernommen hat und es selbst hochlädt (eigene Einwilligung).
--     Fremde Fotos (FuPa, fussball.de, Vereinsseiten) werden nicht verwendet.
--   * Wer ein Profil übernimmt, ist danach als Konto damit verbunden; „Freigeben“ löst die Verbindung und löscht den Foto-Verweis.
--   * Ausblenden (rpc/spieler_ausblenden aus 017) geht weiter für alle sofort.
--
-- Rückgängig machen:
--   drop table if exists public.vereine_admins, public.vereine_wappen, public.team_einladungen cascade;
--   alter table public.spieler drop column if exists konto, drop column if exists foto, drop column if exists beansprucht;
--   drop function if exists public.einladung_lesen(text), public.spieler_beitreten(text, text, text, text, int),
--     public.spieler_beanspruchen(text, text), public.spieler_profil(text, text, int, text), public.spieler_freigeben(text),
--     public.spieler_suche2(text, text, int), public.ist_vereinsadmin(text), public.verein_wappen_setzen(text, text);

-- ---------- Vereinsverwalter ----------
create table if not exists public.vereine_admins (
  verein_id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'anfrage', -- anfrage, ok, abgelehnt
  rolle text,                              -- z. B. Vorstand, Trainer, Abteilungsleiter (Freitext)
  created_at timestamptz not null default now(),
  primary key (verein_id, user_id)
);
alter table public.vereine_admins drop constraint if exists vereine_admins_chk;
alter table public.vereine_admins add constraint vereine_admins_chk check (
  verein_id ~ '^[a-z0-9_-]{2,40}$' and status in ('anfrage', 'ok', 'abgelehnt') and char_length(coalesce(rolle, '')) <= 40 and coalesce(rolle, '') !~ '[<>"]'
);
alter table public.vereine_admins enable row level security;
drop policy if exists vereine_admins_read on public.vereine_admins;
create policy vereine_admins_read on public.vereine_admins for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists vereine_admins_insert on public.vereine_admins;
create policy vereine_admins_insert on public.vereine_admins for insert to authenticated with check (user_id = auth.uid() and status = 'anfrage');
drop policy if exists vereine_admins_admin on public.vereine_admins;
create policy vereine_admins_admin on public.vereine_admins for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists vereine_admins_del on public.vereine_admins;
create policy vereine_admins_del on public.vereine_admins for delete to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.vereine_admins from anon, authenticated;
grant select, delete on public.vereine_admins to authenticated;
grant insert (verein_id, rolle) on public.vereine_admins to authenticated;
grant update (status) on public.vereine_admins to authenticated;

create or replace function public.ist_vereinsadmin(v text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.vereine_admins a where a.verein_id = v and a.user_id = auth.uid() and a.status = 'ok')
$$;
grant execute on function public.ist_vereinsadmin(text) to authenticated;

-- ---------- Eigenes Wappen (vom Verein hochgeladen) ----------
create table if not exists public.vereine_wappen (
  verein_id text primary key,
  pfad text not null,        -- Datei im Bucket kickbase, Ordner wappen/<verein_id>/
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.vereine_wappen drop constraint if exists vereine_wappen_chk;
alter table public.vereine_wappen add constraint vereine_wappen_chk check (
  verein_id ~ '^[a-z0-9_-]{2,40}$' and pfad ~ ('^wappen/' || verein_id || '/[A-Za-z0-9_-]{4,40}\.(webp|png)$')
);
alter table public.vereine_wappen enable row level security;
drop policy if exists vereine_wappen_read on public.vereine_wappen;
create policy vereine_wappen_read on public.vereine_wappen for select using (true);
revoke all on public.vereine_wappen from anon, authenticated;
grant select (verein_id, pfad, created_at) on public.vereine_wappen to anon, authenticated;

-- Setzen nur über diese Funktion (Vereinsadmin oder Kreo-Admin)
create or replace function public.verein_wappen_setzen(v text, p text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.ist_vereinsadmin(v) then raise exception 'keine Berechtigung'; end if;
  if p is null then delete from public.vereine_wappen where verein_id = v; return true; end if;
  insert into public.vereine_wappen (verein_id, pfad, user_id) values (v, p, auth.uid())
    on conflict (verein_id) do update set pfad = excluded.pfad, user_id = excluded.user_id, created_at = now();
  return true;
end $$;
revoke all on function public.verein_wappen_setzen(text, text) from public, anon;
grant execute on function public.verein_wappen_setzen(text, text) to authenticated;

-- Hochladen in wappen/<verein_id>/… nur für Verwalter dieses Vereins
drop policy if exists "wappen hochladen" on storage.objects;
create policy "wappen hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'kickbase' and (storage.foldername(name))[1] = 'wappen' and public.ist_vereinsadmin((storage.foldername(name))[2]));

-- ---------- Einladungen in eine Mannschaft ----------
create table if not exists public.team_einladungen (
  code text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  verein_id text not null,
  verein_name text not null,
  team_art text not null default 'herren',
  team_nr smallint not null default 1,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  bis timestamptz not null default now() + interval '90 days'
);
alter table public.team_einladungen drop constraint if exists team_einladungen_chk;
alter table public.team_einladungen add constraint team_einladungen_chk check (
  code ~ '^[a-f0-9]{12}$' and verein_id ~ '^[a-z0-9_-]{2,40}$' and char_length(verein_name) between 2 and 60 and verein_name !~ '[<>"]'
  and team_art in ('herren', 'frauen', 'ah') and team_nr between 1 and 9
);
alter table public.team_einladungen enable row level security;
drop policy if exists team_einladungen_own on public.team_einladungen;
create policy team_einladungen_own on public.team_einladungen for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists team_einladungen_insert on public.team_einladungen;
create policy team_einladungen_insert on public.team_einladungen for insert to authenticated with check (user_id = auth.uid());
revoke all on public.team_einladungen from anon, authenticated;
grant select on public.team_einladungen to authenticated;
grant insert (verein_id, verein_name, team_art, team_nr) on public.team_einladungen to authenticated;

-- Höchstens 10 Einladungen pro Tag und Nutzer; Code, Zeit und Konto setzt der Server
create or replace function public.team_einladung_vor_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.team_einladungen where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'zu viele Einladungen heute';
  end if;
  new.code := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  new.user_id := auth.uid(); new.created_at := now(); new.bis := now() + interval '90 days';
  return new;
end $$;
revoke all on function public.team_einladung_vor_insert() from public, anon, authenticated;
drop trigger if exists team_einladung_vor_insert on public.team_einladungen;
create trigger team_einladung_vor_insert before insert on public.team_einladungen for each row execute function public.team_einladung_vor_insert();

-- ---------- Spieler: Konto (wer das Profil übernommen hat) und eigenes Foto ----------
alter table public.spieler add column if not exists konto uuid references auth.users (id) on delete set null;
alter table public.spieler add column if not exists foto text;
alter table public.spieler add column if not exists beansprucht boolean generated always as (konto is not null) stored;
alter table public.spieler drop constraint if exists spieler_foto_chk;
alter table public.spieler add constraint spieler_foto_chk check (foto is null or foto ~ '^eigen/[a-f0-9-]{36}/[A-Za-z0-9_-]{4,40}\.(webp|png)$');
create unique index if not exists spieler_konto_idx on public.spieler (konto) where konto is not null;
grant select (foto, beansprucht) on public.spieler to anon, authenticated;

-- Eigenes Foto: nur in eigen/<eigene Nutzer-ID>/
drop policy if exists "eigenes foto hochladen" on storage.objects;
create policy "eigenes foto hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'kickbase' and (storage.foldername(name))[1] = 'eigen' and (storage.foldername(name))[2] = auth.uid()::text);

-- Mehr Spieler pro Tag (ganzer Kader per Liste): 40 statt 25
create or replace function public.spieler_vor_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.spieler where user_id = auth.uid() and created_at > now() - interval '1 day') >= 40 then
    raise exception 'zu viele neue Spieler heute';
  end if;
  new.user_id := auth.uid();
  new.created_at := now();
  new.status := 'neu';
  new.doppelt_von := null;
  return new;
end $$;

-- Einladung lesen (auch ohne Konto): Verein, Mannschaft, Spieler dieser Mannschaft (ob schon übernommen)
create or replace function public.einladung_lesen(p_code text)
returns table (verein_id text, verein_name text, team_art text, team_nr smallint, gueltig boolean, spieler jsonb)
language sql stable security definer set search_path = public as $$
  select e.verein_id, e.verein_name, e.team_art, e.team_nr, e.bis > now(),
    coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'pos', s.pos, 'nummer', s.nummer, 'beansprucht', s.konto is not null) order by s.nachname, s.vorname)
      from public.spieler s where s.verein_id = e.verein_id and s.team_art = e.team_art and s.team_nr = e.team_nr and s.status in ('neu', 'ok')), '[]'::jsonb)
  from public.team_einladungen e where e.code = p_code
$$;
grant execute on function public.einladung_lesen(text) to anon, authenticated;

-- Selbst beitreten: neuer Spieler, gleich mit dem eigenen Konto verbunden (der Spieler bestätigt selbst)
create or replace function public.spieler_beitreten(p_code text, p_vorname text, p_nachname text, p_pos text, p_nummer int)
returns text language plpgsql security definer set search_path = public as $$
declare e public.team_einladungen; nid text;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  select * into e from public.team_einladungen where code = p_code and bis > now();
  if not found then raise exception 'Einladung ungültig'; end if;
  if exists (select 1 from public.spieler where konto = auth.uid()) then raise exception 'schon ein Profil'; end if;
  insert into public.spieler (vorname, nachname, verein_id, verein_name, team_art, team_nr, pos, nummer, bestaetigt)
    values (trim(p_vorname), trim(p_nachname), e.verein_id, e.verein_name, e.team_art, e.team_nr, coalesce(nullif(p_pos, ''), 'MIT'), p_nummer, true)
    returning id into nid;
  update public.spieler set konto = auth.uid() where id = nid;
  return nid;
end $$;
revoke all on function public.spieler_beitreten(text, text, text, text, int) from public, anon;
grant execute on function public.spieler_beitreten(text, text, text, text, int) to authenticated;

-- Vorhandenes Profil übernehmen („Das bin ich“) – nur mit gültiger Einladung derselben Mannschaft und nur, wenn noch frei
create or replace function public.spieler_beanspruchen(p_code text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare e public.team_einladungen;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  select * into e from public.team_einladungen where code = p_code and bis > now();
  if not found then raise exception 'Einladung ungültig'; end if;
  if exists (select 1 from public.spieler where konto = auth.uid()) then raise exception 'schon ein Profil'; end if;
  update public.spieler set konto = auth.uid()
    where id = p_id and verein_id = e.verein_id and konto is null and status in ('neu', 'ok');
  return found;
end $$;
revoke all on function public.spieler_beanspruchen(text, text) from public, anon;
grant execute on function public.spieler_beanspruchen(text, text) to authenticated;

-- Eigenes Profil pflegen: Position, Rückennummer, Foto (nur wer es übernommen hat)
create or replace function public.spieler_profil(p_id text, p_pos text, p_nummer int, p_foto text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  if p_foto is not null and p_foto <> '' and p_foto !~ ('^eigen/' || auth.uid()::text || '/') then raise exception 'Foto passt nicht'; end if;
  update public.spieler set pos = coalesce(nullif(p_pos, ''), pos), nummer = p_nummer,
    foto = case when p_foto = '' then null when p_foto is null then foto else p_foto end
    where id = p_id and konto = auth.uid();
  return found;
end $$;
revoke all on function public.spieler_profil(text, text, int, text) from public, anon;
grant execute on function public.spieler_profil(text, text, int, text) to authenticated;

-- Profil wieder freigeben (Verbindung lösen, Foto-Verweis weg)
create or replace function public.spieler_freigeben(p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.spieler set konto = null, foto = null where id = p_id and (konto = auth.uid() or public.is_admin());
  return found;
end $$;
revoke all on function public.spieler_freigeben(text) from public, anon;
grant execute on function public.spieler_freigeben(text) to authenticated;

-- Welches Profil gehört mir?
create or replace function public.mein_spieler() returns text
language sql stable security definer set search_path = public as $$
  select id from public.spieler where konto = auth.uid() and status in ('neu', 'ok', 'doppelt') limit 1
$$;
grant execute on function public.mein_spieler() to authenticated;

-- Suche wie spieler_suche (017), zusätzlich Foto und ob übernommen
create or replace function public.spieler_suche2(q text, v text default null, n int default 20)
returns table (id text, vorname text, nachname text, verein_id text, verein_name text, team_id text, team_art text, team_nr smallint, pos text, nummer smallint, status text, doppelt_von text, foto text, beansprucht boolean)
language sql stable security definer set search_path = public, extensions as $$
  with s as (select public.vereine_suchname(q) as t)
  select p.id, p.vorname, p.nachname, p.verein_id, p.verein_name, p.team_id, p.team_art, p.team_nr, p.pos, p.nummer, p.status, p.doppelt_von, p.foto, p.konto is not null
  from public.spieler p, s
  where p.status in ('neu', 'ok') and (v is null or p.verein_id = v)
    and (char_length(s.t) = 0 and v is not null
      or char_length(s.t) >= 2 and (p.suchname like '%' || s.t || '%' or word_similarity(s.t, p.suchname) > 0.3))
  order by (p.suchname like s.t || '%') desc, word_similarity(s.t, p.suchname) desc, p.nachname, p.vorname
  limit least(greatest(coalesce(n, 20), 1), 60)
$$;
grant execute on function public.spieler_suche2(text, text, int) to anon, authenticated;
