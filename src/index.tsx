import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { adminHtml } from './admin'

const app = new Hono()

app.use('/static/*', serveStatic({ root: './public' }))

/* ── PAINEL ADMIN ── */
app.get('/admin', (c) => {
  return c.html(adminHtml())
})

app.get('/', (c) => {
  const whatsappNumber = '5535999999999' // Valor padrão — editado pelo admin
  const whatsappMsg = encodeURIComponent('Olá! Tenho interesse no Fixador de Porcelanato da Pousinox. Pode me ajudar?')
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`

  return c.html(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- SEO Meta Tags -->
  <title>Fixador de Porcelanato para Parede | Pousinox — A Arte em Inox | Pouso Alegre MG</title>
  <meta name="description" content="Fixador de porcelanato em aço inox para instalação segura de revestimentos cerâmicos e porcelanatos em paredes. Ancoragem mecânica de alta resistência. Pousinox — Pouso Alegre MG.">
  <meta name="keywords" content="fixador de porcelanato, fixação porcelanato parede, ancoragem porcelanato, segurança porcelanato fachada, fixador porcelanato grande formato, suporte porcelanato, bucha prego porcelanato, inox construção civil">
  <meta name="author" content="Pousinox — A Arte em Inox">
  <meta name="robots" content="index, follow">
  <meta name="geo.region" content="BR-MG">
  <meta name="geo.placename" content="Pouso Alegre">

  <!-- Open Graph -->
  <meta property="og:title" content="Fixador de Porcelanato para Parede | Pousinox">
  <meta property="og:description" content="Sistema de ancoragem mecânica em aço inox para instalação segura de porcelanatos e revestimentos cerâmicos em paredes e fachadas.">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_BR">

  <!-- Schema.org -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Fixador de Porcelanato para Parede",
    "description": "Sistema de ancoragem mecânica em aço inox para instalação segura de porcelanatos e revestimentos cerâmicos em paredes.",
    "brand": {
      "@type": "Brand",
      "name": "Pousinox"
    },
    "material": "Aço Inox",
    "manufacturer": {
      "@type": "Organization",
      "name": "Pousinox — A Arte em Inox",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Pouso Alegre",
        "addressRegion": "MG",
        "addressCountry": "BR"
      }
    }
  }
  </script>

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <!-- Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">

  <!-- Custom CSS -->
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>

<!-- =====================================================
     NAVBAR
     ===================================================== -->
<nav class="navbar" role="navigation" aria-label="Navegação principal">
  <div class="navbar-inner">
    <a href="#hero" class="navbar-brand" aria-label="Pousinox - Página inicial">
      <span class="brand-name">POUSINOX</span>
      <span class="brand-tagline">A Arte em Inox · Pouso Alegre MG</span>
    </a>

    <ul class="navbar-nav" role="menubar">
      <li role="none"><a href="#problema" role="menuitem">O Problema</a></li>
      <li role="none"><a href="#como-funciona" role="menuitem">Como Funciona</a></li>
      <li role="none"><a href="#videos" role="menuitem">Vídeos</a></li>
      <li role="none"><a href="#beneficios" role="menuitem">Benefícios</a></li>
      <li role="none"><a href="#specs" role="menuitem">Especificações</a></li>
      <li role="none"><a href="#produto" role="menuitem">Produto</a></li>
    </ul>

    <div class="navbar-cta">
      <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp" aria-label="Falar no WhatsApp">
        <i class="fab fa-whatsapp"></i>
        WhatsApp
      </a>
    </div>

    <div class="hamburger" role="button" aria-label="Menu" tabindex="0" aria-expanded="false">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
</nav>

<!-- =====================================================
     HERO
     ===================================================== -->
<section class="hero" id="hero" aria-label="Apresentação do produto">
  <div class="hero-grid" aria-hidden="true"></div>
  <div class="hero-inner">

    <!-- LEFT: Text -->
    <div class="hero-content">
      <div class="hero-badge" aria-label="Fabricado em Pouso Alegre MG">
        <span class="hero-badge-dot" aria-hidden="true"></span>
        Fabricado em Pouso Alegre · MG · Brasil
      </div>

      <h1 class="hero-title">
        Fixador de<br>
        <span class="highlight">Porcelanato</span><br>
        em Parede
      </h1>

      <p class="hero-subtitle">
        Sistema de ancoragem desenvolvido para aumentar a segurança na instalação de porcelanatos e revestimentos cerâmicos em paredes.
      </p>

      <ul class="hero-bullets" aria-label="Destaques do produto">
        <li>
          <span class="bullet-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          Segurança estrutural comprovada
        </li>
        <li>
          <span class="bullet-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          Fixação mecânica adicional à argamassa
        </li>
        <li>
          <span class="bullet-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          Ideal para porcelanato de grande formato
        </li>
        <li>
          <span class="bullet-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          Instalação simples e rápida
        </li>
      </ul>

      <div class="hero-actions">
        <a href="#contato" class="btn btn-primary btn-lg">
          <i class="fas fa-tag" aria-hidden="true"></i>
          Solicitar Orçamento
        </a>
        <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-lg">
          <i class="fab fa-whatsapp" aria-hidden="true"></i>
          Falar no WhatsApp
        </a>
        <a href="#como-funciona" class="btn btn-outline">
          <i class="fas fa-play-circle" aria-hidden="true"></i>
          Ver Instalação
        </a>
      </div>

      <div class="hero-stats" aria-label="Estatísticas do produto">
        <div class="hero-stat">
          <span class="stat-number"><span data-counter="100">0</span><span>%</span></span>
          <span class="stat-label">Aço Inox</span>
        </div>
        <div class="hero-stat">
          <span class="stat-number"><span data-counter="120">0</span><span>mm</span></span>
          <span class="stat-label">Comprimento</span>
        </div>
        <div class="hero-stat">
          <span class="stat-number"><span data-counter="0" style="font-size:1.4rem">∞</span></span>
          <span class="stat-label">Durabilidade</span>
        </div>
      </div>
    </div>

    <!-- RIGHT: Image -->
    <div class="hero-visual">
      <div class="hero-image-frame">
        <!--
          INSTRUÇÃO: Substitua a tag abaixo por:
          <img src="/static/hero-instalacao.jpg" alt="Instalação de fixador de porcelanato em parede" class="hero-img" loading="eager">
        -->
        <div class="hero-img-placeholder" role="img" aria-label="Imagem: instalação do fixador de porcelanato">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <p>Inserir foto da<br>instalação do produto<br><small style="opacity:0.6">(hero-instalacao.jpg)</small></p>
        </div>
      </div>

      <!-- Floating badges -->
      <div class="hero-badge-float" aria-label="Material: Aço Inox 304">
        <div class="badge-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="badge-text">
          <strong>Aço Inox 304</strong>
          <span>Alta resistência</span>
        </div>
      </div>

      <div class="hero-badge-float2" aria-label="Produto fabricado no Brasil">
        <div class="material-chip">🇧🇷 Made in Brazil</div>
        <div class="material-label">Pouso Alegre · MG</div>
      </div>
    </div>

  </div>
</section>

<!-- =====================================================
     O PROBLEMA
     ===================================================== -->
<section class="section-problema" id="problema" aria-labelledby="problema-title">
  <div class="container">
    <div class="problema-header animate-on-scroll">
      <div class="section-tag" aria-label="Seção: O Problema">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        O Risco Real
      </div>
      <h2 id="problema-title" class="section-title">Por que o porcelanato pode <span>se desprender</span> da parede?</h2>
      <p class="section-subtitle">
        Placas de porcelanato estão sujeitas a forças que a argamassa sozinha nem sempre consegue suportar. Entenda os principais riscos.
      </p>
    </div>

    <div class="problema-grid">
      <div class="problema-card animate-on-scroll delay-1">
        <div class="problema-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3v1m0 16v1M4.22 4.22l.71.71m13.14 13.14.71.71M3 12h1m16 0h1M4.22 19.78l.71-.71M18.93 5.93l.71-.71"/><circle cx="12" cy="12" r="4"/></svg>
        </div>
        <h3>Dilatação Térmica</h3>
        <p>Variações de temperatura causam expansão e contração das placas, gerando tensões que comprometem a aderência da argamassa ao longo do tempo.</p>
      </div>

      <div class="problema-card animate-on-scroll delay-2">
        <div class="problema-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h3>Falha de Argamassa</h3>
        <p>Aplicação incorreta, argamassa vencida ou incompatível, falta de dupla colagem — qualquer falha pode comprometer a aderência e causar queda das placas.</p>
      </div>

      <div class="problema-card animate-on-scroll delay-3">
        <div class="problema-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h3>Peso Elevado</h3>
        <p>Porcelanatos de grande formato possuem alto peso por m². Em paredes verticais e fachadas, a força gravitacional constante aumenta o risco de desprendimento.</p>
      </div>

      <div class="problema-card animate-on-scroll delay-4">
        <div class="problema-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364"/><circle cx="12" cy="12" r="4"/></svg>
        </div>
        <h3>Vibração Estrutural</h3>
        <p>Tráfego pesado, obras próximas, abalos sísmicos ou recalque diferencial da estrutura criam vibrações que enfraquecem a ligação argamassa-substrato.</p>
      </div>
    </div>

    <div class="problema-solution animate-on-scroll">
      <div class="solution-text">
        <h3>A <span>solução mecânica</span> que elimina o risco</h3>
        <p>
          O Fixador de Porcelanato Pousinox cria um ponto de ancoragem mecânica independente da argamassa. Mesmo que a argamassa falhe, o fixador mantém a placa presa à parede, evitando quedas e garantindo a segurança de pessoas e patrimônios.
        </p>
      </div>
      <div class="solution-features">
        <div class="solution-feature">
          <div class="sf-icon">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="sf-text">
            <strong>Dupla proteção</strong>
            <span>Argamassa + ancoragem mecânica em inox</span>
          </div>
        </div>
        <div class="solution-feature">
          <div class="sf-icon">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="sf-text">
            <strong>Resistência ao tempo</strong>
            <span>Aço inox não enferruja nem se degrada</span>
          </div>
        </div>
        <div class="solution-feature">
          <div class="sf-icon">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="sf-text">
            <strong>Discreto e invisível</strong>
            <span>O fixador fica oculto após a instalação</span>
          </div>
        </div>
        <div class="solution-feature">
          <div class="sf-icon">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="sf-text">
            <strong>Norma de segurança</strong>
            <span>Recomendado para grandes formatos e fachadas</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- =====================================================
     COMO FUNCIONA — 4 ETAPAS
     ===================================================== -->
<section class="section-como-funciona" id="como-funciona" aria-labelledby="como-funciona-title">
  <div class="container">
    <div class="como-header animate-on-scroll">
      <div class="section-tag blue">
        <i class="fas fa-tools" aria-hidden="true"></i>
        Processo de Instalação
      </div>
      <h2 id="como-funciona-title" class="section-title">Como funciona o <span>sistema de fixação</span></h2>
      <p class="section-subtitle" style="margin: 0 auto">
        Instalação simples em 4 etapas. Qualquer profissional de revestimentos pode executar o sistema com ferramentas convencionais.
      </p>
    </div>

    <div class="etapas-container">
      <div class="etapas-line" aria-hidden="true"></div>
      <div class="etapas-grid">

        <!-- Etapa 1 -->
        <article class="etapa-card animate-on-scroll delay-1" aria-labelledby="etapa1-title">
          <div class="etapa-number-wrap" aria-hidden="true">
            <div class="etapa-number">1</div>
          </div>
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/etapa1-incisao.jpg" alt="Incisão no verso do porcelanato com esmerilhadeira em 45 graus" class="etapa-img" loading="lazy">
          -->
          <div class="etapa-img-placeholder" role="img" aria-label="Imagem: preparação do porcelanato com esmerilhadeira">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
            <span>etapa1-incisao.jpg</span>
          </div>
          <div class="etapa-content">
            <span class="etapa-tag">Etapa 1</span>
            <h3 id="etapa1-title">Preparação do Porcelanato</h3>
            <p>Realizar incisão no verso do porcelanato com esmerilhadeira em aproximadamente 45°, criando malha para melhorar a aderência do fixador.</p>
          </div>
        </article>

        <!-- Etapa 2 -->
        <article class="etapa-card animate-on-scroll delay-2" aria-labelledby="etapa2-title">
          <div class="etapa-number-wrap" aria-hidden="true">
            <div class="etapa-number">2</div>
          </div>
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/etapa2-fixador.jpg" alt="Aplicação do fixador metálico com argamassa estrutural no verso da placa" class="etapa-img" loading="lazy">
          -->
          <div class="etapa-img-placeholder" role="img" aria-label="Imagem: aplicação do fixador metálico com argamassa">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <rect x="2" y="8" width="20" height="8" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 16v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2"/>
            </svg>
            <span>etapa2-fixador.jpg</span>
          </div>
          <div class="etapa-content">
            <span class="etapa-tag">Etapa 2</span>
            <h3 id="etapa2-title">Aplicação do Fixador</h3>
            <p>O fixador metálico em aço inox é colado no verso da placa utilizando argamassa estrutural, garantindo aderência máxima ao substrato cerâmico.</p>
          </div>
        </article>

        <!-- Etapa 3 -->
        <article class="etapa-card animate-on-scroll delay-3" aria-labelledby="etapa3-title">
          <div class="etapa-number-wrap" aria-hidden="true">
            <div class="etapa-number">3</div>
          </div>
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/etapa3-placas.jpg" alt="Placas de porcelanato preparadas com os fixadores posicionados" class="etapa-img" loading="lazy">
          -->
          <div class="etapa-img-placeholder" role="img" aria-label="Imagem: placas preparadas com fixadores posicionados">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <rect x="2" y="3" width="9" height="9" rx="1"/><rect x="13" y="3" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/>
            </svg>
            <span>etapa3-placas.jpg</span>
          </div>
          <div class="etapa-content">
            <span class="etapa-tag">Etapa 3</span>
            <h3 id="etapa3-title">Preparação das Placas</h3>
            <p>As placas ficam preparadas com os fixadores corretamente posicionados e a argamassa curada, prontas para instalação na parede ou fachada.</p>
          </div>
        </article>

        <!-- Etapa 4 -->
        <article class="etapa-card animate-on-scroll delay-4" aria-labelledby="etapa4-title">
          <div class="etapa-number-wrap" aria-hidden="true">
            <div class="etapa-number">4</div>
          </div>
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/etapa4-parede.jpg" alt="Fixação do porcelanato na parede com bucha prego" class="etapa-img" loading="lazy">
          -->
          <div class="etapa-img-placeholder" role="img" aria-label="Imagem: fixação do porcelanato na parede com bucha prego">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M15 7H3v13h18V7h-4"/><polyline points="15 3 19 7 15 11"/><line x1="19" y1="7" x2="9" y2="7"/>
            </svg>
            <span>etapa4-parede.jpg</span>
          </div>
          <div class="etapa-content">
            <span class="etapa-tag">Etapa 4</span>
            <h3 id="etapa4-title">Fixação na Parede</h3>
            <p>O fixador é ancorado na parede com bucha prego 6 × 38 mm, criando o ponto de ancoragem mecânica que garante a segurança da instalação.</p>
          </div>
        </article>

      </div>
    </div>

    <!-- Nota técnica -->
    <div class="animate-on-scroll" style="margin-top:48px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:24px 32px;display:flex;align-items:flex-start;gap:16px;">
      <div style="width:36px;height:36px;background:#0ea5e9;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div>
        <strong style="color:#0369a1;font-size:0.9rem;display:block;margin-bottom:4px;">Nota Técnica</strong>
        <p style="color:#0369a1;font-size:0.85rem;margin:0;line-height:1.6">
          O sistema de fixação mecânica é recomendado para porcelanatos acima de 60×60 cm, fachadas ventiladas, áreas externas e qualquer aplicação em que a segurança estrutural seja prioritária. Consulte as normas ABNT NBR 13754 e NBR 14081 para especificação completa.
        </p>
      </div>
    </div>
  </div>
</section>

<!-- =====================================================
     VÍDEOS DE INSTALAÇÃO
     ===================================================== -->
<section class="section-videos" id="videos" aria-labelledby="videos-title">
  <div class="container">
    <div class="videos-header animate-on-scroll">
      <div class="section-tag blue">
        <i class="fas fa-play-circle" aria-hidden="true"></i>
        Vídeos Técnicos
      </div>
      <h2 id="videos-title" class="section-title" style="color:white">Veja a instalação na <span>prática</span></h2>
      <p class="section-subtitle" style="color:rgba(255,255,255,0.6);margin:0 auto">
        Acompanhe cada etapa do processo de instalação em vídeos técnicos detalhados.
      </p>
    </div>

    <div class="videos-grid">

      <!-- Vídeo principal (ocupa 2 colunas) -->
      <article class="video-card animate-on-scroll">
        <!--
          INSTRUÇÃO: Para adicionar vídeo do YouTube, substitua o placeholder abaixo por:
          <div class="video-embed">
            <iframe src="https://www.youtube.com/embed/SEU_VIDEO_ID?rel=0" title="Instalação completa do Fixador de Porcelanato Pousinox" allowfullscreen loading="lazy"></iframe>
          </div>

          Ou use o placeholder clicável abaixo com data-video-url preenchido:
          <div class="video-embed-placeholder" data-video-url="https://www.youtube.com/embed/SEU_VIDEO_ID?autoplay=1">
        -->
        <div class="video-embed-placeholder" 
             data-video-url="" 
             role="button" 
             tabindex="0"
             aria-label="Reproduzir vídeo: Instalação completa do Fixador de Porcelanato">
          <div class="play-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="video-overlay-label">
            <p>Clique para reproduzir · Adicione a URL do vídeo no código</p>
          </div>
        </div>
        <div class="video-info">
          <span class="video-tag">Destaque</span>
          <h4>Processo Completo de Instalação</h4>
          <p>Do corte no porcelanato à fixação final na parede — processo completo em obra real</p>
        </div>
      </article>

      <!-- Vídeo 2 -->
      <article class="video-card animate-on-scroll delay-1">
        <div class="video-embed-placeholder" 
             data-video-url="" 
             role="button" 
             tabindex="0"
             aria-label="Reproduzir vídeo: Preparação do porcelanato">
          <div class="play-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="video-overlay-label">
            <p>Adicione a URL do vídeo</p>
          </div>
        </div>
        <div class="video-info">
          <span class="video-tag">Técnico</span>
          <h4>Preparação do Porcelanato</h4>
          <p>Como realizar a incisão correta no verso da placa com esmerilhadeira</p>
        </div>
      </article>

      <!-- Vídeo 3 -->
      <article class="video-card animate-on-scroll delay-2">
        <div class="video-embed-placeholder" 
             data-video-url="" 
             role="button" 
             tabindex="0"
             aria-label="Reproduzir vídeo: Aplicação do fixador">
          <div class="play-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="video-overlay-label">
            <p>Adicione a URL do vídeo</p>
          </div>
        </div>
        <div class="video-info">
          <span class="video-tag">Técnico</span>
          <h4>Aplicação do Fixador Metálico</h4>
          <p>Colagem do fixador com argamassa estrutural no verso da placa</p>
        </div>
      </article>

      <!-- Vídeo 4 -->
      <article class="video-card animate-on-scroll delay-3">
        <div class="video-embed-placeholder" 
             data-video-url="" 
             role="button" 
             tabindex="0"
             aria-label="Reproduzir vídeo: Obra real">
          <div class="play-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="video-overlay-label">
            <p>Adicione a URL do vídeo</p>
          </div>
        </div>
        <div class="video-info">
          <span class="video-tag">Obra Real</span>
          <h4>Aplicação em Obra Real</h4>
          <p>Veja o fixador sendo usado em uma obra residencial / comercial real</p>
        </div>
      </article>

    </div>

    <!-- CTA vídeos -->
    <div class="animate-on-scroll" style="text-align:center;margin-top:48px;">
      <p style="color:rgba(255,255,255,0.5);font-size:0.9rem;margin-bottom:20px;">Quer ver uma demonstração personalizada para seu projeto?</p>
      <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-lg">
        <i class="fab fa-whatsapp" aria-hidden="true"></i>
        Solicitar Demonstração Técnica
      </a>
    </div>
  </div>
</section>

<!-- =====================================================
     BENEFÍCIOS
     ===================================================== -->
<section class="section-beneficios" id="beneficios" aria-labelledby="beneficios-title">
  <div class="container">
    <div class="beneficios-layout">

      <!-- Texto esquerda -->
      <div class="beneficios-text animate-on-scroll">
        <div class="section-tag">
          <i class="fas fa-star" aria-hidden="true"></i>
          Vantagens
        </div>
        <h2 id="beneficios-title">Por que escolher o <span>Fixador Pousinox</span>?</h2>
        <p>
          Desenvolvido por especialistas em inox para atender as exigências técnicas da construção civil moderna. Um sistema completo que oferece segurança, praticidade e durabilidade.
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:12px;color:#4b5563;font-size:0.9rem;">
            <span style="width:32px;height:32px;background:#d1fae5;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span><strong>Fabricante direto</strong> — sem intermediários</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;color:#4b5563;font-size:0.9rem;">
            <span style="width:32px;height:32px;background:#d1fae5;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span><strong>Aço inox 304</strong> — alta resistência à corrosão</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;color:#4b5563;font-size:0.9rem;">
            <span style="width:32px;height:32px;background:#d1fae5;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span><strong>Entrega para todo o Brasil</strong></span>
          </div>
        </div>
        <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg">
          <i class="fab fa-whatsapp" aria-hidden="true"></i>
          Solicitar Orçamento
        </a>
      </div>

      <!-- Grid de benefícios -->
      <div class="beneficios-grid" role="list" aria-label="Lista de benefícios">

        <div class="beneficio-item animate-on-scroll delay-1" role="listitem">
          <div class="beneficio-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h4>Segurança Aumentada</h4>
          <p>Ancoragem mecânica que evita o desprendimento mesmo em caso de falha da argamassa.</p>
        </div>

        <div class="beneficio-item animate-on-scroll delay-2" role="listitem">
          <div class="beneficio-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M18.364 2.636L21 5.272 12 14.272l-4.243-4.243 1.415-1.414L12 11.444l6.364-8.808zM3 21l4.5-4.5"/><path d="M3 21h5l11-11-5-5L3 16v5z"/></svg>
          </div>
          <h4>Evita Desprendimento</h4>
          <p>Proteção contra queda de placas em paredes, fachadas e áreas de grande circulação.</p>
        </div>

        <div class="beneficio-item animate-on-scroll delay-3" role="listitem">
          <div class="beneficio-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
          </div>
          <h4>Grande Formato</h4>
          <p>Especialmente indicado para porcelanatos 60×60, 90×90, 120×60 cm e maiores.</p>
        </div>

        <div class="beneficio-item animate-on-scroll delay-4" role="listitem">
          <div class="beneficio-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h4>Instalação Rápida</h4>
          <p>Processo simples com ferramentas convencionais. Qualquer profissional executa com facilidade.</p>
        </div>

        <div class="beneficio-item animate-on-scroll delay-1" role="listitem">
          <div class="beneficio-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <h4>Sistema Discreto</h4>
          <p>O fixador fica completamente oculto após a instalação, sem alterar a estética final.</p>
        </div>

        <div class="beneficio-item animate-on-scroll delay-2" role="listitem">
          <div class="beneficio-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h4>Alta Durabilidade</h4>
          <p>Aço inox 304 não enferruja. Resiste a umidade, sais e intempéries por décadas.</p>
        </div>

      </div>
    </div>
  </div>
</section>

<!-- =====================================================
     ESPECIFICAÇÕES TÉCNICAS
     ===================================================== -->
<section class="section-specs" id="specs" aria-labelledby="specs-title">
  <div class="container">
    <div class="specs-layout">

      <!-- Imagem do produto -->
      <aside class="specs-image-side animate-on-scroll" aria-label="Imagem do produto">
        <div class="specs-product-frame">
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/produto-fixador.jpg" alt="Fixador de Porcelanato Pousinox em Aço Inox" class="specs-product-img" loading="lazy">
          -->
          <div class="specs-product-img-placeholder" role="img" aria-label="Foto do fixador de porcelanato">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
              <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
            <p>Inserir foto do<br>fixador metálico<br><small style="opacity:0.6">(produto-fixador.jpg)</small></p>
          </div>
          <p class="specs-product-name">Fixador de Porcelanato</p>
          <span class="specs-product-mat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Aço Inox 304
          </span>
        </div>

        <!-- Selos de qualidade -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px;">
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:1.5rem;margin-bottom:6px;">🇧🇷</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);line-height:1.3">Fabricado<br>no Brasil</div>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:1.5rem;margin-bottom:6px;">🏆</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);line-height:1.3">Qualidade<br>Industrial</div>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:1.5rem;margin-bottom:6px;">⚡</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);line-height:1.3">Instalação<br>Rápida</div>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:1.5rem;margin-bottom:6px;">🔒</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);line-height:1.3">Alta<br>Segurança</div>
          </div>
        </div>
      </aside>

      <!-- Tabela técnica -->
      <div class="specs-table-side animate-on-scroll delay-2">
        <div class="section-tag blue">
          <i class="fas fa-clipboard-list" aria-hidden="true"></i>
          Ficha Técnica
        </div>
        <h2 id="specs-title">Especificações <span style="color:var(--accent)">Técnicas</span></h2>
        <p class="section-subtitle" style="color:rgba(255,255,255,0.55)">
          Dados técnicos completos para especificação em projetos de engenharia e arquitetura.
        </p>

        <table class="specs-table" aria-label="Especificações técnicas do fixador de porcelanato">
          <thead>
            <tr>
              <th scope="col">Especificação</th>
              <th scope="col">Valor / Descrição</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Material</td>
              <td>Aço Inoxidável 304</td>
            </tr>
            <tr>
              <td>Espessura</td>
              <td>0,8 mm</td>
            </tr>
            <tr>
              <td>Comprimento</td>
              <td>120 mm</td>
            </tr>
            <tr>
              <td>Largura</td>
              <td>40 mm</td>
            </tr>
            <tr>
              <td>Sistema de Fixação</td>
              <td>Bucha Prego 6 × 38 mm</td>
            </tr>
            <tr>
              <td>Acabamento</td>
              <td>Inox natural (escovado)</td>
            </tr>
            <tr>
              <td>Resistência à Corrosão</td>
              <td>Alta — ideal para ambientes externos</td>
            </tr>
            <tr>
              <td>Aplicações</td>
              <td>
                <div class="tag-list">
                  <span class="tag">Porcelanato</span>
                  <span class="tag">Cerâmica</span>
                  <span class="tag">Grande Formato</span>
                  <span class="tag">Fachadas</span>
                  <span class="tag">Revestimentos</span>
                </div>
              </td>
            </tr>
            <tr>
              <td>Normas de Referência</td>
              <td>ABNT NBR 13754 / NBR 14081</td>
            </tr>
            <tr>
              <td>Fabricante</td>
              <td>Pousinox — A Arte em Inox</td>
            </tr>
            <tr>
              <td>Origem</td>
              <td>Pouso Alegre — MG — Brasil</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top:32px;">
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="margin-right:12px;">
            <i class="fas fa-file-download" aria-hidden="true"></i>
            Solicitar Ficha Técnica
          </a>
          <a href="#contato" class="btn btn-outline-dark" style="border-color:rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);">
            <i class="fas fa-calculator" aria-hidden="true"></i>
            Calcular Quantidade
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- =====================================================
     APLICAÇÕES
     ===================================================== -->
<section class="section-aplicacoes" id="aplicacoes" aria-labelledby="aplicacoes-title">
  <div class="container">
    <div class="aplicacoes-header animate-on-scroll">
      <div class="section-tag">
        <i class="fas fa-building" aria-hidden="true"></i>
        Onde Aplicar
      </div>
      <h2 id="aplicacoes-title" class="section-title">Aplicações do <span>sistema de fixação</span></h2>
      <p class="section-subtitle" style="margin:0 auto">
        Versátil e eficiente para os mais variados tipos de projetos e ambientes da construção civil.
      </p>
    </div>

    <div class="aplicacoes-grid">

      <article class="aplicacao-card animate-on-scroll delay-1" aria-labelledby="aplic1-title">
        <div class="aplicacao-img-wrap">
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/aplic-fachada.jpg" alt="Fixador de porcelanato em fachadas externas de edifícios" class="aplicacao-img" loading="lazy">
          -->
          <div class="aplicacao-img-placeholder" style="background:linear-gradient(135deg,#E5E7EB,#F3F4F6);" role="img" aria-label="Aplicação em fachadas">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>
            <span style="color:rgba(255,255,255,0.4)">aplic-fachada.jpg</span>
          </div>
          <span class="aplicacao-badge">Fachadas</span>
        </div>
        <div class="aplicacao-content">
          <h3 id="aplic1-title">Fachadas Externas</h3>
          <p>Ancoragem obrigatória para fachadas ventiladas e revestimentos externos. Segurança máxima contra quedas.</p>
        </div>
      </article>

      <article class="aplicacao-card animate-on-scroll delay-2" aria-labelledby="aplic2-title">
        <div class="aplicacao-img-wrap">
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/aplic-interna.jpg" alt="Revestimento porcelanato em parede interna" class="aplicacao-img" loading="lazy">
          -->
          <div class="aplicacao-img-placeholder" style="background:linear-gradient(135deg,#E5E7EB,#F3F4F6);" role="img" aria-label="Aplicação em paredes internas">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="7" width="4" height="4"/><rect x="7" y="13" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/></svg>
            <span style="color:rgba(255,255,255,0.4)">aplic-interna.jpg</span>
          </div>
          <span class="aplicacao-badge">Int. / Ext.</span>
        </div>
        <div class="aplicacao-content">
          <h3 id="aplic2-title">Paredes Internas e Externas</h3>
          <p>Segurança adicional em paredes de salas, corredores, halls e áreas comuns de alto tráfego.</p>
        </div>
      </article>

      <article class="aplicacao-card animate-on-scroll delay-3" aria-labelledby="aplic3-title">
        <div class="aplicacao-img-wrap">
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/aplic-area-externa.jpg" alt="Porcelanato em área externa e varandas" class="aplicacao-img" loading="lazy">
          -->
          <div class="aplicacao-img-placeholder" style="background:linear-gradient(135deg,#E5E7EB,#F3F4F6);" role="img" aria-label="Aplicação em áreas externas">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span style="color:rgba(255,255,255,0.4)">aplic-area-externa.jpg</span>
          </div>
          <span class="aplicacao-badge">Área Externa</span>
        </div>
        <div class="aplicacao-content">
          <h3 id="aplic3-title">Áreas Externas e Varandas</h3>
          <p>Resistência total à umidade e intempéries. O inox garante durabilidade em ambientes agressivos.</p>
        </div>
      </article>

      <article class="aplicacao-card animate-on-scroll delay-1" aria-labelledby="aplic4-title">
        <div class="aplicacao-img-wrap">
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/aplic-residencial.jpg" alt="Obra residencial com revestimento porcelanato" class="aplicacao-img" loading="lazy">
          -->
          <div class="aplicacao-img-placeholder" style="background:linear-gradient(135deg,#E5E7EB,#F3F4F6);" role="img" aria-label="Aplicação em obras residenciais">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style="color:rgba(255,255,255,0.4)">aplic-residencial.jpg</span>
          </div>
          <span class="aplicacao-badge">Residencial</span>
        </div>
        <div class="aplicacao-content">
          <h3 id="aplic4-title">Obras Residenciais</h3>
          <p>Para casas e apartamentos que buscam máxima qualidade e segurança na instalação de revestimentos.</p>
        </div>
      </article>

      <article class="aplicacao-card animate-on-scroll delay-2" aria-labelledby="aplic5-title">
        <div class="aplicacao-img-wrap">
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/aplic-comercial.jpg" alt="Obra comercial com revestimento porcelanato em grande escala" class="aplicacao-img" loading="lazy">
          -->
          <div class="aplicacao-img-placeholder" style="background:linear-gradient(135deg,#E5E7EB,#F3F4F6);" role="img" aria-label="Aplicação em obras comerciais">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span style="color:rgba(255,255,255,0.4)">aplic-comercial.jpg</span>
          </div>
          <span class="aplicacao-badge">Comercial</span>
        </div>
        <div class="aplicacao-content">
          <h3 id="aplic5-title">Obras Comerciais</h3>
          <p>Shopping centers, hotéis, escritórios e lojas — onde a segurança e a responsabilidade são prioridade.</p>
        </div>
      </article>

      <article class="aplicacao-card animate-on-scroll delay-3" aria-labelledby="aplic6-title">
        <div class="aplicacao-img-wrap">
          <!--
            INSTRUÇÃO: Substitua por:
            <img src="/static/aplic-grande-formato.jpg" alt="Porcelanato de grande formato fixado em parede" class="aplicacao-img" loading="lazy">
          -->
          <div class="aplicacao-img-placeholder" style="background:linear-gradient(135deg,#E5E7EB,#F3F4F6);" role="img" aria-label="Aplicação em porcelanatos de grande formato">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            <span style="color:rgba(255,255,255,0.4)">aplic-grande-formato.jpg</span>
          </div>
          <span class="aplicacao-badge">Grande Formato</span>
        </div>
        <div class="aplicacao-content">
          <h3 id="aplic6-title">Porcelanato Grande Formato</h3>
          <p>A solução ideal para placas acima de 60×60 cm onde a segurança mecânica é essencial.</p>
        </div>
      </article>

    </div>
  </div>
</section>

<!-- =====================================================
     PRODUTO
     ===================================================== -->
<section class="section-produto" id="produto" aria-labelledby="produto-title">
  <div class="container">
    <div class="produto-layout">

      <!-- Imagem -->
      <div class="produto-img-frame animate-on-scroll">
        <!--
          INSTRUÇÃO: Substitua por:
          <img src="/static/produto-destaque.jpg" alt="Fixador de Porcelanato Pousinox — produto em aço inox" class="produto-img-main" loading="lazy">
        -->
        <div class="produto-img-placeholder" role="img" aria-label="Foto de destaque do produto fixador de porcelanato">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <p>Inserir foto de destaque do produto<br><small style="opacity:0.7">(produto-destaque.jpg)</small></p>
        </div>
        <div class="produto-img-badge" aria-label="Fabricante: Pousinox, Pouso Alegre MG">
          <div class="pib-label">Fabricante</div>
          <div class="pib-value">Pousinox · MG</div>
        </div>
      </div>

      <!-- Info -->
      <div class="produto-info animate-on-scroll delay-2">
        <div class="section-tag">
          <i class="fas fa-cube" aria-hidden="true"></i>
          O Produto
        </div>
        <h2 id="produto-title">Fixador de Porcelanato<br><span>em Aço Inox</span></h2>
        <p class="produto-desc">
          Desenvolvido pela Pousinox — A Arte em Inox, o fixador de porcelanato é fabricado em aço inoxidável 304 para garantir máxima durabilidade e resistência. Criado para aumentar a segurança na instalação de revestimentos cerâmicos em paredes, o produto oferece um ponto de ancoragem mecânica adicional que complementa a argamassa e evita o desprendimento das placas.
        </p>

        <ul class="produto-features" aria-label="Características do produto" role="list">
          <li class="produto-feature" role="listitem">
            <div class="pf-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span>Fabricado em aço inox 304 — anticorrosão total</span>
          </li>
          <li class="produto-feature" role="listitem">
            <div class="pf-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span>Espessura 0,8 mm — resistência com leveza</span>
          </li>
          <li class="produto-feature" role="listitem">
            <div class="pf-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span>Dimensões otimizadas: 120 mm × 40 mm</span>
          </li>
          <li class="produto-feature" role="listitem">
            <div class="pf-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span>Fixação com bucha prego 6 × 38 mm — ancoragem segura</span>
          </li>
          <li class="produto-feature" role="listitem">
            <div class="pf-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span>Discreto — invisível após a instalação do revestimento</span>
          </li>
          <li class="produto-feature" role="listitem">
            <div class="pf-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span>Fabricação nacional — entrega para todo o Brasil</span>
          </li>
        </ul>

        <div class="produto-actions">
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg">
            <i class="fas fa-shopping-cart" aria-hidden="true"></i>
            Comprar Agora
          </a>
          <a href="#contato" class="btn btn-outline-dark btn-lg">
            <i class="fas fa-file-alt" aria-hidden="true"></i>
            Solicitar Orçamento
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- =====================================================
     FORMULÁRIO DE CONTATO / LEAD
     ===================================================== -->
<section style="padding:80px 0;background:#f8fafc;border-top:1px solid #e5e7eb;" id="contato" aria-labelledby="contato-title">
  <div class="container">
    <div style="max-width:700px;margin:0 auto;text-align:center;" class="animate-on-scroll">
      <div class="section-tag" style="justify-content:center;">
        <i class="fas fa-envelope" aria-hidden="true"></i>
        Solicitar Orçamento
      </div>
      <h2 id="contato-title" class="section-title">Entre em <span>contato</span> conosco</h2>
      <p class="section-subtitle" style="margin:0 auto 40px">
        Preencha o formulário ou fale diretamente pelo WhatsApp. Nossa equipe técnica responde rapidamente.
      </p>
    </div>

    <div style="max-width:700px;margin:0 auto;background:white;border-radius:20px;padding:48px;box-shadow:0 20px 60px rgba(0,0,0,0.08);border:1px solid #e5e7eb;" class="animate-on-scroll delay-2">
      <form id="lead-form" novalidate aria-label="Formulário de contato e orçamento">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <div>
            <label for="nome" style="display:block;font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:6px;">Nome completo *</label>
            <input type="text" id="nome" name="nome" required placeholder="Seu nome" 
              style="width:100%;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:0.9rem;outline:none;transition:border-color 0.2s;font-family:inherit;"
              onfocus="this.style.borderColor='#F97316'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
          <div>
            <label for="empresa" style="display:block;font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:6px;">Empresa / Profissão</label>
            <input type="text" id="empresa" name="empresa" placeholder="Ex: Construtora ABC" 
              style="width:100%;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:0.9rem;outline:none;transition:border-color 0.2s;font-family:inherit;"
              onfocus="this.style.borderColor='#F97316'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <div>
            <label for="telefone" style="display:block;font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:6px;">WhatsApp / Telefone *</label>
            <input type="tel" id="telefone" name="telefone" required placeholder="(35) 9 0000-0000" 
              style="width:100%;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:0.9rem;outline:none;transition:border-color 0.2s;font-family:inherit;"
              onfocus="this.style.borderColor='#F97316'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
          <div>
            <label for="email" style="display:block;font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:6px;">E-mail</label>
            <input type="email" id="email" name="email" placeholder="seu@email.com" 
              style="width:100%;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:0.9rem;outline:none;transition:border-color 0.2s;font-family:inherit;"
              onfocus="this.style.borderColor='#F97316'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
        </div>
        <div style="margin-bottom:20px;">
          <label for="tipo-obra" style="display:block;font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:6px;">Tipo de obra</label>
          <select id="tipo-obra" name="tipo-obra" 
            style="width:100%;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:0.9rem;outline:none;background:white;font-family:inherit;cursor:pointer;"
            onfocus="this.style.borderColor='#F97316'" onblur="this.style.borderColor='#E5E7EB'">
            <option value="">Selecione o tipo de obra</option>
            <option value="residencial">Residencial</option>
            <option value="comercial">Comercial</option>
            <option value="fachada">Fachada / Área externa</option>
            <option value="industrial">Industrial</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div style="margin-bottom:28px;">
          <label for="mensagem" style="display:block;font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:6px;">Mensagem / Detalhes do projeto</label>
          <textarea id="mensagem" name="mensagem" rows="4" placeholder="Descreva o seu projeto, quantidade necessária, prazo, etc." 
            style="width:100%;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:0.9rem;outline:none;resize:vertical;font-family:inherit;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='#F97316'" onblur="this.style.borderColor='#E5E7EB'"></textarea>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <button type="submit" class="btn btn-primary btn-lg" style="flex:1;justify-content:center;">
            <i class="fas fa-paper-plane" aria-hidden="true"></i>
            Solicitar Orçamento
          </button>
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-lg" style="flex:1;justify-content:center;">
            <i class="fab fa-whatsapp" aria-hidden="true"></i>
            Resposta Rápida via WhatsApp
          </a>
        </div>
      </form>
    </div>
  </div>
</section>

<!-- =====================================================
     CALL TO ACTION FINAL
     ===================================================== -->
<section class="section-cta" id="cta" aria-labelledby="cta-title">
  <div class="cta-grid-bg" aria-hidden="true"></div>
  <div class="container">
    <div class="cta-content animate-on-scroll">
      <div class="section-tag" style="justify-content:center;margin-bottom:24px;">
        <i class="fas fa-bolt" aria-hidden="true"></i>
        Ação Imediata
      </div>
      <h2 id="cta-title">Garanta mais <span>segurança</span><br>na instalação do porcelanato</h2>
      <p>
        Não arrisque a integridade da sua obra. O Fixador de Porcelanato Pousinox oferece a ancoragem mecânica que faltava para uma instalação verdadeiramente segura e duradoura.
      </p>
      <div class="cta-actions">
        <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg">
          <i class="fas fa-shopping-cart" aria-hidden="true"></i>
          Comprar Agora
        </a>
        <a href="#contato" class="btn btn-outline btn-lg">
          <i class="fas fa-file-alt" aria-hidden="true"></i>
          Solicitar Orçamento
        </a>
        <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-lg">
          <i class="fab fa-whatsapp" aria-hidden="true"></i>
          Falar no WhatsApp
        </a>
      </div>
      <div class="cta-guarantees" role="list" aria-label="Garantias">
        <div class="cta-guarantee" role="listitem">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          Fabricação nacional — Pouso Alegre MG
        </div>
        <div class="cta-guarantee" role="listitem">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          Aço inox 304 — alta durabilidade
        </div>
        <div class="cta-guarantee" role="listitem">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          Entrega para todo o Brasil
        </div>
        <div class="cta-guarantee" role="listitem">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          Suporte técnico especializado
        </div>
      </div>
    </div>
  </div>
</section>

<!-- =====================================================
     FOOTER
     ===================================================== -->
<footer class="footer" role="contentinfo">
  <div class="container">
    <div class="footer-grid">

      <!-- Brand -->
      <div class="footer-brand">
        <div class="brand-name">POUSINOX</div>
        <div class="brand-tagline">A Arte em Inox</div>
        <p>
          Fabricante especializado em produtos de aço inox para construção civil. Desenvolvemos soluções técnicas que unem segurança, durabilidade e qualidade industrial.
        </p>
        <div style="margin-top:20px;display:flex;gap:12px;">
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" style="width:40px;height:40px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;display:flex;align-items:center;justify-content:center;text-decoration:none;transition:all 0.2s;" aria-label="WhatsApp Pousinox">
            <i class="fab fa-whatsapp" style="color:rgba(255,255,255,0.5);font-size:1.1rem;" aria-hidden="true"></i>
          </a>
          <a href="#" style="width:40px;height:40px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;display:flex;align-items:center;justify-content:center;text-decoration:none;transition:all 0.2s;" aria-label="Instagram Pousinox">
            <i class="fab fa-instagram" style="color:rgba(255,255,255,0.5);font-size:1.1rem;" aria-hidden="true"></i>
          </a>
          <a href="#" style="width:40px;height:40px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;display:flex;align-items:center;justify-content:center;text-decoration:none;transition:all 0.2s;" aria-label="YouTube Pousinox">
            <i class="fab fa-youtube" style="color:rgba(255,255,255,0.5);font-size:1.1rem;" aria-hidden="true"></i>
          </a>
        </div>
      </div>

      <!-- Links -->
      <div class="footer-col">
        <h4>Navegação</h4>
        <ul role="list">
          <li role="listitem"><a href="#problema">O Problema</a></li>
          <li role="listitem"><a href="#como-funciona">Como Funciona</a></li>
          <li role="listitem"><a href="#videos">Vídeos</a></li>
          <li role="listitem"><a href="#beneficios">Benefícios</a></li>
          <li role="listitem"><a href="#specs">Especificações</a></li>
          <li role="listitem"><a href="#aplicacoes">Aplicações</a></li>
          <li role="listitem"><a href="#produto">Produto</a></li>
          <li role="listitem"><a href="#contato">Contato</a></li>
        </ul>
      </div>

      <!-- Contato -->
      <div class="footer-col">
        <h4>Contato</h4>
        <div class="footer-contact-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Pouso Alegre — MG — Brasil
        </div>
        <div class="footer-contact-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" style="color:rgba(255,255,255,0.4);text-decoration:none;">Falar pelo WhatsApp</a>
        </div>
        <div style="margin-top:20px;">
          <p style="font-size:0.75rem;color:rgba(255,255,255,0.3);line-height:1.5;font-style:italic;">
            "Unimos tecnologia, precisão e qualidade para entregar o melhor em produtos de inox para a construção civil."
          </p>
        </div>
      </div>

    </div>

    <div class="footer-bottom">
      <p>© 2024 Pousinox — A Arte em Inox. Todos os direitos reservados. Pouso Alegre · MG · Brasil</p>
      <p class="footer-seo-keywords" aria-hidden="true">
        fixador de porcelanato · fixação porcelanato parede · ancoragem porcelanato · segurança porcelanato fachada · fixador porcelanato grande formato · pousinox · pouso alegre · inox construção civil
      </p>
    </div>
  </div>
</footer>

<!-- =====================================================
     FLOATING ELEMENTS
     ===================================================== -->
<!-- WhatsApp Float Button -->
<a href="${whatsappUrl}" 
   target="_blank" 
   rel="noopener noreferrer" 
   class="whatsapp-float"
   aria-label="Falar com a Pousinox pelo WhatsApp">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
</a>

<!-- Scroll to Top -->
<button class="scroll-top" aria-label="Voltar ao topo da página" title="Voltar ao topo">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
</button>

<!-- Scripts -->
<script src="/static/app.js" defer></script>

</body>
</html>`)
})

export default app
