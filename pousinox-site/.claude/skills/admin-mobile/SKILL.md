---
description: Otimizar painel admin para uso mobile — tabelas, formulários, navegação e ações em tela pequena
---

# Admin Mobile

Adapte módulos do painel admin para uso produtivo em telas pequenas (≤768px). Foco em eficiência operacional, não em simplificação.

## Princípio

O admin mobile não é uma versão "menos" — é uma versão **diferente**. O usuário no celular quer:
- Consultar rápido (ver status, KPI, pendência)
- Agir pontualmente (aprovar, responder, marcar feito)
- NÃO quer: editar formulário de 20 campos, criar relatório complexo

## 1. Auditoria do módulo

Para cada módulo admin, classificar as ações:

| Ação | Mobile? | Padrão |
|---|---|---|
| Consultar lista/status | ✅ Essencial | Card list |
| Ver detalhe | ✅ Essencial | Full-screen sheet |
| Ação rápida (aprovar, status) | ✅ Essencial | Swipe ou bottom sheet |
| Criar/editar completo | ⚠️ Simplificado | Wizard steps |
| Relatório/export | ❌ Desktop-only | Ocultar ou link "Abrir no desktop" |
| Configuração | ❌ Desktop-only | Ocultar |

## 2. Padrões de componente

### Tabelas → Card List
```css
@media (max-width: 768px) {
  .admin-table { display: none; }
  .admin-card-list { display: flex; flex-direction: column; gap: 8px; }
}

.admin-card-item {
  padding: 12px 16px;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 4px;
}
.admin-card-item__title { font-weight: 600; font-size: 0.875rem; }
.admin-card-item__meta { color: var(--prata); font-size: 0.75rem; }
.admin-card-item__status { justify-self: end; }
.admin-card-item__actions { grid-column: 1 / -1; display: flex; gap: 8px; margin-top: 8px; }
```

Layout do card:
```
┌─────────────────────────────┐
│ Título/Nome        [Status] │
│ Meta info (data, valor)     │
│ [Ação1] [Ação2] [Ação3]    │
└─────────────────────────────┘
```

### Navegação → Bottom Tab Bar
```css
@media (max-width: 768px) {
  .admin-sidebar { display: none; }
  .admin-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--azul-escuro);
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 100;
    padding: 8px 0 env(safe-area-inset-bottom);
  }
  .admin-bottom-nav__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    font-size: 0.625rem;
    color: var(--prata);
  }
  .admin-bottom-nav__item.active { color: var(--azul-light); }
  
  /* Compensar bottom nav */
  .admin-content { padding-bottom: 72px; }
}
```

Limite: **5 itens** no bottom nav. Agrupar o resto em "Mais" (⋯).

### Formulários → Wizard Steps
```tsx
// Em vez de todos os campos visíveis, dividir em steps
const STEPS = [
  { label: 'Básico', fields: ['titulo', 'cliente', 'valor'] },
  { label: 'Datas', fields: ['data_inicio', 'data_fim', 'prazo'] },
  { label: 'Detalhes', fields: ['observacoes', 'anexos'] },
]

// UI: indicador de progresso + prev/next
// ┌──────────────────────┐
// │ ● ○ ○  Passo 1 de 3  │
// │                       │
// │ [Campo 1]             │
// │ [Campo 2]             │
// │ [Campo 3]             │
// │                       │
// │ [Voltar]  [Próximo →] │
// └──────────────────────┘
```

### Ações → Bottom Sheet
```css
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 16px 16px 0 0;
  padding: 16px;
  padding-bottom: env(safe-area-inset-bottom, 16px);
  box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
  transform: translateY(100%);
  transition: transform 0.3s ease;
  z-index: 200;
}
.bottom-sheet.open { transform: translateY(0); }
.bottom-sheet__handle {
  width: 32px; height: 4px;
  background: #d1d5db;
  border-radius: 2px;
  margin: 0 auto 12px;
}
.bottom-sheet__action {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.9375rem;
}
```

Usar quando: mais de 2 ações disponíveis no item (em vez de dropdown menu).

