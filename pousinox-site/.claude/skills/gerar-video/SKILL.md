---
description: Gerar vídeos com Remotion (React) — reels, tutoriais, motion graphics, dashboards
---

# Gerar Video

Crie vídeos profissionais usando Remotion (framework React para vídeo programático). Ideal para reels, TikToks, tutoriais, motion graphics e visualizações de dados.

## Pré-requisitos
Se Remotion ainda não estiver instalado:
```bash
npm init video -- --template=blank  # ou clonar template existente
cd my-video && npm install
```

Pacotes úteis: `@remotion/player`, `@remotion/lambda` (render na nuvem), `@remotion/gif`

## 1. Definir o vídeo
Pergunte ao usuário:
- **Tipo:** Reel/TikTok (9:16) / YouTube (16:9) / Stories (9:16) / Dashboard (16:9)?
- **Duração:** 15s / 30s / 60s / custom?
- **Conteúdo:** Produto / Tutorial / Dados / Motion graphics / Texto animado?
- **Estilo:** Minimalista / Corporativo / Dinâmico / Técnico?
- **Áudio:** Com música / Narração / Sem áudio?

## 2. Planejar cenas

### Estrutura por tipo

**Reel de produto (30s)**
```
Cena 1 (0-3s): Hook — texto grande + zoom no produto
Cena 2 (3-10s): Problema — animação do pain point
Cena 3 (10-20s): Solução — produto em ação (fotos/renders)
Cena 4 (20-27s): Prova — laudo/números animados
Cena 5 (27-30s): CTA — logo + "Link na bio"
```

**Tutorial de instalação (60s)**
```
Cena 1 (0-5s): Título + "Como instalar em 3 passos"
Cena 2 (5-20s): Passo 1 — animação/foto com texto
Cena 3 (20-40s): Passo 2 — detalhe técnico
Cena 4 (40-55s): Passo 3 — resultado final
Cena 5 (55-60s): CTA + contato
```

**Dashboard animado (15-30s)**
```
Cena 1 (0-3s): Título com build-in
Cena 2 (3-12s): Gráficos entrando um a um (counter animation)
Cena 3 (12-15s): Highlight do KPI principal
```

## 3. Gerar código Remotion

### Estrutura do projeto
```
src/
  Video.tsx          ← Composição principal (Root)
  scenes/
    Hook.tsx         ← Cena 1
    Problem.tsx      ← Cena 2
    Solution.tsx     ← Cena 3
    Proof.tsx        ← Cena 4
    CTA.tsx          ← Cena 5
  components/
    AnimatedText.tsx ← Texto com spring animation
    Counter.tsx      ← Números animando
    FadeIn.tsx       ← Wrapper de fade
  styles/
    global.css       ← Cores Pousinox (azul escuro, prata, branco)
```

### Padrões de código
```tsx
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'

// Animação suave com spring
const scale = spring({ frame, fps, config: { damping: 12 } })

// Fade in com interpolate
const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

// Texto entrando por caractere
// Counter animado (0 → 1500 em 30 frames)
// Motion blur com CSS filter
```

### Config de renderização
```tsx
// Root.tsx
export const RemotionRoot = () => (
  <Composition
    id="Reel"
    component={Video}
    durationInFrames={30 * 30} // 30s a 30fps
    fps={30}
    width={1080}
    height={1920} // 9:16 para reels
  />
)
```

## 4. Identidade visual Pousinox

```css
:root {
  --azul-escuro: #1a2332;
  --prata: #b8c4d0;
  --branco: #ffffff;
  --azul-accent: #2563eb;
  --font: 'Inter', sans-serif;
}
```

- Background: gradiente azul escuro → preto
- Textos: branco e prata
- Destaques: azul accent
- Logo: canto superior ou inferior
- Font: Inter (mesma do site)

## 5. Renderizar

```bash
# Preview no navegador
npx remotion preview

# Render MP4
npx remotion render src/index.ts Reel out/reel.mp4

# Render com qualidade alta
npx remotion render src/index.ts Reel out/reel.mp4 --codec=h264 --crf=18

# Render GIF (para previews)
npx remotion render src/index.ts Reel out/preview.gif --frames=0-60
```

## 6. Formato de entrega

```
★ VIDEO — [Tipo] — [Tema]
Duração: [X]s
Resolução: [1080x1920 / 1920x1080]
FPS: [30/60]

═══ ROTEIRO ═══
| Cena | Tempo | Descrição | Animação |
|---|---|---|---|
| 1 | 0-3s | Hook | Zoom + text spring |
| 2 | 3-10s | Problema | Fade in + shake |
| ... | ... | ... | ... |

═══ CÓDIGO ═══
[Arquivos gerados — path de cada componente]

═══ ASSETS NECESSÁRIOS ═══
- Fotos: [lista de imagens necessárias]
- Logo: src/assets/logo.png
- Áudio: [se aplicável]

═══ COMANDOS ═══
npm run preview    # Visualizar
npm run render     # Renderizar MP4

═══ PUBLICAÇÃO ═══
- Instagram Reels: upload direto (9:16, max 90s)
- TikTok: upload direto
- YouTube Shorts: upload direto (max 60s)
```

## 7. Templates prontos para Pousinox

| Template | Uso | Duração |
|---|---|---|
| `product-reveal` | Lançamento de produto | 15-30s |
| `before-after` | Antes/depois instalação | 30s |
| `tutorial-steps` | Passo a passo | 45-60s |
| `data-dashboard` | KPIs animados | 15s |
| `testimonial` | Depoimento + dados | 30s |
| `comparison` | Inox vs galvanizado | 30s |

## 8. Integração com pipeline
- Conteúdo do `/social-post` → roteiro para vídeo
- Dados do `/relatorio-vendas` → dashboard animado
- Copy do `/meta-ads` → texto para criativos em vídeo
- Fotos de `/gerar-conteudo` → assets para cenas
