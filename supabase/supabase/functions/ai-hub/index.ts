import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROVIDERS_MODELS: Record<string, string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
  gemini: ["gemini-2.5-flash"],
  cohere: ["command-a-03-2025", "command-r7b-12-2024"],
  huggingface: [
    "mistralai/Mistral-7B-Instruct-v0.3",
    "google/gemma-2-2b-it",
    "microsoft/Phi-3-mini-4k-instruct",
  ],
  together: [
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
  ],
  cloudflare: [
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/mistral/mistral-7b-instruct-v0.1",
  ],
  openrouter: [
    "google/gemini-2.5-flash-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
  ],
};

interface Message {
  role: string;
  content: string;
}

const BASE_SYSTEM_PROMPT = `Você é o assistente de IA da Pousinox. Responda sempre em português brasileiro.

CONTEXTO BASE (use apenas como referência, NÃO repita literalmente):
- Pousinox — fabricante de equipamentos em aço inox, Pouso Alegre/MG, desde 2001
- Carro-chefe: equipamentos e mobiliário em inox sob medida (bancadas, fogões industriais, coifas, corrimãos, lava-botas, etc.)
- O fixador de porcelanato é apenas UM dos produtos — é um insert metálico parafusado na parede que impede a QUEDA do porcelanato
- SOBRE O FIXADOR: é instalado ENTRE a parede e o porcelanato. Impede DESPRENDIMENTO. NÃO é adicionado à argamassa, NÃO protege a superfície, NÃO substitui argamassa. É segurança mecânica ADICIONAL
- Sites: pousinox.com.br | fixadorporcelanato.com.br

REGRAS:
- Priorize informações da BUSCA WEB (quando disponível) sobre este contexto base
- NÃO invente dados que não tenha (CNPJ, faturamento, número de funcionários, etc.)
- Se não souber, diga honestamente
- Seja conciso e preciso`;

// Cache do conteúdo do site (válido por 1 hora)
let siteCache: { content: string; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

function extractText(html: string): string {
  // Remove scripts, styles, SVGs, head
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  // Remove tags HTML
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // Limpa espaços
  text = text.replace(/\s+/g, ' ').trim();
  // Limita a ~4000 chars para não estourar contexto
  return text.slice(0, 4000);
}

async function fetchSiteContext(): Promise<string> {
  const now = Date.now();
  if (siteCache && (now - siteCache.fetchedAt) < CACHE_TTL) {
    return siteCache.content;
  }

  // pousinox.com.br é SPA (React) — fetch retorna HTML vazio, não adianta
  // fixadorporcelanato.com.br é HTML estático — funciona com fetch
  const urls = [
    'https://fixadorporcelanato.com.br',
  ];

  const results: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Pousinox-AI-Hub/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const html = await res.text();
        const text = extractText(html);
        if (text.length > 100) {
          results.push(`[Fonte: ${url}]\n${text}`);
        }
      }
    } catch {
      // timeout ou erro de rede — segue sem esse site
    }
  }

  const content = results.length > 0
    ? results.join('\n\n---\n\n')
    : '(Não foi possível acessar o site neste momento)';

  siteCache = { content, fetchedAt: now };
  return content;
}

// ── Web Search (Brave → Serper fallback) ──

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

let searchCache: Record<string, { results: string; at: number }> = {};
const SEARCH_CACHE_TTL = 30 * 60 * 1000; // 30 min

async function searchBrave(query: string): Promise<SearchResult[]> {
  const key = Deno.env.get("BRAVE_SEARCH_KEY");
  if (!key) return [];
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=pt-br`,
    { headers: { Accept: "application/json", "X-Subscription-Token": key }, signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.web?.results ?? []).slice(0, 5).map((r: any) => ({
    title: r.title, snippet: r.description, url: r.url,
  }));
}

async function searchSerper(query: string): Promise<SearchResult[]> {
  const key = Deno.env.get("SERPER_API_KEY");
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": key },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: 5 }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.organic ?? []).slice(0, 5).map((r: any) => ({
    title: r.title, snippet: r.snippet, url: r.link,
  }));
}

async function webSearch(query: string, preferredSource?: string): Promise<string> {
  // Check cache
  const cacheKey = `${preferredSource || 'auto'}:${query.toLowerCase().trim()}`;
  const cached = searchCache[cacheKey];
  if (cached && (Date.now() - cached.at) < SEARCH_CACHE_TTL) return cached.results;

  let results: SearchResult[] = [];
  let source = "";

  if (preferredSource === 'brave') {
    results = await searchBrave(query);
    source = "Brave Search";
  } else if (preferredSource === 'serper') {
    results = await searchSerper(query);
    source = "Google (Serper)";
  } else {
    // Auto: Brave first, Serper fallback
    results = await searchBrave(query);
    source = "Brave Search";
    if (results.length === 0) {
      results = await searchSerper(query);
      source = "Google (Serper)";
    }
  }

  if (results.length === 0) return '';

  const formatted = results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   Fonte: ${r.url}`)
    .join('\n\n');

  const text = `[Resultados de busca web via ${source}]\n${formatted}`;
  searchCache[cacheKey] = { results: text, at: Date.now() };

  // Limpa cache antigo (max 50 entries)
  const keys = Object.keys(searchCache);
  if (keys.length > 50) {
    const oldest = keys.sort((a, b) => searchCache[a].at - searchCache[b].at).slice(0, keys.length - 50);
    oldest.forEach(k => delete searchCache[k]);
  }

  return text;
}

