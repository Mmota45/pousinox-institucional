---
description: Gera textos de abordagem comercial por prospect — WhatsApp, email, roteiro
---

# Gerar Abordagem

Gere textos de abordagem comercial personalizados para um prospect.

## 1. Identificar prospect
- Receba CNPJ, nome ou ID do prospect
- Busque dados no Supabase (`prospeccao`): nome, segmento, porte, cidade/UF, telefones, whatsapp, email
- Se `cliente_ativo = true`, busque histórico de compras em `nf_cabecalho`
- Se houver deal no pipeline, busque estágio atual

## 2. Gerar textos personalizados

### WhatsApp (curto, direto)
- Saudação com nome da empresa
- Referência ao segmento (usar lógica de `gerarMsgWpp` em AdminCentralVendas.tsx):
  - **Açougue/Frigorífico**: foco em higiene ANVISA, inox 304
  - **Restaurante/Hotel**: foco em design premium, durabilidade
  - **Construção/Revestimento**: foco em segurança, norma técnica
  - **Hospital/Laboratório**: foco em assepsia, certificação
  - **Supermercado**: foco em custo-benefício, volume
  - **Genérico**: foco em qualidade industrial, personalização
- CTA para catálogo ou orçamento
- Max 500 caracteres

### Email (formal, completo)
- Assunto atrativo com gatilho de segmento
- Apresentação Pousinox (1 parágrafo)
- Proposta de valor para o segmento
- Se cliente existente: referência a compras anteriores
- CTA + assinatura

### Roteiro de ligação (tópicos)
- Abertura (quem somos, por que ligamos)
- Perguntas de qualificação por segmento
- Apresentação do produto/solução
- Objeções comuns e respostas
- Fechamento (próximo passo)

## 3. Apresentar ao usuário
- Mostre os 3 textos formatados
- Inclua botão de copiar mental: separe cada texto claramente
- Se prospect tem WhatsApp validado, destaque o texto WA primeiro

## 4. Registrar (opcional)
- Pergunte se quer registrar a atividade em `activity_log`
- Tipo: `abordagem_gerada`, canal: `whatsapp|email|telefone`
