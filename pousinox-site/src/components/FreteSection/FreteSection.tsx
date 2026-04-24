import { useState, useReducer, useEffect, useCallback, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {
  FreteState, FreteAction, FreteTipo, FreteModalidade, FreteProvedor,
  Volume, FreteOpcao, FreteSummary, VOLUME_VAZIO, FRETE_STATE_INICIAL,
  FRETE_PROPRIO_COMPONENTES, FreteProprioComponente,
} from '../../types/frete'
import {
  VOLUME_VAZIO as VOL_VAZIO,
  FRETE_STATE_INICIAL as STATE_INIT,
  FRETE_PROPRIO_COMPONENTES as COMP_DEFAULTS,
} from '../../types/frete'
import {
  calcularTotaisVolumes, cotarFreteExterno, calcularFreteProprio,
  recomendarOpcao, salvarCotacao, carregarFrete, salvarVolumes,
  selecionarOpcaoDB, carregarParametros, salvarParametro,
  calcularDistanciaKm, type DistanciaResult,
} from '../../lib/frete'
import css from './FreteSection.module.css'

// ── Reducer ──────────────────────────────────────────────────────────────────

function freteReducer(state: FreteState, action: FreteAction): FreteState {
  switch (action.type) {
    case 'SET_TIPO':
      return { ...state, tipo: action.payload, dirty: true }
    case 'SET_MODALIDADE':
      return { ...state, modalidade: action.payload, dirty: true }
    case 'ADD_VOLUME':
      return { ...state, volumes: [...state.volumes, { ...VOL_VAZIO, ordem: state.volumes.length }], dirty: true }
    case 'REMOVE_VOLUME':
      return { ...state, volumes: state.volumes.filter((_, i) => i !== action.payload), dirty: true }
    case 'UPDATE_VOLUME':
      return {
        ...state, dirty: true,
        volumes: state.volumes.map((v, i) => i === action.payload.index ? { ...v, ...action.payload.vol } : v),
      }
    case 'COTACAO_START':
      return { ...state, cotando: action.payload }
    case 'COTACAO_OK': {
      const novasCotacoes = [...state.cotacoes, action.payload.cotacao]
      const novasOpcoes = [...state.opcoes, ...action.payload.opcoes]
      const rec = recomendarOpcao(novasOpcoes)
      return { ...state, cotacoes: novasCotacoes, opcoes: novasOpcoes, recomendacao: rec, cotando: null, dirty: true }
    }
    case 'COTACAO_ERRO':
      return { ...state, cotando: null }
    case 'SELECIONAR_OPCAO': {
      const opcoes = state.opcoes.map(o => ({ ...o, selecionada: o === action.payload || (o.id != null && o.id === action.payload.id) }))
      return { ...state, opcoes, opcaoSelecionada: action.payload, dirty: true }
    }
    case 'SET_PRECO_VENDA': {
      const opcoes = [...state.opcoes]
      const op = { ...opcoes[action.payload.opcaoIdx] }
      op.preco_venda = action.payload.valor
      op.margem_pct = op.custo > 0 ? Math.round((op.preco_venda - op.custo) / op.custo * 10000) / 100 : 0
      opcoes[action.payload.opcaoIdx] = op
      const rec = recomendarOpcao(opcoes)
      const sel = state.opcaoSelecionada?.id === op.id ? op : state.opcaoSelecionada
      return { ...state, opcoes, recomendacao: rec, opcaoSelecionada: sel, dirty: true }
    }
    case 'SET_PROPRIO_COMPONENTE': {
      const comps = [...state.proprioComponentes]
      comps[action.payload.idx] = { ...comps[action.payload.idx], valor: action.payload.valor, formula: action.payload.formula }
      return { ...state, proprioComponentes: comps, dirty: true }
    }
    case 'SET_PROPRIO_DISTANCIA':
      return { ...state, proprioDistanciaKm: action.payload, dirty: true }
    case 'SET_PROPRIO_DIAS':
      return { ...state, proprioDias: action.payload, dirty: true }
    case 'LOAD':
      return { ...state, ...action.payload, dirty: false }
    case 'RESET':
      return { ...STATE_INIT, parametros: state.parametros }
    default:
      return state
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

interface FreteSectionProps {
  orcamentoId: number | null
  cepOrigem: string
  cepDestino: string
  valorMercadoria: number
  parentStyles: Record<string, string>
  onFreteChange: (summary: FreteSummary) => void
  usuario: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

const FRETE_TIPOS: Record<string, string> = {
  '': 'Sem frete',
  'CIF': 'CIF — Por conta do fornecedor',
  'FOB': 'FOB — Por conta do comprador',
  'retirada': 'Retirada na fábrica',
  'cliente': 'Por conta do cliente',
  'a_combinar': 'A combinar',
}

// ── Marker icons ─────────────────────────────────────────────────────────────

const markerIcon = (color: string) => L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const ICON_ORIG = markerIcon('#1a5fa8')
const ICON_DEST = markerIcon('#dc2626')

// ── Map fit helper ───────────────────────────────────────────────────────────

function RotaFit({ coords, origem, destino }: { coords: [number, number][]; origem: { lat: number; lon: number }; destino: { lat: number; lon: number } }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length > 1) {
      const bounds = L.latLngBounds(coords.map(c => L.latLng(c[0], c[1])))
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [coords, map])

  return (
    <>
      <Polyline positions={coords} pathOptions={{ color: '#1a5fa8', weight: 3, opacity: 0.8 }} />
      <Marker position={[origem.lat, origem.lon]} icon={ICON_ORIG} />
      <Marker position={[destino.lat, destino.lon]} icon={ICON_DEST} />
    </>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FreteSection({
  orcamentoId, cepOrigem, cepDestino, valorMercadoria,
  parentStyles, onFreteChange, usuario,
}: FreteSectionProps) {
  const [state, dispatch] = useReducer(freteReducer, STATE_INIT)
  const loaded = useRef(false)
  const [showConfig, setShowConfig] = useState(false)
  const [salvandoParam, setSalvandoParam] = useState<string | null>(null)
  const [calculandoDistancia, setCalculandoDistancia] = useState(false)
  const [rotaData, setRotaData] = useState<DistanciaResult | null>(null)
  const [mapaExpandido, setMapaExpandido] = useState(false)
  const distanciaCache = useRef<Record<string, DistanciaResult>>({})

  const handleSalvarParametro = useCallback(async (chave: string, valor: number) => {
    setSalvandoParam(chave)
    try {
      await salvarParametro(chave, valor, usuario)
      dispatch({
        type: 'LOAD',
        payload: { parametros: state.parametros.map(p => p.chave === chave ? { ...p, valor } : p) },
      })
    } finally {
      setSalvandoParam(null)
    }
  }, [state.parametros, usuario])

  // Carregar parâmetros na montagem
  useEffect(() => {
    carregarParametros().then(params => {
      dispatch({ type: 'LOAD', payload: { parametros: params } })
    })
  }, [])

  // Auto-calcular distância quando CEPs mudam
  useEffect(() => {
    const origLimpo = cepOrigem.replace(/\D/g, '')
    const destLimpo = cepDestino.replace(/\D/g, '')
    if (origLimpo.length < 8 || destLimpo.length < 8) { setRotaData(null); return }
    const cacheKey = `${origLimpo}-${destLimpo}`
    if (distanciaCache.current[cacheKey]) {
      const cached = distanciaCache.current[cacheKey]
      setRotaData(cached)
      if (state.proprioDistanciaKm === 0) {
        dispatch({ type: 'SET_PROPRIO_DISTANCIA', payload: cached.distancia_km })
        if (state.proprioDias <= 1) {
          dispatch({ type: 'SET_PROPRIO_DIAS', payload: Math.max(1, Math.ceil(cached.duracao_horas / 8)) })
        }
      }
      return
    }
    setCalculandoDistancia(true)
    calcularDistanciaKm(origLimpo, destLimpo).then(result => {
      if (result) {
        distanciaCache.current[cacheKey] = result
        setRotaData(result)
        dispatch({ type: 'SET_PROPRIO_DISTANCIA', payload: result.distancia_km })
        const diasEstimados = Math.max(1, Math.ceil(result.duracao_horas / 8))
        if (state.proprioDias <= 1) {
          dispatch({ type: 'SET_PROPRIO_DIAS', payload: diasEstimados })
        }
      }
    }).finally(() => setCalculandoDistancia(false))
  }, [cepOrigem, cepDestino])

  // Carregar dados quando orcamentoId muda
  useEffect(() => {
    if (!orcamentoId) {
      if (loaded.current) dispatch({ type: 'RESET' })
      loaded.current = true
      return
    }
    carregarFrete(orcamentoId).then(({ volumes, cotacoes, opcoes }) => {
      const sel = opcoes.find(o => o.selecionada) || null
      const rec = recomendarOpcao(opcoes)
      dispatch({ type: 'LOAD', payload: { volumes, cotacoes, opcoes, opcaoSelecionada: sel, recomendacao: rec } })
      loaded.current = true
    })
  }, [orcamentoId])

  // Notificar o pai quando muda a seleção
  useEffect(() => {
    const totais = calcularTotaisVolumes(state.volumes)
    const sel = state.opcaoSelecionada
    onFreteChange({
      tipo: state.tipo,
      modalidade: state.modalidade,
      valor: sel?.preco_venda ?? 0,
      custo: sel?.custo ?? 0,
      prazo: sel?.prazo_texto ?? '',
      prazo_dias: sel?.prazo_dias ?? null,
      provedor: sel?.provedor ?? '',
      servico: sel?.servico ?? '',
      opcao_id: sel?.id ?? null,
      obs: sel?.obs ?? '',
      peso_total_kg: totais.peso_real,
      volumes_qtd: totais.qtd_total,
    })
  }, [state.opcaoSelecionada, state.tipo, state.modalidade, state.volumes])

  // ── Handlers ──

  const handleCotar = useCallback(async () => {
    if (!cepDestino || cepDestino.replace(/\D/g, '').length < 8) return
    dispatch({ type: 'COTACAO_START', payload: 'correios' })
    try {
      const { cotacao, opcoes } = await cotarFreteExterno(cepDestino, state.volumes, valorMercadoria, usuario)
      if (orcamentoId && opcoes.length) {
        const result = await salvarCotacao(orcamentoId, cotacao, opcoes)
        const opcoesComId = opcoes.map((o, i) => ({ ...o, id: result.opcoes_inseridas[i]?.id, cotacao_id: result.cotacao_id }))
        dispatch({ type: 'COTACAO_OK', payload: { cotacao: { ...cotacao, id: result.cotacao_id }, opcoes: opcoesComId } })
      } else {
        dispatch({ type: 'COTACAO_OK', payload: { cotacao, opcoes } })
      }
    } catch (err) {
      dispatch({ type: 'COTACAO_ERRO', payload: (err as Error).message })
    }
  }, [cepDestino, state.volumes, valorMercadoria, orcamentoId, usuario])

  const handleCalcularProprio = useCallback(() => {
    dispatch({ type: 'COTACAO_START', payload: 'proprio' })
    const opcao = calcularFreteProprio(
      state.proprioComponentes, state.proprioDistanciaKm, state.proprioDias,
      valorMercadoria, state.parametros,
    )
    const cotacao = {
      provedor: 'proprio' as const,
      cep_origem: cepOrigem,
      cep_destino: cepDestino,
      peso_total_kg: calcularTotaisVolumes(state.volumes).peso_real,
      peso_cubado_kg: calcularTotaisVolumes(state.volumes).peso_cubado,
      peso_taxado_kg: calcularTotaisVolumes(state.volumes).peso_taxado,
      valor_mercadoria: valorMercadoria,
      sucesso: true,
      erro: null,
      cotado_em: new Date().toISOString(),
      cotado_por: usuario,
      valido_ate: null,
      opcoes: [opcao],
    }
    dispatch({ type: 'COTACAO_OK', payload: { cotacao, opcoes: [opcao] } })
  }, [state.proprioComponentes, state.proprioDistanciaKm, state.proprioDias, valorMercadoria, state.parametros, cepOrigem, cepDestino, state.volumes, usuario])

  const handleSelecionar = useCallback(async (opcao: FreteOpcao) => {
    dispatch({ type: 'SELECIONAR_OPCAO', payload: opcao })
    if (opcao.id && orcamentoId) {
      await selecionarOpcaoDB(opcao.id, orcamentoId)
    }
  }, [orcamentoId])

  // Salvar volumes quando dirty e tem orcamentoId
  const handleSalvarVolumes = useCallback(async () => {
    if (orcamentoId && state.dirty) {
      await salvarVolumes(orcamentoId, state.volumes)
    }
  }, [orcamentoId, state.volumes, state.dirty])

  // Expor salvarVolumes via ref ou chamar no save do pai
  useEffect(() => {
    // Auto-save volumes on blur (debounced via dirty flag)
    if (!state.dirty || !orcamentoId) return
    const t = setTimeout(() => { salvarVolumes(orcamentoId, state.volumes) }, 2000)
    return () => clearTimeout(t)
  }, [state.volumes, state.dirty, orcamentoId])

  const totais = calcularTotaisVolumes(state.volumes)
  const badges = getBadges(state.opcoes, state.recomendacao)

  return (
    <div className={parentStyles.section}>
      <div className={parentStyles.sectionTitle}>Frete e Logística</div>
      <div className={css.freteWrap}>

        {/* Tipo + Modalidade */}
        <div className={css.freteHeader}>
          <div className={css.freteHeaderField}>
            <label>Tipo de frete</label>
            <select value={state.tipo} onChange={e => dispatch({ type: 'SET_TIPO', payload: e.target.value as FreteTipo })}>
              {Object.entries(FRETE_TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className={css.freteHeaderField}>
            <label>Modalidade comercial</label>
            <select value={state.modalidade} onChange={e => dispatch({ type: 'SET_MODALIDADE', payload: e.target.value as FreteModalidade })}>
              <option value="cobrar">Cobrar do cliente</option>
              <option value="bonus">Bonificação (absorver)</option>
            </select>
          </div>
        </div>

        {state.tipo && state.tipo !== 'retirada' && (
          <>
            {/* Volumes */}
            <div className={css.volumesWrap}>
              <div className={css.comparativoTitle}>Volumes / Embalagens</div>
              {state.volumes.map((vol, i) => (
                <div key={i} className={css.volumeRow}>
                  <div className={css.volumeField}>
                    <label>Descrição</label>
                    <input value={vol.descricao} placeholder={`Volume ${i + 1}`}
                      onChange={e => dispatch({ type: 'UPDATE_VOLUME', payload: { index: i, vol: { descricao: e.target.value } } })} />
                  </div>
                  <div className={css.volumeField}>
                    <label>Peso (kg)</label>
                    <input type="number" step="0.1" value={vol.peso_kg || ''}
                      onChange={e => dispatch({ type: 'UPDATE_VOLUME', payload: { index: i, vol: { peso_kg: parseFloat(e.target.value) || 0 } } })} />
                  </div>
                  <div className={css.volumeField}>
                    <label>C (cm)</label>
                    <input type="number" value={vol.comprimento_cm || ''}
                      onChange={e => dispatch({ type: 'UPDATE_VOLUME', payload: { index: i, vol: { comprimento_cm: parseFloat(e.target.value) || 0 } } })} />
                  </div>
                  <div className={css.volumeField}>
                    <label>L (cm)</label>
                    <input type="number" value={vol.largura_cm || ''}
                      onChange={e => dispatch({ type: 'UPDATE_VOLUME', payload: { index: i, vol: { largura_cm: parseFloat(e.target.value) || 0 } } })} />
                  </div>
                  <div className={css.volumeField}>
                    <label>A (cm)</label>
                    <input type="number" value={vol.altura_cm || ''}
                      onChange={e => dispatch({ type: 'UPDATE_VOLUME', payload: { index: i, vol: { altura_cm: parseFloat(e.target.value) || 0 } } })} />
                  </div>
                  <button className={css.volumeRemove} onClick={() => dispatch({ type: 'REMOVE_VOLUME', payload: i })} title="Remover">✕</button>
                </div>
              ))}
              <button className={css.btnAddVolume} onClick={() => dispatch({ type: 'ADD_VOLUME' })}>+ Adicionar volume</button>

              {state.volumes.length > 0 && (
                <div className={css.volumeTotais}>
                  <span>Volumes: <strong>{totais.qtd_total}</strong></span>
                  <span>Peso real: <strong>{totais.peso_real.toFixed(1)} kg</strong></span>
                  <span>Peso cubado: <strong>{totais.peso_cubado.toFixed(1)} kg</strong></span>
                  <span>Peso taxado: <strong>{totais.peso_taxado.toFixed(1)} kg</strong></span>
                </div>
              )}
            </div>

            {/* Alertas */}
            {!cepDestino && (
              <div className={`${css.alerta} ${css.alertaWarning}`}>
                Preencha o CEP do cliente para cotar frete.
              </div>
            )}

            {/* Rota e ações de cotação */}
            {cepDestino && cepDestino.replace(/\D/g, '').length >= 8 && (
              <>
                <div className={css.rotaInfo}>
                  <span>Origem: <strong>{cepOrigem}</strong></span>
                  <span>→</span>
                  <span>Destino: <strong>{cepDestino}</strong></span>
                  {calculandoDistancia && <span className={css.configSaving}>calculando rota...</span>}
                  {!calculandoDistancia && state.proprioDistanciaKm > 0 && (
                    <span className={css.rotaDistancia}>
                      {state.proprioDistanciaKm} km
                      {rotaData ? ` (~${rotaData.duracao_horas}h)` : ''}
                    </span>
                  )}
                </div>

                {/* Mapa da rota */}
                {rotaData && rotaData.rota_coords.length > 0 && (
                  <div className={`${css.mapaWrap} ${mapaExpandido ? css.mapaExpandido : ''}`}>
                    <button className={css.btnExpandirMapa} onClick={() => setMapaExpandido(v => !v)}>
                      {mapaExpandido ? '✕ Fechar' : '⛶ Ampliar'}
                    </button>
                    <MapContainer
                      key={mapaExpandido ? 'expanded' : 'compact'}
                      style={{ height: '100%', width: '100%', borderRadius: mapaExpandido ? 0 : 8 }}
                      scrollWheelZoom={mapaExpandido}
                      zoomControl={true}
                      attributionControl={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <RotaFit coords={rotaData.rota_coords} origem={rotaData.origem} destino={rotaData.destino} />
                    </MapContainer>
                  </div>
                )}

                <div className={css.cotacaoActions}>
                  <button className={css.btnCotar} onClick={handleCotar}
                    disabled={state.cotando === 'correios'}>
                    {state.cotando === 'correios' ? 'Cotando...' : 'Cotar Correios + Braspress'}
                  </button>
                  <button className={`${css.btnCotar} ${css.btnCotarProprio}`} onClick={handleCalcularProprio}
                    disabled={state.cotando === 'proprio'}>
                    Calcular Frete Próprio
                  </button>
                </div>
              </>
            )}

            {/* Frete Próprio — Parâmetros */}
            {state.opcoes.some(o => o.provedor === 'proprio') && (
              <div className={css.proprioWrap}>
                <div className={css.comparativoTitle}>Memória de Cálculo — Frete Próprio</div>
                <div className={css.proprioParams}>
                  <div className={css.volumeField}>
                    <label>Distância (km) {calculandoDistancia && <span className={css.configSaving}>calculando...</span>}</label>
                    <input type="number" value={state.proprioDistanciaKm || ''}
                      onChange={e => dispatch({ type: 'SET_PROPRIO_DISTANCIA', payload: parseFloat(e.target.value) || 0 })} />
                    {state.proprioDistanciaKm > 0 && !calculandoDistancia && (
                      <span className={css.proprioFormula}>via rota rodoviária</span>
                    )}
                  </div>
                  <div className={css.volumeField}>
                    <label>Dias de viagem</label>
                    <input type="number" value={state.proprioDias || ''}
                      onChange={e => dispatch({ type: 'SET_PROPRIO_DIAS', payload: parseInt(e.target.value) || 1 })} />
                    {(() => {
                      const key = `${cepOrigem.replace(/\D/g, '')}-${cepDestino.replace(/\D/g, '')}`
                      const cached = distanciaCache.current[key]
                      return cached ? <span className={css.proprioFormula}>~{cached.horas}h de viagem</span> : null
                    })()}
                  </div>
                </div>
                {(() => {
                  const proprio = state.opcoes.filter(o => o.provedor === 'proprio').pop()
                  const comps = proprio?.componentes_json || state.proprioComponentes
                  return (
                    <>
                      {comps.map((c, i) => (
                        <div key={c.chave} className={css.proprioRow}>
                          <span className={css.proprioLabel}>{c.label}</span>
                          <input className={css.proprioValor} type="number" step="0.01"
                            value={c.valor || ''}
                            onChange={e => dispatch({
                              type: 'SET_PROPRIO_COMPONENTE',
                              payload: { idx: i, valor: parseFloat(e.target.value) || 0, formula: 'manual' },
                            })} />
                          <span className={css.proprioFormula}>{c.formula}</span>
                        </div>
                      ))}
                      {proprio && (
                        <div className={css.proprioTotal}>
                          <span>Custo total: {fmtBRL(proprio.custo)}</span>
                          <span className={css.proprioTotalVenda}>Venda: {fmtBRL(proprio.preco_venda)}</span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* Comparativo */}
            {state.opcoes.length > 0 && (
              <div className={css.comparativoWrap}>
                <div className={css.comparativoTitle}>
                  Comparativo de opções ({state.opcoes.length})
                  {state.recomendacao?.motivo && (
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 8, fontSize: '0.78rem', color: '#16a34a' }}>
                      {state.recomendacao.motivo}
                    </span>
                  )}
                </div>

                {/* Cards mobile */}
                <div className={css.comparativoCards}>
                  {state.opcoes.map((op, i) => {
                    const b = badges.get(op)
                    return (
                      <div key={op.id ?? i}
                        className={`${css.opcaoCard} ${op.selecionada ? css.opcaoCardSelecionada : ''} ${b?.includes('Recomendada') ? css.opcaoCardRecomendada : ''}`}
                        onClick={() => handleSelecionar(op)}>
                        <div className={css.opcaoCardTopo}>
                          <div>
                            <span className={css.opcaoProvedor}>{op.provedor === 'proprio' ? 'Próprio' : op.provedor === 'correios' ? 'Correios' : 'Braspress'}</span>
                            <span className={css.opcaoServico}> — {op.servico}</span>
                          </div>
                          <span className={css.opcaoPreco}>{fmtBRL(op.preco_venda)}</span>
                        </div>
                        <div className={css.opcaoMeta}>
                          {op.prazo_texto && <span className={css.opcaoPrazo}>{op.prazo_texto}</span>}
                          <span className={css.opcaoCusto}>Custo: {fmtBRL(op.custo)}</span>
                          <span className={`${css.opcaoMargem} ${op.margem_pct >= 0 ? css.margemPositiva : css.margemNegativa}`}>
                            {fmtPct(op.margem_pct)}
                          </span>
                          {b?.map(label => (
                            <span key={label} className={`${css.badge} ${badgeClass(label)}`}>{label}</span>
                          ))}
                          {op.selecionada && <span className={`${css.badge} ${css.badgeSelecionada}`}>Selecionada</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Tabela desktop */}
                <table className={css.comparativoTable}>
                  <thead>
                    <tr>
                      <th>Provedor</th>
                      <th>Serviço</th>
                      <th>Prazo</th>
                      <th style={{ textAlign: 'right' }}>Custo</th>
                      <th style={{ textAlign: 'right' }}>Venda</th>
                      <th style={{ textAlign: 'right' }}>Margem</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.opcoes.map((op, i) => {
                      const b = badges.get(op)
                      const isRec = b?.includes('Recomendada')
                      return (
                        <tr key={op.id ?? i}
                          className={`${op.selecionada ? css.trSelecionada : ''} ${isRec ? css.trRecomendada : ''}`}
                          onClick={() => handleSelecionar(op)}>
                          <td>{op.provedor === 'proprio' ? 'Próprio' : op.provedor === 'correios' ? 'Correios' : 'Braspress'}</td>
                          <td>{op.servico}</td>
                          <td>{op.prazo_texto || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{fmtBRL(op.custo)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input className={css.inputPrecoVenda}
                              type="number" step="0.01"
                              value={op.preco_venda || ''}
                              onClick={e => e.stopPropagation()}
                              onChange={e => dispatch({ type: 'SET_PRECO_VENDA', payload: { opcaoIdx: i, valor: parseFloat(e.target.value) || 0 } })} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={op.margem_pct >= 0 ? css.margemPositiva : css.margemNegativa}>
                              {fmtPct(op.margem_pct)}
                            </span>
                          </td>
                          <td>
                            {b?.map(label => (
                              <span key={label} className={`${css.badge} ${badgeClass(label)}`} style={{ marginRight: 4 }}>{label}</span>
                            ))}
                            {op.selecionada && <span className={`${css.badge} ${css.badgeSelecionada}`}>Selecionada</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Resumo da opção selecionada */}
            {state.opcaoSelecionada && (
              <div className={css.resumoWrap}>
                <div className={css.resumoTitle}>Frete selecionado</div>
                <div className={css.resumoGrid}>
                  <span>Provedor: <strong>{state.opcaoSelecionada.servico}</strong></span>
                  <span>Prazo: <strong>{state.opcaoSelecionada.prazo_texto || '—'}</strong></span>
                  <span>Custo: <strong>{fmtBRL(state.opcaoSelecionada.custo)}</strong></span>
                  <span>Venda: <strong>{fmtBRL(state.opcaoSelecionada.preco_venda)}</strong></span>
                  <span>Margem: <strong className={state.opcaoSelecionada.margem_pct >= 0 ? css.margemPositiva : css.margemNegativa}>
                    {fmtPct(state.opcaoSelecionada.margem_pct)}
                  </strong></span>
                  <span>Tipo: <strong>{FRETE_TIPOS[state.tipo] || 'Sem frete'}</strong></span>
                </div>
                {state.modalidade === 'bonus' && (
                  <div className={`${css.alerta} ${css.alertaInfo}`}>
                    Frete bonificado — não será cobrado do cliente.
                  </div>
                )}
                {state.tipo === 'FOB' && (
                  <div className={`${css.alerta} ${css.alertaInfo}`}>
                    FOB — frete informativo, não incluído no total do orçamento.
                  </div>
                )}
              </div>
            )}

            {/* Configuração de parâmetros */}
            <div className={css.configToggle}>
              <button className={css.btnConfig} onClick={() => setShowConfig(v => !v)}>
                {showConfig ? '✕ Fechar configuração' : '⚙ Parâmetros de frete próprio'}
              </button>
            </div>

            {showConfig && (
              <div className={css.configWrap}>
                <div className={css.comparativoTitle}>Parâmetros padrão da empresa</div>
                <p className={css.configDesc}>
                  Estes valores são usados como base para o cálculo automático do frete próprio. Alterações são salvas imediatamente e valem para todos os orçamentos futuros.
                </p>
                <div className={css.configGrid}>
                  {state.parametros.map(p => (
                    <div key={p.chave} className={css.configRow}>
                      <div className={css.configLabel}>
                        <strong>{p.descricao || p.chave}</strong>
                        <span className={css.configUnidade}>{p.unidade}</span>
                      </div>
                      <div className={css.configInputWrap}>
                        <input
                          className={css.configInput}
                          type="number" step="0.01"
                          value={p.valor}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0
                            dispatch({
                              type: 'LOAD',
                              payload: { parametros: state.parametros.map(x => x.chave === p.chave ? { ...x, valor: v } : x) },
                            })
                          }}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0
                            if (v !== p.valor) handleSalvarParametro(p.chave, v)
                          }}
                        />
                        {salvandoParam === p.chave && <span className={css.configSaving}>Salvando...</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observação logística */}
            <div className={css.freteHeaderField}>
              <label>Observação logística</label>
              <textarea className={css.obsInput}
                value={state.opcaoSelecionada?.obs ?? ''}
                placeholder="Observações sobre o frete..."
                onChange={e => {
                  if (state.opcaoSelecionada) {
                    const updated = { ...state.opcaoSelecionada, obs: e.target.value }
                    dispatch({ type: 'SELECIONAR_OPCAO', payload: updated })
                  }
                }} />
            </div>
          </>
        )}
      </div>
    </div>
  )

  function badgeClass(label: string): string {
    if (label === 'Recomendada') return css.badgeRecomendada
    if (label === 'Menor preço') return css.badgeMelhorPreco
    if (label === 'Menor prazo') return css.badgeMelhorPrazo
    if (label === 'Melhor margem') return css.badgeMelhorMargem
    return ''
  }
}

// ── Badge mapping ────────────────────────────────────────────────────────────

function getBadges(opcoes: FreteOpcao[], rec: FreteState['recomendacao']): Map<FreteOpcao, string[]> {
  const map = new Map<FreteOpcao, string[]>()
  if (!rec) return map

  for (const op of opcoes) {
    const labels: string[] = []
    if (rec.recomendada && sameOp(op, rec.recomendada)) labels.push('Recomendada')
    if (rec.melhor_preco && sameOp(op, rec.melhor_preco)) labels.push('Menor preço')
    if (rec.melhor_prazo && sameOp(op, rec.melhor_prazo)) labels.push('Menor prazo')
    if (rec.melhor_margem && sameOp(op, rec.melhor_margem)) labels.push('Melhor margem')
    if (labels.length) map.set(op, labels)
  }
  return map
}

function sameOp(a: FreteOpcao, b: FreteOpcao): boolean {
  if (a.id != null && b.id != null) return a.id === b.id
  return a.provedor === b.provedor && a.codigo === b.codigo && a.custo === b.custo
}
