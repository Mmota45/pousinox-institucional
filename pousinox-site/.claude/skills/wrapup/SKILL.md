---
description: Resumo executivo da sessão — salva aprendizados no knowledge_guias para memória de longo prazo
---

# Wrapup

Gere um resumo executivo da sessão atual e salve no "cérebro" (knowledge_guias) para consulta futura via RAG.

## 1. Analisar a sessão
Revise o que foi feito nesta conversa:
- Arquivos criados/modificados
- Decisões tomadas e por quê
- Problemas encontrados e como foram resolvidos
- Skills ou módulos criados
- Aprendizados não-óbvios (gotchas, workarounds)

## 2. Classificar aprendizados

| Tipo | Salvar? | Exemplo |
|---|---|---|
| Decisão de arquitetura | ✅ | "Usamos keyword-match em vez de embeddings para guias" |
| Workaround/gotcha | ✅ | "PromiseLike do Supabase não tem .catch" |
| Padrão descoberto | ✅ | "Windows git não rastreia case rename" |
| Convenção definida | ✅ | "Skills precisam de frontmatter description" |
| Fix trivial | ❌ | Typo corrigido |
| Código escrito | ❌ | Derivável do git |

## 3. Gerar resumo executivo

Estrutura:
```
SESSÃO [data] — [título descritivo]

CONTEXTO: [1 linha — o que motivou esta sessão]

DECISÕES:
- [decisão 1]: [justificativa curta]
- [decisão 2]: [justificativa curta]

APRENDIZADOS:
- [gotcha/insight 1]
- [gotcha/insight 2]

IMPLEMENTADO:
- [feature/fix 1]
- [feature/fix 2]

PENDENTE:
- [item não finalizado, se houver]

TAGS: [palavras-chave para busca futura]
```

## 4. Salvar no knowledge_guias

Inserir via Supabase:
```sql
INSERT INTO knowledge_guias (
  titulo, categoria, nivel, pasta,
  o_que_e, quando_usar, como_fazer, onde_fazer, por_que,
  ativo
) VALUES (
  'Sessão [dd/mm/yyyy] — [título]',
  'sessoes',
  'referencia',
  'sessoes',
  '[resumo executivo completo]',
  'Consultar quando trabalhar em tema similar ou precisar de contexto histórico',
  '[decisões + aprendizados formatados]',
  '[arquivos/módulos principais afetados]',
  '[motivação da sessão e resultados alcançados]',
  true
);
```

## 5. Atualizar memórias (se aplicável)
- Se houve feedback do usuário → criar/atualizar memória em `~/.claude/projects/C--Users-marco/memory/`
- Se convenção nova foi definida → salvar como memória tipo `feedback`
- Se informação de projeto mudou → atualizar memória tipo `project`

## 6. Verificar continuidade
- Há algo pendente para próxima sessão? → Registrar no resumo
- Alguma skill precisa de ajuste baseado no que aprendemos? → Notar
- CLAUDE.md precisa de atualização? → Fazer agora ou registrar

## 7. Formato final

```
★ WRAPUP — [data]

═══ RESUMO ═══
[3-5 linhas do que aconteceu]

═══ SALVO NO CÉREBRO ═══
✅ knowledge_guias: "Sessão [data] — [título]"
   Tags: [lista]
   Pasta: sessoes

═══ MEMÓRIAS ATUALIZADAS ═══
- [arquivo.md]: [o que mudou]
- Ou: Nenhuma atualização necessária

═══ PARA PRÓXIMA SESSÃO ═══
- [pendência 1]
- [pendência 2]
- Ou: Tudo concluído ✅
```

## 8. Benefício
Ao salvar cada sessão no knowledge_guias:
- O RAG do Assistente encontra contexto histórico automaticamente
- Perguntas como "por que fizemos X?" são respondidas com base real
- Decisões passadas não são esquecidas ou repetidas
- Onboarding de novo membro: "leia as sessões" → contexto completo
