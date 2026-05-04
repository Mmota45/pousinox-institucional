---
description: Analisa dados do GSC via edge function, identifica oportunidades e recomenda ações de SEO
---

# Radar SEO — Análise Automática

Consulta o Google Search Console via edge function `central-vendas-gsc` e gera relatório com oportunidades.

## 1. Coletar dados do GSC

Chamar a edge function com período de 28 dias:

```js
const { data } = await supabaseAdmin.functions.invoke('central-vendas-gsc', {
  body: { acao: 'gsc', dias: 28 }
})
```

Usar o supabaseAdmin de `src/lib/supabase.ts`:
- URL: `https://vcektwtpofypsgdgdjlx.supabase.co`
- Service key: ler de `src/lib/supabase.ts`

Executar via Node.js (`node -e "..."`) com `@supabase/supabase-js`.

## 2. Analisar KPIs

Extrair do retorno:
- `totalClicks`, `totalImpressions`, `avgCtr`, `avgPosition`
- `topQueries` (array com clicks, impressions, ctr, position por query)
- `totalQueries`

## 3. Classificar queries em quadrantes

| Quadrante | Critério | Ação |
|-----------|----------|------|
| **Quick Wins** | Posição 4-20 + impressões > 50 | Otimizar página existente (meta, H1, conteúdo) |
| **Manter** | Posição 1-3 | Monitorar, não mexer |
| **Potencial** | Posição > 20 + impressões > 100 | Criar conteúdo dedicado |
| **Long Tail** | Impressões < 20 | Ignorar por agora |

## 4. Cruzar com market_keywords

Consultar `market_keywords` no Supabase para verificar:
- Quais queries do GSC já têm keywords cadastradas
- Quais keywords cadastradas NÃO aparecem no GSC (gap de conteúdo)

```sql
SELECT termo, volume_mensal, uf, intencao FROM market_keywords WHERE ativo = true LIMIT 500
```

## 5. Verificar páginas do site

Para cada Quick Win, verificar se a página correspondente:
- Tem H1 com a keyword
- Tem meta description com a keyword
- Tem conteúdo relevante
- Usar Grep/Read para analisar os componentes em `src/pages/`

## 6. Gerar relatório

```
📊 Radar SEO — [data]

## KPIs (últimos 28 dias)
| Métrica | Valor | Meta |
|---------|-------|------|
| Posição Média | X.X | < 10 |
| CTR | X.X% | > 5% |
| Cliques | XXX | ↑ |
| Impressões | XXX | ↑ |

## Quick Wins (otimizar agora)
| Query | Posição | Impressões | CTR | Ação |
|-------|---------|------------|-----|------|
| ... | ... | ... | ... | ... |

## Top 3 (manter)
| Query | Posição | Cliques |
|-------|---------|---------|

## Gaps (keywords sem presença no GSC)
| Keyword | Volume | UF | Sugestão |
|---------|--------|----|----------|

## Ações recomendadas (prioridade)
1. ...
2. ...
3. ...
```

## 7. Implementar ações

Se o usuário aprovar, executar as otimizações:
- Atualizar meta tags via SEO component
- Adicionar/ajustar conteúdo em páginas
- Criar FAQ schema para queries frequentes
- Atualizar sitemap.xml se novas páginas criadas

## Notas
- Sempre comparar com análise anterior (se houver em memória)
- Salvar snapshot dos KPIs em memória para tracking de evolução
- Não mexer em páginas que já estão posição 1-3
