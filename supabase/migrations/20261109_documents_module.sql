-- ============================================================
-- Belege-Modul
-- ============================================================

-- Belegarten (Angebot, Rechnung, …)
CREATE TABLE IF NOT EXISTS document_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,          -- z.B. "Rechnung"
  prefix      text NOT NULL,          -- z.B. "R"
  counter     integer NOT NULL DEFAULT 0,  -- laufender Tageszähler (wird bei Belegerstellung erhöht)
  default_folder text,               -- App-Setting-Key für das Standardverzeichnis
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed: Standardbelegarten
INSERT INTO document_types (name, prefix, default_folder, sort_order) VALUES
  ('Angebot',  'A', 'documents_folder_angebot',  1),
  ('Rechnung', 'R', 'documents_folder_rechnung', 2)
ON CONFLICT DO NOTHING;

-- Belege
CREATE TABLE IF NOT EXISTS documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid NOT NULL REFERENCES document_types(id),
  document_number text NOT NULL,     -- z.B. "R-2026-11-09001"
  date            date NOT NULL DEFAULT CURRENT_DATE,
  contact_id      uuid REFERENCES contacts(id),
  usage_id        uuid REFERENCES property_usages(id),
  subject_line2   text,              -- freie zweite Betreffzeile (mehrzeilig möglich)
  service_from    date,
  service_to      date,
  notes           text,
  is_finalized    boolean NOT NULL DEFAULT false,  -- nach PDF-Erstellung gesperrt
  pdf_path        text,              -- Pfad / URL der gespeicherten PDF-Datei
  pdf_created_at  timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_contact_id_idx  ON documents(contact_id);
CREATE INDEX IF NOT EXISTS documents_usage_id_idx    ON documents(usage_id);
CREATE INDEX IF NOT EXISTS documents_type_date_idx   ON documents(document_type_id, date);

-- Artikel-Stamm (Vorlagen für Positionen)
CREATE TABLE IF NOT EXISTS articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  unit            text DEFAULT 'Stk.',
  quantity        numeric(10,3) NOT NULL DEFAULT 1,
  net_price       numeric(12,2),    -- Netto-Einzelpreis (alternativ zu gross_price)
  gross_price     numeric(12,2),    -- Brutto-Einzelpreis
  vat_rate        numeric(5,2) NOT NULL DEFAULT 19.00,  -- MwSt-Satz in %
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Belegpositionen
CREATE TABLE IF NOT EXISTS document_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 1,  -- lfd. Nr.
  description     text NOT NULL,
  quantity        numeric(10,3) NOT NULL DEFAULT 1,
  gross_unit_price numeric(12,2) NOT NULL,     -- immer Brutto (ggf. hochgerechnet)
  vat_rate        numeric(5,2) NOT NULL DEFAULT 19.00,
  article_id      uuid REFERENCES articles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_items_document_idx ON document_items(document_id, position);

-- Trigger: updated_at auf documents
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: gleiche Muster wie andere Tabellen im Projekt
ALTER TABLE document_types  ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_items   ENABLE ROW LEVEL SECURITY;

-- Authentifizierte Nutzer dürfen alles lesen/schreiben
CREATE POLICY "auth_all" ON document_types  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON documents        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON articles         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON document_items   FOR ALL TO authenticated USING (true) WITH CHECK (true);
