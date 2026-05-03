import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* Fallback hardcoded — usado quando não consegue ler do banco */
const FALLBACK_MODELS: Record<string, string[]> = {
  groq: ["meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "deepseek-r1-distill-llama-70b", "qwen-qwq-32b"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
  cohere: ["command-a-03-2025", "command-r7b-12-2024"],
  huggingface: ["Qwen/Qwen2.5-72B-Instruct", "meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo", "deepseek-ai/DeepSeek-R1-Distill-Llama-70B"],
  cloudflare: ["@cf/meta/llama-3.1-8b-instruct", "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "@cf/qwen/qwen2.5-coder-32b-instruct"],
  openrouter: ["qwen/qwen3-coder-480b:free", "deepseek/deepseek-r1:free", "google/gemini-2.5-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free", "nvidia/llama-3.1-nemotron-70b-instruct:free"],
};

/* Cache de modelos ativos (recarrega a cada 5min) */
let modelsCache: Record<string, string[]> | null = null;
let modelsCacheAt = 0;
const MODELS_CACHE_TTL = 5 * 60 * 1000;

async function getActiveModels(sb: any): Promise<Record<string, string[]>> {
  if (modelsCache && Date.now() - modelsCacheAt < MODELS_CACHE_TTL) return modelsCache;
  try {
    const { data } = await sb.from("ai_hub_models").select("provider, model_id").eq("ativo", true);
    if (data && data.length > 0) {
      const result: Record<string, string[]> = {};
      for (const row of data) {
        if (!result[row.provider]) result[row.provider] = [];
        result[row.provider].push(row.model_id);
      }
      modelsCache = result;
      modelsCacheAt = Date.now();
      return result;
    }
  } catch { /* fallback */ }
  return FALLBACK_MODELS;
}

interface Message {
  role: string;
  content: string;
}

const BASE_SYSTEM_PROMPT = `Você é o assistente de IA da Pousinox. Responda sempre em português brasileiro.

CONTEXTO BASE (use apenas como referência, NÃO repita literalmente):
- Pousinox — fabricante de equipamentos em aço inox, Pouso Alegre/MG, desde 2001
- Carro-chefe: equipamentos e mobiliário em inox sob medida (bancadas, fogões industriais, coifas, corrimãos, lava-botas, etc.)
- O fixador de porcelanato é apenas UM dos produtos — é um insert metálico parafusado na parede que impede a QUEDA do porcelanato
- SOBRE O FIXADOR: é instalado ENTRE a parede e o porcelanato. Impede DESPRENDIMENTO. NÃO é adicionado à argamassa, NÃO protege a superfície, NÃO substitui argamassa. É segurança mecânica ADICIONAL. Modelos: Inox 304 (com laudo LAMAT/SENAI) e Inox 430 (econômico). Aberturas: 5mm (revestimentos 5-8mm) e 11mm (revestimentos 9-14mm). Dimensão padrão: 120×40×0.8mm. Sob medida disponível.
- Sites: pousinox.com.br | fixadorporcelanato.com.br
- SEGMENTOS DE ATUAÇÃO: Açougues e Frigoríficos, Restaurantes e Food Service, Hospitais e Clínicas, Hotéis e Hotelaria, Supermercados, Padarias, Construção Civil, Arquitetura e Engenharia, Indústria Alimentícia, Indústria Farmacêutica, Laticínios, Condomínios Residenciais, Laboratórios, Pet Shops e Veterinárias
- PRODUTOS POR SEGMENTO: bancadas, pias, mesas, coifas, fogões industriais, estufas, corrimãos, guarda-corpos, lava-botas, tanques, prateleiras, carrinhos, suportes, fixadores de porcelanato, projetos sob medida

REGRAS OBRIGATÓRIAS (NUNCA VIOLE):
- SOBRE A POUSINOX: use EXCLUSIVAMENTE o CONTEXTO BASE acima. A Pousinox é fabricante de equipamentos em aço inox e fixadores de porcelanato. NÃO é hotel, NÃO é hospedagem, NÃO é pousada. Se não tiver certeza sobre um dado, diga "não tenho essa informação".
- NÃO invente dados que não tenha (CNPJ, faturamento, número de funcionários, etc.)
- Priorize: 1º Contexto Base → 2º Banco de dados → 3º Site próprio → 4º Busca web → 5º Conhecimento geral
- Seja CONCISO e DIRETO — máximo 3-5 frases por resposta
- NUNCA diga "você está correto em questionar" — vá direto à resposta
- Quando listar dados, use bullets curtos
- Todos os segmentos listados acima são IGUALMENTE importantes`;

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
    // Comercial
    ['produtos', 'Produtos'],
    ['produtos_catalogo', 'Catálogo padronizado'],
    ['clientes', 'Clientes'],
    ['prospeccao', 'Prospects'],
    ['projetos', 'Projetos sob medida'],
    ['pipeline_deals', 'Deals no pipeline'],
    ['vendas', 'Vendas'],
    ['followups', 'Follow-ups'],
    ['calculadora_leads', 'Leads calculadora'],
    // Fixadores
    ['fixador_modelos', 'Modelos de fixador'],
    // Compras
    ['solicitacoes_compra', 'Solicitações de compra'],
    ['cotacoes_compra', 'Cotações de compra'],
    ['pedidos_compra', 'Pedidos de compra'],
    ['recebimentos_compra', 'Recebimentos de compra'],
    // Estoque
    ['estoque_itens', 'Itens de estoque (MP/PA)'],
    ['estoque_movimentacoes', 'Movimentações de estoque'],
    // Produção / Operação
    ['ordens_producao', 'Ordens de produção'],
    ['ordens_manutencao', 'Ordens de manutenção'],
    ['ativos_manutencao', 'Ativos/Equipamentos'],
    // Fiscal
    ['docs_fiscais_recebidos', 'NFs recebidas'],
    ['docs_fiscais_emitidos', 'NFs emitidas'],
    // Financeiro
    ['fin_lancamentos', 'Lançamentos financeiros'],
    ['fin_movimentacoes', 'Movimentações financeiras (caixa)'],
    ['fin_categorias', 'Categorias financeiras'],
    // Marketing
    ['materiais_comerciais', 'Materiais comerciais'],
    ['market_keywords', 'Keywords de mercado'],
    // Qualidade
    ['inspecoes', 'Inspeções de qualidade'],
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
    if (/segmento|setor|nicho|atua[cç][aã]o|portf[oó]lio/i.test(recent)) {
      const { data: segProj } = await sb.from('projetos').select('segmento').not('segmento', 'is', null);
      const { data: segProsp } = await sb.from('prospeccao').select('segmento').not('segmento', 'is', null).limit(1000);
      const { data: portfolio } = await sb.from('portfolio_produtos').select('segmento, nome').limit(50);
      const segsProj = [...new Set((segProj || []).map(p => p.segmento).filter(Boolean))];
      const segsProsp = [...new Set((segProsp || []).map(p => p.segmento).filter(Boolean))];
      if (segsProj.length) results.push(`SEGMENTOS EM PROJETOS (${segsProj.length}): ${segsProj.join(', ')}`);
      if (segsProsp.length) results.push(`SEGMENTOS EM PROSPECÇÃO (${segsProsp.length}): ${segsProsp.join(', ')}`);
      if (portfolio?.length) {
        const segPort = [...new Set(portfolio.map(p => p.segmento).filter(Boolean))];
        results.push(`SEGMENTOS NO PORTFÓLIO (${segPort.length}): ${segPort.join(', ')}`);
      }
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
    if (/projet|sob.?medida/i.test(recent)) {
      const { data } = await sb.from('projetos').select('titulo, cliente, segmento, status, valor').order('created_at', { ascending: false }).limit(5);
      if (data?.length) results.push(`PROJETOS RECENTES:\n${data.map(p => `- ${p.titulo} | ${p.cliente || 'N/A'} | ${p.status} ${p.valor ? `R$${p.valor}` : ''}`).join('\n')}`);
    }
    // Produção
    if (/produ[cç][aã]o|ordem.?produ|op\b/i.test(recent)) {
      const { data } = await sb.from('ordens_producao').select('numero, titulo, status, data_inicio, data_conclusao').order('created_at', { ascending: false }).limit(5);
      if (data?.length) results.push(`ORDENS DE PRODUÇÃO:\n${data.map(o => `- ${o.numero} ${o.titulo || ''} (${o.status})`).join('\n')}`);
    }
    // Compras
    if (/compra|solicita[cç][aã]o|cota[cç][aã]o|fornecedor|recebimento/i.test(recent)) {
      const [sc, pc, rc] = await Promise.all([
        sb.from('solicitacoes_compra').select('numero, descricao, status, created_at').order('created_at', { ascending: false }).limit(5),
        sb.from('pedidos_compra').select('numero, fornecedor_nome, valor_total, status').order('created_at', { ascending: false }).limit(5),
        sb.from('recebimentos_compra').select('numero, pedido_numero, status').order('created_at', { ascending: false }).limit(5),
      ]);
      if (sc.data?.length) results.push(`SOLICITAÇÕES DE COMPRA:\n${sc.data.map(s => `- ${s.numero} ${s.descricao || ''} (${s.status})`).join('\n')}`);
      if (pc.data?.length) results.push(`PEDIDOS DE COMPRA:\n${pc.data.map(p => `- ${p.numero} ${p.fornecedor_nome || ''} R$${p.valor_total || 0} (${p.status})`).join('\n')}`);
      if (rc.data?.length) results.push(`RECEBIMENTOS:\n${rc.data.map(r => `- ${r.numero} ref ${r.pedido_numero || ''} (${r.status})`).join('\n')}`);
    }
    // Estoque
    if (/estoque|mat[eé]ria.?prima|mp\b|pa\b|saldo|inventário/i.test(recent)) {
      const { data } = await sb.from('estoque_itens').select('codigo, nome, tipo, unidade, saldo_atual, estoque_minimo, custo_medio').eq('ativo', true).limit(20);
      if (data?.length) {
        const abaixo = data.filter(i => i.estoque_minimo && i.saldo_atual < i.estoque_minimo);
        results.push(`ESTOQUE (${data.length} itens ativos):\n${data.map(i => `- ${i.codigo} ${i.nome} [${i.tipo}] Saldo: ${i.saldo_atual} ${i.unidade}${i.custo_medio ? ` R$${i.custo_medio}` : ''}`).join('\n')}${abaixo.length ? `\n⚠️ ${abaixo.length} item(ns) ABAIXO do mínimo: ${abaixo.map(i => i.codigo).join(', ')}` : ''}`);
      }
    }
    // Manutenção
    if (/manuten[cç][aã]o|ativo|equipamento|om\b/i.test(recent)) {
      const { data: ativos } = await sb.from('ativos_manutencao').select('codigo, nome, categoria, status').limit(10);
      const { data: ordens } = await sb.from('ordens_manutencao').select('numero, tipo, prioridade, status, custo_realizado').order('created_at', { ascending: false }).limit(5);
      if (ativos?.length) results.push(`ATIVOS: ${ativos.map(a => `- ${a.codigo} ${a.nome} (${a.status})`).join('\n')}`);
      if (ordens?.length) results.push(`ORDENS MANUTENÇÃO:\n${ordens.map(o => `- ${o.numero} ${o.tipo}/${o.prioridade} (${o.status})${o.custo_realizado ? ` R$${o.custo_realizado}` : ''}`).join('\n')}`);
    }
    // Fiscal
    if (/fiscal|nf.?e|nota.?fiscal|nf\b|documento.?fiscal/i.test(recent)) {
      const [nfr, nfe] = await Promise.all([
        sb.from('docs_fiscais_recebidos').select('numero, emitente_nome, valor_total, status').order('created_at', { ascending: false }).limit(5),
        sb.from('docs_fiscais_emitidos').select('numero, destinatario_nome, valor_total, status').order('created_at', { ascending: false }).limit(5),
      ]);
      if (nfr.data?.length) results.push(`NFs RECEBIDAS:\n${nfr.data.map(n => `- NF ${n.numero} ${n.emitente_nome || ''} R$${n.valor_total || 0} (${n.status})`).join('\n')}`);
      if (nfe.data?.length) results.push(`NFs EMITIDAS:\n${nfe.data.map(n => `- NF ${n.numero} ${n.destinatario_nome || ''} R$${n.valor_total || 0} (${n.status})`).join('\n')}`);
    }
    // Fixadores
    if (/fixador|modelo|calculadora|abertura/i.test(recent)) {
      const { data: modelos } = await sb.from('fixador_modelos').select('nome, material, espessura_mm, abertura_aba_mm, ativo').eq('ativo', true);
      const { data: leads } = await sb.from('calculadora_leads').select('nome, whatsapp, empresa, verificado, calculos, criado_em').order('criado_em', { ascending: false }).limit(10);
      if (modelos?.length) results.push(`MODELOS FIXADOR:\n${modelos.map(m => `- ${m.nome} (${m.material}) ${m.espessura_mm}mm abertura ${m.abertura_aba_mm || '?'}mm`).join('\n')}`);
      if (leads?.length) results.push(`LEADS CALCULADORA (últimos 10):\n${leads.map(l => `- ${l.nome} ${l.whatsapp}${l.empresa ? ` (${l.empresa})` : ''} ${l.verificado ? '✅' : '⏳'} ${l.calculos || 0} cálculos`).join('\n')}`);
    }
    // Marketing / Mercado
    if (/marketing|campanha|keyword|mercado|demanda|busca|seo/i.test(recent)) {
      const { data: kw } = await sb.from('market_keywords').select('termo, uf, volume_mensal, intencao, camada').order('volume_mensal', { ascending: false }).limit(15);
      if (kw?.length) results.push(`KEYWORDS DE MERCADO (top 15):\n${kw.map(k => `- "${k.termo}" ${k.uf || ''} vol:${k.volume_mensal || 0} (${k.intencao || 'n/a'}) [${k.camada}]`).join('\n')}`);
      const { data: mat } = await sb.from('materiais_comerciais').select('titulo, tipo, envios').order('envios', { ascending: false }).limit(10);
      if (mat?.length) results.push(`MATERIAIS COMERCIAIS:\n${mat.map(m => `- ${m.titulo} [${m.tipo}] ${m.envios || 0} envios`).join('\n')}`);
    }
    // Qualidade
    if (/qualidade|inspe[cç][aã]o|nc\b|n[aã]o.?conformidade/i.test(recent)) {
      const { data } = await sb.from('inspecoes').select('id, tipo_origem, origem_label, resultado, created_at').order('created_at', { ascending: false }).limit(5);
      if (data?.length) results.push(`INSPEÇÕES RECENTES:\n${data.map(i => `- ${i.origem_label || 'N/A'} → ${i.resultado}`).join('\n')}`);
    }
    // Assistente IA / Knowledge base
    if (/assistente|conhecimento|knowledge|documento|base.?de.?dados|rag/i.test(recent)) {
      const { data } = await sb.from('ai_knowledge_docs').select('titulo, tipo, created_at').order('created_at', { ascending: false }).limit(10);
      if (data?.length) results.push(`BASE DE CONHECIMENTO (${data.length} docs):\n${data.map(d => `- ${d.titulo} [${d.tipo}]`).join('\n')}`);
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
Seja preciso e honesto. NUNCA invente dados, processos, procedimentos ou informações. Se não tiver a informação, diga "não tenho essa informação no sistema". NÃO crie etapas, formulários ou fluxos fictícios. NÃO sugira "entre em contato" ou "forneça dados" como se houvesse um processo — a menos que esteja documentado nos dados fornecidos.`);

  return parts.join('\n');
}

async function injectSystem(messages: Message[], searchSource?: string, extraSystem?: string): Promise<{ msgs: Message[]; didSearch: boolean; didDb: boolean }> {
  if (messages.length > 0 && messages[0].role === 'system') return { msgs: messages, didSearch: false, didDb: false };

  const skipSearch = searchSource === 'none';
  const forceSearch = !skipSearch && searchSource && searchSource !== 'auto';

  // Sempre: overview + site. Paralelo.
  const [overview, siteContent, detail] = await Promise.all([
    fetchOverview(),
    fetchSiteContext(),
    fetchDetail(messages),
  ]);

  const hasDbDetail = !!detail;

  // Busca web: fonte explícita (brave/serper) → forçar busca; auto → shouldSearch decide
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const searchQuery = skipSearch ? null : (forceSearch ? lastUserMsg : shouldSearch(messages, hasDbDetail));
  const searchResults = searchQuery ? await webSearch(searchQuery, searchSource === 'auto' ? undefined : searchSource) : '';

  let systemPrompt = await buildSystemPrompt(overview, detail, siteContent, searchResults);
  if (extraSystem) systemPrompt += '\n\n' + extraSystem;

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
    body: JSON.stringify({ model, messages: msgs, temperature: 0.2 }),
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
    const { provider, model, messages, action, search_source, system: extraSystem } = body;

    if (action === "models") {
      const sb = getSupabase();
      const activeModels = await getActiveModels(sb);
      return new Response(JSON.stringify({ ok: true, providers: activeModels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Ativar/desativar modelo ──
    if (action === "activate" || action === "deactivate") {
      const { model_id: mid, provider: prov, display_name, free: isFree, context_length: ctx, price: pr } = body;
      if (!mid || !prov) {
        return new Response(JSON.stringify({ ok: false, error: "model_id and provider required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sb = getSupabase();
      if (action === "activate") {
        await sb.from("ai_hub_models").upsert({
          provider: prov, model_id: mid, display_name: display_name || mid,
          free: isFree ?? true, context_length: ctx, price: pr, ativo: true,
        }, { onConflict: "provider,model_id" });
      } else {
        await sb.from("ai_hub_models").update({ ativo: false }).eq("provider", prov).eq("model_id", mid);
      }
      modelsCache = null; // limpa cache
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Descobrir modelos disponíveis nos providers ──
    if (action === "discover") {
      const discovered: Record<string, { id: string; name: string; free: boolean; context?: number; new?: boolean }[]> = {};
      const sb = getSupabase();
      const activeModels = await getActiveModels(sb);
      const configured = new Set(Object.values(activeModels).flat());

      // Groq
      try {
        const gk = Deno.env.get("GROQ_API_KEY");
        if (gk) {
          const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${gk}` } });
          const d = await r.json();
          discovered.groq = (d.data || [])
            .filter((m: any) => m.active !== false && m.id && !m.id.includes("whisper") && !m.id.includes("guard") && !m.id.includes("tool-use"))
            .map((m: any) => ({ id: m.id, name: m.id, free: true, context: m.context_window, new: !configured.has(m.id) }));
        }
      } catch { /* skip */ }

      // OpenRouter (todos — free + pagos)
      try {
        const r = await fetch("https://openrouter.ai/api/v1/models");
        const d = await r.json();
        discovered.openrouter = (d.data || [])
          .filter((m: any) => m.id)
          .slice(0, 80)
          .map((m: any) => {
            const isFree = m.pricing?.prompt === "0" || m.id?.endsWith(":free");
            const price = !isFree && m.pricing?.prompt ? `$${(parseFloat(m.pricing.prompt) * 1_000_000).toFixed(2)}/1M` : undefined;
            return { id: m.id, name: m.name || m.id, free: isFree, context: m.context_length, new: !configured.has(m.id), price };
          });
      } catch { /* skip */ }

      // Together (todos)
      try {
        const tk = Deno.env.get("TOGETHER_API_KEY");
        if (tk) {
          const r = await fetch("https://api.together.xyz/v1/models", { headers: { Authorization: `Bearer ${tk}` } });
          const d = await r.json();
          discovered.together = (d || [])
            .filter((m: any) => m.type === "chat" || m.type === "language")
            .slice(0, 80)
            .map((m: any) => {
              const price = m.pricing?.input ? `$${(parseFloat(m.pricing.input) * 1_000_000).toFixed(2)}/1M` : undefined;
              return { id: m.id, name: m.display_name || m.id, free: !price || price === "$0.00/1M", context: m.context_length, new: !configured.has(m.id), price };
            });
        }
      } catch { /* skip */ }

      // Cohere
      try {
        const ck = Deno.env.get("COHERE_API_KEY");
        if (ck) {
          const r = await fetch("https://api.cohere.com/v2/models", { headers: { Authorization: `Bearer ${ck}`, "Content-Type": "application/json" } });
          const d = await r.json();
          discovered.cohere = (d.models || [])
            .filter((m: any) => m.endpoints?.includes("chat"))
            .map((m: any) => ({ id: m.name, name: m.name, free: true, context: m.context_length, new: !configured.has(m.name) }));
        }
      } catch { /* skip */ }

      // HuggingFace (modelos populares de chat/text-generation)
      try {
        const hfToken = Deno.env.get("HUGGINGFACE_TOKEN");
        const headers: Record<string, string> = {};
        if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;
        const r = await fetch("https://huggingface.co/api/models?pipeline_tag=text-generation&sort=likes&direction=-1&limit=50&filter=conversational", { headers });
        const d = await r.json();
        discovered.huggingface = (d || [])
          .filter((m: any) => m.modelId && m.likes > 100)
          .map((m: any) => ({ id: m.modelId, name: m.modelId, free: true, context: undefined, new: !configured.has(m.modelId), likes: m.likes }));
      } catch { /* skip */ }

      return new Response(JSON.stringify({ ok: true, configured: activeModels, discovered }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Transcrição de áudio via Groq Whisper ──
    if (action === "transcribe") {
      const { audio_base64, audio_name } = body;
      if (!audio_base64) {
        return new Response(JSON.stringify({ ok: false, error: "audio_base64 is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const groqKey = Deno.env.get("GROQ_API_KEY");
      if (!groqKey) {
        return new Response(JSON.stringify({ ok: false, error: "GROQ_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Decode base64 to binary
      const binaryStr = atob(audio_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const fileName = audio_name || "audio.ogg";
      const ext = fileName.split(".").pop()?.toLowerCase() || "ogg";
      const mimeMap: Record<string, string> = { ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", webm: "audio/webm", mp4: "audio/mp4" };
      const mime = mimeMap[ext] || "audio/ogg";

      const formData = new FormData();
      formData.append("file", new Blob([bytes], { type: mime }), fileName);
      formData.append("model", "whisper-large-v3");
      formData.append("language", "pt");
      formData.append("response_format", "verbose_json");

      const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: formData,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        return new Response(JSON.stringify({ ok: false, error: `Whisper error: ${errText}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await whisperRes.json();
      return new Response(JSON.stringify({
        ok: true,
        text: result.text,
        language: result.language,
        duration: result.duration,
        segments: result.segments?.map((s: any) => ({ start: s.start, end: s.end, text: s.text })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Health check — testa modelos ativos com prompt simples ──
    if (action === "health_check") {
      const sb = getSupabase();
      const activeModels = await getActiveModels(sb);
      const results: { provider: string; model: string; ok: boolean; latency_ms: number; error?: string }[] = [];
      const testMsgs: Message[] = [{ role: "user", content: "Responda apenas: OK" }];

      const providerFns: Record<string, (m: string, msgs: Message[]) => Promise<string>> = {
        groq: callGroq, gemini: callGemini, cohere: callCohere,
        huggingface: callHuggingFace, together: callTogether,
        cloudflare: callCloudflare, openrouter: callOpenRouter,
      };

      // Testa até 2 modelos por provider para não demorar demais
      for (const [prov, models] of Object.entries(activeModels)) {
        const fn = providerFns[prov];
        if (!fn) continue;
        for (const mid of models.slice(0, 2)) {
          const t0 = Date.now();
          try {
            await fn(mid, testMsgs);
            results.push({ provider: prov, model: mid, ok: true, latency_ms: Date.now() - t0 });
          } catch (e) {
            results.push({ provider: prov, model: mid, ok: false, latency_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, results, checked_at: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "chat") {
      return new Response(JSON.stringify({ ok: false, error: "action must be 'chat', 'models', 'discover', 'health_check' or 'transcribe'" }), {
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
    const { msgs: preparedMsgs, didSearch, didDb } = await injectSystem(messages, search_source, extraSystem);

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
