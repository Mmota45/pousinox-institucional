import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── Hash senha com PBKDF2 (Web Crypto, sem deps) ── */
async function hashSenha(senha: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );
  const hash = new Uint8Array(bits);
  // Formato: salt_hex:hash_hex
  const saltHex = new TextDecoder().decode(encodeHex(salt));
  const hashHex = new TextDecoder().decode(encodeHex(hash));
  return `${saltHex}:${hashHex}`;
}

async function verificarSenha(senha: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );
  const computed = new TextDecoder().decode(encodeHex(new Uint8Array(bits)));
  return computed === hashHex;
}

/* ── Marca d'água via pdf-lib ── */
async function aplicarWatermark(
  pdfBytes: Uint8Array,
  destinatario: string,
  cnpj: string,
  watermarkId: string
): Promise<Uint8Array> {
  const { PDFDocument, rgb, degrees, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");

  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  const textoWm = `CONFIDENCIAL · ${destinatario}`;
  const textoId = `ID: ${watermarkId} · CNPJ: ${cnpj}`;

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Marca d'água diagonal grande
    page.drawText(textoWm, {
      x: width * 0.08,
      y: height * 0.45,
      size: 38,
      font,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.08,
      rotate: degrees(45),
    });

    // Segunda linha menor
    page.drawText("USO RESTRITO · POUSINOX", {
      x: width * 0.15,
      y: height * 0.25,
      size: 24,
      font,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.06,
      rotate: degrees(45),
    });

    // Rodapé com ID rastreável
    page.drawText(textoId, {
      x: 20,
      y: 12,
      size: 6,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.4,
    });
  }

  // Metadata
  doc.setSubject(`Documento rastreável — ID: ${watermarkId}`);
  doc.setProducer("Pousinox — Sistema de Laudos Protegidos");
  doc.setKeywords([watermarkId, "confidencial", "pousinox"]);

  return await doc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    /* ═══════════════════════════════════════════
       ACTION: gerar — Gera PDF protegido
       ═══════════════════════════════════════════ */
    if (action === "gerar") {
      const {
        laudo_path,       // path no bucket 'laudos' (ex: "laudo-senai-2026.pdf")
        destinatario,     // nome da empresa
        cnpj,             // CNPJ do destinatário
        contato,          // nome do contato
        email,            // email do contato
        senha,            // senha de acesso (opcional — gera automaticamente se vazio)
        enviado_por,      // usuário admin
        canal_envio,      // email | whatsapp | link | presencial
        expira_horas = 72, // horas até expirar (default 72h)
        max_downloads = 5, // máximo de downloads
        observacao,
      } = body;

      if (!laudo_path || !destinatario) {
        return json({ error: "laudo_path e destinatario são obrigatórios" }, 400);
      }

      // 1. Buscar PDF original do bucket
      const { data: fileData, error: fileError } = await sb.storage
        .from("laudos")
        .download(laudo_path);

      if (fileError || !fileData) {
        return json({ error: `PDF não encontrado: ${laudo_path}` }, 404);
      }

      const originalBytes = new Uint8Array(await fileData.arrayBuffer());

      // 2. Gerar watermark_id
      const watermarkId = crypto.randomUUID();

      // 3. Aplicar marca d'água
      const protectedBytes = await aplicarWatermark(
        originalBytes,
        destinatario,
        cnpj || "N/A",
        watermarkId
      );

      // 4. Salvar no bucket privado
      const storagePath = `${watermarkId}.pdf`;
      const { error: uploadError } = await sb.storage
        .from("laudos-protegidos")
        .upload(storagePath, protectedBytes, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        return json({ error: `Erro ao salvar PDF: ${uploadError.message}` }, 500);
      }

      // 5. Senha: usar fornecida ou gerar automaticamente (6 dígitos)
      const senhaFinal = senha?.trim() || String(Math.floor(100000 + Math.random() * 900000));
      const senhaHashed = await hashSenha(senhaFinal);

      // 6. Registrar em docs_enviados
      const expiraEm = new Date(Date.now() + expira_horas * 60 * 60 * 1000).toISOString();

      const { data: doc, error: docError } = await sb
        .from("docs_enviados")
        .insert({
          watermark_id: watermarkId,
          tipo_doc: "laudo_protegido",
          titulo: `Laudo — ${destinatario}`,
          empresa: destinatario,
          cnpj: cnpj || null,
          contato: contato || null,
          email: email || null,
          observacao: observacao || null,
          enviado_por: enviado_por || null,
          senha_hash: senhaHashed,
          storage_path: storagePath,
          expira_em: expiraEm,
          downloads: 0,
          max_downloads: maxDownloads(max_downloads),
          status: "ativo",
          canal_envio: canal_envio || "link",
        })
        .select("id, watermark_id, criado_em, expira_em")
        .single();

      if (docError) {
        return json({ error: `Erro ao registrar: ${docError.message}` }, 500);
      }

      return json({
        ok: true,
        watermark_id: watermarkId,
        senha: senhaFinal, // retorna em texto só nesta resposta (nunca mais)
        expira_em: expiraEm,
        max_downloads: max_downloads,
        link: `/laudo/${watermarkId}`,
        doc_id: doc.id,
      });
    }

    /* ═══════════════════════════════════════════
       ACTION: verificar — Verifica senha e retorna signed URL
       ═══════════════════════════════════════════ */
    if (action === "verificar") {
      const { watermark_id, senha } = body;

      if (!watermark_id || !senha) {
        return json({ error: "watermark_id e senha são obrigatórios" }, 400);
      }

      // Buscar documento
      const { data: doc, error: docError } = await sb
        .from("docs_enviados")
        .select("*")
        .eq("watermark_id", watermark_id)
        .eq("tipo_doc", "laudo_protegido")
        .single();

      if (docError || !doc) {
        return json({ error: "Documento não encontrado" }, 404);
      }

      // Verificar status
      if (doc.status === "revogado") {
        return json({ error: "Acesso a este documento foi revogado" }, 403);
      }

      if (doc.status === "expirado" || (doc.expira_em && new Date(doc.expira_em) < new Date())) {
        // Atualizar status se expirado
        if (doc.status !== "expirado") {
          await sb.from("docs_enviados").update({ status: "expirado" }).eq("id", doc.id);
        }
        return json({ error: "Link expirado" }, 403);
      }

      if (doc.downloads >= doc.max_downloads) {
        return json({ error: `Limite de ${doc.max_downloads} downloads atingido` }, 403);
      }

      // Verificar senha
      const senhaOk = await verificarSenha(senha, doc.senha_hash);
      if (!senhaOk) {
        return json({ error: "Senha incorreta" }, 401);
      }

      // Incrementar downloads
      await sb
        .from("docs_enviados")
        .update({ downloads: doc.downloads + 1 })
        .eq("id", doc.id);

      // Gerar signed URL (válida por 10 minutos)
      const { data: urlData, error: urlError } = await sb.storage
        .from("laudos-protegidos")
        .createSignedUrl(doc.storage_path, 600);

      if (urlError || !urlData?.signedUrl) {
        return json({ error: "Erro ao gerar link de download" }, 500);
      }

      return json({
        ok: true,
        url: urlData.signedUrl,
        downloads_restantes: doc.max_downloads - doc.downloads - 1,
        empresa: doc.empresa,
      });
    }

    /* ═══════════════════════════════════════════
       ACTION: listar — Lista laudos enviados
       ═══════════════════════════════════════════ */
    if (action === "listar") {
      const { data, error } = await sb
        .from("docs_enviados")
        .select("*")
        .eq("tipo_doc", "laudo_protegido")
        .order("criado_em", { ascending: false })
        .limit(100);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, docs: data });
    }

    /* ═══════════════════════════════════════════
       ACTION: revogar — Revoga acesso a um laudo
       ═══════════════════════════════════════════ */
    if (action === "revogar") {
      const { watermark_id } = body;
      const { error } = await sb
        .from("docs_enviados")
        .update({ status: "revogado" })
        .eq("watermark_id", watermark_id)
        .eq("tipo_doc", "laudo_protegido");

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    /* ═══════════════════════════════════════════
       ACTION: laudos_base — Lista PDFs disponíveis no bucket
       ═══════════════════════════════════════════ */
    if (action === "laudos_base") {
      const { data, error } = await sb.storage.from("laudos").list("", {
        limit: 50,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) return json({ error: error.message }, 500);
      const pdfs = (data || []).filter((f: any) => f.name.endsWith(".pdf"));
      return json({ ok: true, arquivos: pdfs.map((f: any) => ({ name: f.name, size: f.metadata?.size })) });
    }

    /* ═══════════════════════════════════════════
       ACTION: gerar_proposta — Gera link protegido para proposta comercial
       ═══════════════════════════════════════════ */
    if (action === "gerar_proposta") {
      const {
        orcamento_id,
        destinatario,
        cnpj,
        contato,
        email,
        senha,
        enviado_por,
        canal_envio,
        expira_horas = 72,
        max_downloads = 5,
        observacao,
      } = body;

      if (!orcamento_id || !destinatario) {
        return json({ error: "orcamento_id e destinatario são obrigatórios" }, 400);
      }

      // Verificar se orçamento existe
      const { data: orc, error: orcErr } = await sb
        .from("orcamentos")
        .select("id, numero")
        .eq("id", orcamento_id)
        .single();

      if (orcErr || !orc) {
        return json({ error: "Orçamento não encontrado" }, 404);
      }

      const watermarkId = crypto.randomUUID();
      const senhaFinal = senha?.trim() || String(Math.floor(100000 + Math.random() * 900000));
      const senhaHashed = await hashSenha(senhaFinal);
      const expiraEm = new Date(Date.now() + expira_horas * 60 * 60 * 1000).toISOString();

      const { data: doc, error: docError } = await sb
        .from("docs_enviados")
        .insert({
          watermark_id: watermarkId,
          tipo_doc: "proposta_protegida",
          titulo: `Proposta ${(orc as any).numero} — ${destinatario}`,
          empresa: destinatario,
          cnpj: cnpj || null,
          contato: contato || null,
          email: email || null,
          observacao: observacao || null,
          enviado_por: enviado_por || null,
          senha_hash: senhaHashed,
          orcamento_id: orcamento_id,
          expira_em: expiraEm,
          downloads: 0,
          max_downloads: maxDownloads(max_downloads),
          status: "ativo",
          canal_envio: canal_envio || "link",
        })
        .select("id, watermark_id, criado_em, expira_em")
        .single();

      if (docError) {
        return json({ error: `Erro ao registrar: ${docError.message}` }, 500);
      }

      return json({
        ok: true,
        watermark_id: watermarkId,
        senha: senhaFinal,
        expira_em: expiraEm,
        max_downloads: max_downloads,
        link: `/proposta/${watermarkId}`,
        doc_id: doc.id,
      });
    }

    /* ═══════════════════════════════════════════
       ACTION: verificar_proposta — Verifica senha e retorna dados do orçamento
       ═══════════════════════════════════════════ */
    if (action === "verificar_proposta") {
      const { watermark_id, senha } = body;

      if (!watermark_id || !senha) {
        return json({ error: "watermark_id e senha são obrigatórios" }, 400);
      }

      const { data: doc, error: docError } = await sb
        .from("docs_enviados")
        .select("*")
        .eq("watermark_id", watermark_id)
        .eq("tipo_doc", "proposta_protegida")
        .single();

      if (docError || !doc) {
        return json({ error: "Documento não encontrado" }, 404);
      }

      if (doc.status === "revogado") {
        return json({ error: "Acesso a esta proposta foi revogado" }, 403);
      }

      if (doc.status === "expirado" || (doc.expira_em && new Date(doc.expira_em) < new Date())) {
        if (doc.status !== "expirado") {
          await sb.from("docs_enviados").update({ status: "expirado" }).eq("id", doc.id);
        }
        return json({ error: "Link expirado" }, 403);
      }

      if (doc.downloads >= doc.max_downloads) {
        return json({ error: `Limite de ${doc.max_downloads} acessos atingido` }, 403);
      }

      const senhaOk = await verificarSenha(senha, doc.senha_hash);
      if (!senhaOk) {
        return json({ error: "Senha incorreta" }, 401);
      }

      // Incrementar acessos
      await sb
        .from("docs_enviados")
        .update({ downloads: doc.downloads + 1 })
        .eq("id", doc.id);

      // Carregar dados do orçamento + especificação
      const [{ data: orc }, { data: itens }, { data: anexos }, { data: espec }] = await Promise.all([
        sb.from("orcamentos").select("*").eq("id", doc.orcamento_id).single(),
        sb.from("itens_orcamento").select("*").eq("orcamento_id", doc.orcamento_id).order("ordem"),
        sb.from("orcamentos_anexos").select("nome, url").eq("orcamento_id", doc.orcamento_id).order("criado_em"),
        sb.from("orcamento_especificacoes").select("*, orcamento_especificacao_itens(*)").eq("orcamento_id", doc.orcamento_id).maybeSingle(),
      ]);

      if (!orc) {
        return json({ error: "Orçamento não encontrado" }, 404);
      }

      // Carregar dados bancários
      const ids: number[] = Array.isArray((orc as any).dados_bancarios_ids) ? (orc as any).dados_bancarios_ids : [];
      let dadosBancarios: any[] = [];
      if (ids.length > 0) {
        const { data: bancos } = await sb.from("dados_bancarios").select("*").in("id", ids);
        dadosBancarios = bancos || [];
      }

      // Carregar modelo do fixador se especificação existe
      let modeloFixador = null;
      if (espec?.modelo_id) {
        const { data: modelo } = await sb.from("fixador_modelos").select("nome, material, espessura_mm, possui_laudo, laudo_laboratorio, laudo_resumo").eq("id", espec.modelo_id).single();
        modeloFixador = modelo;
      }

      return json({
        ok: true,
        orcamento: orc,
        itens: itens || [],
        anexos: anexos || [],
        dados_bancarios: dadosBancarios,
        especificacao: espec ? { ...espec, modelo: modeloFixador } : null,
        watermark: {
          empresa: doc.empresa,
          cnpj: doc.cnpj,
          watermark_id: watermarkId,
        },
        downloads_restantes: doc.max_downloads - doc.downloads - 1,
      });
    }

    /* ═══════════════════════════════════════════
       ACTION: revogar (genérico) — Revoga acesso a qualquer doc
       ═══════════════════════════════════════════ */
    if (action === "revogar") {
      const { watermark_id } = body;
      const { error } = await sb
        .from("docs_enviados")
        .update({ status: "revogado" })
        .eq("watermark_id", watermark_id);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function maxDownloads(v: unknown): number {
  const n = Number(v);
  return isNaN(n) || n < 1 ? 5 : Math.min(n, 100);
}
