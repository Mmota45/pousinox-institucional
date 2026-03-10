/* ============================================
   POUSINOX - Fixador de Porcelanato
   JavaScript Principal + Integração Admin
   ============================================ */

/* ────────────────────────────────────────────
   APPLY ADMIN CONFIG
   Lê a configuração salva pelo painel admin e
   aplica dinamicamente na landing page.
──────────────────────────────────────────── */
(function applyAdminConfig() {
  try {
    const raw = localStorage.getItem('pousinox_config');
    if (!raw) return;
    const cfg = JSON.parse(raw);

    /* ── WHATSAPP ── */
    if (cfg.whatsapp?.numero) {
      const num = cfg.whatsapp.numero.replace(/\D/g, '');
      const msg = encodeURIComponent(cfg.whatsapp.mensagem || 'Olá! Tenho interesse no Fixador de Porcelanato da Pousinox. Pode me ajudar?');
      const newUrl = 'https://wa.me/' + num + '?text=' + msg;

      // Atualiza todos os links de WhatsApp na página
      document.querySelectorAll('a[href*="wa.me"]').forEach(function(el) {
        el.href = newUrl;
      });
    }

    /* ── IMAGENS ── */
    var imgMap = {
      'hero':                 { selector: '.hero-img-placeholder', imgClass: 'hero-img', alt: 'Instalação fixador de porcelanato', cls: 'hero-img' },
      'etapa1':               { selector: '[aria-label="Imagem: preparação do porcelanato com esmerilhadeira"]', imgClass: 'etapa-img', alt: 'Preparação do porcelanato' },
      'etapa2':               { selector: '[aria-label="Imagem: aplicação do fixador metálico com argamassa"]', imgClass: 'etapa-img', alt: 'Aplicação do fixador' },
      'etapa3':               { selector: '[aria-label="Imagem: placas preparadas com fixadores posicionados"]', imgClass: 'etapa-img', alt: 'Placas preparadas' },
      'etapa4':               { selector: '[aria-label="Imagem: fixação do porcelanato na parede com bucha prego"]', imgClass: 'etapa-img', alt: 'Fixação na parede' },
      'produto_specs':        { selector: '.specs-product-img-placeholder', imgClass: 'specs-product-img', alt: 'Fixador de Porcelanato Pousinox' },
      'produto_destaque':     { selector: '.produto-img-placeholder', imgClass: 'produto-img-main', alt: 'Produto fixador de porcelanato' },
      'aplic_fachada':        { selector: '[aria-label="Aplicação em fachadas"]', imgClass: 'aplicacao-img', alt: 'Fachadas externas' },
      'aplic_interna':        { selector: '[aria-label="Aplicação em paredes internas"]', imgClass: 'aplicacao-img', alt: 'Paredes internas e externas' },
      'aplic_externa':        { selector: '[aria-label="Aplicação em áreas externas"]', imgClass: 'aplicacao-img', alt: 'Áreas externas' },
      'aplic_residencial':    { selector: '[aria-label="Aplicação em obras residenciais"]', imgClass: 'aplicacao-img', alt: 'Obras residenciais' },
      'aplic_comercial':      { selector: '[aria-label="Aplicação em obras comerciais"]', imgClass: 'aplicacao-img', alt: 'Obras comerciais' },
      'aplic_grande_formato': { selector: '[aria-label="Aplicação em porcelanatos de grande formato"]', imgClass: 'aplicacao-img', alt: 'Grande formato' }
    };

    if (cfg.imagens) {
      var imgKeys = Object.keys(cfg.imagens);
      for (var ik = 0; ik < imgKeys.length; ik++) {
        var imgKey = imgKeys[ik];
        var imgUrl = cfg.imagens[imgKey];
        if (!imgUrl) continue;
        var imgMap2 = imgMap[imgKey];
        if (!imgMap2) continue;
        var placeholder = document.querySelector(imgMap2.selector);
        if (!placeholder) continue;
        var img = document.createElement('img');
        img.src = imgUrl;
        img.alt = imgMap2.alt;
        img.className = imgMap2.imgClass;
        img.loading = 'lazy';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        (function(el){ el.onerror = function() { el.remove(); }; })(img);
        if (placeholder.parentNode) placeholder.parentNode.replaceChild(img, placeholder);
      }
    }

    /* ── VÍDEOS ── */
    var videoMap = {
      'principal':  0,
      'preparacao': 1,
      'aplicacao':  2,
      'obra_real':  3
    };

    if (cfg.videos) {
      var videoPlaceholders = document.querySelectorAll('.video-embed-placeholder');
      var vidKeys = Object.keys(cfg.videos);
      for (var vk = 0; vk < vidKeys.length; vk++) {
        var vidKey = vidKeys[vk];
        var rawUrl = cfg.videos[vidKey];
        if (!rawUrl) continue;
        var vidIdx = videoMap[vidKey];
        if (vidIdx === undefined) continue;
        var vidPlaceholder = videoPlaceholders[vidIdx];
        if (!vidPlaceholder) continue;
        var embedUrl = buildEmbedUrl(rawUrl);
        vidPlaceholder.setAttribute('data-video-url', embedUrl);
      }
    }

  } catch (e) {
    console.warn('[Pousinox] Erro ao aplicar configuração do admin:', e);
  }

  function buildEmbedUrl(url) {
    if (!url) return '';
    if (url.includes('youtube.com/embed/')) return url;
    var patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /v=([a-zA-Z0-9_-]{11})/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = url.match(patterns[i]);
      if (m) return 'https://www.youtube.com/embed/' + m[1] + '?rel=0';
    }
    return url;
  }
})();

