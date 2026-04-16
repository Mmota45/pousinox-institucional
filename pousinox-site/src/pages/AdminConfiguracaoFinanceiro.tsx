import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminFinanceiro.module.css'

interface Categoria   { id: number; nome: string; tipo: 'receita'|'despesa'; grupo: string; cor: string; ativo: boolean }
interface CentroCusto { id: number; nome: string; descricao: string | null; ativo: boolean }

export default function AdminConfiguracaoFinanceiro() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [centros,    setCentros]    = useState<CentroCusto[]>([])
  const [loading,    setLoading]    = useState(true)
  const [msg,        setMsg]        = useState<{ tipo: 'ok'|'erro'; texto: string } | null>(null)

  const [formCat,    setFormCat]    = useState({ nome: '', tipo: 'receita' as 'receita'|'despesa', grupo: '', cor: '#16a34a' })
  const [formCentro, setFormCentro] = useState({ nome: '', descricao: '' })
  const [salvandoCat,    setSalvandoCat]    = useState(false)
  const [salvandoCentro, setSalvandoCentro] = useState(false)

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t) }, [msg])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: cts }] = await Promise.all([
      supabaseAdmin.from('fin_categorias').select('*').eq('ativo', true).order('grupo').order('nome'),
      supabaseAdmin.from('fin_centros_custo').select('*').eq('ativo', true).order('nome'),
    ])
    setCategorias(cats ?? [])
    setCentros(cts ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvarCategoria(e: React.FormEvent) {
    e.preventDefault()
    if (!formCat.nome.trim()) return
    setSalvandoCat(true)
    const { error } = await supabaseAdmin.from('fin_categorias').insert({
      nome: formCat.nome.trim(), tipo: formCat.tipo,
      grupo: formCat.grupo.trim() || null, cor: formCat.cor,
    })
    if (!error) {
      setMsg({ tipo: 'ok', texto: 'Categoria criada.' })
      setFormCat({ nome: '', tipo: 'receita', grupo: '', cor: '#16a34a' })
      carregar()
    } else {
      setMsg({ tipo: 'erro', texto: error.message })
    }
    setSalvandoCat(false)
  }

  async function salvarCentro(e: React.FormEvent) {
    e.preventDefault()
    if (!formCentro.nome.trim()) return
    setSalvandoCentro(true)
    const { error } = await supabaseAdmin.from('fin_centros_custo').insert({
      nome: formCentro.nome.trim(), descricao: formCentro.descricao.trim() || null,
    })
    if (!error) {
      setMsg({ tipo: 'ok', texto: 'Centro criado.' })
      setFormCentro({ nome: '', descricao: '' })
      carregar()
    } else {
      setMsg({ tipo: 'erro', texto: error.message })
    }
    setSalvandoCentro(false)
  }

  const catsPorTipo = (tipo: 'receita'|'despesa') => categorias.filter(c => c.tipo === tipo)

  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <div className={styles.wrap}>
      {msg && (
        <div className={msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}>{msg.texto}</div>
      )}

      <div className={styles.configWrap}>

        {/* ── Categorias ── */}
        <div>
          <div className={styles.configSecao}>Categorias</div>
          <form className={styles.formSmall} onSubmit={salvarCategoria}>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label>Nome *</label>
                <input className={styles.input} value={formCat.nome}
                  onChange={e => setFormCat(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Comissão de vendas" required />
              </div>
              <div className={styles.field}>
                <label>Tipo</label>
                <select className={styles.input} value={formCat.tipo}
                  onChange={e => setFormCat(f => ({ ...f, tipo: e.target.value as 'receita'|'despesa' }))}>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Grupo</label>
                <input className={styles.input} value={formCat.grupo}
                  onChange={e => setFormCat(f => ({ ...f, grupo: e.target.value }))}
                  placeholder="Ex: Operacional" />
              </div>
            </div>
            <div className={styles.formActions}>
              <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.81rem', fontWeight: 600 }}>Cor</span>
                <input type="color" className={styles.inputColor} value={formCat.cor}
                  onChange={e => setFormCat(f => ({ ...f, cor: e.target.value }))} />
              </label>
              <button type="submit" className={styles.btnPrimary} disabled={salvandoCat}>
                {salvandoCat ? 'Salvando...' : 'Criar categoria'}
              </button>
            </div>
          </form>

          <div className={styles.listaConfig}>
            {(['receita', 'despesa'] as const).map(tipo => (
              <div key={tipo}>
                <div className={styles.grupoTitulo}>{tipo === 'receita' ? '↑ Receitas' : '↓ Despesas'}</div>
                <div className={styles.catGrid}>
                  {catsPorTipo(tipo).map(c => (
                    <div key={c.id} className={styles.catItem} style={{ borderLeftColor: c.cor }}>
                      <span className={styles.catNome}>{c.nome}</span>
                      {c.grupo && <span className={styles.catGrupo}>{c.grupo}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Centros de Custo ── */}
        <div>
          <div className={styles.configSecao}>Centros de Custo</div>
          <form className={styles.formSmall} onSubmit={salvarCentro}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Nome *</label>
                <input className={styles.input} value={formCentro.nome}
                  onChange={e => setFormCentro(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Exportação" required />
              </div>
              <div className={styles.field}>
                <label>Descrição</label>
                <input className={styles.input} value={formCentro.descricao}
                  onChange={e => setFormCentro(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Opcional" />
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={salvandoCentro}>
                {salvandoCentro ? 'Salvando...' : 'Criar centro'}
              </button>
            </div>
          </form>
          <div className={styles.catGrid} style={{ marginTop: 16 }}>
            {centros.map(c => (
              <div key={c.id} className={styles.catItem} style={{ borderLeftColor: 'var(--color-primary)' }}>
                <span className={styles.catNome}>{c.nome}</span>
                {c.descricao && <span className={styles.catGrupo}>{c.descricao}</span>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
