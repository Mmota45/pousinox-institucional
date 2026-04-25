import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminFrete.module.css'

/* ── Tipos ── */
interface FreteConfig {
  id: number
  nome: string
  raio_max_km: number
  valor_por_km: number
  frete_minimo: number
  faixa1_km: number
  faixa1_prazo: string
  faixa2_prazo: string
  horario_corte: string
  horario_corte_transportadora: string
  ativo: boolean
}

interface FreteRegra {
  id?: number
  tipo: string
  descricao: string
  condicao_estados: string[] | null
  condicao_produto_id: number | null
  condicao_categoria: string | null
  condicao_valor_min: number | null
  condicao_valor_max: number | null
  valor: number
  prioridade: number
  ativo: boolean
}

const TIPOS_REGRA = [
  { value: 'frete_gratis', label: 'Frete Gratis' },
  { value: 'desconto_pct', label: 'Desconto (%)' },
  { value: 'desconto_fixo', label: 'Desconto (R$)' },
  { value: 'acrescimo_fixo', label: 'Acrescimo (R$)' },
  { value: 'bloqueio', label: 'Bloqueio de envio' },
]

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

const REGRA_VAZIA: FreteRegra = {
  tipo: 'frete_gratis', descricao: '', condicao_estados: null, condicao_produto_id: null,
  condicao_categoria: null, condicao_valor_min: null, condicao_valor_max: null,
  valor: 0, prioridade: 10, ativo: true,
}

