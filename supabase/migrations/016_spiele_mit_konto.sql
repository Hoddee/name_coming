-- Manager-Fairness (Kreo): Für den Manager zählen nur Spiele, die mit Anmeldung gespeichert wurden.
-- Neue Spalte spiele.mit_konto – der Server setzt sie selbst (true, wenn beim Speichern jemand angemeldet war),
-- mitschicken oder nachträglich ändern geht nicht. Es wird nur ein Ja/Nein gespeichert, kein Konto.
-- Bisherige Spiele bekommen einmalig true (sie stammen aus der Testphase und zählen weiter).
-- Version 1 (gleiche Tabelle) merkt davon nichts. Mehrfach ausführen schadet nicht. Rückgängig machen:
--   drop trigger if exists spiele_mit_konto on public.spiele; drop function if exists public.spiele_mit_konto();
--   alter table public.spiele drop column if exists mit_konto;

alter table public.spiele add column if not exists mit_konto boolean not null default true;
alter table public.spiele alter column mit_konto set default false;

create or replace function public.spiele_mit_konto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.mit_konto := auth.uid() is not null;
  else new.mit_konto := old.mit_konto;
  end if;
  return new;
end $$;
revoke all on function public.spiele_mit_konto() from public, anon, authenticated;
drop trigger if exists spiele_mit_konto on public.spiele;
create trigger spiele_mit_konto before insert or update on public.spiele for each row execute function public.spiele_mit_konto();
