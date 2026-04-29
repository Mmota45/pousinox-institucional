import { useState } from 'react'
import styles from './AdminConteudo.module.css'
import { supabaseAdmin } from '../lib/supabase'
import { aiHubChat } from '../lib/aiHelper'
import ArticlePreview from '../components/ArticlePreview/ArticlePreview'
import AgentConteudo from '../components/assistente/AgentConteudo'

const EDGE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/gerar-conteudo'
const ARTIGO_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/gerar-artigo'

const CATEGORIAS = [
  'Restaurantes e Food Service',
  'Hospitalar e Clínicas',
  'Arquitetura e Projetos Residenciais',
  'Construção Civil',
  'Nossa Fábrica',
  'Projetos Entregues',
  'Corte a Laser',
  'Panificação e Confeitaria',
  'Hotelaria',
  'Indústria',
]

function gerarSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}


const TONS = [
  { id: 'informativo',  label: 'Informativo' },
  { id: 'promocional',  label: 'Promocional' },
  { id: 'urgente',      label: 'Urgência' },
  { id: 'educativo',    label: 'Educativo' },
]

const ARTICLE_TEMPLATES: Record<string, { corpo: string; resumo: string }> = {
  solucao: {
    resumo: `- [Problema que esta solução resolve]\n- [Como ela funciona em resumo]\n- [Principal diferencial técnico]`,
    corpo: `**O problema que ele resolve**
[Descreva o problema enfrentado pelo cliente ou segmento. Por que isso é relevante?]

**Como funciona**
[Explique o mecanismo ou processo da solução. Seja técnico e direto.]

**Diferenciais técnicos**
- [Material ou especificação técnica]
- [Dimensão, capacidade ou variante disponível]
- [Facilidade de uso, instalação ou manutenção]

**Para quem é indicado**
[Descreva os segmentos e perfis de clientes que mais se beneficiam desta solução.]

**Por que escolher inox**
[Justificativa técnica: durabilidade, higiene, resistência, normas aplicáveis.]`,
  },
  guia: {
    resumo: `- [O que o leitor vai aprender]\n- [Por que este tema é relevante]\n- [Principal ação prática do guia]`,
    corpo: `**O que você vai aprender**
[Introduza o conteúdo e por que ele é útil para o leitor.]

**Por que isso importa**
[Contextualize o problema ou a necessidade que motivou este guia.]

**Passo a passo**
- [Passo 1: ação concreta]
- [Passo 2: ação concreta]
- [Passo 3: ação concreta]

**Dicas e boas práticas**
[Complemento prático com cuidados, erros comuns ou recomendações técnicas.]

**Conclusão**
[Fechamento com próximo passo claro para o leitor.]`,
  },
  aplicacao: {
    resumo: `- [Segmento ou contexto do projeto]\n- [Desafio que foi resolvido]\n- [Resultado entregue]`,
    corpo: `**O contexto do projeto**
[Descreva o segmento, o cliente (sem identificar se necessário) ou a situação que originou o projeto.]

**O desafio encontrado**
[Qual era o problema específico a resolver? Quais eram as restrições?]

**A solução aplicada**
[O que foi desenvolvido, materiais utilizados, dimensões, processo de fabricação.]

**Resultado entregue**
- [Resultado ou benefício 1]
- [Resultado ou benefício 2]
- [Resultado ou benefício 3]

**Por que inox foi a escolha certa**
[Justificativa técnica e comercial para o uso de aço inox neste projeto.]`,
  },
  institucional: {
    resumo: `- [Contexto ou tema institucional]\n- [O que diferencia a Pousinox®]\n- [Chamada para conhecer mais]`,
    corpo: `**Nossa atuação neste segmento**
[Contextualize a presença e experiência da Pousinox® neste tema ou mercado.]

**O que nos diferencia**
- [Diferencial 1: capacidade técnica ou de produção]
- [Diferencial 2: atendimento ou personalização]
- [Diferencial 3: certificação, norma ou garantia]

**Nosso processo**
[Descreva como trabalhamos: do briefing à entrega, passando pela produção.]

**Projetos e resultados**
[Números, projetos entregues, segmentos atendidos ou alcance geográfico.]`,
  },
}



const REDES_CONFIG: Record<string, { label: string; icon: string; hint: string; rows: number }> = {
  linkedin:  { label: 'LinkedIn',  icon: '💼', hint: 'Ideal: 150–300 palavras, tom profissional e técnico', rows: 12 },
  instagram: { label: 'Instagram', icon: '📸', hint: 'Ideal: 150–200 palavras + hashtags ao final', rows: 10 },
  facebook:  { label: 'Facebook',  icon: '📘', hint: 'Ideal: 80–200 palavras, tom conversacional', rows: 10 },
  whatsapp:  { label: 'WhatsApp',  icon: '💬', hint: 'Ideal: curto e direto, até 100 palavras', rows: 6 },
  email:     { label: 'E-mail',    icon: '📧', hint: 'Inclui linha de assunto + corpo completo', rows: 14 },
  youtube:   { label: 'YouTube',   icon: '🎥', hint: 'Inclui título otimizado + descrição do vídeo', rows: 12 },
}

