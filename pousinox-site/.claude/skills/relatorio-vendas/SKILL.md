---
description: KPIs de vendas do período direto do banco
---

# Relatorio Vendas

KPIs de vendas do período direto do banco Supabase.

## 1. Definir período
- Pergunte ao usuário: mês atual, últimos 30 dias, ou período customizado
- Default: mês atual

## 2. Consultar dados
Execute via supabaseAdmin (no código ou SQL Editor):

### Vendas
- Total de vendas no período (count + sum valor)
- Ticket médio
- Top 5 clientes por valor

### Pipeline
- Deals por estágio (count + sum valor)
- Deals ganhos no período
- Taxa de conversão (ganhos / total)

### Financeiro
- Receitas baixadas (fin_movimentacoes tipo receita)
- Despesas baixadas
- Saldo do período
- Inadimplência (lancamentos vencidos pendentes)

### Produção
- Ordens concluídas no período
- Ordens em andamento

## 3. Relatório

```
📊 Relatório de Vendas — [período]

VENDAS
- Faturamento: R$ X.XXX,XX
- Pedidos: N
- Ticket médio: R$ X.XXX,XX
- Top clientes: 1. Nome (R$ X), 2. Nome (R$ X), ...

PIPELINE
- Deals ativos: N (R$ X.XXX total)
- Ganhos no período: N (R$ X.XXX)
- Conversão: X%

FINANCEIRO
- Receitas realizadas: R$ X.XXX
- Despesas realizadas: R$ X.XXX
- Saldo: R$ X.XXX
- Inadimplência: R$ X.XXX (N títulos)

PRODUCAO
- Concluídas: N ordens
- Em andamento: N ordens
```
