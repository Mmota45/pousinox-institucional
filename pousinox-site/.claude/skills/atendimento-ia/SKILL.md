---
description: Templates de resposta automática por segmento para WhatsApp e email
---

# Atendimento IA

Gere templates de resposta para atendimento ao cliente, segmentados por tipo de solicitação e canal.

## Contexto Pousinox
- **Canal principal:** WhatsApp (31) 99999-xxxx
- **Horário:** Seg-Sex 8h-17h30
- **Equipe:** Pequena (1-2 pessoas no atendimento)
- **Público:** Engenheiros, arquitetos, revendas, instaladores
- **Tom:** Profissional, ágil, técnico quando necessário, nunca robótico

## 1. Identificar cenário
Pergunte ao usuário:
- Tipo: Orçamento / Dúvida técnica / Pós-venda / Reclamação / Reativação?
- Canal: WhatsApp / Email / Instagram DM?
- Segmento do cliente: Construtora / Arquiteto / Revenda / Instalador?
- Urgência: Normal / Prioridade (projeto com deadline)?

## 2. Templates por cenário

### Primeiro contato (lead novo)
```
Olá [nome]! Tudo bem?

Sou [atendente] da Pousinox, fabricante de fixadores de porcelanato em aço inox.

Vi seu interesse em [produto/calculadora/site]. Posso ajudar com:
- Especificação técnica para seu projeto
- Orçamento personalizado
- Envio de amostras

Qual o tipo de projeto? (fachada, piso, piscina, área interna?)
```

### Orçamento
```
[nome], preparei o orçamento conforme conversamos:

▸ Projeto: [descrição]
▸ Modelo: [fixador]
▸ Quantidade: [X] unidades
▸ Valor unitário: R$ [X]
▸ Total: R$ [X]
▸ Prazo entrega: [X] dias úteis
▸ Validade: 15 dias

Condições:
- Pagamento: [opções]
- Frete: [CIF/FOB/valor]

Posso enviar a proposta formal com especificação técnica?
```

### Dúvida técnica
```
Boa pergunta, [nome]!

[Resposta técnica clara e objetiva]

Se precisar, posso enviar:
- Laudo técnico SENAI/LAMAT
- Ficha técnica do modelo [X]
- Vídeo de instalação

Algo mais que posso ajudar?
```

### Pós-venda (acompanhamento)
```
Olá [nome]! Tudo certo com a instalação dos fixadores?

Estou acompanhando para garantir que tudo saiu conforme o especificado.

Se precisar de suporte técnico ou tiver dúvidas sobre a instalação, estou à disposição.

[Se projeto grande: "Tem previsão de próxima etapa? Posso já reservar o material."]
```

### Reclamação
```
[nome], entendo sua frustração e agradeço por nos comunicar.

Vou resolver isso para você. Para agilizar:
1. [Pedido de informação necessária]
2. [Prazo para resolução]
3. [Compensação se aplicável]

Fique tranquilo que vamos resolver o mais rápido possível.
```

### Reativação (cliente inativo 30+ dias)
```
Olá [nome]! Tudo bem por aí?

Vi que faz um tempo desde nosso último contato. Espero que o projeto [referência] tenha ficado excelente!

Temos novidade: [novidade relevante ao segmento]

Tem algum projeto novo em vista? Posso ajudar com especificação ou orçamento rápido.
```

## 3. Personalização por segmento

| Segmento | Tom | Foco | Gatilho |
|---|---|---|---|
| Construtora | Técnico, direto | Prazo, custo, volume | Desconto por quantidade |
| Arquiteto | Sofisticado, visual | Estética, acabamento | Portfolio de projetos |
| Revenda | Comercial, parceria | Margem, giro, exclusividade | Tabela especial |
| Instalador | Prático, simples | Facilidade, rendimento | Dica de instalação |

## 4. Regras de atendimento
- Responder em até 5 minutos (horário comercial)
- Nunca deixar sem resposta — mesmo que seja "Vou verificar e retorno em X"
- Usar nome do cliente sempre
- Não enviar áudio longo (max 30s se necessário)
- Fotos/vídeos > texto longo para explicações técnicas
- Sempre fechar com próximo passo claro
- Se não souber: "Vou consultar nosso técnico e retorno em [prazo]"

## 5. Formato de entrega

```
★ ATENDIMENTO — [Cenário] — [Segmento]

▸ TEMPLATE PRINCIPAL
[mensagem formatada pronta para copiar]

▸ VARIAÇÕES
- Se cliente perguntar preço: [resposta]
- Se cliente pedir prazo: [resposta]
- Se cliente comparar concorrente: [resposta]

▸ FOLLOW-UP (se não responder)
- D+1: [mensagem curta]
- D+3: [material de valor]
- D+7: [última tentativa]

▸ ESCALAÇÃO
Quando escalar para gerência:
- Desconto > 15%
- Reclamação grave
- Projeto > R$50k
- Cliente estratégico
```

## 6. Banco de respostas rápidas
Se o usuário pedir, gere um conjunto completo de respostas rápidas (quick replies) para configurar no WhatsApp Business:
- /orcamento — solicitar info para orçamento
- /prazo — informar prazo padrão
- /laudo — enviar laudo técnico
- /catalogo — enviar catálogo
- /instalacao — dicas de instalação
- /obrigado — agradecimento pós-venda
