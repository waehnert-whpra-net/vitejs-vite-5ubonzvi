-- Link (z. B. Vertrag in Google Drive) an einer Nutzung
alter table public.property_usages
  add column if not exists link_url   text,
  add column if not exists link_label text;
