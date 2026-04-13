import { useEffect, useState } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCatalogo.module.css'

interface AtribCat {
  id: number
  chave: string
  label_pt: string
  tipo_valor: string
  unidade_padrao: string | null
  valores_enum: string[] | null
  frequencia_uso: number
}

const TIPOS = ['text', 'number', 'enum', 'boolean']

const VAZIO: Omit<AtribCat, 'id' | 'frequencia_uso'> = {
  chave: '', label_pt: '', tipo_valor: 'text', unidade_padrao: '', valores_enum: null,
}

export default function AdminCatalogo() {
  const [itens, setItens]           = useState<AtribCat[]>([])
  const [loading, setLoading]       = useState(true)
  const [editando, setEditando]     = useState<AtribCat | null>(null)
  const [novo, setNovo]             = useState<typeof VAZIO | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('atributos_catalogo')
      .select('*')
      .order('frequencia_uso', { ascending: false })
    setItens(data ?? [])
    setLoading(false)
  }

  function enumStr(vals: string[] | null) {
    return vals?.join(', ') ?? ''
  }

  function parseEnum(str: string): string[] | null {
    const arr = str.split(',').map(s => s.trim()).filter(Boolean)
    return arr.length ? arr : null
  }

  async function salvarNovo() {
    if (!novo) return
    if (!novo.chave || !novo.label_pt) { setErro('Chave e label são obrigatórios.'); return }
    setSalvando(true); setErro('')
    const payload = {
      ...novo,
      chave: novo.chave.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
      unidade_padrao: novo.unidade_padrao || null,
    }
    const { error } = await supabaseAdmin.from('atributos_catalogo').insert(payload)
    if (error) { setErro(error.message); setSalvando(false); return }
    setNovo(null)
    await carregar()
    setSalvando(false)
  }

  async function salvarEdicao() {
    if (!editando) return
    setSalvando(true); setErro('')
    const { error } = await supabaseAdmin
      .from('atributos_catalogo')
      .update({
        label_pt:       editando.label_pt,
        tipo_valor:     editando.tipo_valor,
        unidade_padrao: editando.unidade_padrao || null,
        valores_enum:   editando.valores_enum,
      })
      .eq('id', editando.id)
    if (error) { setErro(error.message); setSalvando(false); return }
    setEditando(null)
    await carregar()
    setSalvando(false)
  }

  async function excluir(id: number) {
    if (!confirm('Excluir este atributo do catálogo?')) return
    await supabaseAdmin.from('atributos_catalogo').delete().eq('id', id)
    await carregar()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Catálogo de Atributos</h1>
          <p className={styles.sub}>Chaves, tipos e valores aceitos nos projetos sob medida</p>
        </div>
        {!novo && (
          <button className={styles.btnAdd} onClick={() => { setNovo({ ...VAZIO }); setEditando(null) }}>
            + Novo Atributo
          </button>
        )}
      </div>

      {erro && <div className={styles.erro}>{erro}</div>}

      {novo && (
        <div className={styles.card}>
          <div className={styles.cardTitulo}>Novo atributo</div>
          <div className={styles.formGrid}>
            <label className={styles.label}>
              Chave (snake_case)
              <input className={styles.input} value={novo.chave} onChange={e => setNovo(n => n && ({ ...n, chave: e.target.value }))} placeholder="ex: espessura_mm" autoFocus />
            </label>
            <label className={styles.label}>
              Label (pt-BR)
              <input className={styles.input} value={novo.label_pt} onChange={e => setNovo(n => n && ({ ...n, label_pt: e.target.value }))} placeholder="ex: Espessura (mm)" />
            </label>
            <label className={styles.label}>
              Tipo
              <select className={styles.input} value={novo.tipo_valor} onChange={e => setNovo(n => n && ({ ...n, tipo_valor: e.target.value }))}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className={styles.label}>
              Unidade padrão
              <input className={styles.input} value={novo.unidade_padrao ?? ''} onChange={e => setNovo(n => n && ({ ...n, unidade_padrao: e.target.value }))} placeholder="ex: mm, kg" />
            </label>
            {novo.tipo_valor === 'enum' && (
              <label className={styles.label} style={{ gridColumn: '1 / -1' }}>
                Valores permitidos (separados por vírgula)
                <input className={styles.input} value={enumStr(novo.valores_enum)} onChange={e => setNovo(n => n && ({ ...n, valores_enum: parseEnum(e.target.value) }))} placeholder="ex: polido, escovado, acetinado" />
              </label>
            )}
          </div>
          <div className={styles.acoes}>
            <button className={styles.btnSalvar} onClick={salvarNovo} disabled={salvando}>Salvar</button>
            <button className={styles.btnCancelar} onClick={() => { setNovo(null); setErro('') }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : (
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>Chave</th>
              <th>Label</th>
              <th>Tipo</th>
              <th>Unidade</th>
              <th>Valores enum</th>
              <th>Uso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itens.map(item => (
              editando?.id === item.id ? (
                <tr key={item.id} className={styles.trEdit}>
                  <td><span className={styles.chaveFixa}>{item.chave}</span></td>
                  <td><input className={styles.inputInline} value={editando.label_pt} onChange={e => setEditando(v => v && ({ ...v, label_pt: e.target.value }))} autoFocus /></td>
                  <td>
                    <select className={styles.inputInline} value={editando.tipo_valor} onChange={e => setEditando(v => v && ({ ...v, tipo_valor: e.target.value }))}>
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td><input className={styles.inputInline} value={editando.unidade_padrao ?? ''} onChange={e => setEditando(v => v && ({ ...v, unidade_padrao: e.target.value }))} /></td>
                  <td><input className={styles.inputInline} value={enumStr(editando.valores_enum)} onChange={e => setEditando(v => v && ({ ...v, valores_enum: parseEnum(e.target.value) }))} placeholder="val1, val2" /></td>
                  <td>{item.frequencia_uso}</td>
                  <td className={styles.acoesTd}>
                    <button className={styles.btnSalvarSm} onClick={salvarEdicao} disabled={salvando}>✓</button>
                    <button className={styles.btnCancelarSm} onClick={() => setEditando(null)}>✕</button>
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td><span className={styles.chave}>{item.chave}</span></td>
                  <td>{item.label_pt}</td>
                  <td><span className={styles.tipo}>{item.tipo_valor}</span></td>
                  <td>{item.unidade_padrao || '—'}</td>
                  <td className={styles.enumCell}>{item.valores_enum?.join(', ') || '—'}</td>
                  <td>{item.frequencia_uso}</td>
                  <td className={styles.acoesTd}>
                    <button className={styles.btnEditSm} onClick={() => { setEditando(item); setNovo(null) }}>✏️</button>
                    <button className={styles.btnDelSm} onClick={() => excluir(item.id)}>×</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
