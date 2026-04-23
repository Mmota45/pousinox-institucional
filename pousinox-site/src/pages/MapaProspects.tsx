import { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// leaflet.heat precisa de L como global
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).L = L
}

// Carrega uma vez
const heatReady = import('leaflet.heat').then(() => true)

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
const CANVAS_RENDERER = L.canvas({ padding: 0.5 })

function corVolume(km: number) {
  if (km <= 150) return '#16a34a'
  if (km <= 500) return '#d97706'
  return '#dc2626'
}

function corConversao(d: CidadeConversao): string {
  if (d.vendas > 0) return '#16a34a'
  if (d.interessados > 0 || d.orcamentos > 0) return '#d97706'
  return '#dc2626'
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

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const layerGroup = useRef<L.LayerGroup | null>(null)
  const raioGroup = useRef<L.LayerGroup | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  // Fecha com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setFullscreen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Inicializa o mapa UMA VEZ
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, {
      center: POUSO_ALEGRE,
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    // Pouso Alegre — fixo
    L.circleMarker(POUSO_ALEGRE, {
      radius: 9, color: '#1e3a5f', fillColor: '#1e3a5f', fillOpacity: 1, weight: 2,
      renderer: CANVAS_RENDERER,
    }).addTo(map).bindPopup('<b>Pouso Alegre/MG</b><br>Origem Pousinox')

    layerGroup.current = L.layerGroup().addTo(map)
    raioGroup.current = L.layerGroup().addTo(map)
    mapInstance.current = map

    return () => { map.remove(); mapInstance.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resize ao fullscreen
  useEffect(() => {
    setTimeout(() => mapInstance.current?.invalidateSize(), 50)
  }, [fullscreen])

  // Atualiza círculos de raio (layer separada)
  useEffect(() => {
    const rg = raioGroup.current
    if (!rg) return
    rg.clearLayers()

    if (raioKm && raioKm > 0) {
      L.circle(POUSO_ALEGRE, {
        radius: raioKm * 1000, color: '#1e3a5f', fillColor: '#1e3a5f',
        fillOpacity: 0.04, weight: 2, dashArray: '6 5',
      }).addTo(rg).bindPopup(`Raio definido: ${raioKm} km`)
    } else {
      ;[150, 300, 500].forEach(km => {
        L.circle(POUSO_ALEGRE, {
          radius: km * 1000, color: '#475569', fillOpacity: 0, weight: 1.5, dashArray: '6 5',
        }).addTo(rg).bindPopup(`${km} km de Pouso Alegre`)
      })
    }
  }, [raioKm])

  // Atualiza markers (só limpa a layerGroup, não o mapa inteiro)
  useEffect(() => {
    const map = mapInstance.current
    const lg = layerGroup.current
    if (!map || !lg) return

    lg.clearLayers()
    const markers: L.CircleMarker[] = []

    if (modo === 'volume') {
      const vol = dados as CidadeMapa[]
      vol.forEach(d => {
        const color = corVolume(d.distancia_km ?? 9999)
        const radius = Math.max(3, Math.min(10, Math.log10(d.total + 1) * 3))
        const m = L.circleMarker([d.lat, d.lng], {
          radius, color, fillColor: color, fillOpacity: 0.65, weight: 1,
          renderer: CANVAS_RENDERER,
        }).addTo(lg).bindPopup(
          `<b>${d.cidade}/${d.uf}</b><br>` +
          `${d.total.toLocaleString('pt-BR')} prospects<br>` +
          `${d.distancia_km != null ? d.distancia_km + ' km de Pouso Alegre' : ''}`
        )
        markers.push(m)
      })

      if (clientesConsolidados) {
        clientesConsolidados
          .filter(c => c.lat != null && c.lng != null)
          .forEach(c => {
            L.circleMarker([c.lat as number, c.lng as number], {
              radius: 10, color: '#1d4ed8', fillColor: '#1d4ed8',
              fillOpacity: 0.25, weight: 2.5,
              renderer: CANVAS_RENDERER,
            }).addTo(lg).bindPopup(
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

      heatReady.then(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Lany = L as any
        if (typeof Lany.heatLayer === 'function') {
          Lany.heatLayer(points, {
            radius: 28, blur: 18, maxZoom: 9, max: 1.0,
            gradient: { 0.05: '#818cf8', 0.2: '#38bdf8', 0.4: '#34d399', 0.6: '#fbbf24', 0.8: '#f97316', 1.0: '#ef4444' },
          }).addTo(lg)
        }
      })

      vol.forEach(d => {
        const m = L.circleMarker([d.lat, d.lng], {
          radius: 8, color: 'transparent', fillColor: '#fff', fillOpacity: 0, weight: 0,
          renderer: CANVAS_RENDERER,
        }).addTo(lg).bindPopup(
          `<b>${d.cidade}/${d.uf}</b><br>` +
          `👥 ${d.total.toLocaleString('pt-BR')} prospects<br>` +
          `📍 ${d.distancia_km != null ? d.distancia_km + ' km de Pouso Alegre' : ''}`
        )
        m.on('mouseover', () => m.setStyle({ fillOpacity: 0.5, weight: 1.5, color: '#fff' }))
        m.on('mouseout',  () => m.setStyle({ fillOpacity: 0, weight: 0, color: 'transparent' }))
        markers.push(m)
      })
    } else {
      const conv = dados as CidadeConversao[]
      conv.forEach(d => {
        const color = corConversao(d)
        const radius = Math.max(4, Math.min(14, Math.log10(d.total + 1) * 4))
        const opacity = d.vendas > 0 ? 0.9 : d.interessados > 0 ? 0.75 : 0.55
        const m = L.circleMarker([d.lat, d.lng], {
          radius, color, fillColor: color, fillOpacity: opacity,
          weight: d.vendas > 0 ? 2 : 1,
          renderer: CANVAS_RENDERER,
        }).addTo(lg).bindPopup(popupConversao(d))
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, modo, clientesConsolidados])

  // Legenda memoizada
  const legenda = useMemo(() => {
    if (modo === 'calor') return (
      <>
        <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>Densidade:</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 72, height: 8, borderRadius: 4, background: 'linear-gradient(to right, #818cf8, #38bdf8, #34d399, #fbbf24, #f97316, #ef4444)' }} />
          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>baixa → alta</span>
        </span>
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.72rem' }}>{dados.length} cidades</span>
      </>
    )
    if (modo === 'conversao') return (
      <>
        <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>Resultado:</span>
        <span style={{ fontSize: '0.78rem' }}><span style={{ color: '#16a34a' }}>●</span> Venda</span>
        <span style={{ fontSize: '0.78rem' }}><span style={{ color: '#d97706' }}>●</span> Quente</span>
        <span style={{ fontSize: '0.78rem' }}><span style={{ color: '#dc2626' }}>●</span> Contatado</span>
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.72rem' }}>{dados.length} cidades</span>
      </>
    )
    return (
      <>
        <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>Distância:</span>
        <span style={{ fontSize: '0.78rem' }}><span style={{ color: '#16a34a' }}>●</span> ≤150 km</span>
        <span style={{ fontSize: '0.78rem' }}><span style={{ color: '#d97706' }}>●</span> ≤500 km</span>
        <span style={{ fontSize: '0.78rem' }}><span style={{ color: '#dc2626' }}>●</span> &gt;500 km</span>
        {clientesConsolidados && clientesConsolidados.length > 0 && (
          <span style={{ fontSize: '0.78rem' }}><span style={{ color: '#1d4ed8' }}>◎</span> Cliente</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.72rem' }}>{dados.length} cidades</span>
      </>
    )
  }, [modo, dados.length, clientesConsolidados])

  const legendaBar = (
    <div style={{
      padding: '8px 14px', display: 'flex', gap: 12,
      fontSize: '0.8rem', color: '#475569', flexWrap: 'wrap',
      alignItems: 'center', background: '#fafbfc',
      borderBottom: fullscreen ? '1px solid #e8ecf1' : 'none',
      borderRadius: fullscreen ? 0 : '12px 12px 0 0',
    }}>
      {legenda}
    </div>
  )

  const mapaEl = (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.7)', borderRadius: 8,
          fontSize: '0.85rem', color: '#64748b',
        }}>
          Carregando mapa...
        </div>
      )}

      <button
        onClick={() => setFullscreen(f => !f)}
        title={fullscreen ? 'Sair (Esc)' : 'Expandir'}
        style={{
          position: 'absolute', top: fullscreen ? 16 : 8, right: fullscreen ? 16 : 8,
          zIndex: 1100, background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {fullscreen ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
            <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        )}
      </button>

      <div ref={mapRef} style={{
        width: '100%', height: '100%',
        borderRadius: fullscreen ? 0 : '0 0 12px 12px',
        border: fullscreen ? 'none' : '1px solid #e8ecf1',
        borderTop: 'none',
      }} />
    </div>
  )

  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: '#fff', display: 'flex', flexDirection: 'column',
      }}>
        {legendaBar}
        <div style={{ flex: 1, position: 'relative' }}>{mapaEl}</div>
      </div>
    )
  }

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid #e8ecf1', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      background: '#fff',
    }}>
      {legendaBar}
      <div style={{ position: 'relative', height: 500 }}>{mapaEl}</div>
    </div>
  )
}
