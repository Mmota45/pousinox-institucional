/* ============================================
   POUSINOX — Painel Admin — JavaScript
   ============================================ */
(function () {
  'use strict';

  /* ── CONFIG PADRÃO ── */
  const DEFAULT_CONFIG = {
    whatsapp: {
      numero: '5535999999999',
      mensagem: 'Olá! Tenho interesse no Fixador de Porcelanato da Pousinox. Pode me ajudar?'
    },
    imagens: {
      hero: '',
      etapa1: '', etapa2: '', etapa3: '', etapa4: '',
      produto_specs: '', produto_destaque: '',
      aplic_fachada: '', aplic_interna: '', aplic_externa: '',
      aplic_residencial: '', aplic_comercial: '', aplic_grande_formato: ''
    },
    videos: {
      principal: '', preparacao: '', aplicacao: '', obra_real: ''
    }
  };

  /* ── ESTADO ── */
  let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  let unsaved = false;
  let currentImageTarget = null;

  /* ── UTILS ── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function toast(msg, type = 'success', duration = 3000) {
    const icons = {
      success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
      error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
      info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
    };
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icons[type]}</svg><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  function markUnsaved() {
    unsaved = true;
    const bar = $('#status-bar');
    bar.className = 'status-bar saving';
    bar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Alterações não salvas`;
  }

  function markSaved() {
    unsaved = false;
    const bar = $('#status-bar');
    bar.className = 'status-bar saved';
    bar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Configurações salvas com sucesso`;
  }

  /* ── EXTRAIR ID YOUTUBE ── */
  function extractYoutubeId(url) {
    if (!url) return null;
    // Aceita: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /v=([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  function buildEmbedUrl(input) {
    if (!input) return '';
    if (input.includes('youtube.com/embed/')) return input;
    const id = extractYoutubeId(input);
    if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
    return input; // Retorna como está (outros provedores)
  }

  /* ── LOAD / SAVE CONFIG ── */
  function loadConfig() {
    try {
      const stored = localStorage.getItem('pousinox_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge com defaults para garantir chaves novas
        config = {
          whatsapp: { ...DEFAULT_CONFIG.whatsapp, ...parsed.whatsapp },
          imagens: { ...DEFAULT_CONFIG.imagens, ...parsed.imagens },
          videos: { ...DEFAULT_CONFIG.videos, ...parsed.videos }
        };
      }
    } catch (e) {
      console.warn('Config load error:', e);
    }
    applyConfigToForm();
    updateStats();
  }

  function saveConfig() {
    collectFormValues();
    localStorage.setItem('pousinox_config', JSON.stringify(config));
    markSaved();
    toast('Configurações salvas! A landing page foi atualizada.', 'success');
    updateStats();
    // Envia evento para a landing page (caso esteja em iframe ou outra aba)
    try {
      if (window.opener) window.opener.postMessage({ type: 'POUSINOX_CONFIG_UPDATE', config }, '*');
    } catch (e) {}
  }

  function collectFormValues() {
    // WhatsApp
    config.whatsapp.numero = ($('#wa-numero')?.value || '').replace(/\D/g, '');
    config.whatsapp.mensagem = $('#wa-mensagem')?.value || '';

    // Imagens — via inputs dentro de cada img-card
    $$('[data-img-key]').forEach(el => {
      config.imagens[el.dataset.imgKey] = el.value.trim();
    });

    // Videos
    $$('[data-video-key]').forEach(el => {
      config.videos[el.dataset.videoKey] = el.value.trim();
    });
  }

  function applyConfigToForm() {
    // WhatsApp
    const waNum = $('#wa-numero');
    const waMsg = $('#wa-mensagem');
    if (waNum) waNum.value = config.whatsapp.numero;
    if (waMsg) waMsg.value = config.whatsapp.mensagem;
    updateWaPreview();

    // Imagens
    $$('[data-img-key]').forEach(el => {
      const key = el.dataset.imgKey;
      el.value = config.imagens[key] || '';
      updateImgCard(key);
    });

    // Videos
    $$('[data-video-key]').forEach(el => {
      const key = el.dataset.videoKey;
      el.value = config.videos[key] || '';
      updateVideoCard(key);
    });
  }

  /* ── WHATSAPP PREVIEW ── */
  function updateWaPreview() {
    const num = ($('#wa-numero')?.value || '').replace(/\D/g, '');
    const msg = $('#wa-mensagem')?.value || '';
    const link = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : '#';
    const previewEl = $('#wa-link-preview');
    if (previewEl) previewEl.href = link;
    const numEl = $('#wa-number-display');
    if (numEl) numEl.textContent = num ? `+${num}` : 'Número não informado';
  }

  /* ── IMAGE CARD UPDATE ── */
  function updateImgCard(key) {
    const card = $(`[data-card-key="${key}"]`);
    if (!card) return;
    const url = config.imagens[key] || '';
    const preview = card.querySelector('.img-preview');
    const placeholder = card.querySelector('.img-placeholder');
    const status = card.querySelector('.img-status');

    if (url) {
      if (preview) {
        preview.src = url;
        preview.style.display = 'block';
        preview.onerror = () => {
          preview.style.display = 'none';
          if (placeholder) placeholder.style.display = 'flex';
          if (status) { status.className = 'img-status empty'; status.innerHTML = '● Erro na URL'; }
        };
      }
      if (placeholder) placeholder.style.display = 'none';
      if (status) { status.className = 'img-status ok'; status.innerHTML = '● Imagem definida'; }
      card.classList.add('has-image');
    } else {
      if (preview) preview.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
      if (status) { status.className = 'img-status empty'; status.innerHTML = '● Sem imagem'; }
      card.classList.remove('has-image');
    }
  }

  /* ── VIDEO CARD UPDATE ── */
  function updateVideoCard(key) {
    const card = $(`[data-video-card="${key}"]`);
    if (!card) return;
    const raw = config.videos[key] || '';
    const thumb = card.querySelector('.video-thumb');
    const badge = card.querySelector('.vt-badge');

    if (raw) {
      thumb.classList.add('has-video');
      if (badge) { badge.style.display = 'flex'; badge.textContent = '✓ Configurado'; }
    } else {
      thumb.classList.remove('has-video');
      if (badge) badge.style.display = 'none';
    }
  }

  /* ── STATS ── */
  function updateStats() {
    const imgCount = Object.values(config.imagens).filter(v => v).length;
    const imgTotal = Object.keys(config.imagens).length;
    const vidCount = Object.values(config.videos).filter(v => v).length;
    const vidTotal = Object.keys(config.videos).length;
    const waOk = config.whatsapp.numero ? 1 : 0;

    const s = {
      'stat-img': `${imgCount}/${imgTotal}`,
      'stat-vid': `${vidCount}/${vidTotal}`,
      'stat-wa': waOk ? config.whatsapp.numero : '—',
      'stat-status': (imgCount + vidCount + waOk) > 0 ? 'Ativo' : 'Vazio'
    };
    Object.keys(s).forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.textContent = s[id];
    });
  }

  /* ── SIDEBAR NAVIGATION ── */
  function initNav() {
    $$('.sidebar-item[data-section]').forEach(item => {
      item.addEventListener('click', () => {
        const sec = item.dataset.section;
        $$('.sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        $$('.section-view').forEach(v => v.classList.remove('active'));
        const view = $(`#sec-${sec}`);
        if (view) view.classList.add('active');
      });
    });
  }

  /* ── IMAGE EVENTS ── */
  function initImageEvents() {
    // Input URL change
    $$('[data-img-key]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.imgKey;
        config.imagens[key] = input.value.trim();
        updateImgCard(key);
        markUnsaved();
      });
    });

    // Botão "Carregar URL"
    $$('.btn-load-url').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.imgKey;
        updateImgCard(key);
      });
    });

    // Botão "Remover"
    $$('.btn-remove-img').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.imgKey;
        const input = $(`[data-img-key="${key}"]`);
        if (input) input.value = '';
        config.imagens[key] = '';
        updateImgCard(key);
        markUnsaved();
      });
    });

    // Placeholder click → modal
    $$('.img-placeholder[data-img-key]').forEach(ph => {
      ph.addEventListener('click', () => {
        openImageModal(ph.dataset.imgKey);
      });
    });
  }

  /* ── IMAGE MODAL ── */
  function openImageModal(key) {
    currentImageTarget = key;
    const modal = $('#img-modal');
    const title = $('#img-modal-title');
    if (title) {
      const labels = {
        hero: 'Hero — Imagem principal', etapa1: 'Etapa 1 — Preparação',
        etapa2: 'Etapa 2 — Aplicação', etapa3: 'Etapa 3 — Placas preparadas',
        etapa4: 'Etapa 4 — Fixação na parede', produto_specs: 'Produto — Ficha técnica',
        produto_destaque: 'Produto — Destaque', aplic_fachada: 'Aplicação — Fachadas',
        aplic_interna: 'Aplicação — Paredes internas', aplic_externa: 'Aplicação — Área externa',
        aplic_residencial: 'Aplicação — Residencial', aplic_comercial: 'Aplicação — Comercial',
        aplic_grande_formato: 'Aplicação — Grande formato'
      };
      title.textContent = labels[key] || key;
    }
    const urlInput = $('#modal-img-url');
    if (urlInput) urlInput.value = config.imagens[key] || '';
    modal.classList.remove('hidden');
  }

  function initModalEvents() {
    // Fechar
    $('#img-modal-close')?.addEventListener('click', () => $('#img-modal').classList.add('hidden'));
    $('#img-modal-cancel')?.addEventListener('click', () => $('#img-modal').classList.add('hidden'));
    $('#img-modal')?.addEventListener('click', e => {
      if (e.target === $('#img-modal')) $('#img-modal').classList.add('hidden');
    });

    // Confirmar URL
    $('#img-modal-confirm')?.addEventListener('click', () => {
      const url = $('#modal-img-url')?.value.trim();
      if (currentImageTarget) {
        config.imagens[currentImageTarget] = url;
        const input = $(`[data-img-key="${currentImageTarget}"]`);
        if (input) input.value = url;
        updateImgCard(currentImageTarget);
        markUnsaved();
      }
      $('#img-modal').classList.add('hidden');
      toast('Imagem atualizada!', 'success', 2000);
    });

    // Upload arquivo
    const fileInput = $('#modal-file-input');
    const dropZone = $('#drop-zone');

    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone?.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const file = e.dataTransfer?.files[0];
      if (file) handleFileUpload(file);
    });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) handleFileUpload(file);
    });
  }

  function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) {
      toast('Selecione um arquivo de imagem (JPG, PNG, WebP)', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Imagem muito grande. Máximo 10MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      const urlInput = $('#modal-img-url');
      if (urlInput) urlInput.value = dataUrl;
      toast('Imagem carregada! Clique em "Aplicar" para confirmar.', 'info', 3000);
    };
    reader.readAsDataURL(file);
  }

  /* ── VIDEO EVENTS ── */
  function initVideoEvents() {
    $$('[data-video-key]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.videoKey;
        config.videos[key] = input.value.trim();
        updateVideoCard(key);
        markUnsaved();
      });
    });

    $$('.btn-test-video').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.videoKey;
        const raw = config.videos[key] || '';
        if (!raw) { toast('Insira uma URL de vídeo primeiro.', 'error'); return; }
        const embed = buildEmbedUrl(raw);
        window.open(embed, '_blank');
      });
    });
  }

  /* ── WHATSAPP EVENTS ── */
  function initWaEvents() {
    $('#wa-numero')?.addEventListener('input', () => { updateWaPreview(); markUnsaved(); });
    $('#wa-mensagem')?.addEventListener('input', () => { updateWaPreview(); markUnsaved(); });

    $('#btn-test-wa')?.addEventListener('click', () => {
      const num = ($('#wa-numero')?.value || '').replace(/\D/g, '');
      const msg = $('#wa-mensagem')?.value || '';
      if (!num) { toast('Digite o número do WhatsApp primeiro.', 'error'); return; }
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }

  /* ── SAVE BUTTON ── */
  function initSaveButton() {
    $$('.btn-save').forEach(btn => {
      btn.addEventListener('click', saveConfig);
    });
  }

  /* ── EXPORT CONFIG ── */
  window.exportConfig = function () {
    collectFormValues();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pousinox-config.json';
    a.click();
    toast('Arquivo de configuração baixado!', 'success');
  };

  /* ── IMPORT CONFIG ── */
  window.importConfig = function () {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const imported = JSON.parse(ev.target.result);
          config = { ...DEFAULT_CONFIG, ...imported };
          localStorage.setItem('pousinox_config', JSON.stringify(config));
          applyConfigToForm();
          markSaved();
          updateStats();
          toast('Configuração importada com sucesso!', 'success');
        } catch (err) {
          toast('Arquivo JSON inválido.', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  /* ── RESET ── */
  window.resetConfig = function () {
    if (!confirm('Tem certeza que quer redefinir tudo para os valores padrão?')) return;
    config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    localStorage.removeItem('pousinox_config');
    applyConfigToForm();
    markSaved();
    updateStats();
    toast('Configurações redefinidas!', 'info');
  };

  /* ── FORMAT PHONE ── */
  function formatPhone(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 13) v = v.slice(0, 13);
    input.value = v;
  }
  document.getElementById('wa-numero')?.addEventListener('input', function () { formatPhone(this); });

  /* ── INIT ── */
  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    loadConfig();
    initImageEvents();
    initModalEvents();
    initVideoEvents();
    initWaEvents();
    initSaveButton();

    // Alerta de saída com alterações não salvas
    window.addEventListener('beforeunload', e => {
      if (unsaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  });

})();
