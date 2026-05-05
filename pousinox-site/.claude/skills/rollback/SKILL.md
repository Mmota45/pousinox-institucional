---
description: Reverter último deploy rapidamente
---

# Rollback

Reverter o último deploy rapidamente.

## 1. Verificar estado atual
- Rode `git log --oneline -5` no branch principal
- Rode `git log --oneline -3 gh-pages` para ver deploys recentes
- Identifique o commit a reverter

## 2. Confirmar com o usuário
- Mostre o commit que será revertido e o que será restaurado
- Pergunte: "Confirma rollback para o commit [hash]?"

## 3. Executar rollback
- `git revert HEAD --no-edit` (no branch principal)
- Rode `npm run typecheck` — se falhar, PARE
- Rode `npm run build` — se falhar, PARE
- Rode `npm run deploy`

## 4. Relatório

```
⏪ Rollback — [data]

Revertido: [hash] [mensagem]
Restaurado para: [hash anterior] [mensagem]
Deploy: ✅/❌
URL: pousinox.com.br
```

**ATENÇÃO:** Este comando faz push para produção. Confirme antes de executar.
