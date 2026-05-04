import { useState } from 'react'
import { FileText, Building2, Target, Ruler, Calendar, Shield, Handshake, Search, Brain, Sparkles, Loader2, XCircle, Paperclip } from 'lucide-react'
import CollapsibleSection from '../../CollapsibleSection/CollapsibleSection'
import { aiChat, aiParallel, aiHubChat, type MultiResult } from '../../../lib/aiHelper'
import LaudoProtegido from '../../LaudoProtegido/LaudoProtegido'
import { supabaseAdmin } from '../../../lib/supabase'

/* ═══════════════════════════════════════════════════════════
   Proposta Comercial — seções extras para modo proposta
   ═══════════════════════════════════════════════════════════ */

export interface LaudoVinculado {
  watermark_id: string
  senha: string
  nome?: string
}

export interface PropostaData {
  apresentacao: string
  problema: string
  escopo: string
  cronograma: string
  garantias: string
  encerramento: string
  revisaoFinal: string
  laudo_link_id?: string
  laudo_senha?: string
  laudos?: LaudoVinculado[]
}

export const PROPOSTA_VAZIA: PropostaData = {
  apresentacao: '',
  problema: '',
  escopo: '',
  cronograma: '',
  garantias: '',
  encerramento: '',
  revisaoFinal: '',
}

interface Props {
  proposta: PropostaData
  setProposta: React.Dispatch<React.SetStateAction<PropostaData>>
  clienteNome: string
  clienteSegmento: string
  itensResumo: string
  styles: Record<string, string>
}

const PARALLEL_TARGETS = [
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'groq', model: 'gemma2-9b-it' },
  { provider: 'groq', model: 'mixtral-8x7b-32768' },
]

/* ═══════════════════════════════════════════════════════════
   PROMPT MESTRE — PROPOSTA COMERCIAL POUSINOX
   ═══════════════════════════════════════════════════════════ */

const SOBRE_POUSINOX = `A Pousinox é fabricante de soluções em aço inox com sede em Pouso Alegre/MG. Atende mais de 19 segmentos com fabricação própria.

SEGMENTOS DE ATUAÇÃO (conforme site pousinox.com.br):
1. Restaurantes e Food Service — bancadas, pias, mesas de preparo, armários para cozinhas profissionais
2. Panificação e Confeitaria — mesas de trabalho, armários, estantes sob medida
3. Hospitalar e Clínicas — carrinhos, mesas, suportes e mobiliário com rigor higiênico
4. Laboratório Farmacêutico — bancadas e armários resistentes a produtos químicos
5. Hotelaria e Catering — equipamentos e mobiliário para hotéis, pousadas e eventos
6. Comércio e Varejo — balcões, expositores para açougues, peixarias, supermercados
7. Arquitetura e Projetos Residenciais — peças únicas e elementos decorativos de alto padrão
8. Construção Civil — fixadores de porcelanato em aço inox, corrimãos, guarda-corpos, estruturas metálicas

DESTAQUE — FIXADORES DE PORCELANATO (fixadorporcelanato.com.br):
- Insert metálico em aço inox 304 (fachadas externas) ou 430 (áreas internas)
- Ancoragem mecânica complementar à argamassa colante, prevenindo desprendimento de placas cerâmicas
- Ensaio técnico SENAI/LAMAT (Relatórios 2193–2196/2026) com rastreabilidade do material
- Sistema completo: fixador + bucha prego + adesivo PU + disco de corte + broca
- Calculadora técnica online para especificação por m²

DIFERENCIAIS:
- Fabricação própria em Pouso Alegre/MG
- Projetos padrão e sob medida
- Materiais: aço inox 304 (resistência à corrosão) e 430 (custo-benefício)
- Atendimento técnico-comercial direto do fabricante`

const CONTEXTO_FIXADOR = `${SOBRE_POUSINOX}

FOCO DESTE ORÇAMENTO: Segmento Construção Civil — fixadores de porcelanato.
O segundo parágrafo da apresentação DEVE destacar os fixadores de porcelanato, ensaio SENAI/LAMAT e o sistema completo de instalação.`

const CONTEXTO_INOX = `${SOBRE_POUSINOX}

FOCO DESTE ORÇAMENTO: Mobiliário e equipamentos em aço inox sob medida.
O segundo parágrafo da apresentação DEVE destacar o segmento específico do cliente, a capacidade de fabricação sob medida e os materiais utilizados. NÃO cite Food Service a menos que o segmento do cliente seja Food Service.`

