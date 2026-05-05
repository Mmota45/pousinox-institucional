# Backup DB

Snapshot das tabelas críticas do Supabase antes de migrations arriscadas.

## 1. Identificar tabelas críticas
Tabelas principais do sistema:
- `clientes`, `produtos`, `projetos`, `vendas`
- `fin_lancamentos`, `fin_movimentacoes`, `fin_categorias`
- `pipeline_deals`, `prospeccao` (amostra — tabela grande)
- `knowledge_guias`, `admin_perfis`
- `estoque_itens`, `estoque_movimentacoes`
- `ordens_producao`, `ordens_manutencao`

## 2. Contar registros
- Para cada tabela, rode via Supabase: `SELECT COUNT(*) FROM tabela`
- Reporte a contagem

## 3. Criar backup SQL
- Gere um arquivo `supabase/backups/backup_YYYY-MM-DD.sql` com:
  - `CREATE TABLE IF NOT EXISTS backup_YYYYMMDD_tabela AS SELECT * FROM tabela;` para cada tabela
- NÃO execute — apenas gere o SQL para o usuário rodar no SQL Editor

## 4. Relatório

```
🗄 Backup DB — [data]

| Tabela | Registros | Backup |
|---|---|---|
| clientes | N | backup_YYYYMMDD_clientes |
| ... | ... | ... |

Total: N tabelas, M registros
Arquivo: supabase/backups/backup_YYYY-MM-DD.sql
```

Instrução: "Cole o conteúdo no SQL Editor do Supabase para criar as tabelas de backup."
