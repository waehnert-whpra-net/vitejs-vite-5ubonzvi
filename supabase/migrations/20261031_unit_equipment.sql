-- Ausstattung je Einheit (Küche, Schlafzimmer, Bad ...)
-- Im Supabase SQL Editor ausführen. Das Skript kann gefahrlos mehrfach laufen.

create table if not exists public.unit_equipment (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.property_units(id) on delete cascade,
  bereich      text not null,
  ausstattung  text not null,
  anzahl_soll  integer not null default 0 check (anzahl_soll >= 0),
  anzahl_ist   integer not null default 0 check (anzahl_ist >= 0),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (unit_id, bereich, ausstattung)
);

create index if not exists unit_equipment_unit_idx on public.unit_equipment (unit_id);

-- Hilfsfunktionen für die Rechteprüfung
create or replace function public.equipment_has_role()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

create or replace function public.equipment_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name in ('Admin', 'Super-Admin')
  );
$$;

-- Nicht-Admins dürfen nur Anzahl-IST ändern
create or replace function public.unit_equipment_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is not null and not public.equipment_is_admin() then
    if new.unit_id     is distinct from old.unit_id
    or new.bereich     is distinct from old.bereich
    or new.ausstattung is distinct from old.ausstattung
    or new.anzahl_soll is distinct from old.anzahl_soll
    or new.sort_order  is distinct from old.sort_order then
      raise exception 'Nur Administratoren dürfen diese Felder ändern';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists unit_equipment_guard on public.unit_equipment;
create trigger unit_equipment_guard
  before update on public.unit_equipment
  for each row execute function public.unit_equipment_guard();

-- Row Level Security (je Operation getrennt)
alter table public.unit_equipment enable row level security;

drop policy if exists unit_equipment_select on public.unit_equipment;
drop policy if exists unit_equipment_insert on public.unit_equipment;
drop policy if exists unit_equipment_update on public.unit_equipment;
drop policy if exists unit_equipment_delete on public.unit_equipment;

create policy unit_equipment_select on public.unit_equipment
  for select to authenticated using (public.equipment_has_role());
create policy unit_equipment_insert on public.unit_equipment
  for insert to authenticated with check (public.equipment_is_admin());
create policy unit_equipment_update on public.unit_equipment
  for update to authenticated
  using (public.equipment_has_role()) with check (public.equipment_has_role());
create policy unit_equipment_delete on public.unit_equipment
  for delete to authenticated using (public.equipment_is_admin());

grant select, insert, update, delete on public.unit_equipment to authenticated;

-- Grundausstattung für alle Einheiten mit Betten > 1 (aus naf.xlsx)
-- 'x' = Anzahl entspricht "Max. Aufbettung auf" der Einheit
-- Anzahl-IST startet bei 0 (noch nicht gezählt)
with tpl (sort_order, bereich, ausstattung, qty) as (
  values
    (1, 'Küche', 'Wasserkocher', '1'),
    (2, 'Küche', 'French Press', '1'),
    (3, 'Küche', 'Großer Topf mit Deckel', '1'),
    (4, 'Küche', 'Kleiner Topf mit Deckel', '1'),
    (5, 'Küche', 'Bratpfanne', '1'),
    (6, 'Küche', 'Flache Teller', 'x'),
    (7, 'Küche', 'Tiefe Teller', 'x'),
    (8, 'Küche', 'Kleine Teller', 'x'),
    (9, 'Küche', 'Müslischalen', 'x'),
    (10, 'Küche', 'Kaffeetassen, groß', 'x'),
    (11, 'Küche', 'Wassergläser', 'x'),
    (12, 'Küche', 'Weingläser', 'x'),
    (13, 'Küche', 'Große Glasschüssel', '1'),
    (14, 'Küche', 'Messer', 'x'),
    (15, 'Küche', 'Gabel', 'x'),
    (16, 'Küche', 'Esslöffel', 'x'),
    (17, 'Küche', 'Teelöffel', 'x'),
    (18, 'Küche', 'Brotmesser', '1'),
    (19, 'Küche', 'Küchenmesser', '1'),
    (20, 'Küche', 'Schneidebrett', '1'),
    (21, 'Küche', 'Sieb, groß', '1'),
    (22, 'Küche', 'Salatbesteck', '1'),
    (23, 'Küche', 'Pfannenwender', '1'),
    (24, 'Küche', 'Schöpfkelle', '1'),
    (25, 'Küche', 'Schere', '1'),
    (26, 'Küche', 'Flaschenöffner / Korkenzieher', '1'),
    (27, 'Küche', 'Spülschwamm', '1'),
    (28, 'Küche', 'Spülmittel', '1'),
    (29, 'Küche', 'Geschirrspül-Tabs-Packung', '1'),
    (30, 'Küche', 'Geschirrtuch', '1'),
    (31, 'Küche', 'Mülleimer mit Deckel', '1'),
    (32, 'Küche', 'Müllbeutel-Packung', '1'),
    (33, 'Schlafzimmer', 'Bettlaken', '0'),
    (34, 'Schlafzimmer', 'Bettbezug', '0'),
    (35, 'Schlafzimmer', 'Kopfkissenbezug', '0'),
    (36, 'Schlafzimmer', 'Bettdecke', '0'),
    (37, 'Schlafzimmer', 'Kopfkissen voll', '0'),
    (38, 'Schlafzimmer', 'Kopfkissen flach', '0'),
    (39, 'Bad', 'Handtuch groß', '0'),
    (40, 'Bad', 'Handtuch klein', '0'),
    (41, 'Bad', 'Handwaschseife', '0'),
    (42, 'Bad', 'Toilettenpapier', '0'),
    (43, 'Bad', 'Abfallbehälter klein', '0'),
    (44, 'Bad', 'Duschbad', '0'),
    (45, 'Bad', 'Toilettenbürste', '0')
)
insert into public.unit_equipment (unit_id, bereich, ausstattung, anzahl_soll, anzahl_ist, sort_order)
select u.id,
       t.bereich,
       t.ausstattung,
       case when t.qty = 'x' then coalesce(u.max_extra_beds, u.max_persons, 0) else t.qty::int end,
       0,
       t.sort_order
from public.property_units u
cross join tpl t
where u.max_persons > 1
on conflict (unit_id, bereich, ausstattung) do nothing;
