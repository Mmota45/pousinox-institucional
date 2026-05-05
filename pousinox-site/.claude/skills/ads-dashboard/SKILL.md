---
description: Dashboard unificado Google Ads + Meta Ads — KPIs consolidados, filtros por período e comparativo entre canais
---

# Ads Dashboard

Dashboard centralizado que consolida dados de Google Ads e Meta Ads em uma visão única com comparativos, tendências e alertas.

## 1. Fontes de dados

### Google Ads (API v16)
```
Métricas: impressions, clicks, cost, conversions, conversion_value
Dimensões: campaign, ad_group, keyword, device, date, match_type
Endpoint: googleads.googleapis.com/v16/customers/{id}/googleAds:searchStream
```

### Meta Ads (Marketing API v19)
```
Métricas: impressions, clicks, spend, actions (leads, purchases), cpc, ctr
Dimensões: campaign, adset, ad, age, gender, placement, date
Endpoint: graph.facebook.com/v19.0/act_{id}/insights
```

### Dados internos (Supabase)
```
Tabelas: leads (origem), vendas (receita), fin_lancamentos (investimento real)
Cruzamento: UTM → lead → venda → receita (CAC real)
```

## 2. KPIs consolidados

### Visão geral (cards topo)
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Investido │ │ Cliques  │ │ Leads    │ │ CPA      │ │ ROAS     │
│R$ X.XXX  │ │ N.NNN    │ │ NNN      │ │ R$ XX    │ │ X.Xx     │
│▲12% vs   │ │▼3% vs    │ │▲8% vs    │ │▼5% vs   │ │▲15% vs  │
│anterior  │ │anterior  │ │anterior  │ │anterior  │ │anterior  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Por canal (tabela comparativa)
| Métrica | Google Ads | Meta Ads | Total | Melhor |
|---|---|---|---|---|
| Investimento | R$ X.XXX | R$ X.XXX | R$ X.XXX | — |
| Impressões | X.XXX | X.XXX | X.XXX | [canal] |
| Cliques | X.XXX | X.XXX | X.XXX | [canal] |
| CTR | X.X% | X.X% | X.X% | [canal] |
| CPC médio | R$ X.XX | R$ X.XX | R$ X.XX | [canal] |
| Conversões | XX | XX | XX | [canal] |
| CPA | R$ XX | R$ XX | R$ XX | [canal] |
| ROAS | X.Xx | X.Xx | X.Xx | [canal] |

### Tendência (últimos 30 dias)
```
Investimento ████████████████████████▓▓▓▓░░ (crescendo)
Conversões   ██████████████████████████▓▓░░ (estável)
CPA          ████████████████▓▓▓▓▓▓▓▓��▓░░░ (subindo ⚠️)
```

## 3. Filtros

| Filtro | Opções | Default |
|---|---|---|
| Período | Hoje / 7d / 14d / 30d / Custom | 7d |
| Comparar com | Período anterior / Mesmo período mês passado / YoY | Período anterior |
| Canal | Todos / Google / Meta | Todos |
| Campanha | Multi-select | Todas |
| Dispositivo | Desktop / Mobile / Tablet | Todos |

## 4. Drill-down por canal

### Google Ads — Detalhamento
```
Aba Campanhas:
| Campanha | Invest | Cliques | Conv | CPA | QS médio | Status |
|---|---|---|---|---|---|---|

Aba Palavras-chave:
| Keyword | Match | Invest | Cliques | Conv | CPA | QS | Ação |
|---|---|---|---|---|---|---|---|

Aba Dispositivos:
| Device | Invest% | CPA | Conv% | Recomendação |
|---|---|---|---|---|

Aba Termos de busca:
| Termo | Impressões | Cliques | Conv | Gasto | Ação |
|---|---|---|---|---|---|
| [termo bom] | 500 | 45 | 3 | R$90 | ✅ Manter |
| [termo ruim] | 200 | 30 | 0 | R$75 | ❌ Negativar |
```