/* Ouve atualizações do admin em tempo real (quando aberto em outra aba) */
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'POUSINOX_CONFIG_UPDATE') {
    location.reload();
  }
});

document.addEventListener('DOMContentLoaded', function () {

  /* ---- NAVBAR SCROLL ---- */
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.style.background = 'rgba(15, 15, 26, 0.98)';
      navbar.style.boxShadow = '0 4px 30px rgba(0,0,0,0.3)';
    } else {
      navbar.style.background = 'rgba(15, 15, 26, 0.95)';
      navbar.style.boxShadow = 'none';
    }
  });

  /* ---- HAMBURGER MENU ---- */
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.navbar-nav');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      spans.forEach(s => s.style.background = navMenu.classList.contains('open') ? '#e8751a' : '#fff');
    });

    // Close on link click
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navMenu.classList.remove('open'));
    });
  }

  /* ---- SCROLL TO TOP ---- */
  const scrollTopBtn = document.querySelector('.scroll-top');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) scrollTopBtn.classList.add('visible');
      else scrollTopBtn.classList.remove('visible');
    });
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---- ANIMATE ON SCROLL ---- */
  const animateElements = document.querySelectorAll('.animate-on-scroll');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    animateElements.forEach(el => observer.observe(el));
  } else {
    animateElements.forEach(el => el.classList.add('in-view'));
  }

  /* ---- SMOOTH SCROLL FOR ANCHOR LINKS ---- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ---- COUNTER ANIMATION ---- */
  function animateCounter(el, target, duration = 1500) {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        el.textContent = target;
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(start);
      }
    }, 16);
  }

  const counterElements = document.querySelectorAll('[data-counter]');
  if (counterElements.length && 'IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = parseInt(entry.target.getAttribute('data-counter'));
          animateCounter(entry.target, target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counterElements.forEach(el => counterObserver.observe(el));
  }

  /* ---- VIDEO PLACEHOLDER CLICK ---- */
  document.querySelectorAll('.video-embed-placeholder').forEach(placeholder => {
    placeholder.addEventListener('click', function () {
      const videoUrl = this.getAttribute('data-video-url');
      if (videoUrl) {
        const iframe = document.createElement('iframe');
        iframe.src = videoUrl;
        iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        this.style.position = 'relative';
        this.innerHTML = '';
        this.appendChild(iframe);
      } else {
        this.querySelector('p') && (this.querySelector('p').textContent = 'Adicione a URL do vídeo no atributo data-video-url');
      }
    });
  });

  /* ---- FORM SUBMIT ---- */
  const leadForm = document.getElementById('lead-form');
  if (leadForm) {
    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type="submit"]');
      const orig = btn.textContent;
      btn.textContent = 'Enviando...';
      btn.disabled = true;
      // Simula envio - integrar com backend real
      setTimeout(() => {
        btn.textContent = '✓ Mensagem enviada!';
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.textContent = orig;
          btn.disabled = false;
          btn.style.background = '';
          leadForm.reset();
        }, 3000);
      }, 1500);
    });
  }

});
