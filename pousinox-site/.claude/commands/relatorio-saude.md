---
description: Relatório consolidado de saúde do sistema — banco, build, edge functions
---

# Relatório de Saúde

Consolide os resultados de todas as verificações em um relatório único.

## 1. Coletar dados
Execute as verificações (ou use resultados já disponíveis na conversa):
- **Build**: `npm run typecheck` + `npm run build`
- **Banco**: tamanho, RLS, sequences (via /checar-db)
- **Edge Functions**: sincronia local/deployed (via /checar-edge)
- **Git**: branches pendentes, arquivos não commitados

## 2. Relatório consolidado

```
📊 Relatório de Saúde — Pousinox — [data]

## Build
| Item | Status |
|---|---|
| Typecheck | ✅/❌ |
| Build | ✅/❌ |
| Console.logs | ⚠️ N ocorrências |

## Banco de Dados
| Item | Status |
|---|---|
| Disco | X.X GB / 8 GB |
| RLS | ✅/⚠️ N tabelas |
| Tabela maior | prospeccao (X GB) |

## Edge Functions
| Item | Status |
|---|---|
| Total | N functions |
| Pendentes deploy | N |

## Git
| Item | Status |
|---|---|
| Branch | preview |
| Não commitados | N arquivos |
| Ahead/behind | +N/-N |

## Resumo
🟢 Sistema saudável / 🟡 N warnings / 🔴 N problemas críticos
```

## 3. Recomendações
- Liste ações prioritárias se houver problemas
- Ordene por criticidade (❌ primeiro, ⚠️ depois)
