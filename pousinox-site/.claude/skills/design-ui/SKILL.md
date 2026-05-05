---
description: Elevar qualidade visual de componentes — design profissional com identidade Pousinox
---

# Design UI

Playbook de design frontend para criar interfaces profissionais e sofisticadas, alinhadas com a identidade visual Pousinox.

## Identidade Visual Pousinox

### Paleta de cores
```css
/* Primárias */
--azul-escuro: #1a2332;      /* Fundos, headers, navs */
--azul-profundo: #0f1724;    /* Backgrounds dark */
--prata: #b8c4d0;            /* Textos secundários, bordas */
--branco: #ffffff;            /* Textos principais, cards */

/* Accent */
--azul-accent: #2563eb;      /* CTAs, links, highlights */
--azul-hover: #1d4ed8;       /* Hover states */
--azul-light: #3b82f6;       /* Badges, indicators */

/* Status */
--verde: #10b981;            /* Sucesso, positivo */
--amarelo: #f59e0b;          /* Warning, atenção */
--vermelho: #ef4444;         /* Erro, negativo */

/* Superfícies */
--card-bg: #ffffff;
--card-border: #e2e8f0;
--card-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
--card-shadow-hover: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
```

### Tipografia
```css
--font-display: 'Inter', sans-serif;  /* Títulos */
--font-body: 'Inter', sans-serif;     /* Corpo */

/* Escala */
--text-xs: 0.75rem;    /* Labels, captions */
--text-sm: 0.875rem;   /* Body small, tabelas */
--text-base: 1rem;     /* Body padrão */
--text-lg: 1.125rem;   /* Subtítulos */
--text-xl: 1.25rem;    /* Títulos de seção */
--text-2xl: 1.5rem;    /* Títulos de página */
--text-3xl: 1.875rem;  /* Hero headings */

/* Pesos */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Espaçamento
```css
/* Sistema 4px */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* Border radius */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;
```

## Princípios de Design

### 1. Hierarquia visual
- **Título → Subtítulo → Corpo → Caption** — cada nível menor e mais claro
- Usar peso da fonte (não só tamanho) para diferenciar
- Espaçamento generoso entre seções (32-48px), compacto dentro (8-16px)

### 2. Cards e superfícies
```css
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--card-shadow);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card:hover {
  box-shadow: var(--card-shadow-hover);
  transform: translateY(-2px);
}
```

### 3. Botões
```css
/* Primário */
.btn-primary {
  background: var(--azul-accent);
  color: white;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  transition: background 0.15s ease;
}
.btn-primary:hover { background: var(--azul-hover); }

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--azul-accent);
  border: 1px solid var(--azul-accent);
}
```

### 4. Tabelas profissionais
- Header com background sutil (`#f8fafc`)
- Bordas apenas horizontais (nunca grade completa)
- Hover row com background leve
- Alignment: texto left, números right
- Padding consistente (12px 16px)

### 5. Formulários
- Labels acima do input (nunca inline)
- Border sutil que escurece no focus
- Placeholder em cor clara (não confundir com valor)
- Agrupamento lógico com fieldsets visuais
- Validação inline (não alerts)

### 6. Animações e transições
```css
/* Padrão suave */
transition: all 0.2s ease;

/* Entrada de elementos */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Nunca usar */
/* ❌ transition > 0.4s (parece lento) */
/* ❌ bounce/elastic em UI corporativa */
/* ❌ animações em loop (distrai) */
```

### 7. Ícones e indicadores
- Usar Unicode (✓ ✗ ⚠ ▲ ▼ ◆ ★) para status
- Se precisar de ícones complexos: Lucide React (já compatível)
- Tamanho proporcional ao texto (1em-1.25em)

## Padrões de componentes

### KPI Cards (Dashboard)
```
┌─────────────────┐
│ Label pequeno    │
│ R$ 45.000  ▲12% │
│ vs mês anterior  │
└─────────────────┘
```
- Número grande e bold
- Variação com cor (verde ▲ / vermelho ▼)
- Label discreto acima

### Empty States
- Ilustração ou ícone grande (64px+)
- Texto explicativo curto
- CTA para primeira ação
- Nunca deixar espaço totalmente vazio

### Loading States
- Skeleton screens (não spinners)
- Manter layout structure durante loading
- Transição suave ao carregar dados

### Feedback visual
- Toast notifications (canto superior direito)
- Duração: sucesso 3s, erro 5s
- Cores de status com ícone

## Quando usar esta skill

Ativar ao:
- Criar novo componente/página
- Refatorar UI existente para melhorar aparência
- Receber feedback de que "está com cara de IA"
- Implementar dashboard ou relatório visual
- Criar landing page ou seção pública

## Hero com vídeo cinematográfico (premium)

Elemento que diferencia site profissional de genérico: vídeo em loop na seção hero.

### Quando usar
- Landing pages de produto/serviço principal
- Páginas de segmento (fachada, indústria)
- Home institucional

### Implementação
```tsx
<section className="hero">
  <video
    autoPlay
    muted
    loop
    playsInline
    className="hero-video"
    poster="/assets/hero-poster.webp"  /* fallback enquanto carrega */
  >
    <source src="/assets/hero.mp4" type="video/mp4" />
  </video>
  <div className="hero-overlay" />  /* escurece para legibilidade */
  <div className="hero-content">
    <h1>Headline</h1>
    <p>Subheadline</p>
    <a className="btn-primary">CTA</a>
  </div>
</section>
```

```css
.hero { position: relative; min-height: 80vh; overflow: hidden; }
.hero-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}
.hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(15, 23, 36, 0.6),
    rgba(15, 23, 36, 0.85)
  );
}
.hero-content {
  position: relative; z-index: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 80vh; text-align: center;
  color: white; padding: var(--space-8);
}
```

### Diretrizes do vídeo
- **Duração:** 8-15 segundos (loop seamless)
- **Resolução:** 1920×1080 min, comprimido <5MB (WebM preferível)
- **Loop perfeito:** frame inicial = frame final (evitar corte brusco)
- **Conteúdo Pousinox:** fachada com porcelanato, fábrica em operação, detalhe do fixador inox, instalação em obra
- **Geração IA:** Higgsfield, Runway ou Kling — prompt cinematográfico em inglês com direção de câmera
- **Fallback mobile:** poster estático (WebP) em conexões lentas — usar `<source media="(max-width: 768px)">`
- **Performance:** lazy load com `preload="none"` se abaixo da dobra; `preload="auto"` se hero

## Anti-padrões (evitar)

- ❌ Gradientes excessivos (max 1 por página)
- ❌ Sombras pesadas (usar sutil)
- ❌ Muitas cores simultâneas (max 3 + status)
- ❌ Texto sobre imagem sem overlay
- ❌ Inputs sem label visível
- ❌ Tabelas com scroll horizontal em desktop
- ❌ Modals dentro de modals
- ❌ Fontes decorativas (sempre Inter)
- ❌ Border-radius inconsistente na mesma seção
