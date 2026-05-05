---
description: Empresa IA completa — roda todos os departamentos em sequência (CEO → Comercial → Marketing → Financeiro)
---

# Empresa IA

Simula uma empresa completa operando com agentes IA. Cada departamento executa suas tarefas em sequência hierárquica, passando contexto entre si.

## Organograma

```
                    ┌─────────┐
                    │   CEO   │ /decisao-admin + /briefing
                    └────┬────┘
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────┴─────┐  ┌────┴────┐  ┌─────┴─────┐
    │ COMERCIAL │  │MARKETING│  │FINANCEIRO │
    └─────┬─────┘  └────┬────┘  └─────┬─────┘
          │              │              │
    ┌─────┴─────┐  ┌────┴────┐  ┌─────┴─────┐
    │    SDR    │  │ CONTEÚDO│  │  ANÁLISE  │
    │  VENDAS   │  │   ADS   │  │ RELATÓRIO │
    └───────────┘  └─────────┘  └───────────┘
```

## 1. Modo de operação
Pergunte ao usuário:
- **Completo:** Roda todos os departamentos (30-45 min)
- **Departamento:** Roda apenas 1 área (5-15 min)
- **Sprint:** Foco em 1 objetivo específico com múltiplos departamentos

## 2. Departamentos e tarefas

### CEO (Estratégia e Direção)
**Skills:** /decisao-admin, /briefing, /relatorio-semanal
**Tarefas:**
- Analisar situação atual (dados do banco)
- Definir prioridade da semana (1-3 objetivos)
- Briefar os outros departamentos
- Validar resultados ao final

**Output:** Briefing com metas → passa para departamentos

### COMERCIAL (Vendas e Prospecção)
**Skills:** /enriquecer-lead, /sdr-autonomo, /followup-hoje, /atendimento-ia, /copy-vendas
**Tarefas:**
- Verificar follow-ups pendentes
- Enriquecer top 10 prospects do dia
- Gerar mensagens personalizadas
- Preparar respostas para leads ativos
- Atualizar pipeline

**Input:** Briefing do CEO (segmento/UF foco)
**Output:** N prospects abordados, N follow-ups feitos, status pipeline

### MARKETING (Conteúdo e Ads)
**Skills:** /gerar-conteudo, /social-post, /meta-ads, /otimizar-campanha, /revisar-seo
**Tarefas:**
- Criar 1 post para redes sociais
- Verificar performance de ads ativos
- Gerar/otimizar criativos se necessário
- Revisar SEO de conteúdo recente
- Publicar conteúdo aprovado

**Input:** Briefing do CEO (tema/campanha foco)
**Output:** Conteúdo criado, métricas de ads, ações de otimização

### FINANCEIRO (Análise e Controle)
**Skills:** /analise-financeira, /relatorio-vendas, /relatorio-semanal
**Tarefas:**
- Verificar fluxo de caixa (próximos 7 dias)
- Identificar inadimplência
- Alertar vencimentos
- Calcular KPIs do período
- Recomendar ações financeiras

**Input:** Dados do banco (fin_lancamentos, fin_movimentacoes)
**Output:** Status financeiro, alertas, recomendações

### QUALIDADE (Revisão e Saúde)
**Skills:** /smoke-test, /checar-db, /checar-edge, /audit-rls
**Tarefas:**
- Verificar saúde do código
- Checar integridade do banco
- Validar edge functions
- Alertar vulnerabilidades

**Input:** Estado atual do sistema
**Output:** Score de saúde, alertas técnicos

## 3. Execução

### Modo Completo (sequencial)
```
⏳ 1/5 CEO — Analisando situação e definindo metas...
⏳ 2/5 COMERCIAL — Prospectando e gerenciando pipeline...
⏳ 3/5 MARKETING — Criando conteúdo e otimizando ads...
⏳ 4/5 FINANCEIRO — Analisando fluxo e indicadores...
⏳ 5/5 QUALIDADE — Verificando saúde do sistema...
```

### Modo Departamento
Executar apenas o departamento solicitado com profundidade total.

### Modo Sprint
Definir objetivo → Identificar departamentos envolvidos → Executar apenas o necessário.

## 4. Relatório consolidado

```
★ EMPRESA IA — Relatório [data]
Modo: [Completo/Departamento/Sprint]
Duração: [X min]

═══ CEO — DIREÇÃO ═══
Meta da semana: [objetivo definido]
Prioridades: 1) ... 2) ... 3) ...

═══ COMERCIAL ═══
| Métrica | Hoje | Meta |
|---|---|---|
| Prospects enriquecidos | N | 10/dia |
| Mensagens enviadas | N | 15/dia |
| Follow-ups feitos | N | todos pendentes |
| Respostas recebidas | N | — |
| Deals atualizados | N | — |

═══ MARKETING ═══
| Ação | Status |
|---|---|
| Post criado | ✅ [tema] |
| Ads performance | ✅/⚠ CTR X%, CPC R$X |
| SEO | ✅ Score X/10 |

═══ FINANCEIRO ═══
| Indicador | Valor | Status |
|---|---|---|
| Saldo projetado 7d | R$ X | ✅/⚠ |
| Inadimplência | R$ X (N títulos) | ✅/⚠ |
| Receita mês | R$ X | ▲/▼ vs anterior |

═══ QUALIDADE ═══
| Check | Status |
|---|---|
| Typecheck | ✅ |
| Build | ✅ |
| DB | ✅ |
| Edge functions | ✅ |

═══ DECISÕES PENDENTES ═══
- [Se algum departamento identificou decisão que precisa do CEO]

═══ PRÓXIMAS AÇÕES ═══
1. [Ação prioritária para amanhã]
2. [...]
3. [...]
```

## 5. Regras
- Cada departamento opera de forma independente mas recebe contexto dos anteriores
- Se um departamento falha, registrar e continuar com os próximos
- CEO sempre roda primeiro (define direção) e valida ao final
- Dados reais do banco — nunca inventar números
- Respeitar limites de API (15 WhatsApp/dia, rate limits)
- Modo completo = visão 360 para início do dia
- Sugerir rodar diariamente pela manhã (rotina operacional)
