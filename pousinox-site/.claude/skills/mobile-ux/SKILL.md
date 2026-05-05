---
description: Auditar e melhorar usabilidade mobile — touch, performance, responsividade, acessibilidade
---

# Mobile UX

Audite e otimize a experiência mobile do site Pousinox. Foco em touch targets, performance, responsividade e conversão mobile.

## 1. Auditoria rápida

### Verificações automáticas
```bash
# Lighthouse mobile score
npx lighthouse https://pousinox.com.br --only-categories=performance,accessibility,best-practices --emulated-form-factor=mobile --output=json

# Verificar viewport meta
grep -r "viewport" index.html

# Verificar media queries
grep -rn "@media" src/ --include="*.css" --include="*.tsx" | head -30
```

### Checklist manual (testar em 375px width)
| Critério | OK? | Impacto |
|---|---|---|
| Viewport meta tag presente | | Alto |
| Touch targets ≥ 44x44px | | Alto |
| Font-size ≥ 16px (evita zoom iOS) | | Alto |
| Sem scroll horizontal | | Alto |
| Imagens responsivas (srcset ou max-width:100%) | | Médio |
| Botões CTA visíveis sem scroll | | Alto |
| Formulários com input types corretos (tel, email) | | Médio |
| Espaçamento entre links ≥ 8px | | Médio |
| Menu mobile funcional | | Alto |
| Tabelas com scroll ou layout alternativo | | Médio |

## 2. Padrões de correção

### Touch targets
```css
/* Mínimo 44x44px para elementos clicáveis */
.btn, a, button, [role="button"] {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
}

/* Espaçamento entre itens de lista clicáveis */
.list-item + .list-item {
  margin-top: 8px;
}
```

### Tipografia mobile
```css
@media (max-width: 768px) {
  html { font-size: 16px; } /* Previne zoom no iOS */
  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.375rem; }
  body { line-height: 1.6; }
  p { margin-bottom: 1rem; }
}
```

### Inputs mobile-friendly
```tsx
// Tipos corretos para teclado adequado
<input type="tel" inputMode="numeric" />      // Telefone
<input type="email" inputMode="email" />       // Email
<input type="number" inputMode="decimal" />    // Valores
<input type="search" />                        // Busca com "Ir"

// Evitar zoom no focus (iOS)
input, select, textarea { font-size: 16px; }
```

### Tabelas responsivas
```css
/* Opção 1: Scroll horizontal contido */
.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
}

/* Opção 2: Cards no mobile */
@media (max-width: 768px) {
  table, thead, tbody, tr, td { display: block; }
  thead { display: none; }
  td::before { content: attr(data-label); font-weight: 600; }
}
```

### CTAs fixos mobile
```css
/* Botão WhatsApp flutuante */
.cta-mobile-fixed {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  z-index: 50;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* Esconder em desktop */
@media (min-width: 769px) {
  .cta-mobile-fixed { display: none; }
}
```

### Imagens responsivas
```tsx
// Lazy loading + responsivo
<img
  src={img}
  loading="lazy"
  decoding="async"
  style={{ maxWidth: '100%', height: 'auto' }}
  alt={alt}
/>

// Para backgrounds
.hero {
  background-size: cover;
  background-position: center;
  min-height: 50vh; /* não 100vh — evita problemas com barra de URL mobile */
}
```

### Navegação mobile
```css
/* Hamburger menu padrão */
@media (max-width: 768px) {
  .nav-desktop { display: none; }
  .nav-mobile { display: flex; }
  
  .nav-drawer {
    position: fixed;
    inset: 0;
    background: var(--azul-escuro);
    z-index: 100;
    padding: 24px;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  .nav-drawer.open { transform: translateX(0); }
}
```

## 3. Performance mobile

### Otimizações prioritárias
- **Bundle splitting**: lazy load de rotas pesadas
- **Imagens**: WebP com fallback, srcset por viewport
- **Fonts**: `font-display: swap`, preload da Inter
- **CSS**: purge de classes não usadas
- **JS**: defer scripts não-críticos

```tsx
// Lazy load de rotas
const AdminPage = lazy(() => import('./pages/Admin'))

// Preload de font crítica
<link rel="preload" href="/fonts/inter-var.woff2" as="font" crossOrigin="" />
```

### Métricas alvo (mobile 4G)
| Métrica | Meta | Crítico |
|---|---|---|
| LCP | < 2.5s | > 4s |
| FID/INP | < 100ms | > 300ms |
| CLS | < 0.1 | > 0.25 |
| TTI | < 3.5s | > 7s |

## 4. Conversão mobile

### Princípios
- CTA principal visível acima da dobra (sem scroll)
- WhatsApp button fixo no rodapé em páginas de produto
- Formulários curtos (max 4 campos visíveis por vez)
- Telefone clicável: `<a href="tel:+55...">`
- Endereço linkado ao Maps: `<a href="https://maps.google.com/...">`

### Padrão de landing page mobile
```
┌─────────────────────┐
│ Logo    ☰ Menu      │ ← Header compacto
├─────────────────────┤
│ Headline (max 2lin) │
│ Subtítulo curto     │
│ [CTA PRIMÁRIO]      │ ← Acima da dobra
├─────────────────────┤
│ Benefício 1 (ícone) │
│ Benefício 2 (ícone) │
│ Benefício 3 (ícone) │
├─────────────────────┤
│ Prova social/laudo  │
├─────────────────────┤
│ [CTA SECUNDÁRIO]    │
├─────────────────────┤
│ FAQ (accordion)     │
├─────────────────────┤
│ ☎ WhatsApp fixo     │ ← Sticky bottom
└─────────────────────┘
```

## 5. Formato de entrega

```
★ MOBILE UX — [página/componente]

═══ AUDITORIA ═══
| Critério | Status | Ação |
|---|---|---|
| Touch targets | ✅/❌ | [fix necessário] |
| Font sizes | ✅/❌ | ... |
| Responsividade | ✅/❌ | ... |
| Performance | ✅/❌ | LCP: Xs |
| CTAs | ✅/❌ | ... |

Score mobile: X/10

═══ CORREÇÕES APLICADAS ═══
- [arquivo]: [o que mudou]

═══ PENDENTE ═══
- [item que precisa de decisão do usuário]
```

## 6. Quando usar
- Ao criar nova página ou landing page
- Ao receber reclamação de UX mobile
- Antes de campanha de ads (tráfego mobile = 70%+)
- Após mudanças grandes no layout
- Mensalmente como auditoria preventiva
