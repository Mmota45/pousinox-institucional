/**
 * DiagramaFixador — SVG do posicionamento dos grampos POUSINOX®
 * Extraído de CalculadoraFixador.tsx para reuso em:
 * - CalculadoraFixador (página pública)
 * - PropostaAcesso (proposta comercial)
 * - PrintEspecificacao (ficha técnica PDF)
 */

interface DiagramaFixadorProps {
  fixadoresPorPeca: number
  larguraCm: number
  alturaCm: number
  larguraFixadorMm?: number
  /** Rótulo acima do diagrama */
  label?: string
}

export default function DiagramaFixador({
  fixadoresPorPeca: n,
  larguraCm: larg_cm,
  alturaCm: alt_cm,
  larguraFixadorMm = 40,
  label = 'Posicionamento dos grampos POUSINOX®',
}: DiagramaFixadorProps) {
  if (n <= 0 || larg_cm <= 0 || alt_cm <= 0) return null

  // Escala proporcional
  const maxW = 200, maxH = 260
  const ratio = alt_cm / larg_cm
  let w = maxW, h = maxW * ratio
  if (h > maxH) { h = maxH; w = maxH / ratio }
  if (w < 60) w = 60

  const padT = 60, padB = 45, padL = 50, padR = 30
  const ox = padL
  const oy = padT
  const svgW = w + padL + padR
  const svgH = h + padT + padB + 20

  const fixLargCm = larguraFixadorMm / 10
  const minLadoParaGap5 = 2 * (5 + fixLargCm) + fixLargCm
  const gapCmX = larg_cm >= minLadoParaGap5 ? 5 : Math.max(1, (larg_cm - 2 * fixLargCm) / 3)
  const gapCmY = alt_cm >= minLadoParaGap5 ? 5 : Math.max(1, (alt_cm - 2 * fixLargCm) / 3)
  const fixLargPx = (fixLargCm / larg_cm) * w
  const margemCentroCmX = gapCmX + fixLargCm / 2
  const margemCentroCmY = gapCmY + fixLargCm / 2
  const margemPxX = (margemCentroCmX / larg_cm) * w
  const margemPxY = (margemCentroCmY / alt_cm) * h
  const entreFixCm = larg_cm - 2 * (gapCmX + fixLargCm)

  type Grampo = { x: number; y: number; borda: 'topo' | 'base' | 'esq' | 'dir' }
  const grampos: Grampo[] = []

  if (n === 1) {
    grampos.push({ x: ox + w / 2, y: oy, borda: 'topo' })
  } else if (n === 2) {
    const ladoMenor = Math.min(larg_cm, alt_cm)
    if (ladoMenor < 30) {
      grampos.push({ x: ox + w / 2, y: oy, borda: 'topo' })
      grampos.push({ x: ox + w / 2, y: oy + h, borda: 'base' })
    } else {
      grampos.push({ x: ox + margemPxX, y: oy, borda: 'topo' })
      grampos.push({ x: ox + w - margemPxX, y: oy, borda: 'topo' })
    }
  } else if (n === 3) {
    grampos.push({ x: ox + margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + w - margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + w / 2, y: oy + h, borda: 'base' })
  } else if (n === 4) {
    grampos.push({ x: ox + margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + w - margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + margemPxX, y: oy + h, borda: 'base' })
    grampos.push({ x: ox + w - margemPxX, y: oy + h, borda: 'base' })
  } else if (n === 5) {
    grampos.push({ x: ox + margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + w - margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + margemPxX, y: oy + h, borda: 'base' })
    grampos.push({ x: ox + w - margemPxX, y: oy + h, borda: 'base' })
    grampos.push({ x: ox + w, y: oy + h / 2, borda: 'dir' })
  } else if (n === 6) {
    grampos.push({ x: ox + margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + w - margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + margemPxX, y: oy + h, borda: 'base' })
    grampos.push({ x: ox + w - margemPxX, y: oy + h, borda: 'base' })
    grampos.push({ x: ox, y: oy + h / 2, borda: 'esq' })
    grampos.push({ x: ox + w, y: oy + h / 2, borda: 'dir' })
  } else {
    grampos.push({ x: ox + margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + w - margemPxX, y: oy, borda: 'topo' })
    grampos.push({ x: ox + margemPxX, y: oy + h, borda: 'base' })
    grampos.push({ x: ox + w - margemPxX, y: oy + h, borda: 'base' })
    const lateral = n - 4
    const nEsq = Math.ceil(lateral / 2)
    const nDir = lateral - nEsq
    for (let i = 0; i < nEsq; i++) {
      const y = nEsq === 1 ? oy + h / 2 : oy + margemPxY + (h - 2 * margemPxY) * i / (nEsq - 1)
      grampos.push({ x: ox, y, borda: 'esq' })
    }
    for (let i = 0; i < nDir; i++) {
      const y = nDir === 1 ? oy + h / 2 : oy + margemPxY + (h - 2 * margemPxY) * i / (nDir - 1)
      grampos.push({ x: ox + w, y, borda: 'dir' })
    }
  }

  const fmt = (cm: number) => `${cm % 1 === 0 ? cm : cm.toFixed(1)}cm`
  const corCota = '#6b7280'
  const corCotaAccent = '#1e3a5f'
  const f = 'Inter, sans-serif'
  const gramposTopo = grampos.filter(g => g.borda === 'topo')
  const g1 = gramposTopo[0]
  const g2 = gramposTopo.length >= 2 ? gramposTopo[gramposTopo.length - 1] : null

  return (
    <div style={{ textAlign: 'center', margin: '16px 0' }}>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{label}</div>
      )}
      <svg viewBox={`0 0 ${svgW} ${svgH}`} fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ maxWidth: 320, width: '100%' }}>

        {/* Peca */}
        <rect x={ox} y={oy} width={w} height={h} rx="3" fill="#f2f0ec" stroke="#c8c3b8" strokeWidth="1.5" />

        {/* Cotas acima da peca */}
        {g2 && (() => {
          const fix1Left = g1.x - fixLargPx / 2
          const fix1Right = g1.x + fixLargPx / 2
          const fix2Left = g2.x - fixLargPx / 2
          const fix2Right = g2.x + fixLargPx / 2
          const cotaY = oy - 16

          return (
            <>
              <line x1={ox} y1={oy} x2={ox} y2={cotaY - 4} stroke={corCota} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.3" />
              <line x1={fix1Left} y1={oy} x2={fix1Left} y2={cotaY - 4} stroke={corCota} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.3" />
              <line x1={fix1Right} y1={oy + 3} x2={fix1Right} y2={cotaY + 18} stroke={corCota} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.15" />
              <line x1={fix2Left} y1={oy + 3} x2={fix2Left} y2={cotaY + 18} stroke={corCota} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.15" />
              <line x1={fix2Right} y1={oy} x2={fix2Right} y2={cotaY - 4} stroke={corCota} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.3" />
              <line x1={ox + w} y1={oy} x2={ox + w} y2={cotaY - 4} stroke={corCota} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.3" />

              <line x1={ox} y1={cotaY} x2={fix1Left} y2={cotaY} stroke={corCota} strokeWidth="0.7" />
              <line x1={ox} y1={cotaY - 3} x2={ox} y2={cotaY + 3} stroke={corCota} strokeWidth="0.6" />
              <line x1={fix1Left} y1={cotaY - 3} x2={fix1Left} y2={cotaY + 3} stroke={corCota} strokeWidth="0.6" />
              <text x={(ox + fix1Left) / 2} y={cotaY - 5} textAnchor="middle" fontSize="8" fill={corCotaAccent} fontFamily={f} fontWeight="700">{fmt(gapCmX)}</text>

              <line x1={fix1Right} y1={cotaY} x2={fix2Left} y2={cotaY} stroke={corCotaAccent} strokeWidth="0.8" />
              <line x1={fix1Right} y1={cotaY - 3} x2={fix1Right} y2={cotaY + 3} stroke={corCotaAccent} strokeWidth="0.6" />
              <line x1={fix2Left} y1={cotaY - 3} x2={fix2Left} y2={cotaY + 3} stroke={corCotaAccent} strokeWidth="0.6" />
              <text x={(fix1Right + fix2Left) / 2} y={cotaY - 5} textAnchor="middle" fontSize="10" fill={corCotaAccent} fontFamily={f} fontWeight="700">{fmt(entreFixCm)}</text>

              <line x1={fix2Right} y1={cotaY} x2={ox + w} y2={cotaY} stroke={corCota} strokeWidth="0.7" />
              <line x1={fix2Right} y1={cotaY - 3} x2={fix2Right} y2={cotaY + 3} stroke={corCota} strokeWidth="0.6" />
              <line x1={ox + w} y1={cotaY - 3} x2={ox + w} y2={cotaY + 3} stroke={corCota} strokeWidth="0.6" />
              <text x={(fix2Right + ox + w) / 2} y={cotaY - 5} textAnchor="middle" fontSize="8" fill={corCotaAccent} fontFamily={f} fontWeight="700">{fmt(gapCmX)}</text>

              <line x1={fix1Left} y1={oy + 10} x2={fix1Right} y2={oy + 10} stroke="#999" strokeWidth="0.5" />
              <text x={g1.x} y={oy + 18} textAnchor="middle" fontSize="7" fill="#999" fontFamily={f}>{fmt(fixLargCm)}</text>

              <line x1={fix2Left} y1={oy + 10} x2={fix2Right} y2={oy + 10} stroke="#999" strokeWidth="0.5" />
              <text x={g2.x} y={oy + 18} textAnchor="middle" fontSize="7" fill="#999" fontFamily={f}>{fmt(fixLargCm)}</text>
            </>
          )
        })()}

        {/* Cota esquerda — altura */}
        <line x1={ox - 16} y1={oy} x2={ox - 16} y2={oy + h} stroke={corCota} strokeWidth="0.7" />
        <line x1={ox - 20} y1={oy} x2={ox - 6} y2={oy} stroke={corCota} strokeWidth="0.5" />
        <line x1={ox - 20} y1={oy + h} x2={ox - 6} y2={oy + h} stroke={corCota} strokeWidth="0.5" />
        <text x={ox - 20} y={oy + h / 2} textAnchor="middle" fontSize="10" fill="#374151" fontFamily={f} fontWeight="700" transform={`rotate(-90 ${ox - 20} ${oy + h / 2})`}>{fmt(alt_cm)}</text>

        {/* Cota inferior — largura total */}
        <line x1={ox} y1={oy + h + 16} x2={ox + w} y2={oy + h + 16} stroke={corCota} strokeWidth="0.7" />
        <line x1={ox} y1={oy + h + 6} x2={ox} y2={oy + h + 20} stroke={corCota} strokeWidth="0.5" />
        <line x1={ox + w} y1={oy + h + 6} x2={ox + w} y2={oy + h + 20} stroke={corCota} strokeWidth="0.5" />
        <text x={ox + w / 2} y={oy + h + 28} textAnchor="middle" fontSize="10" fill="#374151" fontFamily={f} fontWeight="700">{fmt(larg_cm)}</text>

        {/* Fixadores — corpo inox, 3 furos, aba */}
        {grampos.map((g, i) => {
          const fw = 6, fh = 20

          if (g.borda === 'esq' || g.borda === 'dir') {
            const bodyX = g.x - fh / 2
            const abaX = g.borda === 'esq' ? g.x - 3 : g.x
            return (
              <g key={i}>
                <rect x={bodyX} y={g.y - fw / 2} width={fh} height={fw} rx="1" fill="#d4d4d4" stroke="#999" strokeWidth="0.7" />
                <circle cx={bodyX + fh * 0.2} cy={g.y} r="1.3" fill="#888" />
                <circle cx={bodyX + fh * 0.5} cy={g.y} r="1.3" fill="#888" />
                <circle cx={bodyX + fh * 0.8} cy={g.y} r="1.3" fill="#888" />
                <rect x={abaX} y={g.y - fw / 2 - 2} width={3} height={fw + 4} rx="0.5" fill="#b0b0b0" stroke="#999" strokeWidth="0.5" />
              </g>
            )
          }

          const bodyY = g.y - fh / 2
          const abaY = g.borda === 'topo' ? g.y : g.y - 3
          return (
            <g key={i}>
              <rect x={g.x - fw / 2} y={bodyY} width={fw} height={fh} rx="1" fill="#d4d4d4" stroke="#999" strokeWidth="0.7" />
              <circle cx={g.x} cy={bodyY + fh * 0.2} r="1.3" fill="#888" />
              <circle cx={g.x} cy={bodyY + fh * 0.5} r="1.3" fill="#888" />
              <circle cx={g.x} cy={bodyY + fh * 0.8} r="1.3" fill="#888" />
              <rect x={g.x - fw / 2 - 2} y={abaY} width={fw + 4} height={3} rx="0.5" fill="#b0b0b0" stroke="#999" strokeWidth="0.5" />
            </g>
          )
        })}

        {/* Legenda */}
        <g transform={`translate(${ox}, ${oy + h + 36})`}>
          <text x="0" y="10" fontSize="8.5" fill={corCota} fontFamily={f}>{n} fixador{n > 1 ? 'es' : ''} por peca</text>
        </g>
      </svg>
    </div>
  )
}
