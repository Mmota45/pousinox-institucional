# Audit RLS

Verificar se todas as tabelas admin têm Row Level Security ativo.

## 1. Listar tabelas do projeto
- Busque todas as tabelas referenciadas no CLAUDE.md e no código (supabaseAdmin.from('tabela'))
- Extraia nomes únicos

## 2. Verificar RLS
- Gere o SQL abaixo para o usuário rodar no SQL Editor:

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

- Peça ao usuário colar o resultado

## 3. Analisar resultado
- Identifique tabelas com `rowsecurity = false`
- Classifique por risco:
  - **ALTO**: tabelas com dados sensíveis (clientes, fin_*, admin_perfis, prospeccao)
  - **MEDIO**: tabelas operacionais (projetos, ordens_*, estoque_*)
  - **BAIXO**: tabelas de configuração (feature_flags, fin_categorias)

## 4. Gerar correções
- Para cada tabela sem RLS, gere:
```sql
ALTER TABLE tabela ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON tabela USING (auth.role() = 'service_role');
```

## 5. Relatório

```
🔒 Audit RLS — [data]

| Tabela | RLS | Risco | Ação |
|---|---|---|---|
| clientes | ✅ | — | — |
| nova_tabela | ❌ | ALTO | Habilitar |

Tabelas OK: N/M
Pendentes: X (gerar migration)
```
