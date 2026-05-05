---
description: Pesquisa profunda estruturada — descobrir fontes, validar, filtrar e organizar conhecimento
---

# Pesquisar

Pesquisa profunda e estruturada sobre um tema. Segue o ciclo: descoberta → validação → filtragem → síntese → armazenamento.

## 1. Definir escopo
Pergunte ao usuário:
- **Tema:** O que pesquisar?
- **Objetivo:** Decisão / Aprendizado / Conteúdo / Estratégia?
- **Profundidade:** Rápida (5 min) / Média (15 min) / Profunda (30+ min)?
- **Foco:** Técnico / Mercado / Concorrência / Tendências / Regulatório?

## 2. Descoberta de fontes (Deep Research)

### Fontes internas (Supabase)
- `knowledge_guias` — guias existentes sobre o tema
- `market_keywords` — dados de mercado/busca
- `nf_cabecalho` + `clientes` — histórico comercial
- `projetos` — experiência em projetos similares

### Fontes externas (via ai-hub busca web)
Buscar em múltiplas queries:
- Query principal: "[tema] + [contexto Pousinox]"
- Query técnica: "[tema] especificação técnica"
- Query mercado: "[tema] mercado Brasil 2025 2026"
- Query concorrência: "[tema] concorrentes alternativas"
- Query tendências: "[tema] tendências inovação"

### Diversidade de fontes
Coletar pelo menos 5-10 fontes de tipos diferentes:
| Tipo | Exemplo | Prioridade |
|---|---|---|
| Dados primários (pesquisa, estudo) | Artigo científico, relatório de mercado | Alta |
| Fonte oficial | Site fabricante, norma técnica | Alta |
| Análise especializada | Blog técnico, consultoria | Média |
| Notícia recente | Portal de construção, revista | Média |
| Opinião/fórum | Discussões de profissionais | Baixa |

## 3. Validar fontes

Para cada fonte, classificar:

| Fonte | Data | Credencial | Tipo | Viés | Manter? |
|---|---|---|---|---|---|
| [url/nome] | [ano] | [quem escreveu] | Primária/Secundária/Opinião | Neutro/Comercial/Acadêmico | ✅/❌ |

### Critérios de remoção
- ❌ Data > 3 anos (exceto normas estáveis)
- ❌ Sem autoria identificável
- ❌ Puramente opinativa sem dados
- ❌ Conflito de interesse óbvio (concorrente direto)
- ❌ Informação duplicada (manter a melhor)

## 4. Filtrar e organizar

### Agrupar por subtema
Organizar as fontes validadas em clusters:
- Cluster 1: [subtema A] — fontes X, Y
- Cluster 2: [subtema B] — fontes Z, W
- Cluster 3: [dados quantitativos] — fontes V

### Identificar gaps
- Falta informação sobre [aspecto X]?
- Dados desatualizados em [área Y]?
- Contradição entre fontes sobre [ponto Z]?

## 5. Sintetizar

### Formato por objetivo

**Para decisão:**
```
CONTEXTO: [situação]
DADOS-CHAVE: [números e fatos]
OPÇÕES: [A, B, C com prós/contras]
RECOMENDAÇÃO: [baseada nas fontes]
CONFIANÇA: [Alta/Média/Baixa — baseado na qualidade das fontes]
```

**Para aprendizado:**
```
CONCEITO: [definição clara]
COMO FUNCIONA: [mecanismo]
APLICAÇÃO POUSINOX: [como usar no nosso contexto]
FONTES: [referências]
```

**Para conteúdo:**
```
INSIGHTS PRINCIPAIS: [3-5 pontos]
DADOS CITÁVEIS: [números para usar em copy/posts]
ÂNGULOS: [diferentes formas de abordar o tema]
FONTES: [para credibilidade]
```

**Para estratégia:**
```
CENÁRIO ATUAL: [estado do mercado]
TENDÊNCIAS: [para onde vai]
OPORTUNIDADES: [para Pousinox]
RISCOS: [ameaças]
AÇÃO RECOMENDADA: [próximo passo]
```

## 6. Armazenar

Salvar resultado em `knowledge_guias`:
```sql
INSERT INTO knowledge_guias (
  titulo, categoria, nivel, pasta,
  o_que_e, quando_usar, como_fazer, onde_fazer, por_que,
  tags, ativo
) VALUES (
  'Pesquisa: [tema] — [data]',
  'pesquisas',
  'referencia',
  'pesquisas',
  '[síntese completa]',
  '[quando consultar este material]',
  '[dados práticos e aplicáveis]',
  '[fontes e URLs]',
  '[motivação e contexto da pesquisa]',
  ARRAY['tag1', 'tag2', 'tag3'],
  true
);
```

## 7. Formato de entrega

```
★ PESQUISA — [Tema]
Profundidade: [Rápida/Média/Profunda]
Objetivo: [Decisão/Aprendizado/Conteúdo/Estratégia]
Fontes analisadas: [N] (de [M] encontradas)
Data: [dd/mm/yyyy]

═══ FONTES VALIDADAS ═══
| # | Fonte | Tipo | Data | Confiança |
|---|---|---|---|---|
| 1 | [nome/url] | Primária | 2026 | Alta |
| 2 | ... | ... | ... | ... |

═══ SÍNTESE ═══
[Formato conforme objetivo — ver seção 5]

═══ DADOS-CHAVE ═══
- [fato 1 — com fonte]
- [fato 2 — com fonte]
- [número citável]

═══ GAPS E INCERTEZAS ═══
- [o que não foi possível confirmar]
- [onde as fontes divergem]

═══ APLICAÇÃO POUSINOX ═══
- [como usar este conhecimento no dia a dia]
- [próxima ação sugerida]

═══ SALVO ═══
✅ knowledge_guias: "Pesquisa: [tema]"
   Tags: [lista]
   Consultável via RAG no Assistente
```

## 8. Integração com pipeline
- Pesquisa de mercado → `/decisao-admin` (embasar decisão)
- Pesquisa de conteúdo → `/gerar-conteudo` (escrever artigo)
- Pesquisa de concorrência → `/meta-ads` (posicionamento)
- Pesquisa técnica → `/briefing` (especificar projeto)
- Pesquisa de segmento → `/sdr-autonomo` (personalizar abordagem)
