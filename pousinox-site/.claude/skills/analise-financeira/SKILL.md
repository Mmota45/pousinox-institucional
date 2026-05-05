---
description: Análise financeira inteligente — DRE, fluxo de caixa, alertas e recomendações
---

# Analise Financeira

Análise financeira completa com diagnóstico, alertas e recomendações de ação.

## Contexto Pousinox
- **Tabelas:** fin_lancamentos, fin_movimentacoes, fin_categorias, fin_centros_custo, fin_parcelas
- **View:** vw_fin_saldo_mes (receitas, despesas, pendentes, vencidos por mês)
- **Origem dos dados:** Vendas, NFs, Projetos, Pipeline, Manual
- **Plano:** Empresa industrial pequena, foco em margem e fluxo de caixa

## 1. Coletar dados
Consultar via Supabase:

### Período
- Default: mês atual + 2 meses anteriores (comparativo)
- Ou perguntar ao usuário

### Queries
- `vw_fin_saldo_mes` — saldos mensais
- `fin_lancamentos` — pendentes e vencidos
- `fin_movimentacoes` — realizados (caixa real)
- `fin_categorias` — agrupamento por grupo
- `vendas` + `pipeline_deals` — receita futura projetada

## 2. Análise

### DRE Simplificado
| Linha | Mês Atual | Mês Anterior | Var % |
|---|---|---|---|
| Receita bruta | R$ | R$ | % |
| (-) Impostos estimados (6.5% SN) | R$ | R$ | |
| = Receita líquida | R$ | R$ | % |
| (-) Custos diretos (MP + MO) | R$ | R$ | % |
| = Margem bruta | R$ | R$ | % |
| (-) Despesas operacionais | R$ | R$ | % |
| = Resultado operacional | R$ | R$ | % |
| Margem operacional | % | % | |

### Fluxo de caixa (próximos 30 dias)
- Entradas previstas (lancamentos pendentes tipo receita)
- Saídas previstas (lancamentos pendentes tipo despesa)
- Saldo projetado
- Ponto de atenção (dia em que saldo fica negativo, se aplicável)

### Indicadores
| Indicador | Valor | Saudável | Status |
|---|---|---|---|
| Margem bruta | % | > 40% | ✅/⚠/✗ |
| Margem operacional | % | > 15% | ✅/⚠/✗ |
| Inadimplência | R$ (%) | < 5% receita | ✅/⚠/✗ |
| Prazo médio recebimento | X dias | < 30 dias | ✅/⚠/✗ |
| Prazo médio pagamento | X dias | > PMR | ✅/⚠/✗ |
| Liquidez corrente | X | > 1.5 | ✅/⚠/✗ |

## 3. Alertas automáticos

| Alerta | Condição | Ação |
|---|---|---|
| ✗ Fluxo negativo | Saldo projetado < 0 em 15 dias | Antecipar recebíveis ou adiar pagamentos |
| ⚠ Inadimplência alta | Vencidos > 10% receita | Cobrar top devedores |
| ⚠ Concentração | 1 cliente > 30% receita | Diversificar carteira |
| ⚠ Margem caindo | Margem < mês anterior em 5%+ | Revisar custos ou preços |
| ✗ Sem reserva | Caixa < 1 mês de despesa fixa | Criar reserva de emergência |

## 4. Recomendações

### Por diagnóstico
- **Fluxo apertado:** Negociar prazos com fornecedores, oferecer desconto para antecipação de clientes
- **Margem baixa:** Revisar precificação (usar `/orcamento-ia`), identificar custos cortáveis
- **Inadimplência:** Régua de cobrança automática (D+1, D+7, D+15, D+30)
- **Concentração:** Ativar prospecção (`/sdr-autonomo`) para novos segmentos
- **Crescimento:** Investir em ads (`/meta-ads`) com ROI > 3x comprovado

### Decisões com números
Sempre apresentar decisões com:
- Custo da ação vs custo da inação
- Payback estimado
- Risco (baixo/médio/alto)

## 5. Formato de entrega

```
★ ANÁLISE FINANCEIRA — [Período]

═══ RESUMO ═══
[3 bullets: saúde geral, principal alerta, principal oportunidade]

═══ DRE ═══
[tabela simplificada]

═══ FLUXO DE CAIXA (30 dias) ═══
Saldo atual: R$ X
(+) Entradas previstas: R$ X (N títulos)
(-) Saídas previstas: R$ X (N títulos)
= Saldo projetado: R$ X
Dia crítico: [data se saldo negativo]

═══ INDICADORES ═══
| Indicador | Valor | Status |
|---|---|---|
| ... | ... | ✅/⚠/✗ |

═══ ALERTAS ═══
- [✗/⚠] [descrição + impacto]

═══ RECOMENDAÇÕES ═══
| # | Ação | Impacto | Urgência |
|---|---|---|---|
| 1 | ... | R$ X/mês | Alta |
| 2 | ... | R$ X/mês | Média |

═══ TOP DEVEDORES (se inadimplência > 5%) ═══
| Cliente | Valor | Dias atraso |
|---|---|---|
| ... | R$ X | N dias |
```

## 6. Periodicidade sugerida
- **Semanal:** Fluxo de caixa + alertas (rápido, 2 min)
- **Mensal:** DRE + indicadores + recomendações (completo)
- **Trimestral:** Análise de tendências + metas
