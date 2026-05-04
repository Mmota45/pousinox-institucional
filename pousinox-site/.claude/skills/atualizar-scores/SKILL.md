---
description: Recalcula scores dos prospects e mostra top 10 priorizados
---

# Atualizar Scores

Recalcule os scores dos prospects e apresente os mais promissores.

## 1. Executar scoring
- Chame a RPC `fn_top_prospects` via Supabase REST:
  ```
  POST /rest/v1/rpc/fn_top_prospects
  Body: {"n": 50, "filtro_uf": null}
  ```
- Se o usuário especificou UF, passe no filtro

## 2. Análise
- Agrupe por UF: quantos prospects por estado
- Agrupe por segmento: distribuição
- Identifique os com WhatsApp validado
- Identifique os que já têm deal no pipeline

## 3. Apresentar Top 10

```
🎯 Top 10 Prospects — [data]

| # | Empresa | UF | Segmento | Score | WhatsApp | Deal |
|---|---|---|---|---|---|---|
| 1 | Empresa X | SP | Construção | 8.5 | ✅ | — |
| 2 | Empresa Y | MG | Restaurante | 7.8 | ❌ | Proposta |
| ... |

📊 Distribuição:
- Por UF: SP (15), MG (12), RJ (8), ...
- Por segmento: Construção (18), Restaurante (10), ...
- Com WhatsApp: 32/50 (64%)
- Com deal: 8/50 (16%)
```

## 4. Sugestões
- Prospects com score alto + WhatsApp validado + sem deal = prioridade máxima
- Sugira próximas ações: `/gerar-abordagem` para os top 3
