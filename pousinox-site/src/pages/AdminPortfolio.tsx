import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { aiHubChat } from '../lib/aiHelper'
import styles from './AdminPortfolio.module.css'

interface Produto {
  id: number; nome: string; descricao: string | null; categoria: string; ativo: boolean
}
interface Mapeamento {
  id: number; segmento: string; produto_id: number; relevancia: number; destaque: boolean
  portfolio_produtos: Produto | null
}
interface Norma {
  id: number; norma: string; orgao: string; titulo: string | null; status: string
  substituida_por: string | null; segmentos: string[]; penalidade: string | null; observacao: string | null
}
interface Exigencia {
  id: number; norma_id: number; artigo: string | null; texto_resumido: string; produto_id: number | null
  portfolio_produtos: { nome: string } | null
}
interface Equipamento {
  id: number; segmento: string; equipamento: string; obrigatorio: boolean; norma_ref: string | null; material: string; observacao: string | null
}

type Aba = 'produtos' | 'segmentos' | 'normas' | 'equipamentos'
type Vista = 'lista' | 'form'

export default function AdminPortfolio() {
  const [aba, setAba] = useState<Aba>('produtos')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // ── Produtos ──
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [prodVista, setProdVista] = useState<Vista>('lista')
  const [prodEdit, setProdEdit] = useState<Partial<Produto>>({})
  const [prodBusca, setProdBusca] = useState('')

  // ── Segmentos ──
  const [mapeamentos, setMapeamentos] = useState<Mapeamento[]>([])
  const [segFiltro, setSegFiltro] = useState('')
  const [segmentos, setSegmentos] = useState<string[]>([])
  const [segAddOpen, setSegAddOpen] = useState(false)
  const [segAddSegmento, setSegAddSegmento] = useState('')
  const [segAddProduto, setSegAddProduto] = useState<number | null>(null)

  // ── Normas ──
  const [normas, setNormas] = useState<Norma[]>([])
  const [normaExpandida, setNormaExpandida] = useState<number | null>(null)
  const [normaExigencias, setNormaExigencias] = useState<Record<number, Exigencia[]>>({})
  const [normaBusca, setNormaBusca] = useState('')
  const [normaFiltroOrgao, setNormaFiltroOrgao] = useState('')
  const [normaFiltroStatus, setNormaFiltroStatus] = useState('')

  // ── Produtos UX ──
  const [catAberta, setCatAberta] = useState<Record<string, boolean>>({})
  const [descExpandida, setDescExpandida] = useState<number | null>(null)

  // ── Equipamentos ──
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [equipFiltro, setEquipFiltro] = useState('')
  const [equipSegmentos, setEquipSegmentos] = useState<string[]>([])
  const [equipEdit, setEquipEdit] = useState<Partial<Equipamento> & { _new?: boolean }>({})
  const [equipNormaPopover, setEquipNormaPopover] = useState<number | null>(null)
  const [equipFiltroTipo, setEquipFiltroTipo] = useState<string>('')
  const [equipFiltroMaterial, setEquipFiltroMaterial] = useState<string>('')
  const [equipFiltroEquip, setEquipFiltroEquip] = useState('')
  const [equipSecaoAberta, setEquipSecaoAberta] = useState<Record<string, boolean>>({})

  // ── IA ──
  const [iaLoading, setIaLoading] = useState<string | null>(null) // 'desc'|'sugestao'|'resumo'
  const [iaResultado, setIaResultado] = useState<{ tipo: string; texto: string } | null>(null)
  const [iaDescProdId, setIaDescProdId] = useState<number | null>(null)

  const showMsg = (tipo: 'ok' | 'erro', texto: string) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  // ── Loaders ──
  const carregarProdutos = useCallback(async () => {
    const { data } = await supabaseAdmin.from('portfolio_produtos').select('*').order('nome')
    setProdutos(data ?? [])
  }, [])

  const carregarMapeamentos = useCallback(async () => {
    const q = supabaseAdmin.from('segmento_portfolio')
      .select('id, segmento, produto_id, relevancia, destaque, portfolio_produtos(id, nome, descricao, categoria, ativo)')
      .order('segmento')
    if (segFiltro) q.eq('segmento', segFiltro)
    const { data } = await q
    setMapeamentos((data as any) ?? [])
    // Extrair segmentos únicos
    const { data: allSegs } = await supabaseAdmin.from('segmento_portfolio').select('segmento')
    const uniq = [...new Set((allSegs ?? []).map((s: any) => s.segmento))].sort()
    setSegmentos(uniq as string[])
  }, [segFiltro])

  const carregarNormas = useCallback(async () => {
    const { data } = await supabaseAdmin.from('portfolio_normas').select('*').order('norma')
    setNormas(data ?? [])
  }, [])

  const carregarEquipamentos = useCallback(async () => {
    const q = supabaseAdmin.from('segmento_equipamentos').select('*').order('segmento').order('obrigatorio', { ascending: false })
    if (equipFiltro) q.eq('segmento', equipFiltro)
    const { data } = await q
    setEquipamentos((data as any) ?? [])
    const { data: allSegs } = await supabaseAdmin.from('segmento_equipamentos').select('segmento')
    const uniq = [...new Set((allSegs ?? []).map((s: any) => s.segmento))].sort()
    setEquipSegmentos(uniq as string[])
  }, [equipFiltro])

  // Carregar counts iniciais de todas as abas
  useEffect(() => {
    carregarProdutos()
    carregarMapeamentos()
    carregarNormas()
    carregarEquipamentos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (aba === 'produtos') carregarProdutos()
    if (aba === 'segmentos') { carregarProdutos(); carregarMapeamentos() }
    if (aba === 'normas') carregarNormas()
    if (aba === 'equipamentos') { carregarEquipamentos(); carregarNormas() }
  }, [aba, carregarProdutos, carregarMapeamentos, carregarNormas, carregarEquipamentos])

  // ── Produto CRUD ──
  async function salvarProduto() {
    if (!prodEdit.nome?.trim()) { showMsg('erro', 'Nome obrigatório'); return }
    if (prodEdit.id) {
      await supabaseAdmin.from('portfolio_produtos').update({
        nome: prodEdit.nome, descricao: prodEdit.descricao || null, categoria: prodEdit.categoria || 'fabricacao', ativo: prodEdit.ativo ?? true
      }).eq('id', prodEdit.id)
      showMsg('ok', 'Produto atualizado')
    } else {
      await supabaseAdmin.from('portfolio_produtos').insert({
        nome: prodEdit.nome, descricao: prodEdit.descricao || null, categoria: prodEdit.categoria || 'fabricacao'
      })
      showMsg('ok', 'Produto criado')
    }
    setProdVista('lista')
    setProdEdit({})
    carregarProdutos()
  }

  async function excluirProduto(id: number) {
    if (!confirm('Excluir produto? Será removido de todos os segmentos.')) return
    await supabaseAdmin.from('portfolio_produtos').delete().eq('id', id)
    showMsg('ok', 'Produto excluído')
    carregarProdutos()
  }

  // ── Mapeamento CRUD ──
  async function adicionarMapeamento() {
    if (!segAddSegmento || !segAddProduto) { showMsg('erro', 'Selecione segmento e produto'); return }
    const { error } = await supabaseAdmin.from('segmento_portfolio').insert({
      segmento: segAddSegmento, produto_id: segAddProduto, relevancia: 5
    })
    if (error) { showMsg('erro', error.message.includes('unique') ? 'Já vinculado' : error.message); return }
    showMsg('ok', 'Vinculado')
    setSegAddOpen(false)
    carregarMapeamentos()
  }

  async function removerMapeamento(id: number) {
    await supabaseAdmin.from('segmento_portfolio').delete().eq('id', id)
    showMsg('ok', 'Removido')
    carregarMapeamentos()
  }

  async function toggleDestaque(m: Mapeamento) {
    await supabaseAdmin.from('segmento_portfolio').update({ destaque: !m.destaque }).eq('id', m.id)
    carregarMapeamentos()
  }

  // ── Equipamento CRUD ──
  async function salvarEquipamento() {
    if (!equipEdit.segmento?.trim() || !equipEdit.equipamento?.trim()) { showMsg('erro', 'Segmento e equipamento obrigatórios'); return }
    const payload = {
      segmento: equipEdit.segmento, equipamento: equipEdit.equipamento,
      obrigatorio: equipEdit.obrigatorio ?? false, norma_ref: equipEdit.norma_ref || null,
      material: equipEdit.material || '304', observacao: equipEdit.observacao || null,
    }
    if (equipEdit.id && !equipEdit._new) {
      await supabaseAdmin.from('segmento_equipamentos').update(payload).eq('id', equipEdit.id)
      showMsg('ok', 'Atualizado')
    } else {
      const { error } = await supabaseAdmin.from('segmento_equipamentos').insert(payload)
      if (error) { showMsg('erro', error.message.includes('unique') ? 'Já existe' : error.message); return }
      showMsg('ok', 'Criado')
    }
    setEquipEdit({})
    carregarEquipamentos()
  }

  async function excluirEquipamento(id: number) {
    if (!confirm('Excluir equipamento?')) return
    await supabaseAdmin.from('segmento_equipamentos').delete().eq('id', id)
    showMsg('ok', 'Excluído')
    carregarEquipamentos()
  }

  // ── IA: Gerar Descrição ──
  async function iaGerarDescricao(prod: Produto) {
    setIaLoading('desc')
    setIaDescProdId(prod.id)
    setIaResultado(null)
    // Buscar segmentos onde o produto é usado
    const { data: segs } = await supabaseAdmin.from('segmento_portfolio').select('segmento').eq('produto_id', prod.id)
    const segmentosList = (segs ?? []).map((s: any) => s.segmento).join(', ') || 'diversos segmentos'

    const prompt = `Gere uma descrição comercial curta (2-3 frases, máximo 200 caracteres) para o produto de aço inox "${prod.nome}" da Pousinox.
Segmentos de uso: ${segmentosList}.
Categoria: ${prod.categoria}.
A descrição deve destacar: material (aço inox AISI 304/316), durabilidade, conformidade sanitária, e aplicação prática.
Responda APENAS com a descrição, sem aspas nem prefixo.`

    const result = await aiHubChat(prompt, { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      'Você é redator técnico-comercial da Pousinox, fabricante de equipamentos em aço inox. Seja direto e profissional.')
    setIaLoading(null)
    if (result.error) { showMsg('erro', `Erro IA: ${result.error}`); return }
    setIaResultado({ tipo: 'desc', texto: result.response.trim() })
  }

  async function iaAplicarDescricao(prodId: number, descricao: string) {
    await supabaseAdmin.from('portfolio_produtos').update({ descricao }).eq('id', prodId)
    showMsg('ok', 'Descrição atualizada!')
    setIaResultado(null)
    setIaDescProdId(null)
    carregarProdutos()
  }

  // ── IA: Sugerir Produtos para Segmento ──
  async function iaSugerirProdutos(segmento: string) {
    setIaLoading('sugestao')
    setIaResultado(null)
    // Buscar equipamentos e produtos já vinculados
    const { data: equips } = await supabaseAdmin.from('segmento_equipamentos').select('equipamento, obrigatorio, material').eq('segmento', segmento)
    const { data: maps } = await supabaseAdmin.from('segmento_portfolio').select('portfolio_produtos(nome)').eq('segmento', segmento)
    const prodsVinculados = (maps ?? []).map((m: any) => m.portfolio_produtos?.nome).filter(Boolean)
    const todosProds = produtos.map(p => p.nome)

    const prompt = `Analise o segmento "${segmento}" e sugira melhorias no portfólio da Pousinox.

EQUIPAMENTOS OBRIGATÓRIOS/RECOMENDADOS para este segmento:
${(equips ?? []).map((e: any) => `- ${e.equipamento} (${e.obrigatorio ? 'OBRIGATÓRIO' : 'recomendado'}, Inox ${e.material})`).join('\n') || 'Nenhum cadastrado'}

PRODUTOS JÁ VINCULADOS ao segmento:
${prodsVinculados.join(', ') || 'Nenhum'}

CATÁLOGO COMPLETO Pousinox (todos os produtos disponíveis):
${todosProds.join(', ')}

Responda em formato:
1. **GAPS**: Equipamentos obrigatórios que NÃO têm produto correspondente vinculado
2. **SUGESTÕES**: Produtos do catálogo que deveriam ser vinculados a este segmento mas não estão
3. **NOVOS**: Produtos que a Pousinox deveria fabricar para atender este segmento (não existem no catálogo)

Seja direto, use bullets. Máximo 300 palavras.`

    const result = await aiHubChat(prompt, { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      'Você é consultor comercial especialista em equipamentos de aço inox para indústria. Analise gaps no portfólio e sugira ações concretas.')
    setIaLoading(null)
    if (result.error) { showMsg('erro', `Erro IA: ${result.error}`); return }
    setIaResultado({ tipo: 'sugestao', texto: result.response.trim() })
  }

  // ── IA: Resumo Executivo Regulatório ──
  async function iaResumoRegulatorio() {
    setIaLoading('resumo')
    setIaResultado(null)
    const normasTexto = normas.map(n =>
      `${n.norma} (${n.orgao}) — ${n.titulo || ''} | Penalidade: ${n.penalidade || 'N/A'} | Segmentos: ${(n.segmentos || []).join(', ')}`
    ).join('\n')

    const prompt = `Com base nestas normas regulatórias que exigem aço inox, gere um RESUMO EXECUTIVO para o vendedor da Pousinox:

${normasTexto}

O resumo deve:
1. **Argumento principal** (1 frase impactante para abrir conversa com cliente)
2. **Por segmento** — para cada segmento relevante, listar: norma mais severa + penalidade + frase de venda
3. **Dados de impacto** — valores de multas, riscos de interdição
4. **Frase de fechamento** — CTA para o vendedor usar

Formato: texto corrido com negrito, pronto para copiar e colar. Máximo 400 palavras. Em português.`

    const result = await aiHubChat(prompt, { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      'Você é especialista em vendas B2B de equipamentos em aço inox. Crie argumentos de venda baseados em compliance regulatório. Nunca invente normas ou valores — use apenas os dados fornecidos.')
    setIaLoading(null)
    if (result.error) { showMsg('erro', `Erro IA: ${result.error}`); return }
    setIaResultado({ tipo: 'resumo', texto: result.response.trim() })
  }

  // ── Norma expand ──
  async function expandirNorma(id: number) {
    if (normaExpandida === id) { setNormaExpandida(null); return }
    setNormaExpandida(id)
    if (!normaExigencias[id]) {
      const { data } = await supabaseAdmin
        .from('portfolio_norma_exigencias')
        .select('id, norma_id, artigo, texto_resumido, produto_id, portfolio_produtos(nome)')
        .eq('norma_id', id)
      setNormaExigencias(prev => ({ ...prev, [id]: (data as any) ?? [] }))
    }
  }

  const prodsFiltrados = produtos.filter(p =>
    !prodBusca || p.nome.toLowerCase().includes(prodBusca.toLowerCase()) || (p.descricao || '').toLowerCase().includes(prodBusca.toLowerCase())
  )

  // Agrupar produtos por categoria
  const prodsPorCategoria = useMemo(() => {
    const map: Record<string, typeof prodsFiltrados> = {}
    prodsFiltrados.forEach(p => {
      const cat = p.categoria || 'sem categoria'
      if (!map[cat]) map[cat] = []
      map[cat].push(p)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [prodsFiltrados])

  const normasFiltradas = normas.filter(n => {
    if (normaBusca && !n.norma.toLowerCase().includes(normaBusca.toLowerCase()) && !(n.titulo || '').toLowerCase().includes(normaBusca.toLowerCase()) && !n.orgao.toLowerCase().includes(normaBusca.toLowerCase())) return false
    if (normaFiltroOrgao && n.orgao !== normaFiltroOrgao) return false
    if (normaFiltroStatus && n.status !== normaFiltroStatus) return false
    return true
  })

  const orgaosUnicos = useMemo(() => [...new Set(normas.map(n => n.orgao))].sort(), [normas])
  const statusUnicos = useMemo(() => [...new Set(normas.map(n => n.status))].sort(), [normas])

  // Equipamentos filtrados e agrupados
  const equipsFiltrados = useMemo(() => {
    return equipamentos.filter(eq => {
      if (equipFiltroTipo === 'obrigatorio' && !eq.obrigatorio) return false
      if (equipFiltroTipo === 'recomendado' && eq.obrigatorio) return false
      if (equipFiltroMaterial && eq.material !== equipFiltroMaterial) return false
      if (equipFiltroEquip && eq.equipamento !== equipFiltroEquip) return false
      return true
    })
  }, [equipamentos, equipFiltroTipo, equipFiltroMaterial, equipFiltroEquip])

  const equipsPorSegmento = useMemo(() => {
    const map: Record<string, typeof equipsFiltrados> = {}
    equipsFiltrados.forEach(eq => {
      if (!map[eq.segmento]) map[eq.segmento] = []
      map[eq.segmento].push(eq)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [equipsFiltrados])

  const materiaisUnicos = useMemo(() => [...new Set(equipamentos.map(e => e.material))].sort(), [equipamentos])
  const equipamentosUnicos = useMemo(() => [...new Set(equipamentos.map(e => e.equipamento))].sort(), [equipamentos])

  const statusCor = (s: string) => {
    if (s === 'vigente') return { bg: '#dcfce7', color: '#15803d' }
    if (s === 'em revisão' || s === 'atualizada' || s === 'atualizado') return { bg: '#fef3c7', color: '#92400e' }
    if (s.includes('revogada') || s.includes('substituída')) return { bg: '#fee2e2', color: '#dc2626' }
    return { bg: '#f1f5f9', color: '#64748b' }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.titulo}>🏭 Portfólio & Normas</h1>
        <p className={styles.subtitulo}>Produtos inox por segmento + normas regulatórias para argumentação comercial</p>
      </div>

      {msg && <div className={msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}>{msg.texto}</div>}

      {/* Abas */}
      <div className={styles.abas}>
        {([['produtos', '📦 Produtos (' + produtos.length + ')'], ['segmentos', '🎯 Segmentos (' + segmentos.length + ')'], ['normas', '⚖️ Normas (' + normas.length + ')'], ['equipamentos', '🔧 Equipamentos (' + equipamentos.length + ')']] as [Aba, string][]).map(([k, label]) => (
          <button key={k} className={`${styles.aba} ${aba === k ? styles.abaAtiva : ''}`} onClick={() => setAba(k)}>{label}</button>
        ))}
      </div>

      {/* ══════ ABA PRODUTOS ══════ */}
      {aba === 'produtos' && (
        <div className={styles.card}>
          {prodVista === 'lista' ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className={styles.inputBusca} placeholder="Buscar produto..." value={prodBusca} onChange={e => setProdBusca(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
                <button className={styles.btnPrimary} onClick={() => { setProdEdit({}); setProdVista('form') }}>+ Novo Produto</button>
              </div>
              {/* Produtos agrupados por categoria — colapsável */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prodsPorCategoria.map(([cat, prods]) => {
                  const aberta = catAberta[cat] ?? false
                  const catLabel: Record<string, string> = { fabricacao: '🔧 Fabricação', fixadores: '📌 Fixadores', acessorios: '🔩 Acessórios' }
                  const catBg: Record<string, string> = { fabricacao: '#f0fdf4', fixadores: '#dbeafe', acessorios: '#fef3c7' }
                  return (
                    <div key={cat} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                      <button onClick={() => setCatAberta(p => ({ ...p, [cat]: !p[cat] }))} style={{ width: '100%', padding: '10px 16px', background: catBg[cat] || '#f8fafc', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                        <span>{aberta ? '▼' : '▶'}</span>
                        <span>{catLabel[cat] || cat}</span>
                        <span style={{ marginLeft: 'auto', background: '#e2e8f0', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{prods.length}</span>
                      </button>
                      {aberta && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {prods.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <strong style={{ fontSize: '0.85rem' }}>{p.nome}</strong>
                                  {!p.ativo && <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>inativo</span>}
                                </div>
                                {p.descricao && (
                                  <p onClick={() => setDescExpandida(descExpandida === p.id ? null : p.id)} style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0', cursor: 'pointer', lineHeight: 1.4, ...(descExpandida !== p.id ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: '100%' } : {}) }}>
                                    {p.descricao}
                                  </p>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <button className={styles.btnSmall} onClick={() => iaGerarDescricao(p)} disabled={iaLoading === 'desc'} title="Gerar descrição com IA">🤖</button>
                                <button className={styles.btnSmall} onClick={() => { setProdEdit(p); setProdVista('form') }}>✏️</button>
                                <button className={styles.btnSmallDanger} onClick={() => excluirProduto(p.id)}>🗑</button>
                              </div>
                              {/* IA: resultado da descrição gerada */}
                              {iaDescProdId === p.id && iaLoading === 'desc' && (
                                <div style={{ marginTop: 6, padding: 8, background: '#f0f7ff', borderRadius: 6, fontSize: '0.8rem', color: '#1e40af' }}>⏳ Gerando descrição...</div>
                              )}
                              {iaDescProdId === p.id && iaResultado?.tipo === 'desc' && (
                                <div style={{ marginTop: 6, padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                                  <p style={{ fontSize: '0.82rem', margin: '0 0 8px', lineHeight: 1.4, color: '#1e293b' }}>🤖 {iaResultado.texto}</p>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button className={styles.btnSmall} onClick={() => iaAplicarDescricao(p.id, iaResultado.texto)} style={{ background: '#16a34a', color: '#fff', border: 'none' }}>✅ Aplicar</button>
                                    <button className={styles.btnSmall} onClick={() => iaGerarDescricao(p)}>🔄 Outra</button>
                                    <button className={styles.btnSmall} onClick={() => { setIaResultado(null); setIaDescProdId(null) }}>✕</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {prodsFiltrados.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Nenhum produto encontrado</p>}
              </div>
            </>
          ) : (
            <>
              <h3>{prodEdit.id ? 'Editar Produto' : 'Novo Produto'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.campo}>
                  <label>Nome *</label>
                  <input value={prodEdit.nome || ''} onChange={e => setProdEdit({ ...prodEdit, nome: e.target.value })} />
                </div>
                <div className={styles.campo}>
                  <label>Categoria</label>
                  <select value={prodEdit.categoria || 'fabricacao'} onChange={e => setProdEdit({ ...prodEdit, categoria: e.target.value })}>
                    <option value="fabricacao">Fabricação</option>
                    <option value="fixadores">Fixadores</option>
                    <option value="acessorios">Acessórios</option>
                  </select>
                </div>
                <div className={styles.campo} style={{ gridColumn: '1 / -1' }}>
                  <label>Descrição</label>
                  <textarea value={prodEdit.descricao || ''} onChange={e => setProdEdit({ ...prodEdit, descricao: e.target.value })} rows={3} />
                </div>
                {prodEdit.id && (
                  <div className={styles.campo}>
                    <label>
                      <input type="checkbox" checked={prodEdit.ativo ?? true} onChange={e => setProdEdit({ ...prodEdit, ativo: e.target.checked })} /> Ativo
                    </label>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className={styles.btnPrimary} onClick={salvarProduto}>Salvar</button>
                <button className={styles.btnSecondary} onClick={() => { setProdVista('lista'); setProdEdit({}) }}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════ ABA SEGMENTOS ══════ */}
      {aba === 'segmentos' && (
        <div className={styles.card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className={styles.inputBusca} value={segFiltro} onChange={e => setSegFiltro(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">Todos os segmentos ({segmentos.length})</option>
              {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className={styles.btnPrimary} onClick={() => setSegAddOpen(true)}>+ Vincular Produto</button>
            {segFiltro && <button className={styles.btnSmall} onClick={() => iaSugerirProdutos(segFiltro)} disabled={iaLoading === 'sugestao'} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600 }}>{iaLoading === 'sugestao' ? '⏳ Analisando...' : '🤖 Sugerir Produtos'}</button>}
          </div>

          {segAddOpen && (
            <div style={{ padding: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <div className={styles.campo}>
                <label>Segmento</label>
                <input list="seg-list" value={segAddSegmento} onChange={e => setSegAddSegmento(e.target.value)} placeholder="Ex: Pizzaria" />
                <datalist id="seg-list">{segmentos.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div className={styles.campo}>
                <label>Produto</label>
                <select value={segAddProduto ?? ''} onChange={e => setSegAddProduto(Number(e.target.value) || null)}>
                  <option value="">Selecione...</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <button className={styles.btnPrimary} onClick={adicionarMapeamento}>Salvar</button>
              <button className={styles.btnSecondary} onClick={() => setSegAddOpen(false)}>Cancelar</button>
            </div>
          )}

          {segFiltro ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <h3 style={{ fontSize: '1rem', color: '#1e40af' }}>{segFiltro} — {mapeamentos.length} produtos</h3>
              {iaResultado?.tipo === 'sugestao' && (
                <div style={{ padding: 14, background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 10, fontSize: '0.84rem', lineHeight: 1.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ color: '#7c3aed' }}>🤖 Análise IA — {segFiltro}</strong>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className={styles.btnSmall} onClick={() => { navigator.clipboard.writeText(iaResultado.texto); showMsg('ok', 'Copiado!') }}>📋</button>
                      <button className={styles.btnSmall} onClick={() => setIaResultado(null)}>✕</button>
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b' }}>{iaResultado.texto}</div>
                </div>
              )}
              {mapeamentos.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <button onClick={() => toggleDestaque(m)} title="Destaque" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>{m.destaque ? '⭐' : '☆'}</button>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem' }}>{m.portfolio_produtos?.nome || '?'}</strong>
                    {m.portfolio_produtos?.descricao && <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>{m.portfolio_produtos.descricao}</span>}
                  </div>
                  <select value={m.relevancia} onChange={async e => { const v = Number(e.target.value); await supabaseAdmin.from('segmento_portfolio').update({ relevancia: v }).eq('id', m.id); carregarMapeamentos() }} title="Relevância (1-10)" style={{ width: 48, padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, color: '#2563eb', background: '#f0f7ff', cursor: 'pointer' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <button className={styles.btnSmallDanger} onClick={() => removerMapeamento(m.id)}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <table className={styles.tabela}>
              <thead>
                <tr><th>Segmento</th><th>Produtos vinculados</th></tr>
              </thead>
              <tbody>
                {segmentos.map(s => {
                  const count = mapeamentos.filter(m => m.segmento === s).length || '—'
                  return (
                    <tr key={s} onClick={() => setSegFiltro(s)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600 }}>{s}</td>
                      <td>{count}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════ ABA NORMAS ══════ */}
      {aba === 'normas' && (
        <div className={styles.card}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className={styles.inputBusca} placeholder="Buscar norma..." value={normaBusca} onChange={e => setNormaBusca(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <select className={styles.inputBusca} value={normaFiltroOrgao} onChange={e => setNormaFiltroOrgao(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">Todos os órgãos</option>
              {orgaosUnicos.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={styles.inputBusca} value={normaFiltroStatus} onChange={e => setNormaFiltroStatus(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">Todos os status</option>
              {statusUnicos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{normasFiltradas.length} norma{normasFiltradas.length !== 1 ? 's' : ''}</span>
            <button className={styles.btnSmall} onClick={iaResumoRegulatorio} disabled={iaLoading === 'resumo' || normas.length === 0} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600 }}>{iaLoading === 'resumo' ? '⏳ Gerando...' : '🤖 Resumo Executivo'}</button>
          </div>

          {/* Resultado IA — Resumo Executivo */}
          {iaResultado?.tipo === 'resumo' && (
            <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: '0.84rem', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ color: '#dc2626' }}>🤖 Resumo Executivo — Argumento Regulatório</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className={styles.btnSmall} onClick={() => { navigator.clipboard.writeText(iaResultado.texto); showMsg('ok', 'Resumo copiado!') }}>📋 Copiar</button>
                  <button className={styles.btnSmall} onClick={() => setIaResultado(null)}>✕</button>
                </div>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b' }}>{iaResultado.texto}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {normasFiltradas.map(n => {
              const sc = statusCor(n.status)
              return (
                <div key={n.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => expandirNorma(n.id)} style={{ width: '100%', padding: '12px 16px', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                    <span style={{ fontSize: '0.85rem' }}>{normaExpandida === n.id ? '▼' : '▶'}</span>
                    <span style={{ background: '#1e40af', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{n.orgao}</span>
                    <strong style={{ fontSize: '0.9rem', flex: 1 }}>{n.norma}</strong>
                    <span style={{ background: sc.bg, color: sc.color, fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>{n.status}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{(n.segmentos || []).length} seg.</span>
                  </button>
                  {normaExpandida === n.id && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
                      {n.titulo && <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 8px' }}>{n.titulo}</p>}
                      {n.substituida_por && <p style={{ fontSize: '0.78rem', color: '#d97706', margin: '0 0 4px' }}>→ Substituída por: {n.substituida_por}</p>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '4px 0 8px' }}>
                        {(n.segmentos || []).map((s: string) => (
                          <span key={s} style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4 }}>{s}</span>
                        ))}
                      </div>
                      {n.penalidade && <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: '4px 0' }}>⚠️ {n.penalidade}</p>}
                      {n.observacao && <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0', lineHeight: 1.4 }}>{n.observacao}</p>}

                      {/* Exigências */}
                      {normaExigencias[n.id] && normaExigencias[n.id].length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong style={{ fontSize: '0.78rem' }}>Exigências ({normaExigencias[n.id].length}):</strong>
                          {normaExigencias[n.id].map(ex => (
                            <div key={ex.id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                              {ex.artigo && <span style={{ fontWeight: 600, color: '#1e40af' }}>{ex.artigo}: </span>}
                              <span style={{ color: '#334155' }}>{ex.texto_resumido}</span>
                              {ex.portfolio_produtos && <span style={{ color: '#16a34a', fontWeight: 600 }}> → {ex.portfolio_produtos.nome}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════ ABA EQUIPAMENTOS ══════ */}
      {aba === 'equipamentos' && (
        <div className={styles.card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <select className={styles.inputBusca} value={equipFiltroEquip} onChange={e => setEquipFiltroEquip(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Todos equipamentos</option>
              {equipamentosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select className={styles.inputBusca} value={equipFiltro} onChange={e => setEquipFiltro(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Todos os segmentos</option>
              {equipSegmentos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={styles.inputBusca} value={equipFiltroTipo} onChange={e => setEquipFiltroTipo(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">Todos os tipos</option>
              <option value="obrigatorio">✅ Obrigatório</option>
              <option value="recomendado">⭐ Recomendado</option>
            </select>
            <select className={styles.inputBusca} value={equipFiltroMaterial} onChange={e => setEquipFiltroMaterial(e.target.value)} style={{ minWidth: 100 }}>
              <option value="">Material</option>
              {materiaisUnicos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{equipsFiltrados.length} equip.</span>
            <button className={styles.btnPrimary} onClick={() => setEquipEdit({ _new: true, obrigatorio: false, material: '304' })}>+ Novo</button>
          </div>

          {/* Form inline */}
          {(equipEdit._new || equipEdit.id) && (
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className={styles.inputBusca} placeholder="Segmento *" value={equipEdit.segmento || ''} onChange={e => setEquipEdit(p => ({ ...p, segmento: e.target.value }))} style={{ flex: 1, minWidth: 150 }} list="eq-seg-list" />
                <datalist id="eq-seg-list">{equipSegmentos.map(s => <option key={s} value={s} />)}</datalist>
                <input className={styles.inputBusca} placeholder="Equipamento *" value={equipEdit.equipamento || ''} onChange={e => setEquipEdit(p => ({ ...p, equipamento: e.target.value }))} style={{ flex: 2, minWidth: 200 }} />
                <select className={styles.inputBusca} value={equipEdit.material || '304'} onChange={e => setEquipEdit(p => ({ ...p, material: e.target.value }))} style={{ width: 90 }}>
                  <option value="304">304</option>
                  <option value="316">316</option>
                  <option value="316L">316L</option>
                  <option value="430">430</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <input type="checkbox" checked={equipEdit.obrigatorio || false} onChange={e => setEquipEdit(p => ({ ...p, obrigatorio: e.target.checked }))} /> Obrigatório
                </label>
                <select className={styles.inputBusca} value={equipEdit.norma_ref || ''} onChange={e => setEquipEdit(p => ({ ...p, norma_ref: e.target.value }))} style={{ flex: 1, minWidth: 150 }}>
                  <option value="">Norma ref (opcional)</option>
                  {normas.map(n => <option key={n.id} value={n.norma}>{n.norma} — {n.orgao}</option>)}
                </select>
                <input className={styles.inputBusca} placeholder="Observação" value={equipEdit.observacao || ''} onChange={e => setEquipEdit(p => ({ ...p, observacao: e.target.value }))} style={{ flex: 2, minWidth: 200 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.btnPrimary} onClick={salvarEquipamento}>💾 Salvar</button>
                <button className={styles.btnSecondary} onClick={() => setEquipEdit({})}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Equipamentos agrupados por segmento — colapsável */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {equipsPorSegmento.map(([seg, eqs]) => {
              const aberta = equipSecaoAberta[seg] ?? false
              const obrigCount = eqs.filter(e => e.obrigatorio).length
              return (
                <div key={seg} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setEquipSecaoAberta(p => ({ ...p, [seg]: !p[seg] }))} style={{ width: '100%', padding: '10px 16px', background: '#f8fafc', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                    <span>{aberta ? '▼' : '▶'}</span>
                    <span style={{ flex: 1 }}>{seg}</span>
                    {obrigCount > 0 && <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700 }}>✅ {obrigCount} obrig.</span>}
                    <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>{eqs.length}</span>
                  </button>
                  {aberta && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {eqs.map(eq => (
                        <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderTop: '1px solid #f1f5f9', background: '#fff', flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: eq.obrigatorio ? '#dcfce7' : '#fef3c7', color: eq.obrigatorio ? '#15803d' : '#92400e' }}>{eq.obrigatorio ? '✅' : '⭐'}</span>
                          <strong style={{ fontSize: '0.84rem', flex: 1, minWidth: 120 }}>{eq.equipamento}</strong>
                          <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: eq.material !== '304' ? '#ede9fe' : '#f1f5f9', color: eq.material !== '304' ? '#7c3aed' : '#64748b' }}>{eq.material}</span>
                          {eq.norma_ref ? (
                            <span style={{ position: 'relative' }}>
                              <button onClick={() => setEquipNormaPopover(equipNormaPopover === eq.id ? null : eq.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', fontWeight: 600, fontSize: '0.78rem', textDecoration: 'underline', padding: 0 }}>{eq.norma_ref}</button>
                              {equipNormaPopover === eq.id && (() => {
                                const norma = normas.find(n => n.norma === eq.norma_ref)
                                return norma ? (
                                  <>
                                    <div onClick={() => setEquipNormaPopover(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                                    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, width: 340, maxWidth: '85vw', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)', padding: 14, fontSize: '0.82rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <span style={{ background: '#1e40af', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{norma.orgao}</span>
                                        <strong>{norma.norma}</strong>
                                        <button onClick={() => setEquipNormaPopover(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94a3b8' }}>✕</button>
                                      </div>
                                      {norma.titulo && <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{norma.titulo}</p>}
                                      {norma.penalidade && <p style={{ margin: '0 0 6px', color: '#b91c1c', fontSize: '0.78rem' }}>⚠️ <strong>Penalidade:</strong> {norma.penalidade}</p>}
                                      {norma.observacao && <p style={{ margin: '0 0 6px', color: '#64748b', fontSize: '0.78rem', lineHeight: 1.4 }}>{norma.observacao}</p>}
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                                        {(norma.segmentos || []).map((s: string) => (
                                          <span key={s} style={{ background: s === seg ? '#dbeafe' : '#f1f5f9', color: s === seg ? '#1e40af' : '#64748b', fontSize: '0.68rem', padding: '1px 5px', borderRadius: 4, fontWeight: s === seg ? 700 : 400 }}>{s}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                ) : <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>(norma não encontrada)</span>
                              })()}
                            </span>
                          ) : null}
                          {eq.observacao && <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>{eq.observacao}</span>}
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }} onClick={() => setEquipEdit(eq)}>✏️</button>
                            <button title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }} onClick={() => excluirEquipamento(eq.id)}>🗑</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {equipsFiltrados.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Nenhum equipamento encontrado</p>}
          </div>
        </div>
      )}
    </div>
  )
}
