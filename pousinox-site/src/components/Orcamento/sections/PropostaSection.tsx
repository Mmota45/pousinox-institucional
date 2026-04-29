import { useState } from 'react'
import CollapsibleSection from '../../CollapsibleSection/CollapsibleSection'
import { aiChat, aiParallel, aiHubChat, type MultiResult } from '../../../lib/aiHelper'
import LaudoProtegido from '../../LaudoProtegido/LaudoProtegido'
import { supabaseAdmin } from '../../../lib/supabase'

/* ═══════════════════════════════════════════════════════════
   Proposta Comercial — seções extras para modo proposta
   ═══════════════════════════════════════════════════════════ */

export interface PropostaData {
  apresentacao: string
  problema: string
  escopo: string
  cronograma: string
  garantias: string
  encerramento: string
  revisaoFinal: string
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

const CONTEXTO_POUSINOX = `A Pousinox é fabricante de equipamentos e mobiliário em aço inox — padrão e sob medida — com sede em Pouso Alegre/MG.

LINHAS DE PRODUTO:
- Equipamentos para cozinhas industriais (bancadas, fogões, coifas, mesas, tanques, cubas)
- Mobiliário em aço inox sob medida
- Corrimãos e guarda-corpos
- Soluções personalizadas para diversos segmentos
- Fixador de segurança para porcelanato (insert metálico em aço inox que impede desprendimento de placas cerâmicas — NÃO substitui argamassa, é dispositivo complementar de segurança)

SEGMENTOS ATENDIDOS:
Construção civil, food service, hospitalar, hotelaria, supermercados, açougues, restaurantes, laboratórios, entre outros.

REGRA DE FOCO NA PROPOSTA:
A proposta deve focar APENAS nos produtos que constam nos itens do orçamento.
Os itens do orçamento são a fonte de verdade — eles definem o produto e o contexto.
- Identificar o lead pelo PRODUTO cotado, não pelo segmento genérico
- Ex: itens com "fixador" → proposta focada em segurança de fachadas cerâmicas
- Ex: itens com "bancada" ou "coifa" → proposta focada em cozinha industrial
- NÃO mencionar produtos que não estejam nos itens do orçamento
- NÃO misturar linhas de produto (fixador + cozinha) a menos que os itens cubram ambos

Referência de escala para construção civil (NÃO é cliente Pousinox):
Edifício Saint Michel (Aracaju/SE) — 2 torres, 14 andares, ~25.000 fixadores.
Projeto em disputa comercial com concorrente CFX RAI-FIX.
Usar APENAS como referência de porte/volume. NUNCA afirmar como cliente ou projeto realizado.`

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

  const ctx = `Cliente: ${clienteNome || 'N/I'}\nSegmento: ${clienteSegmento || 'N/I'}\nItens do orçamento: ${itensResumo || 'N/I'}${projetosSimilares ? `\n\nProjetos similares (mesmo segmento, concluídos):\n${projetosSimilares}` : ''}\n\n${CONTEXTO_POUSINOX}\n${REGRAS_ANTI_ALUCINACAO}\n${DIRETRIZES_ESCRITA}\n${REVISAO_FINAL_CHECKLIST}`

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

  const systemBase = `Gerador de proposta comercial técnica da Pousinox. Gere conteúdo com base EXCLUSIVA nos dados fornecidos.\n${REGRAS_ANTI_ALUCINACAO}\n${DIRETRIZES_ESCRITA}\n${REVISAO_FINAL_CHECKLIST}`

  async function gerarSingle(key: LoadingKey, prompt: string) {
    setL(key, true)
    try {
      const r = await aiChat({ prompt: `${ctx}\n\n${prompt}`, system: systemBase, model: 'groq' })
      if (!r.error && r.content) upd(key, r.content.trim())
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

      if (!textoCompleto.trim()) { upd('revisaoFinal', '⚠️ Preencha ao menos uma seção antes de revisar.'); return }

      const review = await aiHubChat(
        `Proposta comercial para ${clienteNome || 'cliente'}:\n\n${textoCompleto}`,
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        `Revisor de propostas comerciais B2B. Verificar:\n1. Nenhum dado foi inventado\n2. Nenhum item foi adicionado além dos fornecidos\n3. Saint Michel não foi tratado como cliente\n4. Linguagem consistente e técnica\n5. Estrutura completa respeitada\n6. Nota geral (0-10)\nSe houver erro, apontar especificamente. Português brasileiro.\n${REGRAS_ANTI_ALUCINACAO}`,
      )
      upd('revisaoFinal', review.error ? `❌ ${review.error}` : review.response)
    } finally { setL('revisaoFinal', false) }
  }