function shouldSearch(messages: Message[], hasDbData: boolean): string | null {
  if (messages.length === 0) return null;
  const lastMsg = messages[messages.length - 1].content.toLowerCase();

  // Se a pergunta já será respondida pelo banco, NÃO buscar na web
  const internalTerms = ['produto', 'cliente', 'prospect', 'pipeline', 'deal', 'venda', 'pedido',
    'financeiro', 'despesa', 'receita', 'caixa', 'saldo', 'lançamento', 'projeto', 'produção',
    'estoque', 'quantos', 'quantas', 'nosso', 'nossa', 'temos', 'cadastrado'];
  const isInternal = internalTerms.some(t => lastMsg.includes(t));
  if (isInternal && hasDbData) return null;

  // Buscar na web: concorrentes, mercado, informações externas
  const webTerms = ['concorren', 'wfix', 'martins insert', 'faberin', 'fixagran',
    'mercado', 'tendência', 'notícia', 'norma', 'nbr', 'legislaç',
    'pesquis', 'busca na web', 'procur', 'como está o mercado',
    'o que é', 'quem é', 'quanto custa', 'onde compra', 'comparar'];
  if (webTerms.some(t => lastMsg.includes(t))) {
    return messages[messages.length - 1].content;
  }

  // Pousinox genérico (ex: "você conhece a Pousinox?") → busca web para complementar
  if (/pousinox|fixador.*porcelanato/.test(lastMsg) && !isInternal) {
    return `${messages[messages.length - 1].content} site:pousinox.com.br OR pousinox`;
  }

  // Perguntas genéricas de conhecimento → busca web
  const knowledgeTerms = ['estatístic', 'análise de mercado', 'como funciona', 'explique'];
  if (knowledgeTerms.some(t => lastMsg.includes(t))) {
    return messages[messages.length - 1].content;
  }

  return null;
}

// ── Supabase Data ──

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL") ?? '';
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
  return createClient(url, key);
}

// Cache do overview (válido por 5 min)
let overviewCache: { data: string; at: number } | null = null;
const OVERVIEW_TTL = 5 * 60 * 1000;

// Overview leve — sempre enviado, só COUNTs
async function fetchOverview(): Promise<string> {
  if (overviewCache && (Date.now() - overviewCache.at) < OVERVIEW_TTL) return overviewCache.data;

  const sb = getSupabase();
  const counts: Record<string, number> = {};
  const tables = [
    ['produtos', 'Produtos'],
    ['produtos_catalogo', 'Catálogo padronizado'],
    ['clientes', 'Clientes'],
    ['prospeccao', 'Prospects'],
    ['projetos', 'Projetos'],
    ['pipeline_deals', 'Deals no pipeline'],
    ['vendas', 'Vendas'],
    ['fin_lancamentos', 'Lançamentos financeiros'],
    ['followups', 'Follow-ups'],
  ];

  await Promise.all(tables.map(async ([table, label]) => {
    try {
      const { count } = await sb.from(table).select('*', { count: 'exact', head: true });
      counts[label] = count ?? 0;
    } catch { counts[label] = -1; }
  }));

  const lines = Object.entries(counts)
    .filter(([, v]) => v >= 0)
    .map(([k, v]) => `- ${k}: ${v}`);

  const data = `DADOS DISPONÍVEIS NO SISTEMA:\n${lines.join('\n')}\n(Pergunte sobre qualquer um desses para ver detalhes)`;
  overviewCache = { data, at: Date.now() };
  return data;
}