const REDES_GUIA: Record<string, { exemplo: string; regras: { titulo: string; desc: string }[] }> = {
  linkedin: {
    exemplo: `Hook forte na 1ª linha — frase que para o scroll\n\nParágrafo curto com contexto ou dado relevante.\n\nO que aprendemos na Pousinox®:\n→ Diferencial 1\n→ Diferencial 2\n→ Diferencial 3\n\nFechamento com pergunta ou chamada para ação.\n\n#AçoInox #EquipamentosIndustriais #FoodService`,
    regras: [
      { titulo: 'Hook na 1ª linha', desc: 'A primeira frase determina se o usuário vai clicar em "ver mais". Faça uma afirmação ousada ou uma pergunta.' },
      { titulo: 'Parágrafos curtos', desc: 'Máx. 3 linhas por parágrafo. Linha em branco entre cada um — facilita a leitura no feed.' },
      { titulo: 'Sem links no texto', desc: 'O LinkedIn penaliza posts com links externos. Coloque o link nos comentários e mencione isso no texto.' },
      { titulo: 'Hashtags ao final', desc: '3 a 5 hashtags relevantes no final. Não misture no meio do texto.' },
    ],
  },
  instagram: {
    exemplo: `Você sabia que equipamentos em aço inox duram até 3× mais em cozinhas industriais? 🔩\n\nNa Pousinox® fabricamos sob medida para cada projeto — do balcão ao equipamento completo.\n\n✅ Resistência à corrosão\n✅ Fácil higienização\n✅ Normas ANVISA\n\nQuer um orçamento? Chama no direct ou acesse o link da bio! 👇\n\n#AçoInox #CozinhaIndustrial #Pousinox #EquipamentosInox #FoodService #PadariaseBares`,
    regras: [
      { titulo: 'Emojis com moderação', desc: 'Use emojis para quebrar o texto e guiar o olhar, não para enfeitar. 1–2 por parágrafo é suficiente.' },
      { titulo: 'Hashtags ao final', desc: '10 a 20 hashtags no final (ou no 1º comentário). Mix de populares + nicho + marca.' },
      { titulo: 'CTA explícito', desc: 'Sempre termine com uma ação clara: "link na bio", "salve este post", "chama no direct".' },
      { titulo: 'Quebras de linha', desc: 'Use linha em branco entre parágrafos. O Instagram não formata automaticamente — espaço é visual.' },
    ],
  },
  facebook: {
    exemplo: `Dica rápida para quem trabalha com alimentação 🍽️\n\nUm balcão refrigerado em aço inox não é só estética — é higiene comprovada e durabilidade que reduz custo a longo prazo.\n\nNa Pousinox® cada peça é fabricada sob medida. Atendemos padarias, restaurantes, hospitais e indústrias no Sul de Minas e em todo o Brasil.\n\nQual equipamento você está precisando? Conta nos comentários 👇`,
    regras: [
      { titulo: 'Pergunta para engajamento', desc: 'Termine com uma pergunta para estimular comentários — o algoritmo favorece posts com interação.' },
      { titulo: 'Tom mais pessoal', desc: 'O Facebook tem público mais amplo e familiar. Tom menos corporativo, mais próximo.' },
      { titulo: 'Sem excesso de hashtags', desc: '1 a 3 hashtags no máximo. Hashtags em excesso parecem spam no Facebook.' },
      { titulo: 'Imagem vertical funciona melhor', desc: 'No feed mobile, imagens em 4:5 (vertical) ocupam mais espaço e geram mais impressões.' },
    ],
  },
  whatsapp: {
    exemplo: `Olá! 👋\n\nSomos a *Pousinox®* — fabricamos equipamentos em aço inox sob medida para cozinhas industriais, padarias e restaurantes.\n\nTemos produtos em pronta entrega e também fazemos projetos personalizados.\n\nPosso te enviar nosso catálogo? 📋`,
    regras: [
      { titulo: 'Muito curto e direto', desc: 'Máx. 100 palavras. WhatsApp é conversa, não artigo. Cada parágrafo = uma ideia.' },
      { titulo: 'Bold com asterisco', desc: 'Use *asteriscos* para negrito em palavras-chave. Itálico com _sublinhado_.' },
      { titulo: 'Uma pergunta de fechamento', desc: 'Sempre feche com uma pergunta simples que facilita a resposta: "Posso te enviar o catálogo?"' },
      { titulo: 'Sem links longos', desc: 'Use encurtadores (bit.ly) ou links diretos do WhatsApp Business. Link longo afasta.' },
    ],
  },
  email: {
    exemplo: `Assunto: Equipamentos inox sob medida — conheça a Pousinox®\n\nOlá [Nome],\n\nSe você busca durabilidade, higiene e precisão em equipamentos para cozinha industrial, a Pousinox® pode ser o parceiro certo para o seu projeto.\n\nFabricamos sob medida em Pouso Alegre/MG, atendendo padarias, restaurantes, hospitais e indústrias em todo o Brasil.\n\n✅ Projeto personalizado\n✅ Aço inox AISI 304 e 316\n✅ Prazo e garantia\n\nPosso agendar uma conversa rápida para entender sua necessidade?\n\nAtenciosamente,\nEquipe Pousinox®`,
    regras: [
      { titulo: 'Assunto: fórmula [benefício] — [contexto]', desc: 'O assunto define a taxa de abertura. Seja específico, evite palavras como "Promoção" ou "Grátis" (vão para spam).' },
      { titulo: 'Personalização no início', desc: 'Comece com "Olá [Nome]" ou referência ao negócio do destinatário — aumenta significativamente o engajamento.' },
      { titulo: 'Um único CTA', desc: 'Defina uma só ação desejada: agendar reunião, baixar catálogo ou responder. Múltiplos CTAs confundem.' },
      { titulo: 'Assinatura completa', desc: 'Nome, cargo, WhatsApp e site. Facilita o contato de retorno sem depender do e-mail.' },
    ],
  },
  youtube: {
    exemplo: `Título: Como higienizar equipamentos em aço inox corretamente — Pousinox®\n\nDescrição:\nNeste vídeo mostramos o passo a passo correto para higienização de equipamentos em aço inox em ambientes de food service.\n\n⏱ Capítulos:\n0:00 — Introdução\n1:30 — Produtos indicados\n3:00 — Técnica passo a passo\n5:20 — Erros comuns\n7:00 — Conclusão\n\n🔗 Solicite seu orçamento: https://pousinox.com.br/contato\n📞 WhatsApp: (35) 99999-0000\n\n#AçoInox #HigienizaçãoIndustrial #Pousinox #CozinhaIndustrial`,
    regras: [
      { titulo: 'Keyword no título', desc: 'Coloque a palavra-chave principal nos primeiros 40 caracteres do título. O YouTube usa o título para indexação.' },
      { titulo: 'Descrição com capítulos', desc: 'Marque os timestamps (0:00, 1:30…) na descrição. O YouTube gera capítulos automáticos e aumenta retenção.' },
      { titulo: 'Links na descrição', desc: 'Insira links do site, WhatsApp e redes sociais na descrição. São clicáveis e rastreáveis.' },
      { titulo: 'Hashtags no final', desc: '3 hashtags no final da descrição aparecem acima do título no mobile. Use termos de nicho.' },
    ],
  },
}

