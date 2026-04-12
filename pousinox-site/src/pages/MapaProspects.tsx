import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// leaflet.heat é UMD e precisa de L como global para se registrar
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).L = L
}
import('leaflet.heat')

export interface CidadeMapa {
  cidade: string
  uf: string
  lat: number
  lng: number
  total: number
  distancia_km: number
}

export interface CidadeConversao {
  cidade: string
  uf: string
  lat: number
  lng: number
  total: number
  contatados: number
  interessados: number
  orcamentos: number
  vendas: number
}

export interface ClienteConsolidado {
  cidade: string
  uf: string
  count: number
  lat: number | null
  lng: number | null
}

interface PropsVolume {
  modo: 'volume'
  dados: CidadeMapa[]
  loading?: boolean
  raioKm?: number | null
  clientesConsolidados?: ClienteConsolidado[]
}

interface PropsConversao {
  modo: 'conversao'
  dados: CidadeConversao[]
  loading?: boolean
  raioKm?: number | null
}

interface PropsCalor {
  modo: 'calor'
  dados: CidadeMapa[]
  loading?: boolean
  raioKm?: number | null
  clientesConsolidados?: ClienteConsolidado[]
}

type Props = PropsVolume | PropsConversao | PropsCalor

const POUSO_ALEGRE: [number, number] = [-22.2306, -45.9381]

function corVolume(km: number) {
  if (km <= 150) return '#16a34a'
  if (km <= 500) return '#d97706'
  return '#dc2626'
}

function corConversao(d: CidadeConversao): string {
  if (d.vendas > 0)       return '#16a34a'  // verde — venda fechada
  if (d.interessados > 0 || d.orcamentos > 0) return '#d97706' // laranja — quente
  return '#dc2626'                           // vermelho — só contatado
}

function popupConversao(d: CidadeConversao) {
  const taxa = (n: number, total: number) =>
    total > 0 ? ` (${((n / total) * 100).toFixed(0)}%)` : ''
  return (
    `<b>${d.cidade}/${d.uf}</b><br>` +
    `👥 ${d.total.toLocaleString('pt-BR')} contatados<br>` +
    `🟢 ${d.interessados} interessados${taxa(d.interessados, d.total)}<br>` +
    `📄 ${d.orcamentos} orçamentos${taxa(d.orcamentos, d.total)}<br>` +
    `🏆 ${d.vendas} vendas${taxa(d.vendas, d.total)}`
  )
}