### Meta Ads — Detalhamento
```
Aba Campanhas:
| Campanha | Objetivo | Invest | Resultado | Custo/Resultado | Status |
|---|---|---|---|---|---|

Aba Conjuntos:
| Adset | Público | Invest | CTR | CPA | Frequency | Ação |
|---|---|---|---|---|---|---|

Aba Anúncios:
| Ad | Tipo | Invest | CTR | Conv | CPA | Ação |
|---|---|---|---|---|---|---|
| [criativo A] | Vídeo | R$200 | 3.2% | 5 | R$40 | 🏆 Escalar |
| [criativo B] | Imagem | R$200 | 0.8% | 1 | R$200 | ⏸ Pausar |
```

## 5. Alertas automáticos

| Condição | Alerta | Ação sugerida |
|---|---|---|
| CPA > CAC máximo (3 dias seguidos) | 🔴 CPA acima do teto | Pausar keywords/adsets com CPA > 2x meta |
| Budget diário atingido antes das 14h | ⚠️ Orçamento esgotando cedo | Redistribuir ou aumentar budget |
| CTR caiu >30% vs semana anterior | ⚠️ Fadiga de criativo | Trocar criativos / novos testes |
| Frequency > 3 (Meta) | ⚠️ Saturação de público | Expandir audiência ou pausar |
| QS < 5 em keyword com gasto alto | ⚠️ Qualidade baixa | Otimizar página/anúncio |
| Nenhuma conversão em 48h | 🔴 Conversão zerada | Verificar tracking/pixel |

## 6. Simulador de funil

```
┌─────────────────────────────────────┐
│ SIMULADOR DE FUNIL                  │
├─────────────────────────────────────��
│ Investimento mensal: [R$ ___]       │
│ CPC médio: [R$ ___]                │
│ Taxa de conversão LP: [___]%        │
│ Taxa fechamento: [___]%             │
│ Ticket médio: [R$ ___]             │
│ CAC máximo: [R$ ___]               │
├───���───────────────────────────────��─┤
│ RESULTADO:                          │
�� Cliques: NNN                        │
│ Leads: NN                           │
│ Vendas: N                           │
│ Receita: R$ XX.XXX                  │
│ ROAS: X.Xx                          │
│ CAC real: R$ XXX [✅/<⚠️ acima]     │
│ Lucro líquido: R$ X.XXX            │
└────────────────────────────────���────┘
```

## 7. Implementação

### Como módulo admin
- Rota: `/admin/ads-dashboard`
- Dados: edge function `ads-insights` que consulta APIs + cache 1h
- Atualização: manual (botão refresh) ou automática a cada hora
- Secrets: `GOOGLE_ADS_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `META_ADS_TOKEN`, `META_ADS_ACCOUNT_ID`

### Como routine (diário)
- Schedule: 7h (junto com KPI morning)
- Output: resumo WhatsApp com métricas-chave + alertas

## 8. Formato de entrega

```
★ ADS DASHBOARD — [período]

═══ CONSOLIDADO ═══
| Canal | Invest | Conv | CPA | ROAS |
|---|---|---|---|---|
| Google | R$ X.XXX | XX | R$ XX | X.Xx |
| Meta | R$ X.XXX | XX | R$ XX | X.Xx |
| TOTAL | R$ X.XXX | XX | R$ XX | X.Xx |

═══ ALERTAS ═══
🔴 [alerta crítico]
⚠️ [alerta warning]

═══ TOP PERFORMERS ═══
Google: [keyword/campanha] — CPA R$ XX
Meta: [criativo/adset] — CPA R$ XX

═══ DESPERDÍCIO ═══
Google: R$ XXX em termos irrelevantes (N termos)
Meta: R$ XXX em anúncios com CPA > 2x meta

═══ RECOMENDAÇÃO ═══
[1-3 ações prioritárias]
```

## 9. Quando usar
- Diariamente: check rápido de saúde das campanhas
- Semanalmente: análise de tendências e otimizações
- Mensalmente: relatório consolidado + planejamento
- Sob demanda: quando CPA subir ou conversões caírem
