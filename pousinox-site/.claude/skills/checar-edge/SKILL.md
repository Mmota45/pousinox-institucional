---
description: Lista edge functions locais vs deployed — alerta divergências
---

# Checar Edge Functions

Verifique se as edge functions locais estão sincronizadas com o Supabase.

## 1. Listar functions locais
- Rode `ls supabase/supabase/functions/` para listar todas as pastas de functions
- Para cada pasta, verifique se existe `index.ts`

## 2. Listar functions deployed
- Rode `npx supabase functions list --project-ref vcektwtpofypsgdgdjlx` (se CLI disponível)
- Se CLI não disponível, liste as functions conhecidas do CLAUDE.md

## 3. Comparar
- Identifique functions locais não deployadas
- Identifique functions com modificações recentes: `git log --oneline -1 -- supabase/supabase/functions/<nome>/`

## 4. Relatório

```
⚡ Edge Functions — [data]

| Function | Local | Deployed | Último commit |
|---|---|---|---|
| extrair-memorial | ✅ | ✅ | abc1234 (2d atrás) |
| validar-whatsapp | ✅ | ⚠️ Modificada | def5678 (hoje) |
| nova-func | ✅ | ❌ Não deployed | — |

Ação necessária: N functions precisam de deploy
```

Se houver functions pendentes, sugira: `npx supabase functions deploy <nome>`