// Fetch detalhado — acionado pela IA quando precisa de mais info
async function fetchDetail(messages: Message[]): Promise<string> {
  const sb = getSupabase();
  const recent = messages.slice(-4).map(m => m.content).join(' ').toLowerCase();
  const results: string[] = [];

  try {
    if (/produt|catálogo|ite[mn]|pronta.?entrega|outlet|estoque|quantidade/i.test(recent)) {
      const { data: prods } = await sb.from('produtos').select('*').limit(30);
      if (prods?.length) {
        results.push(`PRODUTOS (${prods.length}):\n${prods.map(p =>
          `- ${p.titulo || p.nome || 'N/A'}${p.quantidade != null ? ` | Qtd: ${p.quantidade}` : ''}${p.disponivel ? ' ✅' : ' ❌'}${p.preco ? ` R$${p.preco}` : ''}`
        ).join('\n')}`);
      }
      const { data: cat } = await sb.from('produtos_catalogo').select('*').limit(30);
      if (cat?.length) {
        results.push(`CATÁLOGO (${cat.length}):\n${cat.map(p =>
          `- ${p.nome_padronizado || p.nome || 'N/A'}${p.familia ? ` [${p.familia}]` : ''}`
        ).join('\n')}`);
      }
    }
    if (/client|comprador|rfm|nf\b|nota.?fiscal/i.test(recent)) {
      const { data: top } = await sb.from('clientes').select('nome, cidade, uf, rfm_segmento').order('rfm_valor', { ascending: false }).limit(10);
      if (top?.length) results.push(`TOP CLIENTES:\n${top.map(c => `- ${c.nome} (${c.cidade}/${c.uf}) ${c.rfm_segmento || ''}`).join('\n')}`);
    }
    if (/prospect|prospec|lead|cnpj/i.test(recent)) {
      const { count } = await sb.from('prospeccao').select('*', { count: 'exact', head: true });
      results.push(`PROSPECÇÃO: ${count || 0} prospects`);
    }
    if (/vend[ae]|pedido/i.test(recent)) {
      const { data } = await sb.from('vendas').select('id, cliente_nome, valor_total, status, created_at').order('created_at', { ascending: false }).limit(5);
      if (data?.length) results.push(`VENDAS RECENTES:\n${data.map(v => `- ${v.cliente_nome || 'N/A'} R$${v.valor_total || 0} (${v.status})`).join('\n')}`);
    }
    if (/pipeline|deal|negoci|oportunidade|funil/i.test(recent)) {
      const { data } = await sb.from('pipeline_deals').select('titulo, estagio, valor, empresa_nome').order('created_at', { ascending: false }).limit(10);
      if (data?.length) {
        const porEstagio: Record<string, number> = {};
        data.forEach(d => { porEstagio[d.estagio] = (porEstagio[d.estagio] || 0) + 1; });
        results.push(`PIPELINE:\nPor estágio: ${Object.entries(porEstagio).map(([e, n]) => `${e}=${n}`).join(', ')}\n${data.slice(0, 5).map(d => `- ${d.titulo || d.empresa_nome || 'N/A'} (${d.estagio}) R$${d.valor || 0}`).join('\n')}`);
      }
    }
    if (/financeir|despes|receit|caixa|saldo|lançamento/i.test(recent)) {
      const { data } = await sb.from('fin_lancamentos').select('tipo, status, valor').limit(500);
      if (data?.length) {
        const rec = data.filter(l => l.tipo === 'receita').reduce((s, l) => s + (l.valor || 0), 0);
        const desp = data.filter(l => l.tipo === 'despesa').reduce((s, l) => s + (l.valor || 0), 0);
        results.push(`FINANCEIRO: Receitas R$${rec.toFixed(2)} | Despesas R$${desp.toFixed(2)} | ${data.filter(l => l.status === 'pendente').length} pendentes`);
      }
    }
    if (/projet|sob.?medida|ordem|produç/i.test(recent)) {
      const { data } = await sb.from('projetos').select('titulo, cliente, segmento, status, valor').order('created_at', { ascending: false }).limit(5);
      if (data?.length) results.push(`PROJETOS RECENTES:\n${data.map(p => `- ${p.titulo} | ${p.cliente || 'N/A'} | ${p.status} ${p.valor ? `R$${p.valor}` : ''}`).join('\n')}`);
    }
  } catch { /* silencia erros de tabelas inexistentes */ }

  return results.join('\n\n');
}

// ── Build System Prompt ──

async function buildSystemPrompt(overview: string, detail: string, siteContent: string, searchResults: string): Promise<string> {
  const parts = [BASE_SYSTEM_PROMPT];

  // Overview sempre presente
  parts.push(`\n${overview}`);

  // Detalhes do banco quando disponíveis
  if (detail) {
    parts.push(`\nDETALHES DO BANCO DE DADOS (ALTA CONFIABILIDADE):\n${detail}`);
  }
  if (siteContent && !siteContent.includes('Não foi possível')) {
    parts.push(`\nCONTEÚDO DA LANDING PAGE:\n${siteContent}`);
  }
  if (searchResults) {
    parts.push(`\nBUSCA WEB:\n${searchResults}\nCite as fontes quando relevante.`);
  }

  parts.push(`\nPRIORIDADE: 1º Banco de dados → 2º Site próprio → 3º Busca web → 4º Conhecimento geral.
Seja preciso e honesto. NUNCA invente informações.`);

  return parts.join('\n');
}

