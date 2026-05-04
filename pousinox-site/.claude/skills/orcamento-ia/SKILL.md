---
description: Gera orçamento via linguagem natural — busca produtos, similares, preços
---

# Orçamento IA

Gere um orçamento estruturado a partir de uma descrição em linguagem natural.

## 1. Receber pedido
- O usuário descreve o que precisa em linguagem natural:
  - "Orçamento para revestimento de 200m² de fachada com porcelanato 60x120"
  - "Fixadores para cozinha industrial de restaurante, 50m²"
  - "Projeto sob medida para hospital, área de 300m²"

## 2. Pesquisar dados

### Produtos
- Busque em `produtos` (Supabase): fixadores compatíveis com a aplicação
- Filtre por segmento, tipo de porcelanato, ambiente

### Projetos similares
- Busque em `projetos` via RPC `buscar_similares` (Jaccard) ou por atributos
- Use projetos passados para referência de quantidades e preços

### Preços
- Consulte preços em `produtos` e `outlet_produtos`
- Se disponível, use custo por kg da precificação por peso

### Calculadora
- Se aplicável, use a lógica da calculadora pública para estimar quantidade de fixadores
- Dados necessários: área (m²), tamanho do porcelanato, espaçamento

## 3. Montar orçamento

```
📋 Orçamento — [cliente/projeto]

| # | Item | Qtd | Unid | Valor Unit | Total |
|---|---|---|---|---|---|
| 1 | Fixador XYZ | 500 | pç | R$ 2,50 | R$ 1.250,00 |
| 2 | Consumível ABC | 10 | kg | R$ 45,00 | R$ 450,00 |
| ... |

Subtotal: R$ X.XXX,XX
Observações: [baseado em projeto similar #XXX]
```

## 4. Confirmar com o usuário
- Mostre o orçamento para revisão
- Pergunte se quer ajustar quantidades, preços ou itens
- Se aprovado, ofereça salvar

## 5. Salvar (opcional)
- Insira como rascunho em `orcamentos` (Supabase)
- Ou navegue para `/admin/orcamento` pré-preenchido
- Reportar: ID do orçamento, valor total, cliente

## Regras
- **NUNCA inventar preços** — use apenas dados do banco
- Se não encontrar preço, marque como "A consultar" e avise
- Referencie projetos similares quando usado como base
- Valores em BRL, formatados com separador de milhares