### KPIs → Scroll horizontal
```css
@media (max-width: 768px) {
  .kpi-grid {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 12px;
    padding: 0 16px;
    -webkit-overflow-scrolling: touch;
  }
  .kpi-card {
    scroll-snap-align: start;
    min-width: 140px;
    flex-shrink: 0;
  }
}
```

### Abas → Scroll horizontal
```css
@media (max-width: 768px) {
  .admin-tabs {
    display: flex;
    overflow-x: auto;
    white-space: nowrap;
    border-bottom: 1px solid var(--card-border);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .admin-tabs::-webkit-scrollbar { display: none; }
  .admin-tab {
    padding: 12px 16px;
    flex-shrink: 0;
    font-size: 0.8125rem;
  }
}
```

### Filtros → Collapsible
```css
@media (max-width: 768px) {
  .admin-filters {
    display: none;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: #f8fafc;
    border-radius: var(--radius-md);
  }
  .admin-filters.open { display: flex; }
  .admin-filters-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    color: var(--azul-accent);
    padding: 8px 0;
  }
}
```

### Drawer/Modal → Full Screen
```css
@media (max-width: 768px) {
  .admin-drawer {
    width: 100% !important;
    max-width: 100%;
    border-radius: 0;
    height: 100vh;
    height: 100dvh; /* dynamic viewport height */
  }
}
```

## 3. Gestos e interações

| Gesto | Ação | Onde |
|---|---|---|
| Tap | Abrir detalhe | Card item |
| Long press | Selecionar (multi-select) | Card item |
| Swipe left | Ação rápida (excluir/arquivar) | Card item |
| Swipe right | Ação positiva (aprovar/concluir) | Card item |
| Pull down | Refresh | Lista |
| Swipe between | Trocar aba | Tabs |

### Pull to refresh
```tsx
// Hook simples
const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  // Detecta touch start > touch move > threshold (60px) > release
  // Mostra spinner no topo durante refresh
}
```

## 4. Prioridades por módulo

| Módulo | Prioridade mobile | Ações mobile |
|---|---|---|
| Dashboard | Alta | Ver KPIs, pendências |
| Pipeline | Alta | Mover deal, ver valor |
| Follow-ups | Alta | Marcar feito, adiar |
| Financeiro | Média | Ver saldo, aprovar |
| Produção | Média | Atualizar status OP |
| Qualidade | Média | Registrar inspeção |
| Projetos | Baixa | Só consulta |
| Estoque | Baixa | Consultar saldo |
| Relatórios | Nenhuma | Desktop only |
| Configuração | Nenhuma | Desktop only |

## 5. Breakpoints

```css
/* Mobile-first para admin */
@media (max-width: 768px)  { /* Phone */ }
@media (max-width: 1024px) { /* Tablet - layout intermediário */ }
/* Desktop: default (sem media query) */
```

## 6. Checklist de implementação

Para cada módulo:
- [ ] Card list alternativo à tabela
- [ ] Bottom sheet para ações (se >2)
- [ ] Formulário em steps (se >5 campos)
- [ ] Filtros colapsáveis
- [ ] Abas com scroll horizontal
- [ ] Drawer → full screen
- [ ] Touch targets ≥ 44px
- [ ] Safe area (notch, home indicator)
- [ ] Testar em 375px width

## 7. Formato de entrega

```
★ ADMIN MOBILE — [módulo]

═══ CLASSIFICAÇÃO DE AÇÕES ═══
| Ação | Mobile | Padrão aplicado |
|---|---|---|
| ... | ✅/⚠️/❌ | ... |

═══ ALTERAÇÕES ═══
- [arquivo]: [adaptação mobile aplicada]

═══ TESTADO EM ═══
- 375px (iPhone SE) ✅/❌
- 390px (iPhone 14) ✅/❌
- 768px (iPad mini) ✅/❌
```

## 8. Quando usar
- Ao criar novo módulo admin (já fazer responsivo)
- Quando Marco reportar dificuldade no celular
- Antes de viagem/evento (acesso mobile aumenta)
- Sprint de UX admin
