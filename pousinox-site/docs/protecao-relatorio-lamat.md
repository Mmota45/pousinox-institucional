# Proteção e Entrega do Relatório LAMAT/SENAI Itaúna

**Uso interno — não publicar no site**

---

## Contexto

O relatório técnico completo dos ensaios LAMAT/SENAI Itaúna é um ativo comercial sensível da Pousinox.  
Ele **não deve ser distribuído publicamente** e deve ser entregue somente após o fechamento de negócio,
de forma personalizada e protegida por cliente.

---

## Quando entregar

- Após confirmação do pedido / contrato assinado
- A pedido de engenheiros, arquitetos ou especificadores em contexto técnico formal (laudo, memorial descritivo)
- Nunca como material de prospecção gratuita

---

## Fluxo de entrega protegida

### 1. Preparar a cópia personalizada

Para cada cliente que recebe o relatório, gerar uma versão individual do PDF com:

**Marca d'água com:**
- `CONFIDENCIAL`
- `POUSINOX`
- Nome da empresa cliente (ex: `Construtora ABC Ltda`)
- Data de emissão (ex: `2026-04-07`)

**Ferramenta recomendada — Adobe Acrobat:**
1. Abrir o PDF original (`relatorio-lamat-original.pdf`)
2. Menu `Ferramentas > Editar PDF > Marca d'água > Adicionar`
3. Configurar texto com as 4 linhas acima, opacidade ~25%, posição diagonal
4. Salvar como: `relatorio-lamat-[nome-cliente]-[data].pdf`

**Ferramenta alternativa (gratuita) — Python + pypdf:**
```python
# instalar: pip install pypdf reportlab
from pypdf import PdfWriter, PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
import io

def gerar_relatorio_protegido(cliente: str, data: str, senha: str) -> None:
    # 1. Gera página de marca d'água
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=(595, 842))  # A4
    c.setFont("Helvetica-Bold", 36)
    c.setFillAlpha(0.15)
    c.setFillColorRGB(0.1, 0.2, 0.35)
    c.rotate(45)
    c.drawString(80, 100, f"CONFIDENCIAL — POUSINOX")
    c.drawString(80, 60, f"{cliente}")
    c.save()
    packet.seek(0)

    # 2. Aplica sobre cada página do PDF original
    wm_reader = PdfReader(packet)
    original = PdfReader("relatorio-lamat-original.pdf")
    writer = PdfWriter()
    for page in original.pages:
        page.merge_page(wm_reader.pages[0])
        writer.add_page(page)

    # 3. Aplica senha
    writer.encrypt(user_password=senha, owner_password=senha + "-owner")

    # 4. Salva
    nome_arquivo = f"relatorio-lamat-{cliente.lower().replace(' ', '-')}-{data}.pdf"
    with open(nome_arquivo, "wb") as f:
        writer.write(f)
    print(f"Arquivo gerado: {nome_arquivo}")

# Exemplo de uso:
# gerar_relatorio_protegido(
#     cliente="Construtora ABC",
#     data="2026-04-07",
#     senha="LAMAT2026#ABC"
# )
```

---

### 2. Definir senha individual

- Senha deve ser **única por cliente**
- Sugestão de formato: `LAMAT[ano]#[sigla-cliente]`  
  Exemplo: `LAMAT2026#ABC` para Construtora ABC
- Registrar a senha no sistema CRM / planilha interna junto ao nome do cliente

---

### 3. Envio ao cliente

**Canal recomendado:** e-mail ou WhatsApp direto (não compartilhar links públicos)

**Texto sugerido para envio:**

> Segue em anexo o relatório técnico completo dos ensaios LAMAT/SENAI Itaúna do Fixador
> de Porcelanato Pousinox, conforme combinado.
>
> O arquivo está protegido por senha: **[SENHA DO CLIENTE]**
>
> Este relatório é de uso exclusivo da [NOME DA EMPRESA] e não deve ser redistribuído.
> Em caso de dúvidas técnicas, nossa equipe está à disposição.
>
> Atenciosamente,  
> Equipe Pousinox

---

### 4. Controle de versões entregues

Manter uma planilha ou registro no CRM com:

| Cliente | Empresa | Data de entrega | Nome do arquivo | Senha |
|---|---|---|---|---|
| João Silva | Construtora ABC | 2026-04-07 | relatorio-lamat-construtora-abc-2026-04-07.pdf | LAMAT2026#ABC |

---

## O que NÃO fazer

- Não subir o PDF em nenhum servidor público ou pasta do Google Drive sem restrição de acesso
- Não enviar o relatório original sem marca d'água e senha
- Não compartilhar link de download público no site
- Não incluir o PDF como anexo em e-mails marketing ou newsletters

---

## Arquivo original

O arquivo `relatorio-lamat-original.pdf` deve ser armazenado localmente ou em pasta
privada de acesso restrito à equipe comercial/técnica da Pousinox.  
**Não deve ser versionado no repositório Git.**
