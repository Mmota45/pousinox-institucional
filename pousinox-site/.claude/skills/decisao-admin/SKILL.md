---
description: Analisar cenário e recomendar decisão com prós, contras e riscos
---

# Decisao Admin

Analise um cenário de negócio e recomende uma decisão fundamentada com prós, contras, riscos e plano de ação.

## Contexto Pousinox
- **Empresa:** Fabricante industrial pequena (5-15 funcionários)
- **Faturamento:** R$ 50k-200k/mês (variável por projeto)
- **Margem:** 40-60% bruta (produto industrial de nicho)
- **Mercado:** B2B, ciclo de venda 15-60 dias, ticket R$2k-50k
- **Região:** Base em MG, atende Brasil todo

## 1. Entender o dilema
Pergunte ao usuário:
- Qual a decisão a ser tomada?
- Qual o contexto/motivação?
- Quais opções estão na mesa?
- Há deadline?
- Qual o impacto financeiro estimado?
- Quem é afetado? (equipe, clientes, fornecedores)

## 2. Coletar dados relevantes
Buscar no sistema (se aplicável):
- Dados financeiros (fin_lancamentos, vw_fin_saldo_mes)
- Pipeline ativo (pipeline_deals)
- Capacidade produtiva (ordens_producao)
- Estoque disponível (estoque_itens)
- Histórico de vendas (nf_cabecalho)
- Market data (market_keywords)

## 3. Analisar com frameworks

### Matriz de decisão (se múltiplas opções)
| Critério (peso) | Opção A | Opção B | Opção C |
|---|---|---|---|
| Impacto financeiro (30%) | X/10 | X/10 | X/10 |
| Risco (25%) | X/10 | X/10 | X/10 |
| Esforço/complexidade (20%) | X/10 | X/10 | X/10 |
| Alinhamento estratégico (15%) | X/10 | X/10 | X/10 |
| Reversibilidade (10%) | X/10 | X/10 | X/10 |
| **Score total** | **X** | **X** | **X** |

### Análise SWOT (se decisão estratégica)
| | Positivo | Negativo |
|---|---|---|
| Interno | Forças | Fraquezas |
| Externo | Oportunidades | Ameaças |

### Cenários (se incerteza alta)
- **Otimista:** O que acontece se tudo der certo?
- **Realista:** O mais provável
- **Pessimista:** Worst case — é suportável?

## 4. Recomendar

### Estrutura da recomendação
1. **Decisão recomendada** (1 frase clara)
2. **Por quê** (3 razões principais com dados)
3. **Riscos** (o que pode dar errado + mitigação)
4. **Custo da inação** (o que acontece se não decidir)
5. **Plano de execução** (primeiros 3 passos concretos)
6. **Critério de revisão** (quando reavaliar a decisão)

### Princípios de decisão Pousinox
- Priorizar caixa sobre crescimento (empresa pequena = vulnerável)
- Preferir decisões reversíveis (testar antes de escalar)
- Cliente concentrado = risco (max 25% do faturamento)
- Investir em diferencial (inox, laudo, qualidade) não em preço
- Automação > contratação (margem protegida)

## 5. Formato de entrega

```
★ DECISÃO — [Título do dilema]
Data: [dd/mm/yyyy]
Urgência: [Alta/Média/Baixa]
Impacto: [R$ estimado ou qualitativo]

═══ CONTEXTO ═══
[2-3 linhas resumindo a situação]

═══ OPÇÕES ═══
A) [descrição]
B) [descrição]
C) [não fazer nada / manter status quo]

═══ ANÁLISE ═══
[Matriz de decisão ou SWOT — o que for mais adequado]

═══ RECOMENDAÇÃO ═══
▶ [Opção recomendada]

Razões:
1. [com dado]
2. [com dado]
3. [com dado]

═══ RISCOS ═══
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| ... | Alta/Média/Baixa | R$ ou qualitativo | Como evitar |

═══ CUSTO DA INAÇÃO ═══
[O que se perde ao não decidir — quantificar se possível]

═══ PLANO DE EXECUÇÃO ═══
1. [Ação imediata — esta semana]
2. [Próximo passo — semana que vem]
3. [Validação — em 15-30 dias]

═══ REVISÃO ═══
Reavaliar em: [data ou trigger]
Métrica de sucesso: [como saber se deu certo]
Ponto de abort: [quando pivotar se der errado]
```

## 6. Tipos comuns de decisão

| Tipo | Framework ideal | Dados-chave |
|---|---|---|
| Investir em equipamento | ROI + Payback | Custo vs economia mensal |
| Contratar vs terceirizar | Custo total + risco | Fixo vs variável, dependência |
| Novo mercado/segmento | TAM + esforço | market_keywords, prospects na base |
| Precificação | Margem + elasticidade | Custos, concorrência, willingness-to-pay |
| Cortar produto/serviço | Contribuição marginal | Margem unitária, volume, cross-sell |
| Parceria/distribuidor | Margem cedida vs volume | Alcance, exclusividade, controle |
