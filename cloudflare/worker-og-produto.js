addEventListener("fetch", function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  var SUPABASE_URL = "https://vcektwtpofypsgdgdjlx.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Xq8ZiFGMQfE8wWfwtDOUNw_aozTc_PP";
  var SITE = "https://pousinox.com.br";
  var DESTINO = SITE + "/pronta-entrega";
  var FALLBACK = SITE + "/og-image.webp";

  var url = new URL(request.url);
  var match = url.pathname.match(/^\/produto\/([^\/]+)$/);
  if (!match) return Response.redirect(DESTINO, 302);

  var id = match[1];

  var apiRes = await fetch(
    SUPABASE_URL + "/rest/v1/produtos_publicos?id=eq." + id + "&select=titulo,descricao,fotos,categoria,fabricante&limit=1",
    { headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY } }
  );
  var lista = await apiRes.json();
  var p = (lista && lista[0]) ? lista[0] : null;

  var titulo = (p && p.titulo) ? p.titulo : "Equipamento Inox - Pousinox";
  var descricao = (p && p.descricao) ? p.descricao : "Equipamentos em aco inox com pronta entrega em Pouso Alegre, MG.";
  var imagem = (p && p.fotos && p.fotos[0]) ? p.fotos[0] : FALLBACK;
  var cat = (p && p.categoria) ? (p.categoria + ": ") : "";
  var tituloOG = titulo + " | POUSINOX Pouso Alegre MG";
  var sufixo = (p && p.fabricante)
    ? " - fabricado por " + p.fabricante + ", vendido pela POUSINOX, Pouso Alegre, MG."
    : " - POUSINOX, Pouso Alegre, MG.";
  var descOG = cat + descricao + sufixo;
  var urlCanonica = SITE + "/produto/" + id;

  var h = "<!DOCTYPE html><html lang=\"pt-BR\"><head>";
  h += "<meta charset=\"UTF-8\">";
  h += "<title>" + tituloOG + "</title>";
  h += "<meta property=\"og:type\" content=\"product\">";
  h += "<meta property=\"og:url\" content=\"" + urlCanonica + "\">";
  h += "<meta property=\"og:title\" content=\"" + tituloOG + "\">";
  h += "<meta property=\"og:description\" content=\"" + descOG + "\">";
  h += "<meta property=\"og:image\" content=\"" + imagem + "\">";
  h += "<meta property=\"og:image:width\" content=\"1200\">";
  h += "<meta property=\"og:image:height\" content=\"900\">";
  h += "<meta property=\"og:locale\" content=\"pt_BR\">";
  h += "<meta property=\"og:site_name\" content=\"POUSINOX\">";
  h += "<meta name=\"twitter:card\" content=\"summary_large_image\">";
  h += "<meta name=\"twitter:title\" content=\"" + tituloOG + "\">";
  h += "<meta name=\"twitter:description\" content=\"" + descOG + "\">";
  h += "<meta name=\"twitter:image\" content=\"" + imagem + "\">";
  h += "</head><body>";
  h += "<script>window.location.replace(\"" + DESTINO + "\")<\/script>";
  h += "<p>Redirecionando... <a href=\"" + DESTINO + "\">Clique aqui</a></p>";
  h += "</body></html>";

  return new Response(h, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" }
  });
}
