---
description: Criar migration SQL para Supabase seguindo padrões do projeto
---

# Migration

Crie uma migration SQL para o Supabase seguindo os padrões do projeto.

## 1. Entender o pedido
- Pergunte ao usuário o que precisa ser criado (tabelas, colunas, índices, etc.) se não foi especificado
- Verifique se já existe tabela ou migration similar em `supabase/migrations/`

## 2. Gerar arquivo SQL
- Caminho: `supabase/migrations/YYYYMMDD_<nome-descritivo>.sql` (data de hoje)
- Padrões obrigatórios:
  - `id BIGSERIAL PRIMARY KEY` (ou `UUID DEFAULT gen_random_uuid()` se justificado)
  - `created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`
  - `updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`
  - `ALTER TABLE <nome> ENABLE ROW LEVEL SECURITY;`
  - `CREATE POLICY "service_role_all" ON <nome> USING (auth.role() = 'service_role');`
  - `CREATE TRIGGER trg_<nome>_updated_at BEFORE UPDATE ON <nome> FOR EACH ROW EXECUTE FUNCTION set_updated_at();`
- Se precisar de numeração sequencial (OP-XXXX, SC-XXXX):
  - `CREATE SEQUENCE <nome>_numero_seq START 1;`
  - `numero TEXT NOT NULL DEFAULT '<prefixo>-' || LPAD(nextval('<nome>_numero_seq')::TEXT, 4, '0')`
- Valores monetários: `NUMERIC(14,2)`
- Quantidades: `NUMERIC(10,3)`
- Status/enums: `TEXT NOT NULL DEFAULT '<valor>' CHECK (<coluna> IN (...))`

## 3. Mostrar ao usuário
- Apresente o SQL completo para aprovação antes de salvar o arquivo
- Destaque tabelas, colunas e relações criadas

## 4. Salvar e instruir
- Salve o arquivo na pasta de migrations
- Instrua o usuário: "Rode no SQL Editor do Supabase ou via `npx supabase db push`"

## 5. Atualizar CLAUDE.md
- Adicione a(s) nova(s) tabela(s) na seção relevante do CLAUDE.md
- Mencione a migration criada
