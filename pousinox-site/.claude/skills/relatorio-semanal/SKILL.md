---
description: Relatório semanal consolidado — vendas, pipeline, produção, marketing
---

# Relatorio Semanal

Gere um relatório semanal completo com dados de todas as áreas do negócio.

## 1. Definir período
- Default: últimos 7 dias (segunda a domingo anterior)
- Ou perguntar ao usuário se quer período customizado

## 2. Coletar dados (via Supabase)

### Comercial
- Novos leads (count `leads` criados no período)
- Deals movidos no pipeline (count `pipeline_deals` atualizados)
- Deals ganhos e valor total
- Follow-ups realizados vs pendentes
- Prospects contactados (activity_log)

### Financeiro
- Receitas realizadas (fin_movimentacoes tipo receita)
- Despesas realizadas
- Saldo do período
- Inadimplência (vencidos pendentes)
- Novos lançamentos criados

### Produção
- Ordens criadas / concluídas / em andamento
- Projetos novos vs finalizados

### Marketing
- Posts publicados (se CMS ativo)
- Visitas ao site (GA4 se disponível)
- Leads gerados por canal

### Estoque
- Movimentações no período
- Itens abaixo do mínimo (alerta)

## 3. Comparar com semana anterior
Para cada métrica principal, calcular:
- Variação % vs semana anterior
- Tendência (subindo ▲ / estável ► / caindo ▼)

## 4. Formato de entrega

```
★ RELATÓRIO SEMANAL — [dd/mm] a [dd/mm/yyyy]

═══ RESUMO EXECUTIVO ═══
[3 bullets com destaques positivos e alertas]

═══ COMERCIAL ═══
| Métrica | Semana | Anterior | Var |
|---|---|---|---|
| Leads | N | N | ▲/▼ X% |
| Deals ganhos | N (R$ X) | N (R$ X) | ... |
| Follow-ups feitos | N/N | ... | ... |
| Prospects contactados | N | ... | ... |

═══ FINANCEIRO ═══
| Métrica | Semana | Anterior | Var |
|---|---|---|---|
| Receita | R$ X | R$ X | ... |
| Despesa | R$ X | R$ X | ... |
| Saldo | R$ X | R$ X | ... |
| Inadimplência | R$ X (N títulos) | ... | ... |

═══ PRODUÇÃO ═══
| Métrica | Semana |
|---|---|
| Ordens criadas | N |
| Ordens concluídas | N |
| Projetos ativos | N |

═══ MARKETING ═══
| Métrica | Semana |
|---|---|
| Visitas site | N |
| Leads por canal | Orgânico: N, Pago: N, Direto: N |

═══ ALERTAS ═══
- ⚠ [alerta 1: ex. estoque abaixo do mínimo]
- ⚠ [alerta 2: ex. follow-ups atrasados]

═══ PRIORIDADES PRÓXIMA SEMANA ═══
1. [Baseado nos dados — o que atacar]
2. [...]
3. [...]
```

## 5. Distribuição
Sugerir ao usuário:
- Enviar por email (via `/copy-vendas` formatado)
- Salvar em `knowledge_guias` como histórico
- Postar em canal interno (se tiver)
