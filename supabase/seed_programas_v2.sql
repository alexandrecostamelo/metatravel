-- Seed v2: adiciona programas que o seats.aero retorna mas estavam faltando no banco
-- Rodar no Supabase SQL Editor
-- Idempotente: usa INSERT ... ON CONFLICT DO NOTHING

-- Inserir programas faltantes
INSERT INTO programas_milhas (slug, nome, moeda_taxas_default, ativo)
VALUES
  ('aadvantage',     'American AAdvantage',        'USD', true),
  ('alaska',         'Alaska Mileage Plan',         'USD', true),
  ('avios_iberia',   'Iberia Plus (Avios)',          'EUR', true),
  ('avios_british',  'British Airways Avios',        'GBP', true),
  ('emirates',       'Emirates Skywards',            'USD', true),
  ('etihad',         'Etihad Guest',                 'USD', true),
  ('finnair_plus',   'Finnair Plus',                 'EUR', true),
  ('flying_blue',    'Air France/KLM Flying Blue',   'EUR', true),
  ('lufthansa',      'Miles & More (Lufthansa)',      'EUR', true),
  ('qantas',         'Qantas Frequent Flyer',        'USD', true),
  ('singapore',      'Singapore KrisFlyer',          'USD', true),
  ('tap',            'TAP Miles&Go',                 'EUR', true),
  ('turkish',        'Turkish Miles & Smiles',       'USD', true),
  ('virgin_atlantic','Virgin Atlantic Flying Club',  'USD', true)
ON CONFLICT (slug) DO NOTHING;

-- Inserir cotações de referência para os novos programas
-- Valores médios de mercado (R$/milheiro) - início 2026
INSERT INTO cotacoes_milheiro (programa_id, valor_brl, fonte)
SELECT p.id, v.valor_brl::numeric, 'seed_v2'
FROM (VALUES
  ('aadvantage',     48.00),
  ('alaska',         45.00),
  ('avios_iberia',   56.00),
  ('avios_british',  58.00),
  ('emirates',       55.00),
  ('etihad',         52.00),
  ('finnair_plus',   52.00),
  ('flying_blue',    50.00),
  ('lufthansa',      55.00),
  ('qantas',         50.00),
  ('singapore',      65.00),
  ('tap',            40.00),
  ('turkish',        45.00),
  ('virgin_atlantic',48.00)
) AS v(slug, valor_brl)
JOIN programas_milhas p ON p.slug = v.slug
-- Só insere se ainda não tiver cotação (evita duplicar)
WHERE NOT EXISTS (
  SELECT 1 FROM cotacoes_milheiro c WHERE c.programa_id = p.id
);