export default function AdminConteudo() {
  const [secao, setSecao] = useState<'blog' | 'linkedin' | 'instagram' | 'facebook' | 'whatsapp' | 'email' | 'youtube'>('blog')
  const [agentConteudo, setAgentConteudo] = useState(false)
  const [tema, setTema] = useState('')
  const [tom, setTom] = useState('informativo')
  const [textoRede, setTextoRede] = useState('')
  const [gerandoTextoRede, setGerandoTextoRede] = useState(false)
  const [erroTextoRede, setErroTextoRede] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [publicado, setPublicado] = useState(false)
  const [erroPublicar, setErroPublicar] = useState('')
  const [categoriasArtigo, setCategoriasArtigo] = useState<string[]>(['Restaurantes e Food Service'])
  const [imagemDestaque, setImagemDestaque] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  // Campos editoriais blog
  const [tituloArtigo, setTituloArtigo] = useState('')
  const [metaArtigo, setMetaArtigo] = useState('')
  const [kwsSugeridas, setKwsSugeridas] = useState<string[]>([])
  const [subtitulo, setSubtitulo] = useState('')
  const [tipoPost, setTipoPost] = useState<'solucao'|'guia'|'aplicacao'|'institucional'>('solucao')
  const [origemOferta, setOrigemOferta] = useState<'nenhum'|'produto_proprio'|'parceiro'>('nenhum')
  const [ctaTipo, setCtaTipo] = useState<'pronta_entrega'|'orcamento'|'parceiro'|'nenhum'>('orcamento')
  const [fabricanteParceiro, setFabricanteParceiro] = useState('')
  const [produtoRelacionadoId, setProdutoRelacionadoId] = useState('')
  const [buscarProduto, setBuscarProduto] = useState('')
  const [produtosEncontrados, setProdutosEncontrados] = useState<{id: string, titulo: string}[]>([])
  const [corpoEditado, setCorpoEditado] = useState('')
  const [resumoEditado, setResumoEditado] = useState('')
  const [guiaAberto, setGuiaAberto] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<'editor' | 'preview'>('editor')
  const [templateAplicado, setTemplateAplicado] = useState(false)
  const [keywords, setKeywords] = useState<{ id: number; termo: string; volume_mensal: number; segmento: string | null; intencao: string | null }[]>([])
  const [kwSelecionadas, setKwSelecionadas] = useState<string[]>([])
  const [gerandoRascunho, setGerandoRascunho] = useState(false)
  const [erroRascunho, setErroRascunho] = useState('')
  const [pipelineSeo, setPipelineSeo] = useState(true)
  const [revisaoSeo, setRevisaoSeo] = useState('')
  const [pautasSeo, setPautasSeo] = useState<{ termo: string; posicao: number; impressoes: number; cliques: number; volumeMk: number | null; acao: string }[]>([])
  const [carregandoPautas, setCarregandoPautas] = useState(false)
  const [pautasAberto, setPautasAberto] = useState(false)
  const [pickerAberto, setPickerAberto] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<'blog' | 'redes'>('blog')
  const [imagemRedes, setImagemRedes] = useState('')
  const [imagensBucket, setImagensBucket] = useState<{ name: string; url: string }[]>([])
  const [uploadando, setUploadando] = useState(false)
  const [abaRedeAtiva, setAbaRedeAtiva] = useState<'editor' | 'preview'>('editor')
  const [guiaRedeAberto, setGuiaRedeAberto] = useState(false)
  const [modeloRedeAplicado, setModeloRedeAplicado] = useState(false)

  async function listarImagens() {
    const { data } = await supabaseAdmin.storage.from('artigos-imagens').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    const base = `https://vcektwtpofypsgdgdjlx.supabase.co/storage/v1/object/public/artigos-imagens/`
    setImagensBucket((data ?? []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({ name: f.name, url: base + f.name })))
  }

  async function comprimirImagem(file: File, maxWidth = 1200, qualidade = 0.82): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao comprimir')), 'image/webp', qualidade)
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function excluirImagem(nome: string) {
    await supabaseAdmin.storage.from('artigos-imagens').remove([nome])
    if (imagemDestaque.includes(nome)) setImagemDestaque('')
    await listarImagens()
  }

  async function uploadImagem(file: File) {
    setUploadando(true)
    try {
      const blob = await comprimirImagem(file)
      const nome = `${Date.now()}.webp`
      const { error } = await supabaseAdmin.storage.from('artigos-imagens').upload(nome, blob, { contentType: 'image/webp' })
      if (!error) {
        const url = `https://vcektwtpofypsgdgdjlx.supabase.co/storage/v1/object/public/artigos-imagens/${nome}`
        if (pickerTarget === 'redes') setImagemRedes(url); else setImagemDestaque(url)
        await listarImagens()
        setPickerAberto(false)
      }
    } catch {
      // fallback: envia original se compressão falhar
      const nome = `${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabaseAdmin.storage.from('artigos-imagens').upload(nome, file, { contentType: file.type })
      if (!error) {
        const url = `https://vcektwtpofypsgdgdjlx.supabase.co/storage/v1/object/public/artigos-imagens/${nome}`
        if (pickerTarget === 'redes') setImagemRedes(url); else setImagemDestaque(url)
        await listarImagens()
        setPickerAberto(false)
      }
    }
    setUploadando(false)
  }

  // Busca keywords do estudo de mercado quando categoria muda
  async function buscarKeywords(cat: string) {
    // Mapeia categoria do blog para termos relevantes de segmento
    const termo = cat.toLowerCase().replace(/[^a-záéíóúãõ\s]/gi, '').split(' ')[0]
    const { data } = await supabaseAdmin
      .from('market_keywords')
      .select('id, termo, volume_mensal, segmento, intencao')
      .eq('ativo', true)
      .or(`segmento.ilike.%${termo}%,termo.ilike.%${termo}%`)
      .order('volume_mensal', { ascending: false })
      .limit(12)
    setKeywords(data ?? [])
    setKwSelecionadas([])
  }

  function toggleKw(termo: string) {
    setKwSelecionadas(prev =>
      prev.includes(termo)
        ? prev.filter(k => k !== termo)
        : prev.length < 4 ? [...prev, termo] : prev
    )
  }

  async function sugerirPautas() {
    setCarregandoPautas(true)
    setPautasAberto(true)
    try {
      const d30 = new Date(); d30.setDate(d30.getDate() - 30)
      const start = d30.toISOString().slice(0, 10)
      const end = new Date().toISOString().slice(0, 10)
      const res = await fetch(`https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/ga4-metrics?gsc=1&startDate=${start}&endDate=${end}`)
      const gsc = await res.json()
      if (gsc.error) throw new Error(gsc.error)

      // Buscar market_keywords para cruzar volume
      const { data: mkData } = await supabaseAdmin
        .from('market_keywords')
        .select('termo, volume_mensal')
        .eq('ativo', true)

      const mkMap = new Map<string, number>()
      ;(mkData ?? []).forEach((k: { termo: string; volume_mensal: number }) => mkMap.set(k.termo.toLowerCase(), k.volume_mensal))

      // Combinar: oportunidades (pos 5-20) + queries com impressões altas mas poucos cliques
      const allQueries: typeof gsc.queries = [...(gsc.queries ?? []), ...(gsc.oportunidades ?? [])]
      const seen = new Set<string>()
      const pautas = allQueries
        .filter((q: { query: string }) => { if (seen.has(q.query)) return false; seen.add(q.query); return true })
        .map((q: { query: string; posicao: number; impressoes: number; cliques: number; ctr: number }) => ({
          termo: q.query,
          posicao: q.posicao,
          impressoes: q.impressoes,
          cliques: q.cliques,
          volumeMk: mkMap.get(q.query.toLowerCase()) ?? null,
          acao: q.posicao <= 3 && q.ctr < 0.05
            ? 'Melhorar title/meta — boa posição mas CTR baixo'
            : q.posicao <= 10
            ? 'Expandir conteúdo da página para consolidar posição'
            : q.impressoes > 5
            ? 'Criar artigo/landing page dedicada ao tema'
            : 'Incluir como keyword secundária em conteúdo existente',
        }))
        .sort((a: { impressoes: number }, b: { impressoes: number }) => b.impressoes - a.impressoes)
        .slice(0, 15)

      setPautasSeo(pautas)
    } catch (e) {
      console.error(e)
      setPautasSeo([])
    }
    setCarregandoPautas(false)
  }

  async function gerarRascunho() {
    if (!tema.trim()) { setErroRascunho('Informe o tema antes de gerar.'); return }
    setErroRascunho('')
    setGerandoRascunho(true)

    try {
      const res = await fetch(ARTIGO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sb_publishable_Xq8ZiFGMQfE8wWfwtDOUNw_aozTc_PP' },
        body: JSON.stringify({
          tema: tema.trim(),
          categoria: categoriasArtigo.join(', '),
          tipoPost,
          origemOferta,
          ctaTipo,
          fabricanteParceiro: origemOferta === 'parceiro' ? fabricanteParceiro : undefined,
          keywords: kwSelecionadas,
          tom,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()

      // Preenche campos do editor com a resposta estruturada
      if (data.corpo) setCorpoEditado(data.corpo)
      if (data.resumo) setResumoEditado(data.resumo)
      if (data.subtitulo) setSubtitulo(data.subtitulo)
      if (data.titulo) setTituloArtigo(data.titulo)
      if (data.meta) setMetaArtigo(data.meta)
      if (data.keywords_sugeridas) setKwsSugeridas(data.keywords_sugeridas)
      setAbaAtiva('editor')

      // Pipeline etapa 2: revisão SEO automática
      if (data.corpo && pipelineSeo) {
        setRevisaoSeo('⏳ Revisando SEO...')
        try {
          const review = await aiHubChat(
            `Título: ${data.titulo || tema}\nKeywords: ${kwSelecionadas.join(', ')}\n\nArtigo:\n${data.corpo}`,
            { provider: 'groq', model: 'llama-3.3-70b-versatile' },
            'Especialista em SEO para blog B2B industrial. Analise o artigo e retorne:\n1. Score SEO (0-10)\n2. Densidade de keywords (ok/baixa/alta)\n3. Sugestões de melhoria (máx 5 itens)\n4. Meta description sugerida (máx 160 chars)\nSeja direto. Português brasileiro.',
          )
          setRevisaoSeo(review.error ? `❌ ${review.error}` : review.response)
        } catch { setRevisaoSeo('') }
      }
    } catch (e) {
      setErroRascunho(e instanceof Error ? e.message : 'Erro ao gerar rascunho.')
    }
    setGerandoRascunho(false)
  }

  function aplicarTemplate() {
    const tpl = ARTICLE_TEMPLATES[tipoPost]
    if (!tpl) return
    setCorpoEditado(tpl.corpo)
    setResumoEditado(tpl.resumo)
    setTemplateAplicado(true)
    setTimeout(() => setTemplateAplicado(false), 2500)
  }

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  async function gerarTextoRede() {
    if (!tema.trim()) return
    setGerandoTextoRede(true)
    setErroTextoRede('')
    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, redes: [secao], tom }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      let texto = ''
      if (secao === 'linkedin') texto = data.linkedin ?? ''
      else if (secao === 'instagram') texto = data.instagram ?? ''
      else if (secao === 'facebook') texto = data.facebook ?? ''
      else if (secao === 'whatsapp') texto = data.whatsapp ?? ''
      else if (secao === 'email') texto = `Assunto: ${data.email_assunto ?? ''}\n\n${data.email_corpo ?? ''}`
      else if (secao === 'youtube') texto = `Título: ${data.youtube_titulo ?? ''}\n\nDescrição:\n${data.youtube_desc ?? ''}`
      setTextoRede(texto)
    } catch (e) {
      setErroTextoRede(e instanceof Error ? e.message : 'Erro ao gerar')
    }
    setGerandoTextoRede(false)
  }

  async function buscarProdutos(termo: string) {
    setBuscarProduto(termo)
    if (termo.length < 2) { setProdutosEncontrados([]); return }
    const { data } = await supabaseAdmin.from('produtos').select('id, titulo').ilike('titulo', `%${termo}%`).limit(8)
    setProdutosEncontrados(data ?? [])
  }

  async function publicarNoBlog() {
    if (!tituloArtigo.trim() || !corpoEditado.trim()) return
    setPublicando(true)
    setErroPublicar('')

    const hoje = new Date()
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const dataFormatada = `${hoje.getDate()} ${meses[hoje.getMonth()]} ${hoje.getFullYear()}`
    const conteudo = corpoEditado
    const palavras = conteudo.split(/\s+/).length
    const minutos = Math.max(1, Math.round(palavras / 200))

    const { error } = await supabaseAdmin.from('artigos').insert({
      slug: gerarSlug(tituloArtigo),
      titulo: tituloArtigo,
      categoria: categoriasArtigo.join(', '),
      resumo: resumoEditado || metaArtigo || '',
      conteudo,
      tempo_leitura: `${minutos} min`,
      meta_descricao: metaArtigo || '',
      palavras_chave: kwsSugeridas,
      data_publicacao: dataFormatada,
      publicado: true,
      imagem_destaque: imagemDestaque.trim(),
      video_url: videoUrl.trim(),
      subtitulo: subtitulo.trim() || null,
      tipo_post: tipoPost,
      origem_oferta: origemOferta,
      cta_tipo: ctaTipo,
      fabricante_parceiro: origemOferta === 'parceiro' ? fabricanteParceiro.trim() || null : null,
      produto_relacionado_id: produtoRelacionadoId || null,
    })

    if (error) {
      setErroPublicar(error.message.includes('duplicate') ? 'Já existe um artigo com esse título.' : error.message)
    } else {
      setPublicado(true)
    }
    setPublicando(false)
  }

  function renderPreviewRede() {
    const texto = textoRede.trim()
    const imagem = imagemRedes.trim()
    const now = new Date()
    const hora = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`

    if (secao === 'linkedin') {
      const truncado = texto.length > 400
      const visivel = truncado ? texto.slice(0, 400) + '…' : texto
      return (
        <div style={{ background: '#f3f2ef', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', maxWidth: '560px', margin: '0 auto', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e3f6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>P</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#000' }}>Pousinox®</p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#666' }}>Fabricante de equipamentos em aço inox · Pouso Alegre/MG</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>Agora · 🌐</p>
              </div>
              <button style={{ padding: '5px 14px', border: '1px solid #0a66c2', borderRadius: '20px', background: 'none', color: '#0a66c2', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>+ Seguir</button>
            </div>
            <div style={{ padding: '0 16px 12px' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6, color: '#333', whiteSpace: 'pre-wrap' }}>{texto ? visivel : <span style={{ color: '#aaa' }}>O texto gerado aparecerá aqui…</span>}</p>
              {truncado && <span style={{ color: '#0a66c2', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}> …ver mais</span>}
            </div>
            {imagem && <img src={imagem} alt="" style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }} />}
            <div style={{ padding: '4px 16px 8px', borderTop: imagem ? 'none' : '1px solid #e0e0e0', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#999' }}>👍 💡 ❤️</span>
              <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: 2 }}>0 reações</span>
            </div>
            <div style={{ borderTop: '1px solid #e0e0e0', display: 'flex' }}>
              {['👍 Curtir', '💬 Comentar', '↗ Compartilhar'].map(a => (
                <button key={a} style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', fontSize: '0.8rem', color: '#555', fontWeight: 600, cursor: 'pointer' }}>{a}</button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (secao === 'instagram') {
      const linhas = texto.split('\n')
      const hashtagIdx = linhas.findIndex(l => l.trim().startsWith('#'))
      const corpo = hashtagIdx > 0 ? linhas.slice(0, hashtagIdx).join('\n') : texto
      const hashtags = hashtagIdx > 0 ? linhas.slice(hashtagIdx).join(' ') : ''
      return (
        <div style={{ background: '#fafafa', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #dbdbdb', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #efefef' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#fff', flexShrink: 0 }}>P</div>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#000' }}>pousinox</span>
              <span style={{ marginLeft: 'auto', fontSize: '1.2rem', color: '#333', cursor: 'pointer' }}>···</span>
            </div>
            {imagem
              ? <img src={imagem} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', aspectRatio: '1/1', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '2rem' }}>🖼</div>
            }
            <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '14px' }}>
                <span style={{ fontSize: '1.5rem', cursor: 'pointer' }}>🤍</span>
                <span style={{ fontSize: '1.4rem', cursor: 'pointer' }}>💬</span>
                <span style={{ fontSize: '1.4rem', cursor: 'pointer' }}>✈️</span>
              </div>
              <span style={{ fontSize: '1.4rem', cursor: 'pointer' }}>🔖</span>
            </div>
            <div style={{ padding: '0 12px 12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.82rem', fontWeight: 600, color: '#000' }}>0 curtidas</p>
              <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: '#333', whiteSpace: 'pre-wrap' }}>
                <strong>pousinox</strong> {corpo || <span style={{ color: '#aaa' }}>O texto gerado aparecerá aqui…</span>}
              </p>
              {hashtags && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#00376b' }}>{hashtags}</p>}
            </div>
          </div>
        </div>
      )
    }

    if (secao === 'facebook') {
      return (
        <div style={{ background: '#f0f2f5', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', maxWidth: '500px', margin: '0 auto', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e3f6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>P</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: '#050505' }}>Pousinox®</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#65676b' }}>Agora · 🌐</p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#65676b', fontSize: '1.2rem', cursor: 'pointer' }}>···</span>
            </div>
            <div style={{ padding: '0 16px 12px' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6, color: '#050505', whiteSpace: 'pre-wrap' }}>{texto || <span style={{ color: '#aaa' }}>O texto gerado aparecerá aqui…</span>}</p>
            </div>
            {imagem && <img src={imagem} alt="" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />}
            <div style={{ padding: '6px 16px', borderTop: '1px solid #e4e6ea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#65676b' }}>👍 😮 ❤️ 0</span>
              <span style={{ fontSize: '0.78rem', color: '#65676b' }}>0 comentários</span>
            </div>
            <div style={{ padding: '4px 8px', borderTop: '1px solid #e4e6ea', display: 'flex' }}>
              {['👍 Curtir', '💬 Comentar', '↗ Compartilhar'].map(a => (
                <button key={a} style={{ flex: 1, padding: '8px 0', background: 'none', border: 'none', fontSize: '0.82rem', color: '#65676b', fontWeight: 700, cursor: 'pointer', borderRadius: '4px' }}>{a}</button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (secao === 'whatsapp') {
      return (
        <div style={{ background: '#111b21', padding: '1rem', borderRadius: '8px', minHeight: '200px' }}>
          <div style={{ maxWidth: '420px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ background: '#202c33', padding: '10px 16px', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e3f6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>P</div>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: '#e9edef' }}>Pousinox®</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#8696a0' }}>online</p>
              </div>
            </div>
            <div style={{ background: '#0b141a', padding: '16px 12px', minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              {imagem && (
                <div style={{ maxWidth: '260px', borderRadius: '8px 8px 0 8px', overflow: 'hidden', background: '#202c33', padding: '4px' }}>
                  <img src={imagem} alt="" style={{ width: '100%', borderRadius: '6px', display: 'block' }} />
                </div>
              )}
              <div style={{ maxWidth: '280px', background: '#005c4b', borderRadius: '8px 0 8px 8px', padding: '8px 12px 6px', color: '#e9edef', fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {texto || <span style={{ color: '#8696a0' }}>O texto gerado aparecerá aqui…</span>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#8696a0' }}>{hora}</span>
                  <span style={{ fontSize: '0.7rem', color: '#53bdeb' }}>✓✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (secao === 'email') {
      const linhas = texto.split('\n')
      const assuntoLinha = linhas.find(l => l.startsWith('Assunto:')) ?? ''
      const assunto = assuntoLinha.replace(/^Assunto:\s*/i, '')
      const corpo = linhas.filter(l => !l.startsWith('Assunto:')).join('\n').replace(/^\n+/, '')
      return (
        <div style={{ background: '#f6f8fc', padding: '1.5rem', borderRadius: '8px', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e0e0e0', maxWidth: '600px', margin: '0 auto', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ background: '#404040', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {['#ff5f57','#ffbd2e','#28c840'].map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
              <span style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', color: '#ccc' }}>Nova Mensagem</span>
            </div>
            <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '0.82rem' }}>
                <span style={{ color: '#888', minWidth: 40 }}>De:</span>
                <span style={{ color: '#333' }}>Pousinox® <span style={{ color: '#888' }}>&lt;contato@pousinox.com.br&gt;</span></span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '0.82rem' }}>
                <span style={{ color: '#888', minWidth: 40 }}>Para:</span>
                <span style={{ color: '#333' }}>[cliente]</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.82rem', borderTop: '1px solid #f0f0f0', paddingTop: '6px' }}>
                <span style={{ color: '#888', minWidth: 40 }}>Assunto:</span>
                <span style={{ fontWeight: 600, color: '#111' }}>{assunto || <span style={{ color: '#aaa', fontWeight: 400 }}>Gerado pela IA…</span>}</span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', minHeight: '120px' }}>
              {imagem && <img src={imagem} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px', marginBottom: '12px' }} />}
              <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap' }}>{corpo || <span style={{ color: '#aaa' }}>O corpo do e-mail aparecerá aqui…</span>}</p>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', background: '#fafafa', display: 'flex', gap: '8px' }}>
              <button style={{ padding: '6px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>Enviar</button>
              <span style={{ fontSize: '1rem', cursor: 'pointer', color: '#666', marginTop: '4px' }}>📎</span>
              <span style={{ fontSize: '1rem', cursor: 'pointer', color: '#666', marginTop: '4px' }}>🗑</span>
            </div>
          </div>
        </div>
      )
    }

    if (secao === 'youtube') {
      const linhas = texto.split('\n')
      const tituloLinha = linhas.find(l => l.startsWith('Título:')) ?? ''
      const titulo = tituloLinha.replace(/^Título:\s*/i, '')
      const descIdx = linhas.findIndex(l => l.toLowerCase().includes('descrição:'))
      const desc = descIdx >= 0 ? linhas.slice(descIdx + 1).join('\n').trim() : ''
      return (
        <div style={{ background: '#0f0f0f', padding: '1.5rem', borderRadius: '8px', fontFamily: 'Roboto, system-ui, sans-serif' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            {imagem
              ? <img src={imagem} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
              : <div style={{ width: '100%', aspectRatio: '16/9', background: '#272727', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>▶</div>
            }
            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e3f6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>P</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: '#fff', lineHeight: 1.3, marginBottom: '4px' }}>{titulo || <span style={{ color: '#666' }}>Título do vídeo aparecerá aqui…</span>}</p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa' }}>Pousinox® · 0 visualizações · Agora</p>
              </div>
              <span style={{ color: '#aaa', fontSize: '1.2rem', cursor: 'pointer' }}>⋮</span>
            </div>
            {desc && (
              <div style={{ marginTop: '12px', background: '#272727', borderRadius: '10px', padding: '12px', color: '#e0e0e0', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {desc.slice(0, 300)}{desc.length > 300 ? '…' : ''}
                {desc.length > 300 && <span style={{ color: '#aaa', cursor: 'pointer' }}> mais</span>}
              </div>
            )}
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['👍 Gostei', '👎 Não gostei', '↗ Compartilhar', '✂️ Recortar', '💾 Salvar'].map(a => (
                <button key={a} style={{ padding: '6px 14px', background: '#272727', border: 'none', borderRadius: '20px', color: '#e0e0e0', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>{a}</button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className={styles.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className={styles.titulo} style={{ margin: 0 }}>Conteúdo</h1>
        <button style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => setAgentConteudo(true)}>✍️ Gerador IA</button>
      </div>

      {/* Seletor de canal */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[
          { id: 'blog',      label: '📝 Blog' },
          { id: 'linkedin',  label: '💼 LinkedIn' },
          { id: 'instagram', label: '📸 Instagram' },
          { id: 'facebook',  label: '📘 Facebook' },
          { id: 'whatsapp',  label: '💬 WhatsApp' },
          { id: 'email',     label: '📧 E-mail' },
          { id: 'youtube',   label: '🎥 YouTube' },
        ].map(s => (
          <button key={s.id} type="button"
            onClick={() => { setSecao(s.id as typeof secao); setTextoRede(''); setErroTextoRede('') }}
            style={{ padding: '0.45rem 1rem', fontWeight: 700, fontSize: '0.85rem', border: '2px solid', borderRadius: '8px', cursor: 'pointer',
              borderColor: secao === s.id ? '#1e3f6e' : '#e2e8f0',
              background: secao === s.id ? '#1e3f6e' : '#fff',
              color: secao === s.id ? '#fff' : '#64748b' }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── SEÇÃO BLOG ─────────────────────────────────────── */}
      {secao === 'blog' && (
        <div className={styles.card}>
          {/* Campos principais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Tema do artigo</label>
              <textarea
                className={styles.textarea}
                rows={2}
                placeholder="Ex: Balcão refrigerado inox para padarias, como higienizar equipamentos inox…"
                value={tema}
                onChange={e => setTema(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                Segmentos <span style={{ fontWeight: 400, color: '#94a3b8' }}>(selecione quantos quiser)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {CATEGORIAS.map(c => (
                  <button key={c} type="button"
                    onClick={() => {
                      const next = categoriasArtigo.includes(c)
                        ? categoriasArtigo.filter(x => x !== c)
                        : [...categoriasArtigo, c]
                      setCategoriasArtigo(next.length ? next : [c])
                      buscarKeywords(next[0] ?? c)
                    }}
                    style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', border: '1px solid',
                      background: categoriasArtigo.includes(c) ? '#1e3f6e' : '#fff',
                      color: categoriasArtigo.includes(c) ? '#fff' : '#475569',
                      borderColor: categoriasArtigo.includes(c) ? '#1e3f6e' : '#cbd5e1' }}
                  >{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Tom</label>
              <div className={styles.chips}>
                {TONS.map(t => (
                  <button key={t.id} type="button"
                    className={`${styles.chip} ${tom === t.id ? styles.chipAtivo : ''}`}
                    onClick={() => setTom(t.id)}
                  >{t.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Tipo editorial</label>
              <select value={tipoPost} onChange={e => setTipoPost(e.target.value as typeof tipoPost)}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155' }}>
                <option value="solucao">Solução</option>
                <option value="guia">Guia</option>
                <option value="aplicacao">Aplicação</option>
                <option value="institucional">Institucional</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Origem da oferta</label>
              <select value={origemOferta} onChange={e => setOrigemOferta(e.target.value as typeof origemOferta)}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155' }}>
                <option value="nenhum">Sem produto</option>
                <option value="produto_proprio">Produto Pousinox®</option>
                <option value="parceiro">Produto de parceiro</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>CTA do post</label>
              <select value={ctaTipo} onChange={e => setCtaTipo(e.target.value as typeof ctaTipo)}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155' }}>
                <option value="orcamento">Solicitar orçamento / WhatsApp</option>
                <option value="pronta_entrega">Ver na Pronta Entrega</option>
                <option value="parceiro">Produto de parceiro (aviso)</option>
                <option value="nenhum">Nenhum</option>
              </select>
            </div>
            {origemOferta === 'parceiro' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', display: 'block', marginBottom: '0.25rem' }}>Fabricante parceiro *</label>
                <input type="text" placeholder="Ex: Croydon, Frilux…" value={fabricanteParceiro} onChange={e => setFabricanteParceiro(e.target.value)}
                  style={{ width: '100%', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
              </div>
            )}
          </div>

          {/* Keywords + Gerar rascunho */}
          <div style={{ padding: '0.875rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: keywords.length > 0 ? '0.6rem' : 0 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Keywords — estudo de mercado <span style={{ fontWeight: 400, marginLeft: 6, color: '#94a3b8' }}>(máx. 4)</span>
              </span>
              <button type="button" onClick={() => buscarKeywords(categoriasArtigo[0] ?? '')}
                style={{ fontSize: '0.75rem', color: '#1e3f6e', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                ↻ atualizar
              </button>
            </div>
            {keywords.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                {keywords.map(kw => (
                  <button key={kw.id} type="button" onClick={() => toggleKw(kw.termo)}
                    title={`vol. ${kw.volume_mensal?.toLocaleString('pt-BR') ?? '—'}/mês · ${kw.intencao ?? ''}`}
                    style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', border: '1px solid',
                      background: kwSelecionadas.includes(kw.termo) ? '#1e3f6e' : '#fff',
                      color: kwSelecionadas.includes(kw.termo) ? '#fff' : '#334155',
                      borderColor: kwSelecionadas.includes(kw.termo) ? '#1e3f6e' : '#cbd5e1' }}>
                    {kw.termo}
                    {kw.volume_mensal ? <span style={{ opacity: 0.6, marginLeft: 4, fontSize: '0.72rem' }}>{kw.volume_mensal >= 1000 ? `${Math.round(kw.volume_mensal / 1000)}k` : kw.volume_mensal}</span> : null}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.25rem 0 0.75rem' }}>
                Nenhuma keyword carregada —{' '}
                <button type="button" onClick={() => buscarKeywords(categoriasArtigo[0] ?? '')} style={{ color: '#1e3f6e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}>buscar</button>
                {' '}ou acesse{' '}
                <a href="/admin/estudo-mercado" target="_blank" style={{ color: '#1e3f6e', fontSize: '0.78rem' }}>Estudo de Mercado</a>.
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={gerarRascunho} disabled={gerandoRascunho || !tema.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 700, border: 'none', borderRadius: '8px',
                  background: gerandoRascunho || !tema.trim() ? '#94a3b8' : '#1e3f6e', color: '#fff', cursor: gerandoRascunho || !tema.trim() ? 'not-allowed' : 'pointer' }}>
                {gerandoRascunho ? <><span className={styles.spinner} /> Gerando rascunho…</> : '✨ Gerar rascunho com IA'}
              </button>
              <button type="button" onClick={aplicarTemplate}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', color: '#1e3f6e', cursor: 'pointer' }}>
                📋 Usar modelo — {tipoPost === 'solucao' ? 'Solução' : tipoPost === 'guia' ? 'Guia' : tipoPost === 'aplicacao' ? 'Aplicação' : 'Institucional'}
              </button>
              {templateAplicado && <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>✓ Estrutura aplicada</span>}
              {kwSelecionadas.length > 0 && <span style={{ fontSize: '0.78rem', color: '#475569' }}>{kwSelecionadas.length} keyword{kwSelecionadas.length > 1 ? 's' : ''} selecionada{kwSelecionadas.length > 1 ? 's' : ''}</span>}
              {erroRascunho && <span style={{ fontSize: '0.78rem', color: '#dc2626' }}>{erroRascunho}</span>}
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}>
                <input type="checkbox" checked={pipelineSeo} onChange={e => setPipelineSeo(e.target.checked)} />
                🔍 Revisão SEO automática
              </label>
            </div>
            {revisaoSeo && (
              <div style={{ marginTop: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                <strong style={{ color: '#15803d' }}>🔍 Revisão SEO (Llama 70B)</strong>
                <div style={{ marginTop: 6 }}>{revisaoSeo}</div>
              </div>
            )}

            {/* Sugerir pautas SEO */}
            <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.75rem' }}>
              <button type="button" onClick={sugerirPautas} disabled={carregandoPautas}
                style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e3f6e', background: 'none', border: '1px solid #bfdbfe', borderRadius: '20px', padding: '4px 14px', cursor: carregandoPautas ? 'wait' : 'pointer' }}>
                {carregandoPautas ? 'Analisando SEO…' : '🔍 Sugerir pautas com dados do Google'}
              </button>
              {pautasAberto && pautasSeo.length > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.78rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Termo</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Impr.</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Pos.</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Ação</th>
                        <th style={{ padding: '4px 6px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pautasSeo.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '5px 6px', fontWeight: 500, color: '#334155' }}>
                            {p.termo}
                            {p.volumeMk != null && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: '#94a3b8' }}>vol. {p.volumeMk.toLocaleString('pt-BR')}</span>}
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', color: '#64748b' }}>{p.impressoes}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                            <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600,
                              background: p.posicao <= 3 ? '#dcfce7' : p.posicao <= 10 ? '#fef3c7' : '#fee2e2',
                              color: p.posicao <= 3 ? '#166534' : p.posicao <= 10 ? '#92400e' : '#dc2626' }}>
                              {p.posicao.toFixed(1)}
                            </span>
                          </td>
                          <td style={{ padding: '5px 6px', fontSize: '0.72rem', color: '#64748b' }}>{p.acao}</td>
                          <td style={{ padding: '5px 6px' }}>
                            <button type="button" onClick={() => { setTema(p.termo); toggleKw(p.termo); setPautasAberto(false) }}
                              style={{ fontSize: '0.7rem', color: '#1e3f6e', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              Usar tema
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pautasAberto && !carregandoPautas && pautasSeo.length === 0 && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>Nenhuma oportunidade encontrada no período.</p>
              )}
            </div>
          </div>

          {/* Tab switcher Editor / Preview */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 0 }}>
            <button type="button" onClick={() => setAbaAtiva('editor')}
              style={{ flex: 1, padding: '0.6rem', fontSize: '0.82rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: abaAtiva === 'editor' ? '#fff' : '#f8fafc', color: abaAtiva === 'editor' ? '#1e3f6e' : '#64748b', borderBottom: abaAtiva === 'editor' ? '2px solid #1e3f6e' : '2px solid transparent', transition: 'all 0.15s' }}>
              ✏ Editor
            </button>
            <button type="button" onClick={() => setAbaAtiva('preview')}
              style={{ flex: 1, padding: '0.6rem', fontSize: '0.82rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: abaAtiva === 'preview' ? '#fff' : '#f8fafc', color: abaAtiva === 'preview' ? '#1e3f6e' : '#64748b', borderBottom: abaAtiva === 'preview' ? '2px solid #1e3f6e' : '2px solid transparent', transition: 'all 0.15s' }}>
              👁 Preview do artigo
            </button>
          </div>

          {/* Aba Preview */}
          {abaAtiva === 'preview' && (
            <div style={{ padding: '1.5rem 1.25rem', background: '#fff' }}>
              <ArticlePreview
                titulo={tituloArtigo}
                subtitulo={subtitulo}
                categoria={categoriasArtigo[0] ?? ''}
                resumo={resumoEditado}
                conteudo={corpoEditado}
                imagemDestaque={imagemDestaque}
                tipoPost={tipoPost}
                ctaTipo={ctaTipo}
                fabricanteParceiro={fabricanteParceiro}
              />
            </div>
          )}

          {/* Aba Editor */}
          {abaAtiva === 'editor' && (
          <div>
            {/* Guia de formatação */}
            <div style={{ margin: '0.75rem 0 0.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <button type="button" onClick={() => setGuiaAberto(g => !g)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.875rem', background: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#475569', letterSpacing: '0.03em' }}>
                <span>📐 Guia de formatação editorial</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{guiaAberto ? '▲ fechar' : '▼ ver'}</span>
              </button>
              {guiaAberto && (
                <div style={{ padding: '1rem 0.875rem', background: '#fff', borderTop: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                  <pre style={{ background: '#f1f5f9', padding: '0.75rem', borderRadius: '6px', fontSize: '0.78rem', whiteSpace: 'pre-wrap', color: '#334155', marginBottom: '0.75rem' }}>{`**O problema que ele resolve**\nTexto explicando o problema...\n\n**Como funciona**\nTexto sobre o funcionamento...\n\n**Diferenciais técnicos**\n- Material: aço inox 304\n- Dimensões: 60 × 40 cm\n- Sem energia elétrica`}</pre>
                  <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><strong>Headings</strong>: <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>**Título da seção**</code> em linha própria</li>
                    <li><strong>Listas</strong>: cada item com <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>- item</code></li>
                  </ul>
                </div>
              )}
            </div>

            {/* Título e Meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Título SEO — editável</label>
                <input type="text" placeholder="Título do artigo (até 65 caracteres)" value={tituloArtigo} onChange={e => setTituloArtigo(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Subtítulo — opcional</label>
                <input type="text" placeholder="Frase curta de apoio ao título" value={subtitulo} onChange={e => setSubtitulo(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Meta description SEO</label>
                <input type="text" placeholder="Até 155 caracteres" value={metaArtigo} onChange={e => setMetaArtigo(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', color: '#334155', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Corpo editável */}
            <div style={{ marginBottom: '0.5rem' }}>
              {(() => {
                const temHeadings = /\*\*[^*]+\*\*/.test(corpoEditado)
                const numSecoes = (corpoEditado.match(/\*\*[^*]+\*\*/g) || []).length
                return (
                  <>
                    {!temHeadings && corpoEditado.trim() && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#92400e' }}>
                        ⚠️ <strong>Sem seções detectadas.</strong> Adicione headings com **Título**.
                      </div>
                    )}
                    {temHeadings && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#15803d' }}>
                        ✓ {numSecoes} {numSecoes === 1 ? 'seção detectada' : 'seções detectadas'} — artigo modular
                      </div>
                    )}
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Corpo do artigo</label>
                    <textarea value={corpoEditado} onChange={e => setCorpoEditado(e.target.value)} rows={18}
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: '#334155', fontFamily: 'monospace', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }} />
                  </>
                )
              })()}
            </div>

            {/* Resumo */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                Resumo rápido <span style={{ fontWeight: 400, color: '#94a3b8' }}>— use "- item" por linha para bullets</span>
              </label>
              <textarea value={resumoEditado} onChange={e => setResumoEditado(e.target.value)} rows={4}
                placeholder={`- Ponto principal 1\n- Ponto principal 2\n- Ponto principal 3`}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: '#334155', fontFamily: 'monospace', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            {/* Imagem e vídeo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Imagem de destaque — opcional</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="url" placeholder="https://..." value={imagemDestaque} onChange={e => setImagemDestaque(e.target.value)}
                    style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
                  <button type="button" onClick={() => { setPickerTarget('blog'); setPickerAberto(true); listarImagens() }}
                    style={{ padding: '0.4rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    🖼 Escolher
                  </button>
                </div>
                {imagemDestaque.trim() && (
                  <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                    <img src={imagemDestaque.trim()} alt="Destaque"
                      style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'block' }} />
                    <button type="button" onClick={() => setImagemDestaque('')}
                      style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1 }}>×</button>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Vídeo YouTube (URL) — opcional</label>
                <input type="url" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
              </div>
              {ctaTipo === 'pronta_entrega' && (
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                    Produto relacionado (pronta entrega){produtoRelacionadoId && <span style={{ color: '#16a34a', marginLeft: 6 }}>✓ vinculado</span>}
                  </label>
                  <input type="text" placeholder="Buscar produto pelo título…" value={buscarProduto} onChange={e => buscarProdutos(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
                  {produtosEncontrados.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2 }}>
                      {produtosEncontrados.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => { setProdutoRelacionadoId(p.id); setBuscarProduto(p.titulo); setProdutosEncontrados([]) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#334155', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                          {p.titulo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Checklist editorial */}
            {(() => {
              const checks = [
                { ok: !!tituloArtigo.trim(), label: 'Título' },
                { ok: !!subtitulo.trim(), label: 'Subtítulo' },
                { ok: resumoEditado.trim().length > 20, label: 'Resumo rápido' },
                { ok: /\*\*[^*]+\*\*/.test(corpoEditado), label: '3–5 seções com heading' },
                { ok: ctaTipo !== 'nenhum', label: 'CTA definido' },
              ]
              const ok = checks.filter(c => c.ok).length
              return (
                <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Checklist editorial — {ok}/{checks.length}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {checks.map(c => (
                      <span key={c.label} style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '20px', background: c.ok ? '#dcfce7' : '#fef9c3', color: c.ok ? '#15803d' : '#92400e', fontWeight: 500 }}>
                        {c.ok ? '✓' : '○'} {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Publicar */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {publicado ? (
                <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>✓ Artigo publicado no blog com sucesso!</p>
              ) : (
                <button className={styles.btnGerar} onClick={publicarNoBlog} disabled={publicando || !tituloArtigo.trim() || !corpoEditado.trim()}
                  style={{ width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}>
                  {publicando ? 'Publicando…' : 'Publicar no Blog'}
                </button>
              )}
            </div>
            {erroPublicar && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>{erroPublicar}</p>}
          </div>
          )}
        </div>
      )}

      {/* ── SEÇÃO REDES SOCIAIS ─────────────────────────────── */}
      {/* ── SEÇÃO REDES SOCIAIS (LinkedIn, Instagram, etc.) ── */}
      {secao !== 'blog' && (
      <div className={styles.card}>
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.75rem', padding: '0.5rem 0.75rem', background: '#f0f6ff', borderRadius: '6px', borderLeft: '3px solid #1e3f6e' }}>
          {REDES_CONFIG[secao]?.hint}
        </p>

        {/* Tema */}
        <div className={styles.field}>
          <label className={styles.label}>Tema ou produto</label>
          <textarea className={styles.textarea} rows={2}
            placeholder="Ex: Balcão refrigerado inox para padarias, dicas de higienização de equipamentos inox…"
            value={tema} onChange={e => setTema(e.target.value)} />
        </div>

        {/* Segmentos */}
        <div className={styles.field}>
          <label className={styles.label}>Segmentos <span style={{ fontWeight: 400, color: '#94a3b8' }}>(opcional)</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {CATEGORIAS.map(c => (
              <button key={c} type="button"
                onClick={() => setCategoriasArtigo(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', border: '1px solid',
                  background: categoriasArtigo.includes(c) ? '#1e3f6e' : '#fff',
                  color: categoriasArtigo.includes(c) ? '#fff' : '#475569',
                  borderColor: categoriasArtigo.includes(c) ? '#1e3f6e' : '#cbd5e1' }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Tom */}
        <div className={styles.field}>
          <label className={styles.label}>Tom</label>
          <div className={styles.chips}>
            {TONS.map(t => (
              <button key={t.id} type="button"
                className={`${styles.chip} ${tom === t.id ? styles.chipAtivo : ''}`}
                onClick={() => setTom(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Tipo editorial + Origem + CTA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Tipo editorial</label>
            <select value={tipoPost} onChange={e => setTipoPost(e.target.value as typeof tipoPost)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155' }}>
              <option value="solucao">Solução</option>
              <option value="guia">Guia</option>
              <option value="aplicacao">Aplicação</option>
              <option value="institucional">Institucional</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Origem da oferta</label>
            <select value={origemOferta} onChange={e => setOrigemOferta(e.target.value as typeof origemOferta)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155' }}>
              <option value="nenhum">Sem produto</option>
              <option value="produto_proprio">Produto Pousinox®</option>
              <option value="parceiro">Produto de parceiro</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>CTA principal</label>
            <select value={ctaTipo} onChange={e => setCtaTipo(e.target.value as typeof ctaTipo)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155' }}>
              <option value="orcamento">Solicitar orçamento / WhatsApp</option>
              <option value="pronta_entrega">Ver na Pronta Entrega</option>
              <option value="parceiro">Produto de parceiro (aviso)</option>
              <option value="nenhum">Nenhum</option>
            </select>
          </div>
          {origemOferta === 'parceiro' && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', display: 'block', marginBottom: '0.25rem' }}>Fabricante parceiro *</label>
              <input type="text" placeholder="Ex: Croydon, Frilux…" value={fabricanteParceiro} onChange={e => setFabricanteParceiro(e.target.value)}
                style={{ width: '100%', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        {/* Keywords */}
        <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: keywords.length > 0 ? '0.5rem' : 0 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Keywords <span style={{ fontWeight: 400, color: '#94a3b8' }}>(máx. 4)</span>
            </span>
            <button type="button" onClick={() => buscarKeywords(categoriasArtigo[0] ?? '')}
              style={{ fontSize: '0.75rem', color: '#1e3f6e', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>↻ atualizar</button>
          </div>
          {keywords.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.5rem' }}>
              {keywords.map(kw => (
                <button key={kw.id} type="button" onClick={() => toggleKw(kw.termo)}
                  title={`vol. ${kw.volume_mensal?.toLocaleString('pt-BR') ?? '—'}/mês · ${kw.intencao ?? ''}`}
                  style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', border: '1px solid',
                    background: kwSelecionadas.includes(kw.termo) ? '#1e3f6e' : '#fff',
                    color: kwSelecionadas.includes(kw.termo) ? '#fff' : '#334155',
                    borderColor: kwSelecionadas.includes(kw.termo) ? '#1e3f6e' : '#cbd5e1' }}>
                  {kw.termo}
                  {kw.volume_mensal ? <span style={{ opacity: 0.6, marginLeft: 4, fontSize: '0.72rem' }}>{kw.volume_mensal >= 1000 ? `${Math.round(kw.volume_mensal/1000)}k` : kw.volume_mensal}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.25rem 0 0.5rem' }}>
              Nenhuma keyword carregada —{' '}
              <button type="button" onClick={() => buscarKeywords(categoriasArtigo[0] ?? '')} style={{ color: '#1e3f6e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}>buscar</button>
              {' '}ou acesse{' '}
              <a href="/admin/estudo-mercado" target="_blank" style={{ color: '#1e3f6e', fontSize: '0.78rem' }}>Estudo de Mercado</a>.
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button className={styles.btnGerar} onClick={gerarTextoRede} disabled={gerandoTextoRede || !tema.trim()}
              style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
              {gerandoTextoRede ? <><span className={styles.spinner} /> Gerando…</> : '✨ Gerar rascunho com IA'}
            </button>
            {REDES_GUIA[secao] && (
              <button type="button"
                onClick={() => { setTextoRede(REDES_GUIA[secao].exemplo); setAbaRedeAtiva('editor'); setModeloRedeAplicado(true); setTimeout(() => setModeloRedeAplicado(false), 2500) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', color: '#1e3f6e', cursor: 'pointer' }}>
                📋 Usar modelo — {REDES_CONFIG[secao]?.label}
              </button>
            )}
            {modeloRedeAplicado && <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>✓ Modelo aplicado</span>}
            {kwSelecionadas.length > 0 && (
              <span style={{ fontSize: '0.78rem', color: '#475569' }}>{kwSelecionadas.length} keyword{kwSelecionadas.length > 1 ? 's' : ''} selecionada{kwSelecionadas.length > 1 ? 's' : ''}</span>
            )}
            {erroTextoRede && <span style={{ fontSize: '0.78rem', color: '#dc2626' }}>{erroTextoRede}</span>}
          </div>
        </div>

        {/* Tabs Editor / Preview */}
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 0 }}>
            <button type="button" onClick={() => setAbaRedeAtiva('editor')}
              style={{ flex: 1, padding: '0.55rem', fontSize: '0.82rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: abaRedeAtiva === 'editor' ? '#fff' : '#f8fafc', color: abaRedeAtiva === 'editor' ? '#1e3f6e' : '#64748b', borderBottom: abaRedeAtiva === 'editor' ? '2px solid #1e3f6e' : '2px solid transparent' }}>
              ✏ Editor
            </button>
            <button type="button" onClick={() => setAbaRedeAtiva('preview')}
              style={{ flex: 1, padding: '0.55rem', fontSize: '0.82rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: abaRedeAtiva === 'preview' ? '#fff' : '#f8fafc', color: abaRedeAtiva === 'preview' ? '#1e3f6e' : '#64748b', borderBottom: abaRedeAtiva === 'preview' ? '2px solid #1e3f6e' : '2px solid transparent' }}>
              👁 Preview {REDES_CONFIG[secao]?.label}
            </button>
          </div>

          {abaRedeAtiva === 'editor' && (
            <div>
              {/* Guia de formatação por canal */}
              {REDES_GUIA[secao] && (
                <div style={{ margin: '0.75rem 0 0.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setGuiaRedeAberto(g => !g)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.875rem', background: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#475569', letterSpacing: '0.03em' }}>
                    <span>📐 Guia de formatação — {REDES_CONFIG[secao]?.label}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{guiaRedeAberto ? '▲ fechar' : '▼ ver'}</span>
                  </button>
                  {guiaRedeAberto && (
                    <div style={{ padding: '1rem 0.875rem', background: '#fff', borderTop: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#334155', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Exemplo de estrutura</p>
                      <pre style={{ background: '#f1f5f9', padding: '0.75rem', borderRadius: '6px', fontSize: '0.78rem', whiteSpace: 'pre-wrap', color: '#334155', marginBottom: '0.75rem', fontFamily: 'monospace' }}>{REDES_GUIA[secao].exemplo}</pre>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#334155', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Boas práticas</p>
                      <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '6px', margin: 0 }}>
                        {REDES_GUIA[secao].regras.map(r => (
                          <li key={r.titulo}><strong>{r.titulo}</strong>: {r.desc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0 0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Texto — editável antes de copiar</label>
                {textoRede && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{textoRede.length} chars · {textoRede.split(/\s+/).filter(Boolean).length} palavras</span>}
              </div>
              <textarea value={textoRede} onChange={e => setTextoRede(e.target.value)}
                rows={REDES_CONFIG[secao]?.rows ?? 10}
                placeholder="O rascunho gerado pela IA aparecerá aqui — você pode editar antes de copiar."
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#334155', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }} />

              {/* Produto relacionado (pronta entrega) */}
              {ctaTipo === 'pronta_entrega' && (
                <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                    Produto relacionado (pronta entrega){produtoRelacionadoId && <span style={{ color: '#16a34a', marginLeft: 6 }}>✓ vinculado</span>}
                  </label>
                  <input type="text" placeholder="Buscar produto pelo título…" value={buscarProduto} onChange={e => buscarProdutos(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
                  {produtosEncontrados.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2 }}>
                      {produtosEncontrados.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => { setProdutoRelacionadoId(p.id); setBuscarProduto(p.titulo); setProdutosEncontrados([]) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#334155', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                          {p.titulo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {abaRedeAtiva === 'preview' && (
            <div style={{ marginTop: '0.5rem' }}>
              {renderPreviewRede()}
            </div>
          )}
        </div>

        {/* Imagem + Vídeo */}
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Imagem de destaque — opcional</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="url" placeholder="https://..." value={imagemRedes} onChange={e => setImagemRedes(e.target.value)}
                style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
              <button type="button" onClick={() => { setPickerTarget('redes'); setPickerAberto(true); listarImagens() }}
                style={{ padding: '0.4rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                🖼 Escolher
              </button>
            </div>
            {imagemRedes.trim() && (
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <img src={imagemRedes.trim()} alt="Imagem" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'block' }} />
                <button type="button" onClick={() => setImagemRedes('')}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: '0.85rem' }}>×</button>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Vídeo YouTube (URL) — opcional</label>
            <input type="url" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#334155', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Checklist editorial por canal */}
        {(() => {
          const checks: { ok: boolean; label: string }[] = [
            { ok: !!tema.trim(), label: 'Tema definido' },
            { ok: !!textoRede.trim(), label: 'Texto gerado' },
            { ok: !!imagemRedes.trim(), label: 'Imagem escolhida' },
            { ok: ctaTipo !== 'nenhum', label: 'CTA definido' },
            ...(secao === 'instagram' ? [{ ok: textoRede.includes('#'), label: 'Hashtags incluídas' }] : []),
            ...(secao === 'email' ? [{ ok: textoRede.toLowerCase().includes('assunto:'), label: 'Linha de assunto presente' }] : []),
            ...(secao === 'youtube' ? [{ ok: textoRede.toLowerCase().includes('título:'), label: 'Título do vídeo presente' }] : []),
            ...(secao === 'linkedin' ? [{ ok: textoRede.split(/\n/).some(l => l.startsWith('#')), label: 'Hashtags ao final' }] : []),
          ]
          const ok = checks.filter(c => c.ok).length
          return (
            <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', margin: '0.75rem 0' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Checklist — {REDES_CONFIG[secao]?.label} · {ok}/{checks.length}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {checks.map(c => (
                  <span key={c.label} style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '20px', background: c.ok ? '#dcfce7' : '#fef9c3', color: c.ok ? '#15803d' : '#92400e', fontWeight: 500 }}>
                    {c.ok ? '✓' : '○'} {c.label}
                  </span>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Copiar */}
        <button
          onClick={() => copiar(textoRede, secao)}
          disabled={!textoRede.trim()}
          style={{ marginTop: '0.75rem', padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.9rem', border: 'none', borderRadius: '8px', cursor: textoRede.trim() ? 'pointer' : 'not-allowed', background: textoRede.trim() ? '#1e3f6e' : '#94a3b8', color: '#fff' }}>
          {copiado === secao ? '✓ Copiado!' : `Copiar texto para ${REDES_CONFIG[secao]?.label}`}
        </button>
      </div>
      )}

      {/* Modal picker de imagens — nível raiz, funciona em blog e redes */}
      {pickerAberto && (
        <div onClick={() => setPickerAberto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Imagens — artigos-imagens</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <label style={{ padding: '0.4rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', color: '#1e3f6e', cursor: 'pointer' }}>
                  {uploadando ? 'Enviando…' : '⬆ Upload'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f) }} />
                </label>
                <button onClick={() => setPickerAberto(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
              </div>
            </div>
            <div style={{ padding: '0.5rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span>📐 <strong>Dimensões ideais:</strong></span>
              <span>Hero/destaque: <strong>1200×400px</strong></span>
              <span>Produto: <strong>800×600px</strong></span>
              <span>✅ Upload comprime automaticamente para WebP 82%</span>
            </div>
            <div style={{ overflowY: 'auto', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {imagensBucket.length === 0 && (
                <p style={{ gridColumn: '1/-1', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                  Nenhuma imagem no bucket. Faça upload acima.
                </p>
              )}
              {imagensBucket.map(img => (
                <div key={img.name} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: (pickerTarget === 'blog' ? imagemDestaque : imagemRedes) === img.url ? '3px solid #1e3f6e' : '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                  <img src={img.url} alt={img.name} onClick={() => { if (pickerTarget === 'redes') setImagemRedes(img.url); else setImagemDestaque(img.url); setPickerAberto(false) }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }} />
                  <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                    <a href={img.url} download={img.name} onClick={e => e.stopPropagation()}
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                      title="Download">⬇</a>
                    <button type="button"
                      onClick={e => { e.stopPropagation(); if (confirm(`Excluir "${img.name}"?`)) excluirImagem(img.name) }}
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: '0.8rem', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Excluir">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <AgentConteudo aberto={agentConteudo} onClose={() => setAgentConteudo(false)} />
    </div>
  )
}