  async function gerarTudo() {
    // Busca projetos similares antes de gerar
    await buscarProjetosSimilares()
    // Pipeline: gera todas as seções em sequência
    await gerarSingle('apresentacao',
      'Seção: APRESENTAÇÃO DA EMPRESA.\nApresentar a Pousinox de forma institucional. Conectar com o segmento do cliente. Máx 2 parágrafos.')
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
          <strong style={{ color: '#4c1d95' }}>📄 Modo Proposta Comercial</strong>
          <div style={{ fontSize: '0.78rem', color: '#6b21a8', marginTop: 2 }}>Preencha ou gere com IA as seções abaixo</div>
        </div>
        <button
          onClick={gerarTudo}
          disabled={Object.values(loading).some(v => v)}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
        >
          {Object.values(loading).some(v => v) ? '⏳ Gerando proposta...' : '🧠 Gerar proposta completa com IA'}
        </button>
      </div>

      {/* Apresentação */}
      <CollapsibleSection title="🏭 Apresentação da Empresa" count={proposta.apresentacao ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.apresentacao} onClick={() => gerarSingle('apresentacao',
            'Seção: APRESENTAÇÃO DA EMPRESA.\nApresentar a Pousinox de forma institucional. Conectar com o segmento do cliente. Máx 2 parágrafos.')}>
            {loading.apresentacao ? '⏳' : '✨'} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={5} placeholder="Apresentação da empresa para o cliente..."
          value={proposta.apresentacao} onChange={e => upd('apresentacao', e.target.value)} />
      </CollapsibleSection>

      {/* Problema/Solução — com 3 variações */}
      <CollapsibleSection title="🎯 Problema e Solução" count={proposta.problema ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button className={styles.btnAddItem} disabled={loading.problema} onClick={() => gerarSingle('problema',
            'Seção: ENTENDIMENTO DA NECESSIDADE + SOLUÇÃO PROPOSTA.\nInferir contexto com base no segmento e itens — não inventar dores específicas. Relacionar diretamente os itens com a aplicação. Máx 3 parágrafos.')}>
            {loading.problema ? '⏳' : '✨'} Gerar com IA
          </button>
          <button className={styles.btnAddItem} disabled={loadingVariacoes} onClick={gerarVariacoes}
            style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#c4b5fd' }}>
            {loadingVariacoes ? '⏳ Gerando...' : '🧠 3 variações'}
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
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{v.error ? `❌ ${v.error}` : v.response}</div>
              </div>
            ))}
          </div>
        )}
        <textarea className={`${styles.input} ${styles.textarea}`} rows={6} placeholder="Descreva o problema do cliente e como sua solução resolve..."
          value={proposta.problema} onChange={e => upd('problema', e.target.value)} />
      </CollapsibleSection>

      {/* Escopo Técnico */}
      <CollapsibleSection title="📐 Escopo Técnico" count={proposta.escopo ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.escopo} onClick={() => gerarSingle('escopo',
            'Seção: ESCOPO TÉCNICO DOS ITENS.\nListar todos os itens do orçamento. Para cada item incluir: nome, quantidade, descrição funcional (sem inventar especificações não fornecidas). Formato de lista.')}>
            {loading.escopo ? '⏳' : '✨'} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={6} placeholder="Especificações técnicas, materiais, acabamentos..."
          value={proposta.escopo} onChange={e => upd('escopo', e.target.value)} />
      </CollapsibleSection>

      {/* Cronograma */}
      <CollapsibleSection title="📅 Cronograma" count={proposta.cronograma ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.cronograma} onClick={() => gerarSingle('cronograma',
            'Seção: CRONOGRAMA ESTIMADO.\nDescrever etapas: validação técnica, produção, entrega/instalação. Sempre incluir aviso de "estimativa sujeita à validação técnica".')}>
            {loading.cronograma ? '⏳' : '✨'} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={5} placeholder="Etapas e prazos estimados..."
          value={proposta.cronograma} onChange={e => upd('cronograma', e.target.value)} />
      </CollapsibleSection>

      {/* Garantias */}
      <CollapsibleSection title="🛡️ Garantias" count={proposta.garantias ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.garantias} onClick={() => gerarSingle('garantias',
            'Seção: GARANTIAS E CONDIÇÕES.\nGarantia contra defeitos de fabricação. Condições gerais de uso e instalação. Linguagem conservadora, sem promessas absolutas.')}>
            {loading.garantias ? '⏳' : '✨'} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={5} placeholder="Termos de garantia e assistência técnica..."
          value={proposta.garantias} onChange={e => upd('garantias', e.target.value)} />
      </CollapsibleSection>

      {/* Encerramento Comercial */}
      <CollapsibleSection title="🤝 Encerramento Comercial" count={proposta.encerramento ? 1 : 0}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button className={styles.btnAddItem} disabled={loading.encerramento} onClick={() => gerarSingle('encerramento',
            'Seção: ENCERRAMENTO COMERCIAL.\nReforçar disponibilidade para ajustes. Incentivar continuidade da negociação. Máx 2 parágrafos.')}>
            {loading.encerramento ? '⏳' : '✨'} Gerar com IA
          </button>
        </div>
        <textarea className={`${styles.input} ${styles.textarea}`} rows={4} placeholder="Texto de encerramento e próximos passos..."
          value={proposta.encerramento} onChange={e => upd('encerramento', e.target.value)} />
      </CollapsibleSection>

      {/* Revisão Final IA */}
      <CollapsibleSection title="🔍 Revisão Final IA" count={proposta.revisaoFinal ? 1 : 0}>
        <button className={styles.btnAddItem} disabled={loading.revisaoFinal} onClick={revisarProposta}
          style={{ marginBottom: 8, background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>
          {loading.revisaoFinal ? '⏳ Revisando...' : '🔍 Revisar proposta completa'}
        </button>
        {proposta.revisaoFinal && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, fontSize: '0.84rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {proposta.revisaoFinal}
          </div>
        )}
      </CollapsibleSection>

      {/* Laudo Protegido */}
      <CollapsibleSection title="📎 Laudo Técnico Protegido" count={0}>
        <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: 10, lineHeight: 1.5 }}>
          Anexe o laudo de ensaio técnico com marca d'água rastreável e acesso protegido por senha.
          O destinatário receberá um link + senha (compartilhados separadamente).
        </p>
        <LaudoProtegido
          empresa={clienteNome}
          usuario=""
        />
      </CollapsibleSection>
    </>
  )
}
