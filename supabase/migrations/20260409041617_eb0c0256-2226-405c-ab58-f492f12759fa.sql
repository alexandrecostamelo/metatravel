
-- Tabela programas_milhas
CREATE TABLE public.programas_milhas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  moeda_taxas_default TEXT NOT NULL DEFAULT 'BRL',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.programas_milhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública programas" ON public.programas_milhas FOR SELECT USING (true);
CREATE POLICY "Escrita autenticada programas" ON public.programas_milhas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update autenticado programas" ON public.programas_milhas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete autenticado programas" ON public.programas_milhas FOR DELETE TO authenticated USING (true);

-- Tabela cotacoes_milheiro
CREATE TABLE public.cotacoes_milheiro (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  programa_id BIGINT NOT NULL REFERENCES public.programas_milhas(id) ON DELETE CASCADE,
  valor_brl NUMERIC(10,2) NOT NULL,
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  fonte TEXT NOT NULL DEFAULT 'manual'
);

ALTER TABLE public.cotacoes_milheiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública cotações" ON public.cotacoes_milheiro FOR SELECT USING (true);
CREATE POLICY "Escrita autenticada cotações" ON public.cotacoes_milheiro FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update autenticado cotações" ON public.cotacoes_milheiro FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete autenticado cotações" ON public.cotacoes_milheiro FOR DELETE TO authenticated USING (true);

-- Tabela buscas_log
CREATE TABLE public.buscas_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  data_ida DATE NOT NULL,
  data_volta DATE,
  cabine TEXT NOT NULL,
  total_ofertas INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.buscas_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê próprias buscas" ON public.buscas_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Qualquer um pode inserir busca" ON public.buscas_log FOR INSERT WITH CHECK (true);

-- Seed: programas
INSERT INTO public.programas_milhas (slug, nome) VALUES
  ('smiles', 'Smiles'),
  ('azul', 'Azul Fidelidade'),
  ('latam_pass', 'LATAM Pass'),
  ('aeroplan', 'Aeroplan'),
  ('avios_qatar', 'Avios Qatar'),
  ('united', 'United MileagePlus');

-- Seed: cotações
INSERT INTO public.cotacoes_milheiro (programa_id, valor_brl)
SELECT id, 16.00 FROM public.programas_milhas WHERE slug = 'smiles'
UNION ALL
SELECT id, 15.00 FROM public.programas_milhas WHERE slug = 'azul'
UNION ALL
SELECT id, 25.00 FROM public.programas_milhas WHERE slug = 'latam_pass'
UNION ALL
SELECT id, 45.00 FROM public.programas_milhas WHERE slug = 'aeroplan'
UNION ALL
SELECT id, 56.00 FROM public.programas_milhas WHERE slug = 'avios_qatar'
UNION ALL
SELECT id, 48.00 FROM public.programas_milhas WHERE slug = 'united';
