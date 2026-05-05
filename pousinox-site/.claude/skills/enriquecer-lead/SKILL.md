---
description: Enriquecer prospect com dados externos — site, redes, decisores, email, qualificação
---

# Enriquecer Lead

Pipeline de enriquecimento: pega prospect da base e busca informações externas para qualificar antes da abordagem.

## Contexto Pousinox
- **Base:** 3M+ prospects em `prospeccao` (CNPJ, nome, segmento, porte, telefone, UF)
- **Edge function:** `enriquecer-prospects` (já deployed)
- **Busca web:** Brave + Serper via `ai-hub`
- **Dados existentes:** CNPJ, razão social, segmento, porte, telefone1/2, email, cidade, UF

## 1. Selecionar prospects para enriquecimento
Pergunte ao usuário:
- Lista específica? (nomes ou IDs)
- Ou filtro: UF + Segmento + Score mínimo?
- Volume: quantos enriquecer? (recomendado: 5-20 por vez)

## 2. Pesquisa multicanal

Para cada prospect, buscar em múltiplas fontes:

### Fontes de dados
| Fonte | O que buscar | Como |
|---|---|---|
| Google (site oficial) | URL, serviços, porte real | Busca: "{nome empresa} {cidade}" |
| Google (contato) | Email, telefone, WhatsApp | Busca: "{nome empresa} {cidade} telefone celular site" |
| CNPJ.biz / ReceitaWS | Sócios, capital social, atividade | API ou busca por CNPJ |
| LinkedIn | Decisores (nome, cargo) | Busca: "{empresa} LinkedIn" |
| Instagram | Presença digital, posts recentes | Busca: "{empresa} Instagram" |
| Notícias | Obras recentes, expansão, licitações | Busca: "{empresa} obra" ou "{empresa} licitação" |

### Dados a extrair
- **Site oficial:** URL, tem formulário de contato? tem WhatsApp?
- **Decisor:** Nome do responsável técnico/compras + cargo
- **Email corporativo:** Padrão (nome@empresa.com.br)
- **Redes sociais:** Instagram/LinkedIn da empresa
- **Contexto:** Obra recente? Expansão? Novo projeto?
- **Concorrência:** Já usa fixador? Qual tipo?

## 3. Qualificar (Match Score)

Calcular score de qualificação 0-10:

| Critério | Peso | Como medir |
|---|---|---|
| Usa porcelanato/revestimento | 3 | Site menciona, segmento compatível |
| Tem obra ativa/recente | 2 | Notícias, posts, licitações |
| Porte compatível (médio/grande) | 2 | Capital social, número funcionários |
| Decisor identificado | 1.5 | Nome + cargo encontrado |
| Canal de contato direto | 1 | WhatsApp ou email do decisor |
| Região prioritária | 0.5 | MG/SP/RJ/PR/SC |

**Classificação:**
- 8-10: Hot lead — abordar imediatamente
- 5-7: Warm lead — abordar com material educativo
- 0-4: Cold — manter na base, não priorizar

## 4. Gerar perfil enriquecido

Para cada prospect, montar ficha:

```
▸ [EMPRESA] — Score: X/10 [HOT/WARM/COLD]
  CNPJ: XX.XXX.XXX/XXXX-XX
  Site: https://...
  Segmento: Construção civil
  Porte: Médio (50-100 func)
  Cidade/UF: Belo Horizonte/MG

  DECISOR:
  - Nome: João Silva
  - Cargo: Diretor de Obras
  - LinkedIn: [url]
  - Email: joao@empresa.com.br

  CONTEXTO:
  - Obra ativa: Condomínio XYZ (fachada porcelanato)
  - Post recente: Instagram mostra obra em andamento
  - Usa fixador: Não identificado (oportunidade)

  CANAIS:
  - WhatsApp: (31) 99999-0000 ✅ validado
  - Email: contato@empresa.com.br
  - Instagram: @empresa_construcao

  ABORDAGEM SUGERIDA:
  - Ângulo: [qual pain point explorar]
  - Canal: [WhatsApp/Email/LinkedIn]
  - Mensagem: [1 linha de hook personalizado]
```

## 5. Atualizar base
Salvar dados enriquecidos em `prospeccao`:
- `website`, `email`, `whatsapp` (se novos)
- `observacoes` (contexto encontrado)
- Registrar em `activity_log`: tipo='enriquecimento'

## 6. Formato de entrega

```
★ ENRIQUECIMENTO — [N] prospects
Filtro: [segmento] / [UF]
Data: [dd/mm/yyyy]

═══ RESULTADO ═══
| # | Empresa | Score | Decisor | Canal | Status |
|---|---|---|---|---|---|
| 1 | Empresa A | 9/10 HOT | João (Dir. Obras) | WhatsApp | Abordar |
| 2 | Empresa B | 6/10 WARM | Maria (Arq.) | Email | Nutrir |
| 3 | Empresa C | 3/10 COLD | — | — | Manter |

═══ FICHAS DETALHADAS ═══
[ficha por prospect — ver formato acima]

═══ PRÓXIMOS PASSOS ═══
- HOT leads → /sdr-autonomo (gerar mensagem + agendar)
- WARM leads → /copy-vendas (sequência de nutrição)
- COLD leads → Manter na base para scoring futuro

Dados atualizados na base: [N] prospects enriquecidos
```

## 7. Integração com pipeline
- Hot leads enriquecidos → `/sdr-autonomo` para abordagem imediata
- Decisor identificado → Personalizar mensagem com nome e cargo
- Obra ativa encontrada → Mencionar na abordagem ("Vi que estão com o projeto X...")
- Sem WhatsApp → Buscar no site/Instagram antes de descartar