async function injectSystem(messages: Message[], searchSource?: string): Promise<{ msgs: Message[]; didSearch: boolean; didDb: boolean }> {
  if (messages.length > 0 && messages[0].role === 'system') return { msgs: messages, didSearch: false, didDb: false };

  const skipSearch = searchSource === 'none';

  // Sempre: overview + site. Paralelo.
  const [overview, siteContent, detail] = await Promise.all([
    fetchOverview(),
    fetchSiteContext(),
    fetchDetail(messages),
  ]);

  const hasDbDetail = !!detail;

  // Busca web: só se não for pergunta interna com dados do banco
  const searchQuery = skipSearch ? null : shouldSearch(messages, hasDbDetail);
  const searchResults = searchQuery ? await webSearch(searchQuery, searchSource === 'auto' ? undefined : searchSource) : '';

  const systemPrompt = await buildSystemPrompt(overview, detail, siteContent, searchResults);
  return {
    msgs: [{ role: 'system', content: systemPrompt }, ...messages],
    didSearch: !!searchResults,
    didDb: hasDbDetail,
  };
}

// Providers recebem messages já com system prompt injetado
async function callGroq(model: string, msgs: Message[]): Promise<string> {
  const key = Deno.env.get("GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: msgs }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));
  return data.choices[0].message.content;
}

async function callGemini(model: string, msgs: Message[]): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  const prompt = msgs.map((m) => `${m.role}: ${m.content}`).join("\n");
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));
  return data.candidates[0].content.parts[0].text;
}

async function callCohere(model: string, msgs: Message[]): Promise<string> {
  const key = Deno.env.get("COHERE_API_KEY");
  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: msgs.map((m) => ({ role: m.role, content: m.content })) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
  return data.message.content[0].text;
}

async function callHuggingFace(model: string, msgs: Message[]): Promise<string> {
  const token = Deno.env.get("HUGGINGFACE_TOKEN");
  const prompt = msgs.map((m) => `${m.role}: ${m.content}`).join("\n") + "\nassistant:";
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 1024 } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? JSON.stringify(data));
  const generated = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
  if (!generated) throw new Error("No generated_text in response");
  return generated.includes("assistant:") ? generated.split("assistant:").slice(-1)[0].trim() : generated;
}

async function callTogether(model: string, msgs: Message[]): Promise<string> {
  const key = Deno.env.get("TOGETHER_API_KEY");
  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: msgs }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));
  return data.choices[0].message.content;
}

async function callCloudflare(model: string, msgs: Message[]): Promise<string> {
  const accountId = Deno.env.get("CF_ACCOUNT_ID");
  const token = Deno.env.get("CF_AI_TOKEN");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: msgs }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message ?? JSON.stringify(data));
  return data.result.response;
}

async function callOpenRouter(model: string, msgs: Message[]): Promise<string> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://pousinox.com.br",
    },
    body: JSON.stringify({ model, messages: msgs }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));
  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { provider, model, messages, action, search_source } = body;

    if (action === "models") {
      return new Response(JSON.stringify({ ok: true, providers: PROVIDERS_MODELS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "chat") {
      return new Response(JSON.stringify({ ok: false, error: "action must be 'chat' or 'models'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!provider || !model || !messages) {
      return new Response(JSON.stringify({ ok: false, error: "provider, model and messages are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pré-processa: injeta system prompt + banco + busca web (se necessário)
    const { msgs: preparedMsgs, didSearch, didDb } = await injectSystem(messages, search_source);

    let response: string;
    switch (provider) {
      case "groq":
        response = await callGroq(model, preparedMsgs);
        break;
      case "gemini":
        response = await callGemini(model, preparedMsgs);
        break;
      case "cohere":
        response = await callCohere(model, preparedMsgs);
        break;
      case "huggingface":
        response = await callHuggingFace(model, preparedMsgs);
        break;
      case "together":
        response = await callTogether(model, preparedMsgs);
        break;
      case "cloudflare":
        response = await callCloudflare(model, preparedMsgs);
        break;
      case "openrouter":
        response = await callOpenRouter(model, preparedMsgs);
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: `Unknown provider: ${provider}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ ok: true, response, provider, model, tokens_used: null, web_search: didSearch, db_search: didDb, search_source: search_source || 'auto' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