function detectarContexto(itensResumo: string, segmento?: string): string {
  const lower = ((itensResumo || '') + ' ' + (segmento || '')).toLowerCase()
  if (lower.includes('fixador') || lower.includes('grampo') || lower.includes('bucha prego') || lower.includes('porcelanato') || lower.includes('construç') || lower.includes('fachada') || lower.includes('revestiment') || lower.includes('disco') || lower.includes('broca') || lower.includes('pu ')) {
    return CONTEXTO_FIXADOR
  }
  return CONTEXTO_INOX
}

const REGRA_FOCO = `REGRAS DE FOCO:
- Focar APENAS nos produtos que constam nos itens do orçamento
- NÃO mencionar produtos fora do orçamento
- NÃO mencionar nome do cliente no texto
- NÃO cite projetos, clientes ou obras específicas`

const REGRAS_ANTI_ALUCINACAO = `
REGRAS OBRIGATÓRIAS (ANTI-ALUCINAÇÃO):
- Nunca inventar dados, números, prazos, certificações, clientes ou projetos
- Nunca citar normas técnicas não fornecidas
- Nunca extrapolar capacidades técnicas
- Nunca adicionar itens não presentes no orçamento
- Não alterar ou enriquecer dados do cliente
- Se faltar informação: usar "sob consulta" ou "conforme projeto"
- Saint Michel: sempre como referência de escala, nunca como cliente
- Prazos: sempre incluir "estimativa sujeita à validação técnica"
- NÃO faça perguntas ao cliente na proposta
- NÃO gere sugestões de perguntas ou follow-ups
- Gere APENAS o texto da seção solicitada, nada mais
`

const DIRETRIZES_ESCRITA = `
DIRETRIZES DE ESCRITA:
- Tom profissional B2B industrial
- Linguagem clara, objetiva e técnica
- Evitar marketing exagerado
- Evitar adjetivos vagos (ex: "excelente", "alta qualidade")
- Parágrafos curtos
- Não usar emojis
`

const REVISAO_FINAL_CHECKLIST = `
REVISÃO FINAL (OBRIGATÓRIA ANTES DE RESPONDER):
Verificar:
1. Nenhum dado foi inventado
2. Nenhum item foi adicionado além dos fornecidos
3. Saint Michel não foi tratado como cliente
4. Linguagem consistente e técnica
5. Estrutura completa respeitada
Se houver erro → corrigir antes de entregar.
`

type LoadingKey = 'apresentacao' | 'problema' | 'escopo' | 'cronograma' | 'garantias' | 'encerramento' | 'revisaoFinal'

