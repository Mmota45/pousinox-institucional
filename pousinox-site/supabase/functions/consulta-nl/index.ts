// Edge Function: consulta-nl
// Consulta em linguagem natural → SQL → resposta formatada
// Chamada sob demanda via POST

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Whitelist de tabelas e operações permitidas (segurança)
const TABELAS_PERMITIDAS = [
  'vendas', 'clientes', 'prospeccao', 'pipeline_deals', 'orcamentos',
  'fin_lancamentos', 'fin_movimentacoes', 'docs_fiscais_emitidos', 'docs_fiscais_recebidos',
  'estoque_itens', 'estoque_movimentacoes', 'projetos', 'ordens_producao',
  'leads', 'followups', 'activity_log', 'nao_conformidades',
  'noticias_radar', 'alertas', 'briefings', 'insights',
]

const SCHEMA_RESUMO = `
Tabelas disponíveis:
- vendas: id, produto_titulo, valor_recebido, data_venda, forma_pagamento, cliente_nome, cnpj
- clientes: id, razao_social, cnpj, cidade, uf, rfm_score, rfm_segmento, rfm_recencia, rfm_frequencia, rfm_valor
- prospeccao: id, razao_social, cnpj, uf, cidade, segmento, score_total, whatsapp
- pipeline_deals: id, titulo, prospect_id, cliente_id, valor, estagio, created_at, updated_at
- orcamentos: id, numero, cliente_nome, total, status, created_at
- fin_lancamentos: id, descricao, tipo (receita/despesa), valor, status, data_vencimento, data_pagamento, origem
- estoque_itens: id, nome, codigo, saldo_atual, estoque_minimo, custo_medio, tipo (mp/pa)
- projetos: id, titulo, cliente, cnpj, segmento, status, valor, created_at
- leads: id, nome, email, telefone, origem, status, created_at
- followups: id, prospect_id, tipo, data_prevista, status
- nao_conformidades: id, titulo, severidade, status, created_at

Regras:
- Use SOMENTE SELECT, nunca INSERT/UPDATE/DELETE
- Sempre use LIMIT (max 100)
- Para valores monetários, use SUM/AVG com COALESCE
- Datas em formato ISO (YYYY-MM-DD)
`

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { pergunta } = await req.json()
    if (!pergunta) return new Response(JSON.stringify({ ok: false, error: 'Pergunta obrigatória' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Passo 1: Gerar SQL via IA
    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!groqKey) return new Response(JSON.stringify({ ok: false, error: 'GROQ_API_KEY não configurada' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const sqlRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Você é um gerador de SQL PostgreSQL para a Pousinox. Gere APENAS a query SQL, sem explicação, sem markdown, sem backticks. ${SCHEMA_RESUMO}`,
          },
          { role: 'user', content: pergunta },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    })
    const sqlData = await sqlRes.json()
    let sql = (sqlData.choices?.[0]?.message?.content || '').trim()

    // Limpar possíveis backticks
    sql = sql.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim()

    // Validação de segurança
    const sqlUpper = sql.toUpperCase()
    if (!sqlUpper.startsWith('SELECT')) {
      return new Response(JSON.stringify({ ok: false, error: 'Apenas consultas SELECT são permitidas' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i.test(sql)) {
      return new Response(JSON.stringify({ ok: false, error: 'Operação não permitida' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verificar se usa apenas tabelas permitidas
    const tabelasUsadas = sql.match(/\bFROM\s+(\w+)|\bJOIN\s+(\w+)/gi)?.map(m => m.replace(/^(FROM|JOIN)\s+/i, '').toLowerCase()) || []
    const naoPermitida = tabelasUsadas.find(t => !TABELAS_PERMITIDAS.includes(t))
    if (naoPermitida) {
      return new Response(JSON.stringify({ ok: false, error: `Tabela "${naoPermitida}" não permitida` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Garantir LIMIT
    if (!/\bLIMIT\b/i.test(sql)) sql += ' LIMIT 50'

    // Passo 2: Executar SQL
    const { data: rows, error: dbError } = await supabase.rpc('exec_readonly', { query: sql })

    // Fallback: se RPC não existe, usar query direta (menos seguro)
    let resultado: any[]
    if (dbError?.message?.includes('function') || dbError?.message?.includes('exec_readonly')) {
      // Tentar via REST — limitado mas funcional
      return new Response(JSON.stringify({
        ok: true,
        sql,
        resultado: null,
        nota: 'RPC exec_readonly não encontrada. Execute a query manualmente no SQL Editor.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else if (dbError) {
      return new Response(JSON.stringify({ ok: false, error: dbError.message, sql }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else {
      resultado = rows
    }

    // Passo 3: Formatar resposta via IA
    const fmtRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Responda a pergunta do usuário baseado nos dados. Seja conciso, use formatação markdown. Valores monetários em R$. A empresa é Pousinox, fabricante de produtos em aço inox.' },
          { role: 'user', content: `Pergunta: ${pergunta}\n\nDados:\n${JSON.stringify(resultado, null, 2)}` },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    })
    const fmtData = await fmtRes.json()
    const resposta = fmtData.choices?.[0]?.message?.content || 'Sem resposta'

    // Salvar no histórico
    await supabase.from('insights').insert({
      tipo: 'consulta_nl',
      mensagem: pergunta,
      dados: { sql, resultado_count: resultado?.length, resposta: resposta.slice(0, 500) },
    })

    return new Response(JSON.stringify({ ok: true, pergunta, sql, resposta, linhas: resultado?.length ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
