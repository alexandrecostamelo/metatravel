# Schema real do Supabase

Gerado via SQL Editor → information_schema.columns em 2026-04-09.

## programas_milhas

| coluna              | tipo                     | nullable | default  |
|---------------------|--------------------------|----------|----------|
| id                  | bigint                   | NO       |          |
| slug                | text                     | NO       |          |
| nome                | text                     | NO       |          |
| moeda_taxas_default | text                     | NO       | 'BRL'    |
| ativo               | boolean                  | NO       | true     |
| criado_em           | timestamp with time zone | NO       | now()    |

## cotacoes_milheiro

| coluna        | tipo                     | nullable | default   |
|---------------|--------------------------|----------|-----------|
| id            | bigint                   | NO       |           |
| programa_id   | bigint                   | NO       |           |
| valor_brl     | numeric                  | NO       |           |
| vigente_desde | timestamp with time zone | NO       | now()     |
| fonte         | text                     | NO       | 'manual'  |

## buscas_log

| coluna        | tipo                     | nullable | default |
|---------------|--------------------------|----------|---------|
| id            | bigint                   | NO       |         |
| user_id       | uuid                     | YES      |         |
| origem        | text                     | NO       |         |
| destino       | text                     | NO       |         |
| data_ida      | date                     | NO       |         |
| data_volta    | date                     | YES      |         |
| cabine        | text                     | NO       |         |
| total_ofertas | integer                  | NO       | 0       |
| criado_em     | timestamp with time zone | NO       | now()   |
