#!/usr/bin/env node
/**
 * validate-seo.js — Valida SEO e Schema.org antes do deploy
 * Uso: node scripts/validate-seo.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'index.html');

let errors = 0;
let warnings = 0;

function err(msg)  { console.error(`  \u2716 ERRO: ${msg}`); errors++; }
function warn(msg) { console.warn(`  \u26A0 AVISO: ${msg}`); warnings++; }
function ok(msg)   { console.log(`  \u2714 ${msg}`); }
function section(title) { console.log(`\n[${title}]`); }

// ---------------------------------------------------------------------------
// Lê o HTML
// ---------------------------------------------------------------------------
if (!fs.existsSync(HTML_FILE)) {
  console.error('ERRO: index.html não encontrado em ' + ROOT);
  process.exit(1);
}
const html = fs.readFileSync(HTML_FILE, 'utf-8');

// ---------------------------------------------------------------------------
// Meta tags obrigatórias
// ---------------------------------------------------------------------------
section('Meta Tags');

const metaChecks = [
  [/<title>[^<]{10,}<\/title>/,              '<title> presente e com texto'],
  [/<meta name="description" content=".{50,}"/, 'meta description (50+ chars)'],
  [/<link rel="canonical"/,                  'canonical presente'],
  [/<meta property="og:title"/,              'og:title presente'],
  [/<meta property="og:description"/,        'og:description presente'],
  [/<meta property="og:image"/,              'og:image presente'],
  [/<meta property="og:url"/,                'og:url presente'],
  [/<meta name="twitter:card"/,              'twitter:card presente'],
];

for (const [regex, label] of metaChecks) {
  if (regex.test(html)) ok(label);
  else err(`${label} — ausente ou inválido`);
}

if (!/og:image:width/.test(html))  warn('og:image:width não definido (recomendado: 1200)');
if (!/og:image:height/.test(html)) warn('og:image:height não definido (recomendado: 630)');

// ---------------------------------------------------------------------------
// Schema.org JSON-LD
// ---------------------------------------------------------------------------
section('Schema.org JSON-LD');

const scriptBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

if (scriptBlocks.length === 0) {
  err('Nenhum bloco application/ld+json encontrado');
} else {
  ok(`${scriptBlocks.length} bloco(s) JSON-LD encontrado(s)`);
}

for (const [, raw] of scriptBlocks) {
  let schema;
  try {
    schema = JSON.parse(raw);
  } catch (e) {
    err(`JSON-LD inválido (parse error): ${e.message}`);
    continue;
  }

  const type = schema['@type'];
  console.log(`\n  Schema: ${type}`);

  // --- Product ---
  if (type === 'Product') {
    if (!schema.name)        err('Product: "name" obrigatório ausente');
    else                      ok('Product.name presente');

    if (!schema.image)       err('Product: "image" obrigatório ausente');
    else                      ok('Product.image presente');

    if (!schema.description) warn('Product: "description" recomendado ausente');
    else                      ok('Product.description presente');

    if (!schema.brand)       warn('Product: "brand" recomendado ausente');
    else                      ok('Product.brand presente');

    if (schema.offers) {
      const price = schema.offers.price;
      if (price === undefined || price === null || price === '') {
        err('Product.offers: "price" obrigatório ausente — remova offers ou adicione price');
      }
      if (!schema.offers.priceCurrency) {
        err('Product.offers: "priceCurrency" obrigatório ausente');
      }
    }
  }

  // --- LocalBusiness ---
  if (type === 'LocalBusiness') {
    if (!schema.name)      err('LocalBusiness: "name" obrigatório ausente');
    else                    ok('LocalBusiness.name presente');

    if (!schema.address)   err('LocalBusiness: "address" obrigatório ausente');
    else                    ok('LocalBusiness.address presente');

    if (!schema.telephone) warn('LocalBusiness: "telephone" recomendado ausente');
    else                    ok('LocalBusiness.telephone presente');

    if (!schema.url)       warn('LocalBusiness: "url" recomendado ausente');
    else                    ok('LocalBusiness.url presente');
  }

  // --- FAQPage ---
  if (type === 'FAQPage') {
    const items = schema.mainEntity;
    if (!Array.isArray(items) || items.length === 0) {
      err('FAQPage: "mainEntity" vazio ou ausente');
    } else {
      ok(`FAQPage.mainEntity: ${items.length} perguntas`);
      items.forEach((q, i) => {
        if (q['@type'] !== 'Question')
          err(`FAQPage item ${i + 1}: @type deve ser "Question"`);
        if (!q.name)
          err(`FAQPage item ${i + 1}: "name" (pergunta) ausente`);
        if (!q.acceptedAnswer?.text)
          err(`FAQPage item ${i + 1}: "acceptedAnswer.text" ausente`);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Arquivos estáticos referenciados no HTML
// ---------------------------------------------------------------------------
section('Arquivos Estáticos');

const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
const assetRefs = [...htmlNoComments.matchAll(/(?:href|src|content)="((?:static|admin)\/[^"?#]+)"/g)]
  .map(m => m[1]);

const uniqueAssets = [...new Set(assetRefs)];

if (uniqueAssets.length === 0) {
  warn('Nenhuma referência a static/ ou admin/ encontrada para verificar');
} else {
  for (const asset of uniqueAssets) {
    const fullPath = path.join(ROOT, asset);
    if (fs.existsSync(fullPath)) ok(`${asset}`);
    else err(`${asset} — referenciado mas não encontrado no disco`);
  }
}

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(50));
if (errors === 0 && warnings === 0) {
  console.log('Tudo valido! Pronto para deploy.\n');
  process.exit(0);
} else {
  if (errors > 0)   console.error(`${errors} erro(s) encontrado(s) — corrija antes do deploy`);
  if (warnings > 0) console.warn(`${warnings} aviso(s) — recomendado corrigir`);
  console.log('');
  process.exit(errors > 0 ? 1 : 0);
}
