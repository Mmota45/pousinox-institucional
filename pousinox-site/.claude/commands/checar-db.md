---
description: Verifica saúde do banco Supabase — tabelas, RLS, disco, sequences
---

# Checar DB

Verifique a saúde do banco de dados Supabase.

## 1. Conectar ao banco
- Use a API REST do Supabase com service_role key (em `src/lib/supabase.ts`)
- URL: `https://vcektwtpofypsgdgdjlx.supabase.co`

## 2. Verificações

### Tamanho das tabelas
- Rode via curl REST: `SELECT schemaname, tablename, pg_total_relation_size(schemaname||'.'||tablename) as size FROM pg_tables WHERE schemaname = 'public' ORDER BY size DESC LIMIT 20`
- Formate em MB/GB

### RLS ativo
- Verifique: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
- ⚠️ Alerte tabelas sem RLS ativo

### Sequences
- Liste: `SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public'`
- Verifique se há gaps grandes

### Uso de disco
- Consulte tamanho total do banco
- ⚠️ Alerte se > 80% do limite do plano (8GB plano Pro)

## 3. Relatório

```
🗄️ Saúde do Banco — [data]

| Verificação | Status | Detalhes |
|---|---|---|
| Disco | ✅/⚠️ | X.X GB / 8 GB (XX%) |
| RLS | ✅/⚠️ | N tabelas sem RLS |
| Top tabelas | ℹ️ | 1. prospeccao (X GB), 2. ... |
| Sequences | ✅ | N sequences ativas |
```
