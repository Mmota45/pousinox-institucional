# Follow-up Hoje

Lista follow-ups do dia com contexto e mensagem sugerida.

## 1. Buscar follow-ups
Consulte via supabaseAdmin:
- `followups` com `data_prevista <= hoje` e `status = 'pendente'`
- Join com `prospeccao` para nome, segmento, cidade, UF, WhatsApp
- Join com `pipeline_deals` se houver `deal_id`
- Ordene: atrasados primeiro, depois hoje

## 2. Enriquecer contexto
Para cada follow-up:
- Último contato (activity_log mais recente do prospect)
- Deal no pipeline? Qual estágio e valor?
- Tem WhatsApp validado?

## 3. Gerar mensagem sugerida
Para cada prospect, gere uma mensagem curta de WhatsApp considerando:
- Segmento do prospect
- Histórico (primeiro contato? retorno? negociação?)
- Tom profissional e direto

## 4. Relatório

```
📋 Follow-ups — [data]

⚠ ATRASADOS (N)
| # | Prospect | Segmento | UF | Dias atraso | Deal | WhatsApp |
|---|---|---|---|---|---|---|
| 1 | Nome | Construção | SP | 3d | R$ 5k (proposta) | ✅ 11999... |

Mensagem sugerida:
"Bom dia [nome]! Tudo bem? Gostaria de retomar nossa conversa sobre [contexto]. Posso enviar mais detalhes?"

---

▶ HOJE (N)
| # | Prospect | Segmento | UF | Tipo | Deal | WhatsApp |
|---|---|---|---|---|---|---|
| 1 | Nome | Restaurante | MG | Retorno | R$ 3k (qualificado) | ✅ 31988... |

Mensagem sugerida:
"Olá [nome]! Conforme combinamos, estou entrando em contato sobre [contexto]."

---

Resumo: N follow-ups (X atrasados, Y hoje)
Ação: Responda com o número do prospect para enviar WhatsApp
```