/* ── Componente ── */
function AdminFrete() {
  const [aba, setAba] = useState<'config' | 'regras'>('config')

  // Config
  const [config, setConfig] = useState<FreteConfig | null>(null)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [msgConfig, setMsgConfig] = useState<{ ok: boolean; texto: string } | null>(null)

  // Regras
  const [regras, setRegras] = useState<FreteRegra[]>([])
  const [formRegra, setFormRegra] = useState<FreteRegra | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [salvandoRegra, setSalvandoRegra] = useState(false)
  const [msgRegra, setMsgRegra] = useState<{ ok: boolean; texto: string } | null>(null)

  /* ── Load ── */
  const carregarConfig = useCallback(async () => {
    const { data } = await supabaseAdmin.from('frete_config').select('*').eq('ativo', true).limit(1)
    if (data?.length) setConfig(data[0])
  }, [])

  const carregarRegras = useCallback(async () => {
    const { data } = await supabaseAdmin.from('frete_regras').select('*').order('prioridade', { ascending: true })
    if (data) setRegras(data)
  }, [])

  useEffect(() => { carregarConfig(); carregarRegras() }, [carregarConfig, carregarRegras])

  /* ── Salvar config ── */
  const salvarConfig = async () => {
    if (!config) return
    setSalvandoConfig(true)
    setMsgConfig(null)
    const { error } = await supabaseAdmin.from('frete_config').update({
      raio_max_km: config.raio_max_km,
      valor_por_km: config.valor_por_km,
      frete_minimo: config.frete_minimo,
      faixa1_km: config.faixa1_km,
      faixa1_prazo: config.faixa1_prazo,
      faixa2_prazo: config.faixa2_prazo,
      horario_corte: config.horario_corte,
      horario_corte_transportadora: config.horario_corte_transportadora,
    }).eq('id', config.id)
    setSalvandoConfig(false)
    setMsgConfig(error ? { ok: false, texto: error.message } : { ok: true, texto: 'Salvo com sucesso!' })
    setTimeout(() => setMsgConfig(null), 3000)
  }

  /* ── Salvar regra ── */
  const salvarRegra = async () => {
    if (!formRegra || !formRegra.descricao.trim()) return
    setSalvandoRegra(true)
    setMsgRegra(null)

    const payload = {
      tipo: formRegra.tipo,
      descricao: formRegra.descricao.trim(),
      condicao_estados: formRegra.condicao_estados?.length ? formRegra.condicao_estados : null,
      condicao_produto_id: formRegra.condicao_produto_id || null,
      condicao_categoria: formRegra.condicao_categoria?.trim() || null,
      condicao_valor_min: formRegra.condicao_valor_min || null,
      condicao_valor_max: formRegra.condicao_valor_max || null,
      valor: formRegra.valor,
      prioridade: formRegra.prioridade,
      ativo: formRegra.ativo,
    }

    let error
    if (editandoId) {
      ({ error } = await supabaseAdmin.from('frete_regras').update(payload).eq('id', editandoId))
    } else {
      ({ error } = await supabaseAdmin.from('frete_regras').insert(payload))
    }

    setSalvandoRegra(false)
    if (error) {
      setMsgRegra({ ok: false, texto: error.message })
    } else {
      setMsgRegra({ ok: true, texto: editandoId ? 'Regra atualizada!' : 'Regra criada!' })
      setFormRegra(null)
      setEditandoId(null)
      carregarRegras()
    }
    setTimeout(() => setMsgRegra(null), 3000)
  }

  const excluirRegra = async (id: number) => {
    if (!confirm('Excluir esta regra?')) return
    await supabaseAdmin.from('frete_regras').delete().eq('id', id)
    carregarRegras()
  }

  const toggleRegra = async (id: number, ativo: boolean) => {
    await supabaseAdmin.from('frete_regras').update({ ativo: !ativo }).eq('id', id)
    carregarRegras()
  }

  const editarRegra = (r: FreteRegra) => {
    setFormRegra({ ...r })
    setEditandoId(r.id ?? null)
  }

  const toggleUf = (uf: string) => {
    if (!formRegra) return
    const estados = formRegra.condicao_estados ?? []
    const novo = estados.includes(uf) ? estados.filter(e => e !== uf) : [...estados, uf]
    setFormRegra({ ...formRegra, condicao_estados: novo.length ? novo : null })
  }

  const labelTipo = (tipo: string) => TIPOS_REGRA.find(t => t.value === tipo)?.label ?? tipo

  /* ── Render ── */
  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Frete</h1>
          <p className={styles.pageSubtitle}>Configuracao de frete proprio e regras condicionais</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${aba === 'config' ? styles.tabAtiva : ''}`} onClick={() => setAba('config')}>
          Configuracao
        </button>
        <button className={`${styles.tab} ${aba === 'regras' ? styles.tabAtiva : ''}`} onClick={() => setAba('regras')}>
          Regras ({regras.length})
        </button>
      </div>

      {/* ── ABA CONFIGURACAO ── */}
      {aba === 'config' && config && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Frete Proprio (Entrega Rapida)</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Raio maximo (km)</label>
              <input type="number" className={styles.formInput} value={config.raio_max_km}
                onChange={e => setConfig({ ...config, raio_max_km: +e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor por km (R$)</label>
              <input type="number" step="0.50" className={styles.formInput} value={config.valor_por_km}
                onChange={e => setConfig({ ...config, valor_por_km: +e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Frete minimo (R$)</label>
              <input type="number" step="1" className={styles.formInput} value={config.frete_minimo}
                onChange={e => setConfig({ ...config, frete_minimo: +e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Faixa 1 — ate (km)</label>
              <input type="number" className={styles.formInput} value={config.faixa1_km}
                onChange={e => setConfig({ ...config, faixa1_km: +e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Prazo Faixa 1</label>
              <input type="text" className={styles.formInput} value={config.faixa1_prazo}
                onChange={e => setConfig({ ...config, faixa1_prazo: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Prazo Faixa 2</label>
              <input type="text" className={styles.formInput} value={config.faixa2_prazo}
                onChange={e => setConfig({ ...config, faixa2_prazo: e.target.value })} />
            </div>
          </div>

          <h2 className={styles.cardTitle} style={{ marginTop: 12 }}>Horarios de Corte</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Corte — Frete Proprio</label>
              <input type="time" className={styles.formInput} value={config.horario_corte}
                onChange={e => setConfig({ ...config, horario_corte: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Corte — Correios / Transportadora</label>
              <input type="time" className={styles.formInput} value={config.horario_corte_transportadora}
                onChange={e => setConfig({ ...config, horario_corte_transportadora: e.target.value })} />
            </div>
          </div>

          {msgConfig && (
            <div className={`${styles.formMsg} ${msgConfig.ok ? styles.formMsgOk : styles.formMsgErro}`}>
              {msgConfig.texto}
            </div>
          )}

          <div className={styles.formActions}>
            <button className={styles.btnPrimary} onClick={salvarConfig} disabled={salvandoConfig}>
              {salvandoConfig ? 'Salvando...' : 'Salvar Configuracao'}
            </button>
          </div>
        </div>
      )}

      {/* ── ABA REGRAS ── */}
      {aba === 'regras' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {!formRegra && (
              <button className={styles.btnPrimary} onClick={() => { setFormRegra({ ...REGRA_VAZIA }); setEditandoId(null) }}>
                + Nova Regra
              </button>
            )}
          </div>

          {/* Form inline */}
          {formRegra && (
            <div className={styles.regraForm}>
              <h3 className={styles.regraFormTitle}>{editandoId ? 'Editar Regra' : 'Nova Regra'}</h3>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tipo</label>
                  <select className={styles.formSelect} value={formRegra.tipo}
                    onChange={e => setFormRegra({ ...formRegra, tipo: e.target.value })}>
                    {TIPOS_REGRA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Descricao</label>
                  <input type="text" className={styles.formInput} placeholder="Ex: Frete gratis MG acima R$500"
                    value={formRegra.descricao} onChange={e => setFormRegra({ ...formRegra, descricao: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Prioridade (menor = maior)</label>
                  <input type="number" className={styles.formInput} value={formRegra.prioridade}
                    onChange={e => setFormRegra({ ...formRegra, prioridade: +e.target.value })} />
                </div>
              </div>

              {formRegra.tipo !== 'frete_gratis' && formRegra.tipo !== 'bloqueio' && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Valor ({formRegra.tipo === 'desconto_pct' ? '%' : 'R$'})
                    </label>
                    <input type="number" step="0.01" className={styles.formInput} value={formRegra.valor}
                      onChange={e => setFormRegra({ ...formRegra, valor: +e.target.value })} />
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Estados (vazio = todos)</label>
                <div className={styles.chipGroup}>
                  {UFS.map(uf => (
                    <button key={uf} type="button"
                      className={`${styles.chip} ${(formRegra.condicao_estados ?? []).includes(uf) ? styles.chipAtivo : ''}`}
                      onClick={() => toggleUf(uf)}>
                      {uf}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Valor minimo do pedido (R$)</label>
                  <input type="number" step="0.01" className={styles.formInput}
                    value={formRegra.condicao_valor_min ?? ''}
                    onChange={e => setFormRegra({ ...formRegra, condicao_valor_min: e.target.value ? +e.target.value : null })} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Valor maximo do pedido (R$)</label>
                  <input type="number" step="0.01" className={styles.formInput}
                    value={formRegra.condicao_valor_max ?? ''}
                    onChange={e => setFormRegra({ ...formRegra, condicao_valor_max: e.target.value ? +e.target.value : null })} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Categoria (opcional)</label>
                  <input type="text" className={styles.formInput} placeholder="Ex: utensilios-corte"
                    value={formRegra.condicao_categoria ?? ''}
                    onChange={e => setFormRegra({ ...formRegra, condicao_categoria: e.target.value || null })} />
                </div>
              </div>

              {msgRegra && (
                <div className={`${styles.formMsg} ${msgRegra.ok ? styles.formMsgOk : styles.formMsgErro}`}>
                  {msgRegra.texto}
                </div>
              )}

              <div className={styles.formActions}>
                <button className={styles.btnSecondary} onClick={() => { setFormRegra(null); setEditandoId(null) }}>
                  Cancelar
                </button>
                <button className={styles.btnPrimary} onClick={salvarRegra} disabled={salvandoRegra || !formRegra.descricao.trim()}>
                  {salvandoRegra ? 'Salvando...' : editandoId ? 'Atualizar' : 'Criar Regra'}
                </button>
              </div>
            </div>
          )}

          {/* Tabela de regras */}
          <div className={styles.card} style={{ padding: 0 }}>
            {regras.length === 0 ? (
              <p className={styles.vazio}>Nenhuma regra cadastrada</p>
            ) : (
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Prio</th>
                    <th>Tipo</th>
                    <th>Descricao</th>
                    <th>Estados</th>
                    <th>Valor min</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {regras.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.prioridade}</td>
                      <td><span className={styles.badgeTipo}>{labelTipo(r.tipo)}</span></td>
                      <td style={{ fontWeight: 600 }}>{r.descricao}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {r.condicao_estados?.length ? r.condicao_estados.join(', ') : 'Todos'}
                      </td>
                      <td>{r.condicao_valor_min ? `R$ ${r.condicao_valor_min.toFixed(2)}` : '—'}</td>
                      <td>
                        {r.tipo === 'frete_gratis' ? 'Gratis' :
                         r.tipo === 'bloqueio' ? 'Bloqueado' :
                         r.tipo === 'desconto_pct' ? `${r.valor}%` :
                         `R$ ${r.valor.toFixed(2)}`}
                      </td>
                      <td>
                        <span className={r.ativo ? styles.badgeAtivo : styles.badgeInativo}>
                          {r.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.acoes}>
                          <button className={styles.btnAcao} title={r.ativo ? 'Desativar' : 'Ativar'}
                            onClick={() => toggleRegra(r.id!, r.ativo)}>
                            {r.ativo ? '⏸' : '▶'}
                          </button>
                          <button className={styles.btnAcao} title="Editar" onClick={() => editarRegra(r)}>✏️</button>
                          <button className={styles.btnAcao} title="Excluir" onClick={() => excluirRegra(r.id!)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default AdminFrete
