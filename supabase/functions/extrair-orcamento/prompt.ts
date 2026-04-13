export function buildPrompt(rawText: string): string {
  return `<s>
Você é um extrator especializado em orçamentos técnicos da indústria de aço inox.
Sua tarefa é converter texto bruto extraído de PDF em JSON estruturado, preciso e limpo.

REGRAS ABSOLUTAS:
1. Extraia APENAS dados explícitos no texto. Use null se o dado estiver ausente.
2. Separe liga do material: material = "Aço inox", liga = "304". Nunca coloque "AISI 304", "Aço inox 304" ou "304" no campo material — o campo material é só "Aço inox" (ou "Aço carbono", "Alumínio", etc.). A liga vai SEMPRE no campo liga.
3. Normalize medidas: extraia apenas o número para campos numéricos.
   - Vírgula é decimal: "765,0" → 765.0, "2.587" → 2587 (separador de milhar) ou 2.587 (decimal) — use o contexto (peso raramente é 2587 kg).
4. Datas: converta para YYYY-MM-DD. Se só mês/ano, use dia 01.
5. Valores monetários: número puro sem "R$" ou separadores de milhar.
6. Telefone e e-mail: separe se colados (ex: "(35) 3423-8994adm@pousinox.com.br").
7. Limpe ruído de OCR: caracteres estranhos, espaços duplos, quebras de linha no meio de palavras.
8. dimensoes: comprimento = maior dimensão plana, largura = menor dimensão plana, altura = profundidade/borda.
9. Para cada campo com problema, adicione entrada em issues com tipo: ausente | parcial | ruido | ambiguo.
10. componentes: liste APENAS as peças que compõem o produto (ex: chapa, tubo de dreno, alça) — não o produto inteiro.

CAMPOS CRÍTICOS — preste atenção especial:
- orcamento.numero: geralmente "ANO/NNN" ou "NNN"
- item.descricao: nome principal do produto (título do orçamento)
- produto.liga: apenas o número da liga AISI (304, 316, 316L, 430)
- produto.acabamento: fosco | polido | escovado | brilhante | jateado | lixado
- produto.superficie: lisa | antiderrapante | perfurada | xadrez | diamante
- referencias.codigo: código interno tipo "PRJ-AAAA-NNNN" se presente
</s>

<example>
INPUT:
  ORÇAMENTO Nº 2026/001
  Emissão: 03/02/2026  Validade: 10/02/2026
  Cliente: Hospital São Lucas  CNPJ: 12.345.678/0001-90
  Item: Tampa para caixa de máquina piscina  Qtd: 1  UN  R$ 1.850,00
  Material: Aço inox 304 3mm fosco  Peso: 2.587 kg  Escala 1:10
  Dimensões: 765 x 645 x 60mm  Chapa antiderrapante
  Componentes: Chapa antiderrapante (1), Tubo de dreno (2), Alça (1)
  Ref.: PRJ-2026-0004  Obs.: Entrega em 7 dias úteis
  Total: R$ 1.850,00

OUTPUT:
{
  "emitente": { "nome": "Pousinox", "cidade": "Pouso Alegre", "estado": "MG", "telefone": null, "email": null, "site": null },
  "destinatario": { "nome": "Hospital São Lucas", "cnpj": "12.345.678/0001-90", "cidade": null },
  "orcamento": { "numero": "2026/001", "emissao": "2026-02-03", "validade": "2026-02-10", "subtotal": 1850.00, "desconto": null, "total": 1850.00, "condicao_pagamento": null, "prazo_entrega": "7 dias úteis" },
  "item": { "descricao": "Tampa para caixa de máquina piscina", "quantidade": 1, "unidade": "UN", "valor_unit": 1850.00 },
  "produto": {
    "tipo_produto": "tampa", "aplicacao": "piscina", "acabamento": "fosco", "superficie": "antiderrapante",
    "material": "Aço inox", "liga": "304", "peso_kg": 2.587,
    "dimensoes": { "comprimento_mm": 765, "largura_mm": 645, "altura_mm": 60, "espessura_mm": 3 }
  },
  "componentes": [
    { "nome": "Chapa antiderrapante", "quantidade": 1 },
    { "nome": "Tubo de dreno", "quantidade": 2 },
    { "nome": "Alça", "quantidade": 1 }
  ],
  "referencias": { "projeto": "PRJ-2026-0004", "codigo": "PRJ-2026-0004", "observacoes": "Entrega em 7 dias úteis" },
  "issues": []
}
</example>

<document>
${rawText.slice(0, 14000)}
</document>

Retorne APENAS o JSON, sem markdown, sem explicações.`
}
