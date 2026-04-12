# Fase 5 — pgvector em Shadow Mode: Roteiro de Etapas

## Etapa 1 ✅ PRONTA — Schema + scaffold (zero risco)

Execute `AdminProjetos_fase5_etapa1.sql` no SQL Editor do Supabase.

O que entrega:
- `CREATE EXTENSION vector`
- Tabela `feature_flags` (flag desabilitada)
- Tabela `projeto_embeddings` (vazia — preenchida na Etapa 2)
- Tabela `similarity_shadow_log` (vazia — preenchida na Etapa 3)
- RPC `buscar_similares_vector` (retorna vazio até backfill)
- RPC `registrar_shadow_log` (calcula divergência Jaccard vs vector)
- Trigger que invalida embedding quando atributos mudam
- RLS em tudo

Reversão: `DROP TABLE similarity_shadow_log, projeto_embeddings, feature_flags CASCADE;`

---

## Etapa 2 — Pipeline de embeddings via n8n (sem frontend)

Pré-requisito: Etapa 1 executada, conta OpenAI ativa.

O que fazer:
1. Criar Webhook n8n: `POST /webhook/projeto-embed`
   - Input: `{ projeto_id, titulo, segmento, atributos: [{chave, valor}] }`
   - Formatar texto_base: `"{segmento}: {titulo}. {chave1}={val1}, ..."` 
   - Chamar `POST https://api.openai.com/v1/embeddings` com modelo `text-embedding-3-small`
   - Fazer upsert em `projeto_embeddings` via Supabase REST (service_role)

2. Criar Webhook n8n: `POST /webhook/backfill-embeddings`
   - Buscar todos projetos sem embedding (LEFT JOIN projeto_embeddings WHERE projeto_id IS NULL)
   - Processar em lotes de 20 com delay de 500ms
   - Logar progresso

3. Trigger Supabase → n8n (quando projeto é salvo):
   - Database Webhook no Supabase: INSERT/UPDATE em `projetos` → POST para webhook n8n
   - Inclui atributos via query adicional no n8n

SQL de apoio para verificar cobertura:
```sql
SELECT
  count(*) FILTER (WHERE e.projeto_id IS NULL) AS sem_embedding,
  count(*) FILTER (WHERE e.invalidado = true)  AS invalidados,
  count(*) FILTER (WHERE e.invalidado = false) AS validos
FROM projetos p
LEFT JOIN projeto_embeddings e ON e.projeto_id = p.id;
```

---

## Etapa 3 — Shadow mode no frontend (flag habilitada para admin)

Pré-requisito: Etapa 2 com > 80% dos projetos com embedding válido.

O que fazer no frontend (AdminProjetos.tsx):
1. Na inicialização, ler `feature_flags WHERE flag = 'vector_similarity_shadow'`
2. Se `habilitado = true`:
   - No effect de similares: após receber resultado do Jaccard, chamar API de embedding
     com o texto_base montado dos atributos atuais
   - Passar o vetor para `buscar_similares_vector`
   - Chamar `registrar_shadow_log` com ambos os resultados + latências
3. Continuar mostrando apenas resultados Jaccard ao usuário (shadow = invisível)

Texto base para embedding (client-side):
```ts
function montarTextoBase(form: FormState, atributos: AtributoLocal[]): string {
  const attrs = atributos
    .map(a => `${a.chave}=${a.valor}`)
    .sort()
    .join(', ')
  return `${form.segmento || 'geral'}: ${form.titulo}. ${attrs}`
}
```

Chamada de embedding (usar variável de ambiente, nunca hardcoded):
```ts
const res = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}` },
  body: JSON.stringify({ model: 'text-embedding-3-small', input: textoBase })
})
const { data } = await res.json()
const embedding = data[0].embedding  // float[]
```

**Nota de segurança:** A chave OpenAI ficará no bundle do frontend (admin only, não público).
Alternativa mais segura: proxy via n8n ou Supabase Edge Function.

---

## Etapa 4 — Análise e decisão de promoção

Quando fazer: depois de ~100 buscas logadas com flag ativa.

Queries de análise no SQL Editor:
```sql
-- Distribuição de divergência
SELECT
  CASE
    WHEN divergencia < 0.2  THEN '0-20% (alta concordância)'
    WHEN divergencia < 0.5  THEN '20-50% (divergência moderada)'
    ELSE                         '>50% (alta divergência)'
  END AS faixa,
  count(*),
  round(avg(jaccard_ms), 0) AS jaccard_ms_medio,
  round(avg(vector_ms), 0)  AS vector_ms_medio
FROM similarity_shadow_log
WHERE divergencia IS NOT NULL
GROUP BY 1 ORDER BY 1;

-- Casos de alta divergência para revisão manual
SELECT
  l.created_at,
  l.divergencia,
  l.jaccard_ids,
  l.vector_ids,
  l.atributos_json
FROM similarity_shadow_log l
WHERE l.divergencia > 0.5
ORDER BY l.created_at DESC
LIMIT 20;
```

Critério de promoção (sugestão):
- divergência média < 0.3 → motores concordam → Jaccard suficiente
- divergência média > 0.5 → vector encontra padrões diferentes → avaliar manualmente quais resultados são melhores
- Mostrar os dois rankings lado a lado para o admin avaliar (A/B manual)

---

## Etapa 5 (futura) — CBR (Case-Based Reasoning)

Com histórico de projetos + embeddings + feedback de similaridade manual:
- Fine-tuning do embedding ou reranking por feedback
- Sugestão automática de atributos ao criar projeto novo (baseado em similar)
- Estimativa de valor_total baseada em projetos similares
- Cluster de projetos por segmento para catálogo automático

---

## Modelo de embedding recomendado

| Modelo | Dims | Custo/1M tokens | Qualidade | Recomendação |
|--------|------|-----------------|-----------|--------------|
| text-embedding-3-small | 1536 | $0.02 | boa | **usar** |
| text-embedding-3-large | 3072 | $0.13 | excelente | quando > 500 projetos |
| text-embedding-ada-002 | 1536 | $0.10 | boa (legado) | não usar (mais caro) |

Para < 500 projetos: text-embedding-3-small, 1536 dims.
Custo estimado de backfill de 500 projetos: ~R$ 0,05.
