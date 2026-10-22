import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));

function getAdminCredentials() {
  return {
    user: process.env.ADMIN_USER || "admin",
    pass: process.env.ADMIN_PASS || "atpromo123",
  };
}

function verifyHeaderCredentials(req: express.Request): boolean {
  const { user: expectedUser, pass: expectedPass } = getAdminCredentials();

  const headerUser =
    (req.headers["x-auth-user"] as string | undefined) ??
    (req.headers["x-admin-user"] as string | undefined);
  const headerPass =
    (req.headers["x-auth-pass"] as string | undefined) ??
    (req.headers["x-admin-pass"] as string | undefined);

  if (headerUser !== undefined && headerPass !== undefined) {
    return headerUser === expectedUser && headerPass === expectedPass;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
      const colonIndex = decoded.indexOf(":");
      if (colonIndex !== -1) {
        const u = decoded.slice(0, colonIndex);
        const p = decoded.slice(colonIndex + 1);
        return u === expectedUser && p === expectedPass;
      }
    } catch {
      return false;
    }
  }

  return false;
}

const ANGLE_INSTRUCTIONS: Record<string, string> = {
  "price-alert": `ÂNGULO CRIATIVO ESCOLHIDO: "🔥 Alerta de Preço / Bug"
- Foco total no desconto agressivo, queda histórica de preço e urgência de estoque.
- badge (Gatilho em laranja): Ex: "Vazou o preço:" ou "Menor preço hoje:"
- title (Complemento da headline): Ex: "RTX 5060 Ti de 16GB caiu demais"
- Os 4 itens de highlights do Slide 2 devem focar em: 1) Queda brusca de valor vs mercado, 2) Especificação principal de ponta, 3) Parcelamento sem juros raro, 4) Risco real de acabar em minutos.`,

  "contrarian": `ÂNGULO CRIATIVO ESCOLHIDO: "🛑 Opinião Contrária"
- Provocação inteligente estilo editorial tech (ex: "Esqueça placa de 8GB em 2026: por esse valor a 16GB engole a concorrência").
- badge (Gatilho em laranja): Ex: "Não erre na compra:" ou "Esqueça 8GB:"
- title (Complemento da headline): Ex: "Por que a RTX 5060 Ti 16GB vale muito mais"
- Os 4 itens de highlights do Slide 2 devem contrastar o erro comum de compra vs a vantagem real deste modelo.`,

  "math-value": `ÂNGULO CRIATIVO ESCOLHIDO: "📊 Matemática do Custo-Benefício"
- Foco racional em economia em Reais (R$), preço por GB/FPS, longevidade do setup e facilidade no parcelamento sem juros.
- badge (Gatilho em laranja): Ex: "Conta rápida:" ou "Economia real:"
- title (Complemento da headline): Ex: "R$ 616 a menos na RTX 5060 Ti 16GB"
- Os 4 itens de highlights do Slide 2 devem trazer números claros: economia direta em R$, valor da parcela sem juros, custo por benefício técnico e revenda/durabilidade.`,

  "who-is-it-for": `ÂNGULO CRIATIVO ESCOLHIDO: "✅ Guia Rápido: Pra quem é?"
- Divide os 4 pontos do Slide 2 de forma honesta e consultiva:
  1) Para quem joga em Quad HD / busca longevidade
  2) Para quem trabalha com edição, 3D ou IA local
  3) Para quem precisa parcelar sem perder desconto à vista
  4) Ponto de atenção transparente (ex: condição Seminovo / caixa aberta / estoque limitado).
- badge (Gatilho em laranja): Ex: "Vale pra você?" ou "Guia rápido:"
- title (Complemento da headline): Ex: "Pra quem é essa RTX 5060 Ti 16GB"`,

  "hidden-detail": `ÂNGULO CRIATIVO ESCOLHIDO: "🔍 O Detalhe que Ninguém Viu"
- Destaca uma especificação técnica decisiva que passa despercebida (ex: memória GDDR7 nova geração, construção MSI Ventus 2X OC, garantia oficial Amazon mesmo no seminovo).
- badge (Gatilho em laranja): Ex: "Detalhe oculto:" ou "Olha a ficha técnica:"
- title (Complemento da headline): Ex: "O segredo dessa RTX 5060 Ti 16GB GDDR7"
- Os 4 itens de highlights do Slide 2 devem dissecar os diferenciais técnicos ocultos do modelo e da oferta.`,
};

