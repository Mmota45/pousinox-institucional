---
description: Análise do bundle — identificar lazy loads e otimizações
---

# Audit Bundle

Analise o tamanho do bundle e identifique oportunidades de otimização.

## 1. Build com análise
- Rode `npm run build` e capture a saída completa
- Liste todos os chunks com tamanho (kB e gzip)

## 2. Identificar maiores chunks
- Ordene por tamanho (gzip)
- Destaque chunks > 200 kB gzip

## 3. Analisar imports pesados
- Busque imports de bibliotecas grandes: `recharts`, `leaflet`, `pdf-lib`, `pdf-merger-js`
- Verifique quais páginas admin importam essas libs
- Identifique quais podem ser lazy loaded com `React.lazy()`

## 4. Verificar lazy loads existentes
- Busque `React.lazy` e `import()` dinâmicos no código
- Liste rotas que JA usam lazy loading

## 5. Sugerir otimizações
- Para cada lib pesada, sugira o lazy load com código pronto
- Estime economia potencial

## 6. Relatório

```
📦 Audit Bundle — [data]

Tamanho total: X kB (Y kB gzip)

| Chunk | Tamanho | Gzip | Componentes |
|---|---|---|---|
| index-XXX.js | X kB | Y kB | ... |

Top libs pesadas:
| Lib | Estimativa | Lazy loadable? | Onde |
|---|---|---|---|
| recharts | ~200kB | ✅ | AdminDashboardBI, StudioPanel |

Economia potencial: ~X kB gzip com lazy loading
```
