---
description: Pipeline SDR completo — buscar prospects, qualificar, gerar mensagem e agendar envio
---

# SDR Autonomo

Pipeline de prospecção ativa: identifica prospects qualificados, gera mensagem personalizada e agenda envio.

## Contexto Pousinox
- **Base:** 3M+ prospects em `prospeccao` (CNPJs com segmento, porte, UF, telefone, WhatsApp)
- **Scoring:** `fn_top_prospects` calcula score on-the-fly (demanda + segmento + porte + proximidade)
- **Canais:** WhatsApp (principal), email (secundário)
- **Segmentos-alvo:** Construção civil, revestimentos, arquitetura, hospitalar, hotelaria
- **Região foco:** MG, SP, RJ, PR, SC (nessa ordem)

## 1. Definir campanha
Pergunte ao usuário:
- Objetivo: Apresentação / Reativação / Lançamento / Evento?
- Segmento-alvo: Qual(is) segmento(s)?
- UF-alvo: Qual(is) estado(s)?
- Volume: Quantos prospects por dia? (recomendado: 10-20)
- Canal: WhatsApp / Email / Ambos?

## 2. Buscar e qualificar prospects

### Critérios de qualificação
| Critério | Peso | Fonte |
|---|---|---|
| Score fn_top_prospects ≥ 6 | Alto | RPC Supabase |
| Tem WhatsApp validado | Alto | prospeccao.whatsapp_validado |
| Segmento target | Alto | prospeccao.segmento |
| Porte Médio/Grande | Médio | prospeccao.porte |
| Sem contato prévio 30d | Médio | activity_log |
| UF prioritária | Médio | prospeccao.uf |

### Query
```sql
-- Top N prospects qualificados sem contato recente
SELECT p.* FROM prospeccao p
WHERE p.segmento ILIKE '%{segmento}%'
  AND p.uf = '{uf}'
  AND p.whatsapp_validado = true
  AND p.id NOT IN (
    SELECT prospect_id FROM activity_log
    WHERE criado_em > NOW() - INTERVAL '30 days'
  )
ORDER BY score DESC
LIMIT {volume}
```

## 3. Gerar mensagens personalizadas

Para cada prospect, gerar mensagem considerando:
- **Nome da empresa** (prospeccao.nome)
- **Segmento** (adaptar linguagem e pain point)
- **Cidade/UF** (referência local)
- **Porte** (tom: grande=formal, pequeno=direto)

### Templates por segmento
| Segmento | Pain point | Hook |
|---|---|---|
| Construção | Retrabalho, peças caindo | "Fixador errado custa caro na fachada" |
| Arquitetura | Estética, acabamento | "Fixador invisível — piso limpo sem ranhuras" |
| Hospitalar | Higiene, inox | "Único fixador que não enferruja em área molhada" |
| Hotelaria | Durabilidade, manutenção | "Zero manutenção — fixador vitalício em inox" |
| Restaurante | Cozinha industrial, higiene | "Porcelanato firme na cozinha industrial" |

### Estrutura da mensagem
```
[Saudação + nome da empresa]
[Hook do segmento — 1 linha]
[Benefício concreto — 1 linha]
[Prova — laudo/clientes/anos]
[CTA claro — pergunta ou oferta]
```

Max 4-5 linhas. Sem áudio. Sem PDF no primeiro contato.

## 4. Planejar envios

### Regras de envio
- Max 15 WhatsApps/dia (limite Z-API para evitar ban)
- Intervalo: 3-5 min entre envios (parecer humano)
- Horário: 8h-11h ou 14h-16h30 (melhor resposta B2B)
- Nunca enviar: sábado, domingo, feriados
- Não reenviar para quem não respondeu (aguardar 7d para follow-up)

### Cadência
- **D0:** Primeira mensagem (apresentação + hook)
- **D+3:** Follow-up se não respondeu (enviar material: laudo ou vídeo)
- **D+7:** Último contato ("Posso ajudar de outra forma?")
- **D+30:** Reativação suave (se ainda sem resposta)

## 5. Registrar atividade
Para cada envio, registrar em:
- `activity_log`: tipo='whatsapp', canal='prospecção', prospect_id
- `followups`: agendar D+3 e D+7 automaticamente

## 6. Formato de entrega

```
★ SDR AUTÔNOMO — Campanha [nome]
Segmento: [target]
UF: [estados]
Volume: [N/dia]
Canal: [WhatsApp/Email]

═══ PROSPECTS QUALIFICADOS ([N]) ═══
| # | Empresa | Cidade/UF | Score | WhatsApp | Segmento |
|---|---|---|---|---|---|
| 1 | ... | ... | 8.2 | ✅ | Construção |

═══ MENSAGENS GERADAS ═══

▸ Prospect 1: [Empresa]
[mensagem personalizada]

▸ Prospect 2: [Empresa]
[mensagem personalizada]

...

═══ AGENDA DE ENVIOS ═══
| Data | Horário | Prospect | Tipo |
|---|---|---|---|
| dd/mm | 09:15 | Empresa 1 | Primeiro contato |
| dd/mm | 09:20 | Empresa 2 | Primeiro contato |

═══ FOLLOW-UPS AGENDADOS ═══
| Data | Prospect | Tipo |
|---|---|---|
| dd/mm+3 | Empresa 1 | Material (laudo) |
| dd/mm+7 | Empresa 1 | Último contato |

Próxima ação: Confirmar envio ou ajustar mensagens?
```

## 7. Métricas de sucesso
Após campanha ativa, medir:
- Taxa de resposta: >15% é bom para prospecção fria B2B
- Taxa de qualificação: >5% gerando deal no pipeline
- Custo por lead: R$0 (sem mídia paga)
- Tempo médio até resposta: < 24h indica bom timing