export default function PropostaSection({ proposta, setProposta, clienteNome, clienteSegmento, itensResumo, styles }: Props) {
  const [loading, setLoading] = useState<Record<LoadingKey, boolean>>({ apresentacao: false, problema: false, escopo: false, cronograma: false, garantias: false, encerramento: false, revisaoFinal: false })
  const [variacoes, setVariacoes] = useState<MultiResult[]>([])
  const [loadingVariacoes, setLoadingVariacoes] = useState(false)
  const [projetosSimilares, setProjetosSimilares] = useState('')

  function setL(key: LoadingKey, v: boolean) { setLoading(prev => ({ ...prev, [key]: v })) }
  function upd(key: keyof PropostaData, val: string) { setProposta(prev => ({ ...prev, [key]: val })) }

  const ctxEmpresa = detectarContexto(itensResumo, clienteSegmento)
  const ctx = `Segmento do cliente: ${clienteSegmento || 'N/I'}\nItens do orçamento: ${itensResumo || 'N/I'}\n\n${ctxEmpresa}\n${REGRA_FOCO}\n${REGRAS_ANTI_ALUCINACAO}\n${DIRETRIZES_ESCRITA}\n${REVISAO_FINAL_CHECKLIST}`

  async function buscarProjetosSimilares() {
    try {
      const seg = (clienteSegmento || '').toLowerCase()
      let query = supabaseAdmin.from('projetos').select('titulo, cliente_nome, segmento, valor, status').eq('status', 'concluido').limit(5)
      if (seg) query = query.ilike('segmento', `%${seg}%`)
      const { data } = await query
      if (data?.length) {
        setProjetosSimilares(data.map((p: any) => `- ${p.titulo} (${p.cliente_nome || 'N/I'}, ${p.segmento || 'N/I'})`).join('\n'))
      }
    } catch { /* sem projetos similares */ }
  }

  const segmentoAtual = clienteSegmento || 'N/I'
  const systemBase = `Você é um redator técnico-comercial B2B. Sua ÚNICA função é gerar o texto da seção solicitada.
FORMATO DE SAÍDA: apenas o texto da seção, sem perguntas, sem sugestões, sem comentários, sem blocos de citação (>), sem markdown headers.
Responda SOMENTE com o conteúdo textual da seção pedida.
SEGMENTO DO CLIENTE DESTE ORÇAMENTO: ${segmentoAtual}. Quando pedir para destacar o segmento do cliente, fale EXCLUSIVAMENTE sobre "${segmentoAtual}". NUNCA fale sobre Food Service a menos que o segmento seja Food Service.
${REGRAS_ANTI_ALUCINACAO}\n${DIRETRIZES_ESCRITA}\n${REVISAO_FINAL_CHECKLIST}`

  async function gerarSingle(key: LoadingKey, prompt: string) {
    setL(key, true)
    try {
      const r = await aiHubChat(
        `${ctx}\n\n${prompt}`,
        { provider: 'openrouter', model: 'anthropic/claude-sonnet-4' },
        systemBase,
      )
      if (!r.error && r.response) {
        // Limpar: remover perguntas/follow-ups que o modelo pode gerar
        const clean = r.response.trim()
          .replace(/^>.*$/gm, '')           // remover blockquotes
          .replace(/^\?.*$/gm, '')           // remover linhas começando com ?
          .replace(/\n{3,}/g, '\n\n')        // normalizar espaços
          .trim()
        upd(key, clean)
      }
    } finally { setL(key, false) }
  }

  async function gerarVariacoes() {
    setLoadingVariacoes(true)
    setVariacoes([])
    const prompt = `${ctx}\n\nSeção: ENTENDIMENTO DA NECESSIDADE + SOLUÇÃO PROPOSTA.\nInferir contexto com base no segmento e itens. Não inventar dores específicas. Relacionar diretamente os itens com a aplicação. Máx 3 parágrafos. Português brasileiro.`
    const res = await aiParallel(prompt, PARALLEL_TARGETS, systemBase)
    setVariacoes(res)
    setLoadingVariacoes(false)
  }

  async function revisarProposta() {
    setL('revisaoFinal', true)
    try {
      const textoCompleto = [
        proposta.apresentacao && `## Apresentação\n${proposta.apresentacao}`,
        proposta.problema && `## Problema e Solução\n${proposta.problema}`,
        proposta.escopo && `## Escopo Técnico\n${proposta.escopo}`,
        proposta.cronograma && `## Cronograma\n${proposta.cronograma}`,
        proposta.garantias && `## Garantias\n${proposta.garantias}`,
        proposta.encerramento && `## Encerramento\n${proposta.encerramento}`,
      ].filter(Boolean).join('\n\n')

      if (!textoCompleto.trim()) { upd('revisaoFinal', 'Preencha ao menos uma seção antes de revisar.'); return }

      const review = await aiHubChat(
        `Proposta comercial para ${clienteNome || 'cliente'}:\n\n${textoCompleto}`,
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        `Revisor de propostas comerciais B2B. Verificar:\n1. Nenhum dado foi inventado\n2. Nenhum item foi adicionado além dos fornecidos\n3. Saint Michel não foi tratado como cliente\n4. Linguagem consistente e técnica\n5. Estrutura completa respeitada\n6. Nota geral (0-10)\nSe houver erro, apontar especificamente. Português brasileiro.\n${REGRAS_ANTI_ALUCINACAO}`,
      )
      upd('revisaoFinal', review.error ? review.error : review.response)
    } finally { setL('revisaoFinal', false) }
  }

  async function gerarTudo() {
    // Busca projetos similares antes de gerar
    await buscarProjetosSimilares()
    // Pipeline: gera todas as seções em sequência
    await gerarSingle('apresentacao',
      'Seção: APRESENTAÇÃO DA EMPRESA.\nApresentar a Pousinox de forma institucional breve, focando APENAS na linha de produtos relevante para os itens do orçamento. NÃO mencione o nome do cliente. NÃO liste todos os segmentos — foque no segmento do cliente. Máx 2 parágrafos curtos. Gere APENAS o texto.')
    await gerarSingle('problema',
      'Seção: ENTENDIMENTO DA NECESSIDADE + SOLUÇÃO PROPOSTA.\nInferir contexto com base no segmento e itens — não inventar dores específicas. Relacionar diretamente os itens com a aplicação. Máx 3 parágrafos.')
    await gerarSingle('escopo',
      'Seção: ESCOPO TÉCNICO DOS ITENS.\nListar todos os itens do orçamento. Para cada item incluir: nome, quantidade, descrição funcional (sem inventar especificações não fornecidas). Formato de lista.')
    await gerarSingle('cronograma',
      'Seção: CRONOGRAMA ESTIMADO.\nDescrever etapas: validação técnica, produção, entrega/instalação. Sempre incluir aviso de "estimativa sujeita à validação técnica".')
    await gerarSingle('garantias',
      'Seção: GARANTIAS E CONDIÇÕES.\nGarantia contra defeitos de fabricação. Condições gerais de uso e instalação. Linguagem conservadora, sem promessas absolutas.')
    await gerarSingle('encerramento',
      'Seção: ENCERRAMENTO COMERCIAL.\nReforçar disponibilidade para ajustes. Incentivar continuidade da negociação. Máx 2 parágrafos.')
    // Revisor final
    await revisarProposta()
  }

  return (
    <>
      {/* Botão gerar tudo */}
      <div style={{ background: 'linear-gradient(135deg, #ede9fe, #dbeafe)', border: '1px solid #c4b5fd', borderRadius: 10, padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <strong style={{ color: '#4c1d95' }}><FileText size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Modo Proposta Comercial</strong>
          <div style={{ fontSize: '0.78rem', color: '#6b21a8', marginTop: 2 }}>Preencha ou gere com IA as seções abaixo</div>
        </div>
        <button
          onClick={gerarTudo}
          disabled={Object.values(loading).some(v => v)}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
        >
          {Object.values(loading).some(v => v) ? <><Loader2 size={14} className="spin" /> Gerando proposta...</> : <><Brain size={14} /> Gerar proposta completa com IA</>}
        </button>
      </div>

      {/* Apresentação */}
      <CollapsibleSection title={<><Building2 size={16} /> Apresentação da Empresa</>} count={proposta.apresentacao ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} onClick={() => {
            const segMap: Record<string, string> = {
              'Construção Civil': 'No segmento de Construção Civil, a Pousinox desenvolve fixadores de segurança para porcelanato em aço inox — sistema de ancoragem mecânica complementar à argamassa colante, projetado para prevenir o desprendimento de placas cerâmicas em fachadas e paredes. Os fixadores são fabricados em aço inox 304 (aplicações externas) e 430 (áreas internas), com material validado em ensaio técnico SENAI/LAMAT. A empresa oferece atendimento técnico-comercial direto do fabricante, com calculadora online para especificação de materiais por m².',
              'Restaurantes e Food Service': 'No segmento de Restaurantes e Food Service, a Pousinox desenvolve equipamentos e mobiliário em aço inox para cozinhas profissionais — bancadas, pias, mesas de preparo, coifas, estantes e estruturas sob medida. Todos os produtos são fabricados em aço inox 304, com projetos adaptados às especificações de cada operação.',
              'Hospitalar e Clínicas': 'No segmento Hospitalar, a Pousinox desenvolve mobiliário em aço inox com rigor higiênico — carrinhos, mesas, suportes e estruturas sob medida para ambientes de saúde. Produtos fabricados em aço inox 304, atendendo aos requisitos de higienização e durabilidade do setor.',
              'Hotelaria e Catering': 'No segmento de Hotelaria e Catering, a Pousinox desenvolve equipamentos e mobiliário em aço inox para hotéis, pousadas e serviços de eventos — projetos padrão e sob medida, fabricados em aço inox 304 com atendimento direto do fabricante.',
            }
            const segmentos = ['Construção Civil', 'Restaurantes e Food Service', 'Hospitalar e Clínicas', 'Hotelaria e Catering', 'Panificação e Confeitaria', 'Laboratório Farmacêutico', 'Comércio e Varejo', 'Arquitetura e Projetos Residenciais']
            // Colocar o segmento do cliente em primeiro na lista
            const ordered = [segmentoAtual, ...segmentos.filter(s => s !== segmentoAtual)].filter(Boolean)
            const p1 = `A Pousinox é fabricante de soluções em aço inox, com sede e fabricação própria em Pouso Alegre/MG. A empresa atende diversos segmentos de mercado, incluindo ${ordered.slice(0, 5).join(', ')}, entre outros.`
            const p2 = segMap[segmentoAtual] || segMap['Construção Civil']
            upd('apresentacao', `${p1}\n\n${p2}`)
          }} style={{ fontSize: '0.75rem' }}>
            <FileText size={14} /> Usar template
          </button>
          <button className={styles.btnAddItem} disabled={loading.apresentacao} onClick={() => gerarSingle('apresentacao',
            `Seção: APRESENTAÇÃO DA EMPRESA.
SEGMENTO DO CLIENTE NESTE ORÇAMENTO: ${clienteSegmento || 'N/I'}
Estrutura obrigatória em 2 parágrafos:
1º parágrafo: Apresentar a Pousinox como fabricante de soluções em aço inox com fabricação própria em Pouso Alegre/MG, citando os principais segmentos de atuação. NÃO detalhar produtos — apenas os nomes dos segmentos.
2º parágrafo: OBRIGATÓRIO falar sobre o segmento "${clienteSegmento || 'do cliente'}". Destacar a experiência da Pousinox NESTE segmento específico e os diferenciais relevantes. NÃO falar de outro segmento no 2º parágrafo.
NÃO mencione fixadores na apresentação. NÃO mencione o nome do cliente. Máx 2 parágrafos curtos. Gere APENAS o texto.`)}>
            {loading.apresentacao ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={5} placeholder="Apresentação da empresa para o cliente..."
          value={proposta.apresentacao} onChange={e => upd('apresentacao', e.target.value)} />
      </CollapsibleSection>

      {/* Problema/Solução — com 3 variações */}
      <CollapsibleSection title={<><Target size={16} /> Problema e Solução</>} count={proposta.problema ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button className={styles.btnAddItem} disabled={loading.problema} onClick={() => gerarSingle('problema',
            'Seção: ENTENDIMENTO DA NECESSIDADE + SOLUÇÃO PROPOSTA.\nInferir contexto com base no segmento e itens — não inventar dores específicas. Relacionar diretamente os itens com a aplicação. Máx 3 parágrafos.')}>
            {loading.problema ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Gerar com IA
          </button>
          <button className={styles.btnAddItem} disabled={loadingVariacoes} onClick={gerarVariacoes}
            style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#c4b5fd' }}>
            {loadingVariacoes ? <><Loader2 size={14} className="spin" /> Gerando...</> : <><Brain size={14} /> 3 variações</>}
          </button>
        </div>
        {variacoes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {variacoes.map((v, i) => (
              <div key={i} style={{ background: v.error ? '#fef2f2' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 11, color: '#6366f1' }}>{v.model} {v.tempo ? `(${(v.tempo / 1000).toFixed(1)}s)` : ''}</span>
                  {!v.error && <button onClick={() => upd('problema', v.response)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Usar esta</button>}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{v.error ? <><XCircle size={14} style={{ verticalAlign: 'middle' }} /> {v.error}</> : v.response}</div>
              </div>
            ))}
          </div>
        )}
        <textarea className={`${styles.input} ${styles.textarea}`} rows={6} placeholder="Descreva o problema do cliente e como sua solução resolve..."
          value={proposta.problema} onChange={e => upd('problema', e.target.value)} />
      </CollapsibleSection>

      {/* Escopo Técnico */}
      <CollapsibleSection title={<><Ruler size={16} /> Escopo Técnico</>} count={proposta.escopo ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.escopo} onClick={() => gerarSingle('escopo',
            'Seção: ESCOPO TÉCNICO DOS ITENS.\nListar todos os itens do orçamento. Para cada item incluir: nome, quantidade, descrição funcional (sem inventar especificações não fornecidas). Formato de lista.')}>
            {loading.escopo ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={6} placeholder="Especificações técnicas, materiais, acabamentos..."
          value={proposta.escopo} onChange={e => upd('escopo', e.target.value)} />
      </CollapsibleSection>

      {/* Cronograma */}
      <CollapsibleSection title={<><Calendar size={16} /> Cronograma</>} count={proposta.cronograma ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.cronograma} onClick={() => gerarSingle('cronograma',
            'Seção: CRONOGRAMA ESTIMADO.\nDescrever etapas: validação técnica, produção, entrega/instalação. Sempre incluir aviso de "estimativa sujeita à validação técnica".')}>
            {loading.cronograma ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={5} placeholder="Etapas e prazos estimados..."
          value={proposta.cronograma} onChange={e => upd('cronograma', e.target.value)} />
      </CollapsibleSection>

      {/* Garantias */}
      <CollapsibleSection title={<><Shield size={16} /> Garantias</>} count={proposta.garantias ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.garantias} onClick={() => gerarSingle('garantias',
            'Seção: GARANTIAS E CONDIÇÕES.\nGarantia contra defeitos de fabricação. Condições gerais de uso e instalação. Linguagem conservadora, sem promessas absolutas.')}>
            {loading.garantias ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={5} placeholder="Termos de garantia e assistência técnica..."
          value={proposta.garantias} onChange={e => upd('garantias', e.target.value)} />
      </CollapsibleSection>

      {/* Encerramento Comercial */}
      <CollapsibleSection title={<><Handshake size={16} /> Encerramento Comercial</>} count={proposta.encerramento ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.encerramento} onClick={() => gerarSingle('encerramento',
            'Seção: ENCERRAMENTO COMERCIAL.\nReforçar disponibilidade para ajustes. Incentivar continuidade da negociação. Máx 2 parágrafos.')}>
            {loading.encerramento ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={4} placeholder="Texto de encerramento e próximos passos..."
          value={proposta.encerramento} onChange={e => upd('encerramento', e.target.value)} />
      </CollapsibleSection>

      {/* Revisão Final IA */}
      <CollapsibleSection title={<><Search size={16} /> Revisão Final IA</>} count={proposta.revisaoFinal ? 1 : 0}>
        <button className={styles.btnAddItem} disabled={loading.revisaoFinal} onClick={revisarProposta}
          style={{ marginBottom: 8, background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>
          {loading.revisaoFinal ? <><Loader2 size={14} className="spin" /> Revisando...</> : <><Search size={14} /> Revisar proposta completa</>}
        </button>
        {proposta.revisaoFinal && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, fontSize: '0.84rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {proposta.revisaoFinal}
          </div>
        )}
      </CollapsibleSection>

      {/* Laudos Protegidos */}
      <CollapsibleSection title={<><Paperclip size={16} /> Laudos Técnicos Protegidos</>} count={(proposta.laudos?.length || 0) + (proposta.laudo_link_id ? 1 : 0)}>
        {/* Laudos já vinculados */}
        {(proposta.laudos || []).map((laudo, idx) => (
          <div key={laudo.watermark_id} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div>
              <strong>Laudo {idx + 1}{laudo.nome ? ` — ${laudo.nome}` : ''}</strong>
              <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: 2 }}>ID: {laudo.watermark_id.slice(0, 8)}... · Senha salva</div>
            </div>
            <button onClick={() => {
              setProposta(prev => ({ ...prev, laudos: (prev.laudos || []).filter((_, i) => i !== idx) }))
            }} style={{ background: 'none', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', color: '#dc2626' }}>
              Desvincular
            </button>
          </div>
        ))}

        {/* Compat: laudo_link_id legado */}
        {proposta.laudo_link_id && !(proposta.laudos || []).some(l => l.watermark_id === proposta.laudo_link_id) && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div>
              <strong>Laudo vinculado</strong>
              <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: 2 }}>ID: {proposta.laudo_link_id.slice(0, 8)}... · Senha salva</div>
            </div>
            <button onClick={() => { upd('laudo_link_id', ''); upd('laudo_senha', '') }} style={{ background: 'none', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', color: '#dc2626' }}>
              Desvincular
            </button>
          </div>
        )}

        {/* Adicionar novo laudo */}
        <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: 10, lineHeight: 1.5 }}>
          Anexe laudos de ensaio técnico com marca d'água rastreável e acesso protegido por senha.
          Cada laudo gera um link + senha separados. Você pode anexar múltiplos laudos.
        </p>
        <LaudoProtegido
          empresa={clienteNome}
          usuario=""
          multi
          onGerado={(result) => {
            setProposta(prev => ({
              ...prev,
              laudos: [...(prev.laudos || []), { watermark_id: result.watermark_id, senha: result.senha }],
            }))
          }}
        />
      </CollapsibleSection>
    </>
  )
}
