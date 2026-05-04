---
description: Import unificado de keywords — detecta formato GKP, CSV PT-BR ou estendido
---

# Importar Keywords

Importe keywords de mercado para a tabela `market_keywords` com detecção automática de formato.

## 1. Receber arquivo
- Peça o caminho do arquivo CSV ao usuário
- Leia as primeiras 5 linhas para detectar o formato

## 2. Detectar formato

| Formato | Detecção | Delimitador |
|---|---|---|
| **Google Keyword Planner** | Header até linha 20, contém "Keyword" + "Avg. monthly searches" | Tab (`\t`) |
| **CSV PT-BR** | Delimitador `;`, colunas em português | Ponto-e-vírgula |
| **Estendido** | Linha 0 contém `termo` + `volume_mensal` | Vírgula ou `;` |

### Mapeamento de colunas

**GKP:**
- Keyword → termo
- Avg. monthly searches → volume_mensal
- Mudança em três meses → variacao_3m
- Mudança YoY → variacao_yoy
- Competition → competicao (Alto/Alta→alta, Baixo/Baixa→baixa, Médio/Média→media)
- Competition (indexed value) → trend_score

**Estendido:** colunas já têm nomes corretos

## 3. Validação
- Peça a UF obrigatória (dropdown com estados) — todos os termos recebem essa UF
- Verifique campos obrigatórios: `termo`, `volume_mensal`
- Alerte se há linhas com volume 0
- Conte duplicatas (mesmo termo + UF já existente)

## 4. Inserir
- Camada: `externa`
- Batch de 200 registros por vez
- Reporte progresso: `Inserindo... N/T (XX%)`
- Upsert por `termo + uf + camada` para evitar duplicatas

## 5. Relatório

```
📥 Import concluído — [data]

| Métrica | Valor |
|---|---|
| Formato detectado | GKP / CSV PT-BR / Estendido |
| UF | [UF selecionada] |
| Total linhas | N |
| Inseridos | N |
| Duplicados (skip) | N |
| Erros | N |
| Volume médio | X.XXX |
```