export default function MapaProspects({ dados, loading, raioKm, modo, ...rest }: Props) {
  const clientesConsolidados = modo === 'volume'
    ? (rest as PropsVolume).clientesConsolidados
    : modo === 'calor'
    ? (rest as PropsCalor).clientesConsolidados
    : undefined
  const mapRef        = useRef<HTMLDivElement>(null)
  const instanceRef   = useRef<L.Map | null>(null)
  const heatReadyRef  = useRef(false)
  const [fullscreen, setFullscreen] = useState(false)

  // Pré-carrega leaflet.heat e marca como pronto
  useEffect(() => {
    if (heatReadyRef.current) return
    import('leaflet.heat').then(() => { heatReadyRef.current = true })
  }, [])

  // Fecha com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setFullscreen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Leaflet precisa ser notificado quando o container muda de tamanho
  useEffect(() => {
    instanceRef.current?.invalidateSize()
  }, [fullscreen])

  useEffect(() => {
    if (!mapRef.current) return
    if (instanceRef.current) {
      instanceRef.current.remove()
      instanceRef.current = null
    }

    const map = L.map(mapRef.current).setView(POUSO_ALEGRE, 6)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    // Origem: Pouso Alegre
    L.circleMarker(POUSO_ALEGRE, {
      radius: 9, color: '#1e3a5f', fillColor: '#1e3a5f', fillOpacity: 1, weight: 2,
    }).addTo(map).bindPopup('<b>Pouso Alegre/MG</b><br>Origem Pousinox')

    // Círculo de raio
    if (raioKm && raioKm > 0) {
      L.circle(POUSO_ALEGRE, {
        radius: raioKm * 1000, color: '#1e3a5f', fillColor: '#1e3a5f',
        fillOpacity: 0.04, weight: 2, dashArray: '6 5',
      }).addTo(map).bindPopup(`Raio definido: ${raioKm} km`)
    } else {
      ;[150, 300, 500].forEach(km => {
        L.circle(POUSO_ALEGRE, {
          radius: km * 1000, color: '#475569', fillOpacity: 0, weight: 1.5, dashArray: '6 5',
        }).addTo(map).bindPopup(`${km} km de Pouso Alegre`)
      })
    }

    const markers: L.CircleMarker[] = []

    if (modo === 'volume') {
      const vol = dados as CidadeMapa[]
      vol.forEach(d => {
        const color  = corVolume(d.distancia_km ?? 9999)
        const radius = Math.max(3, Math.min(10, Math.log10(d.total + 1) * 3))
        const m = L.circleMarker([d.lat, d.lng], {
          radius, color, fillColor: color, fillOpacity: 0.65, weight: 1,
        }).addTo(map).bindPopup(
          `<b>${d.cidade}/${d.uf}</b><br>` +
          `${d.total.toLocaleString('pt-BR')} prospects<br>` +
          `${d.distancia_km != null ? d.distancia_km + ' km de Pouso Alegre' : ''}`
        )
        markers.push(m)
      })

      // Marcadores de clientes consolidados (anel azul por cima)
      if (clientesConsolidados) {
        clientesConsolidados
          .filter(c => c.lat != null && c.lng != null)
          .forEach(c => {
            L.circleMarker([c.lat as number, c.lng as number], {
              radius: 10,
              color: '#1d4ed8',
              fillColor: '#1d4ed8',
              fillOpacity: 0.25,
              weight: 2.5,
            }).addTo(map).bindPopup(
              `<b>${c.cidade}/${c.uf}</b><br>` +
              `🏢 <b>${c.count} ${c.count === 1 ? 'cliente consolidado' : 'clientes consolidados'}</b>`
            )
          })
      }
    } else if (modo === 'calor') {
      const vol = dados as CidadeMapa[]
      const maxTotal = Math.max(...vol.map(d => d.total), 1)
      const points = vol
        .filter(d => d.lat && d.lng)
        .map(d => [d.lat, d.lng, d.total / maxTotal] as [number, number, number])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lany = L as any
      if (typeof Lany.heatLayer !== 'function') {
        // Plugin ainda não carregou — aguarda e re-renderiza
        import('leaflet.heat').then(() => { instanceRef.current?.remove(); instanceRef.current = null })
        return
      }
      Lany.heatLayer(points, {
        radius: 35,
        blur: 25,
        maxZoom: 8,
        max: 1.0,
        gradient: { 0.1: '#3b82f6', 0.3: '#06b6d4', 0.5: '#22c55e', 0.7: '#f59e0b', 1.0: '#ef4444' },
      }).addTo(map)

      // Marcadores invisíveis só para zoom automático e popup
      vol.forEach(d => {
        const m = L.circleMarker([d.lat, d.lng], {
          radius: 6, color: 'transparent', fillColor: 'transparent', fillOpacity: 0, weight: 0,
        }).addTo(map).bindPopup(
          `<b>${d.cidade}/${d.uf}</b><br>` +
          `👥 ${d.total.toLocaleString('pt-BR')} prospects<br>` +
          `📍 ${d.distancia_km != null ? d.distancia_km + ' km de Pouso Alegre' : ''}`
        )
        markers.push(m)
      })
    } else {
      const conv = dados as CidadeConversao[]
      conv.forEach(d => {
        const color  = corConversao(d)
        // Tamanho proporcional ao total de contatados
        const radius = Math.max(4, Math.min(14, Math.log10(d.total + 1) * 4))
        // Marcadores com vendas ficam mais opacos e maiores
        const opacity = d.vendas > 0 ? 0.9 : d.interessados > 0 ? 0.75 : 0.55
        const m = L.circleMarker([d.lat, d.lng], {
          radius, color, fillColor: color, fillOpacity: opacity, weight: d.vendas > 0 ? 2 : 1,
        }).addTo(map).bindPopup(popupConversao(d))
        markers.push(m)
      })
    }

    // Zoom automático
    if (dados.length === 1) {
      map.setView([dados[0].lat, dados[0].lng], 11)
      markers[0]?.openPopup()
    } else if (dados.length > 1) {
      const group = L.featureGroup(markers)
      map.fitBounds(group.getBounds().pad(0.15))
    }

    instanceRef.current = map
    return () => { map.remove(); instanceRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, modo, clientesConsolidados])

  const legendaVolume = (
    <>
      <span style={{ fontWeight: 600 }}>Distância de Pouso Alegre:</span>
      <span><span style={{ color: '#16a34a', fontSize: '1rem' }}>●</span> até 150 km</span>
      <span><span style={{ color: '#d97706', fontSize: '1rem' }}>●</span> 150 – 500 km</span>
      <span><span style={{ color: '#dc2626', fontSize: '1rem' }}>●</span> acima de 500 km</span>
      {clientesConsolidados && clientesConsolidados.length > 0 && (
        <span><span style={{ color: '#1d4ed8', fontSize: '1rem' }}>◎</span> cliente consolidado</span>
      )}
      <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>{dados.length} cidades · tamanho = volume</span>
    </>
  )

  const legendaConversao = (
    <>
      <span style={{ fontWeight: 600 }}>Melhor resultado:</span>
      <span><span style={{ color: '#16a34a', fontSize: '1rem' }}>●</span> Venda fechada</span>
      <span><span style={{ color: '#d97706', fontSize: '1rem' }}>●</span> Interessado / Orçamento</span>
      <span><span style={{ color: '#dc2626', fontSize: '1rem' }}>●</span> Só contatado</span>
      <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>{dados.length} cidades · tamanho = nº contatados</span>
    </>
  )

  const legendaCalor = (
    <>
      <span style={{ fontWeight: 600 }}>Densidade de prospects:</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ display: 'inline-block', width: 80, height: 10, borderRadius: 4, background: 'linear-gradient(to right, #3b82f6, #06b6d4, #22c55e, #f59e0b, #ef4444)' }} />
        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>baixa → alta</span>
      </span>
      <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>{dados.length} cidades · clique para detalhes</span>
    </>
  )

  const mapaEl = (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.7)', borderRadius: 8,
          fontSize: '0.9rem', color: '#64748b',
        }}>
          Carregando mapa...
        </div>
      )}

      {/* Botão fullscreen */}
      <button
        onClick={() => setFullscreen(f => !f)}
        title={fullscreen ? 'Sair da tela cheia (Esc)' : 'Expandir mapa'}
        style={{
          position: 'absolute', top: fullscreen ? 16 : 8, right: fullscreen ? 16 : 8,
          zIndex: 1100, background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)', lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {fullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
            <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        )}
      </button>

      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: fullscreen ? 0 : 10, border: '1px solid #e2e8f0' }} />
    </div>
  )

  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: '#fff', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', gap: 16, fontSize: '0.82rem', color: '#475569',
          flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
        }}>
          {modo === 'volume' ? legendaVolume : modo === 'calor' ? legendaCalor : legendaConversao}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          {mapaEl}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ marginBottom: 10, display: 'flex', gap: 16, fontSize: '0.82rem', color: '#475569', flexWrap: 'wrap', alignItems: 'center' }}>
        {modo === 'volume' ? legendaVolume : modo === 'calor' ? legendaCalor : legendaConversao}
      </div>
      <div style={{ position: 'relative', height: 520 }}>
        {mapaEl}
      </div>
    </div>
  )
}
