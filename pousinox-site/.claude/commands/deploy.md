---
description: Build + deploy site (Cloudflare Pages) + edge functions Supabase
---

# Deploy

Execute as etapas abaixo em sequência. **Pare imediatamente se qualquer etapa falhar.**

## 1. Typecheck
- Rode `npm run typecheck`
- Se falhar, liste os erros e PARE. Não continue o deploy com erros de tipo.

## 2. Build
- Rode `npm run build`
- Se falhar, liste os erros e PARE.

## 3. Edge Functions (se aplicável)
- Rode `git diff --name-only HEAD~1 -- supabase/supabase/functions/` para ver funções modificadas
- Para cada função modificada, rode `npx supabase functions deploy <nome-da-funcao> --project-ref <ref>`
- Se nenhuma função foi modificada, pule esta etapa

## 4. Deploy do site
- Rode `npm run deploy` (push para gh-pages via script existente)
- Aguarde conclusão e reporte o resultado

## 5. Resumo
- Reporte:
  - ✅/❌ Typecheck
  - ✅/❌ Build
  - ✅/❌ Edge functions (N deployadas) ou ⏭ Nenhuma modificada
  - ✅/❌ Site deploy
  - URL: pousinox.com.br
