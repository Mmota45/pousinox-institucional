---
description: Gerar proposta comercial estruturada — escopo, valor, prazo, diferenciais e apresentação profissional
---

# Proposta Comercial

Gere propostas comerciais profissionais a partir de briefing mínimo. Formato pronto para envio por email/WhatsApp ou exportação PDF.

## 1. Coletar briefing

Pergunte ao usuário:
- **Cliente:** Nome, empresa, segmento
- **Necessidade:** O que o cliente pediu/precisa
- **Escopo:** Produtos/serviços a incluir
- **Prazo:** Quando precisa entregar
- **Valor:** Faixa de preço ou calcular?
- **Contexto:** Como o lead chegou? O que já sabe sobre nós?

## 2. Estrutura da proposta

### Capa
```
[LOGO POUSINOX]

PROPOSTA COMERCIAL
[Título descritivo do projeto]

Preparada para: [Nome do Cliente]
[Empresa]
[Data]

Ref: PROP-[YYYY]-[NNN]
```

### Seção 1 — Entendimento
```
## Contexto

[1-2 parágrafos mostrando que entendemos o problema/necessidade do cliente]

## Desafios identificados
- [Desafio 1 que o cliente enfrenta]
- [Desafio 2]
- [Desafio 3]
```

Objetivo: mostrar que ouvimos e entendemos antes de oferecer solução.

### Seção 2 — Solução proposta
```
## Nossa proposta

[Descrição da solução em linguagem de benefício, não de feature]

### Escopo de fornecimento
| Item | Descrição | Qtd | Unidade |
|---|---|---|---|
| 1 | [produto/serviço] | X | [pç/m²/kit] |
| 2 | [produto/serviço] | X | [pç/m²/kit] |

### O que está incluído
- [item 1]
- [item 2]
- [item 3]

### O que NÃO está incluído
- [exclusão 1 — evita retrabalho/discussão futura]
- [exclusão 2]
```

### Seção 3 — Diferenciais
```
## Por que Pousinox

| Diferencial | Benefício para você |
|---|---|
| Aço inox 304/316 | Durabilidade 30+ anos sem corrosão |
| Laudo técnico LAMAT/SENAI | Segurança comprovada em ensaio |
| Projeto sob medida | Solução exata para sua necessidade |
| Fábrica própria | Prazo e preço direto (sem intermediário) |
| Suporte técnico | Acompanhamento pós-venda |
```

### Seção 4 — Investimento
```
## Investimento

| Item | Valor unitário | Qtd | Subtotal |
|---|---|---|---|
| [produto 1] | R$ X.XXX | N | R$ X.XXX |
| [produto 2] | R$ X.XXX | N | R$ X.XXX |
| Frete | — | — | R$ X.XXX |
| **TOTAL** | | | **R$ XX.XXX** |

### Condições de pagamento
- À vista: [desconto]% — R$ XX.XXX
- 2x: entrada + 30 dias
- 3x: 30/60/90 dias
- Boleto/Pix/Transferência

### Validade
Esta proposta é válida por [15/30] dias a partir de [data].
```

### Seção 5 — Prazo e entrega
```
## Prazo

| Etapa | Prazo | Observação |
|---|---|---|
| Aprovação da proposta | — | Início do cronograma |
| Projeto técnico | X dias | Enviaremos para aprovação |
| Fabricação | X dias | Após aprovação do projeto |
| Entrega/Instalação | X dias | [local/frete] |
| **Total estimado** | **X dias úteis** | |
```

### Seção 6 — Garantia e suporte
```
## Garantia

- Garantia contra defeitos de fabricação: [X] anos
- Laudo técnico incluso: [sim/não]
- Suporte técnico: [email/telefone/WhatsApp]
- Manual de instalação: incluso
```

### Seção 7 — Próximos passos
```
## Próximos passos

1. ✅ Aprovar esta proposta (responda este email ou WhatsApp)
2. 📋 Enviaremos o projeto técnico para validação
3. 💰 Faturamento conforme condição escolhida
4. 🏭 Início da fabricação
5. 🚚 Entrega no prazo combinado

---
Dúvidas? Fale diretamente comigo:
[Nome] — [cargo]
📱 (35) XXXXX-XXXX (WhatsApp)
✉️ [email]
```

## 3. Variantes por tipo

### Proposta de produto (fixadores, projetos sob medida)
- Foco em especificação técnica
- Incluir diagrama/desenho se disponível
- Referenciar laudo técnico
- Comparativo com alternativas (galvanizado, alumínio)

### Proposta de serviço (corte laser, consultoria)
- Foco em metodologia e etapas
- Incluir cases/portfólio
- SLA e entregas parciais
- Cronograma detalhado

### Proposta de implementação (IA, automação para clientes)
- Foco em ROI e economia
- Antes/depois com métricas
- Escopo por fases
- Suporte e treinamento

## 4. Tom e linguagem

### Usar
- Linguagem de benefício ("você terá..." não "nós oferecemos...")
- Números concretos (prazo exato, valor exato)
- Verbos de ação nos próximos passos
- Formatação limpa (muito espaço em branco)

### Evitar
- Jargão técnico sem explicação
- Parágrafos longos (max 3 linhas)
- Linguagem genérica ("solução inovadora", "excelência")
- Valores arredondados demais (passa impressão de chute)

## 5. Integração com sistema

### Salvar no AdminOrcamento
Se dados suficientes, criar orçamento no sistema:
```
Navegue para /admin/orcamento → Novo
Preencher: cliente, itens, valores, condições
Gerar link de proposta: /proposta/[id]
```

### Envio
- Email via Brevo (PDF anexo ou link)
- WhatsApp via Z-API (mensagem + link)
- Tracking de abertura via AdminOrcamento

## 6. Formato de entrega

```
★ PROPOSTA COMERCIAL — [Cliente]

Ref: PROP-[YYYY]-[NNN]
Valor: R$ XX.XXX
Prazo: X dias úteis
Validade: [data]

═══ DOCUMENTO ═══
[Proposta completa formatada em Markdown]

═══ AÇÕES ═══
- [ ] Criar no AdminOrcamento
- [ ] Enviar por [email/WhatsApp]
- [ ] Agendar follow-up em [N dias]

═══ ARGUMENTOS DE VENDA ═══
- Se pedir desconto: [margem disponível, contrapartida]
- Se comparar com concorrente: [diferencial técnico]
- Se questionar prazo: [possibilidade de urgência]
```

## 7. Quando usar
- Lead qualificado pede orçamento/proposta
- Após reunião comercial (follow-up com proposta)
- Renovação de contrato com cliente existente
- Resposta a licitação ou pedido formal
- Upsell para cliente ativo