function buildSystemInstruction(angle: string): string {
  const angleGuide = ANGLE_INSTRUCTIONS[angle] || ANGLE_INSTRUCTIONS["price-alert"];

  return `Você é o estrategista de conteúdo e copywriter oficial da página de ofertas de tecnologia @atpromoo no Instagram (estilo Editorial Neo-Brutalista limpo e direto).
Receba um texto bruto de oferta de grupo de WhatsApp/Telegram e extraia os dados padronizados para preencher um Carrossel de 3 slides no Instagram.

${angleGuide}

Regras obrigatórias de formatação dos campos JSON:
- badge: Gatilho curto editorial (2 a 4 palavras, sem emojis exagerados, terminado em dois-pontos, ex: "Vazou o preço:", "Não compre 8GB:", "Economia real:", "Detalhe oculto:").
- title: Título principal conciso para a Headline da Capa (máximo 34 caracteres, ex: "RTX 5060 Ti 16GB GDDR7").
- subtitle: Submodelo técnico em maiúsculas para a barra inferior da foto (ex: "MSI VENTUS 2X OC • GDDR7").
- condition: Selo curto de aviso/condição em maiúsculas para o topo da moldura (ex: "⚠️ SEMINOVO • ESTOQUE LIMITADO" se citar seminovo/usado, ou "⚡ ESTOQUE LIMITADO", "✅ NOVO • GARANTIA OFICIAL").
- oldPrice: Preço médio normal de mercado estimado no formato "R$ X.XXX" (ex: "R$ 3.899").
- price: Preço principal da oferta formatado "R$ X.XXX" (ex: "R$ 3.283").
- installments: Linha curta de parcelamento calculando o valor da parcela (ex: "10x de R$ 328,30 sem Juros" ou "À vista no PIX").
- store: Nome curto da loja identificada (ex: "AMAZON", "MERCADO LIVRE", "KABUM!", "SHOPEE", "ALIEXPRESS").
- coupon: Código do cupom se existir, ou string vazia "".
- highlights: Array com EXATAMENTE 4 strings no formato "EMOJI Título Curto | Explicação direta em uma linha (máx 65 caracteres)".
  Exemplo exato do formato de cada item em highlights:
  1. "🚀 16GB de VRAM GDDR7 | Sobra memória para rodar tudo em Quad HD (1440p) e projetos de IA."
  2. "❄️ Construção MSI Ventus 2X OC | Dual Fan com overclock de fábrica e excelente refrigeração."
  3. "💳 Parcelamento Raro sem Juros | Sai por 10x de R$ 328,30 sem acréscimo direto na Amazon."
  4. "⚠️ Atenção ao Estoque Seminovo | Unidades reembaladas na Amazon com garantia costumam esgotar rápido."
- caption: Legenda completa para Instagram da @atpromoo adaptada ao ângulo escolhido, com bullets, preço, aviso se for seminovo, chamada para acessar o grupo pelo link na bio (@atpromoo) e hashtags.`;
}

app.post("/api/login", (req, res) => {
  const { user: expectedUser, pass: expectedPass } = getAdminCredentials();
  const bodyUser = req.body?.username ?? req.body?.user;
  const bodyPass = req.body?.password ?? req.body?.pass;

  const isBodyValid =
    typeof bodyUser === "string" &&
    typeof bodyPass === "string" &&
    bodyUser === expectedUser &&
    bodyPass === expectedPass;

  if (isBodyValid || verifyHeaderCredentials(req)) {
    res.json({ ok: true, user: expectedUser });
    return;
  }

  res.status(401).json({ ok: false, error: "Usuário ou senha incorretos." });
});

app.post("/api/extract-offer", async (req, res) => {
  if (!verifyHeaderCredentials(req)) {
    res.status(401).json({ error: "Não autorizado. Faça login novamente." });
    return;
  }

  try {
    const { raw, angle = "price-alert" } = req.body;
    if (!raw || typeof raw !== "string") {
      res.status(400).json({ error: "Texto da oferta inválido." });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: raw,
      config: {
        systemInstruction: buildSystemInstruction(String(angle)),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            badge: { type: Type.STRING },
            condition: { type: Type.STRING },
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            oldPrice: { type: Type.STRING },
            price: { type: Type.STRING },
            installments: { type: Type.STRING },
            store: { type: Type.STRING },
            coupon: { type: Type.STRING },
            highlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            caption: { type: Type.STRING },
          },
          required: [
            "badge",
            "condition",
            "title",
            "subtitle",
            "oldPrice",
            "price",
            "installments",
            "store",
            "coupon",
            "highlights",
            "caption",
          ],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Empty response from Gemini");
    }

    const parsed = JSON.parse(jsonText.trim());
    res.json(parsed);
  } catch (error) {
    console.error("Error extracting offer with Gemini:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to extract offer",
    });
  }
});

function resolveIndexHtmlPath(): string {
  const candidates = [
    path.join(__dirname, "index.html"),
    path.join(process.cwd(), "index.html"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.static(__dirname));

app.get("/atpromo_studio_gerador_de_posts_e_carross_is.html", (_req, res) => {
  res.sendFile(resolveIndexHtmlPath());
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(resolveIndexHtmlPath());
});

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export { app };
export default app;
