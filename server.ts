import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b";
const GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";

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

Responda APENAS com um objeto JSON válido contendo exatamente estas chaves:
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
- caption: Legenda completa para Instagram da @atpromoo adaptada ao ângulo escolhido, com bullets de destaques, preço, aviso se for seminovo, chamada forte para o seguidor comentar "EU QUERO" para receber o link direto no direct ou acessar pelo link na bio (@atpromoo) e hashtags relevantes de hardware/games.`;
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

interface ExtractedOffer {
  badge: string;
  condition: string;
  title: string;
  subtitle: string;
  oldPrice: string;
  price: string;
  installments: string;
  store: string;
  coupon: string;
  highlights: string[];
  caption: string;
  modelUsed?: string;
  fromFallback?: boolean;
  quotaExceeded?: boolean;
  missingApiKey?: boolean;
}

function parseOfferLocally(raw: string, angle: string): ExtractedOffer {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  // 1. Detectar Loja pelo Link ou Menção
  let detectedStore = "AMAZON";
  if (/amazon/i.test(raw)) detectedStore = "AMAZON";
  else if (/mercadolivre|meli\./i.test(raw)) detectedStore = "MERCADO LIVRE";
  else if (/shopee/i.test(raw)) detectedStore = "SHOPEE";
  else if (/kabum/i.test(raw)) detectedStore = "KABUM!";
  else if (/terabyte/i.test(raw)) detectedStore = "TERABYTE";
  else if (/pichau/i.test(raw)) detectedStore = "PICHAU";
  else if (/aliexpress/i.test(raw)) detectedStore = "ALIEXPRESS";
  else if (/magazineluiza|magalu/i.test(raw)) detectedStore = "MAGALU";

  // 2. Detectar Preço
  let numericPrice = 0;
  let formattedPrice = "R$ 3.283";
  const priceMatch = raw.match(/R\$\s*([\d.]+(?:,\d{2})?)/i);
  if (priceMatch) {
    const cleanNumStr = priceMatch[1].replace(/\./g, "").replace(",", ".");
    numericPrice = parseFloat(cleanNumStr);
    if (!isNaN(numericPrice)) {
      formattedPrice = "R$ " + Math.round(numericPrice).toLocaleString("pt-BR");
    }
  }

  let formattedOldPrice = "";
  if (numericPrice > 0) {
    const estimatedOld = Math.round((numericPrice * 1.18) / 10) * 10 - 1;
    formattedOldPrice = "R$ " + estimatedOld.toLocaleString("pt-BR");
  } else {
    formattedOldPrice = "R$ 3.899";
  }

  // 3. Detectar Parcelamento
  let installmentsText = "À vista no PIX ou parcelado";
  const instMatch = raw.match(/(\d{1,2})\s*x\s*(?:de\s*R\$\s*([\d.,]+))?\s*(sem\s*juros)?/i);
  if (instMatch) {
    const count = parseInt(instMatch[1], 10);
    const semJuros = instMatch[3] ? "sem Juros" : "";
    if (count > 0) {
      if (numericPrice > 0) {
        const parcelVal = (numericPrice / count).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        installmentsText = `${count}x de R$ ${parcelVal} ${semJuros}`.trim();
      } else {
        installmentsText = `Em até ${count}x ${semJuros}`.trim();
      }
    }
  }

  // 4. Detectar Condição
  let conditionTag = "⚡ ESTOQUE LIMITADO";
  if (/seminovo/i.test(raw)) conditionTag = "⚠️ SEMINOVO • ESTOQUE LIMITADO";
  else if (/reembalado|open\s*box/i.test(raw)) conditionTag = "⚠️ REEMBALADO • GARANTIA OFICIAL";
  else if (/importado|estoque\s*no\s*brasil/i.test(raw)) conditionTag = "🇧🇷 ESTOQUE NO BRASIL";

  // 5. Detectar Cupom
  let couponCode = "";
  const cupomMatch = raw.match(/cupom\s*[:\-]?\s*([A-Z0-9]{4,15})/i);
  if (cupomMatch) {
    couponCode = cupomMatch[1].toUpperCase();
  }

  // 6. Extrair Produto e Submodelo
  let techLine =
    lines.find((l) => l.startsWith("_") || /GB|RTX|RX|RYZEN|SSD|DDR|HZ|BITS/i.test(l)) ||
    lines[0] ||
    "Placa de Vídeo RTX";
  techLine = techLine
    .replace(/^_+|_+$/g, "")
    .replace(/^\*+|\*+$/g, "")
    .replace(/\(seminovo\)/gi, "")
    .trim();

  let cleanTitle = techLine;
  let cleanSubtitle = `OFERTA VERIFICADA • ${detectedStore}`;
  if (/RTX\s*5060\s*TI/i.test(raw)) {
    cleanTitle = "RTX 5060 Ti 16GB GDDR7";
    cleanSubtitle = "MSI VENTUS 2X OC • GDDR7";
  } else if (cleanTitle.length > 28) {
    const words = cleanTitle.split(/\s+/);
    cleanTitle = words.slice(0, 4).join(" ");
    cleanSubtitle = words.slice(4, 10).join(" ").toUpperCase();
  }

  let badge = "Vazou o preço:";
  let highlights: string[] = [];

  if (angle === "contrarian") {
    badge = "Esqueça placa de 8GB:";
    cleanTitle = `Por que a ${cleanTitle} vale muito mais`;
    highlights = [
      `🛑 8GB já trava em jogos novos | Com 16GB GDDR7 você roda tudo no Ultra sem gargalo de VRAM.`,
      `❄️ Projeto ${cleanSubtitle} | Construção superior que mantém temperaturas baixas em uso pesado.`,
      `💳 Preço de versão básica | Saindo por ${formattedPrice} (${installmentsText}) na ${detectedStore}.`,
      `⚠️ Oportunidade Seminovo | Reembalado oficial na ${detectedStore} com garantia e preço de ocasião.`,
    ];
  } else if (angle === "math-value") {
    badge = "Matemática rápida:";
    cleanTitle = `${cleanTitle} pelo menor custo por FPS`;
    highlights = [
      `📊 Economia Direta no Bolso | De ${formattedOldPrice} por ${formattedPrice} nesta oferta.`,
      `💳 Sem Juros no Cartão | Parcelamento em ${installmentsText} sem perder o valor promocional.`,
      `🚀 Longevidade de Setup | ${cleanSubtitle} pronta para vários anos sem precisar de upgrade.`,
      `✅ Compra Segura ${detectedStore} | Entrega rápida e proteção total ao comprador.`,
    ];
  } else if (angle === "who-is-it-for") {
    badge = "Guia rápido:";
    cleanTitle = `Pra quem é a ${cleanTitle}?`;
    highlights = [
      `🎮 Ideal para Gamers exigentes | Perfeita para rodar jogos atuais em Quad HD (1440p) com folga.`,
      `💻 Criadores, Edição e IA | Memória de sobra para renderização, edição de vídeo e IA local.`,
      `💳 Para quem busca parcelamento | ${formattedPrice} em ${installmentsText} direto na ${detectedStore}.`,
      `⚠️ Ponto de Atenção | ${conditionTag} — estoque super restrito que acaba rápido.`,
    ];
  } else if (angle === "hidden-detail") {
    badge = "O detalhe que ninguém viu:";
    cleanTitle = `O segredo dessa ${cleanTitle}`;
    highlights = [
      `🔍 Nova Memória GDDR7 | Largura de banda muito mais rápida que a geração GDDR6 anterior.`,
      `❄️ Engenharia ${cleanSubtitle} | Sistema térmico otimizado com overclock de fábrica.`,
      `🛡️ Garantia na ${detectedStore} | Mesmo na condição seminovo, conta com cobertura oficial da loja.`,
      `🔥 Preço fora da curva | ${formattedPrice} (${installmentsText}) é valor raríssimo para essa ficha técnica.`,
    ];
  } else {
    // Default: price-alert
    badge = "Vazou o preço:";
    highlights = [
      `🚀 Desempenho de Ponta | ${cleanTitle} (${cleanSubtitle}) pelo menor valor monitorado.`,
      `❄️ Construção Premium | Acabamento reforçado e refrigeração silenciosa de alta eficiência.`,
      `💳 Pagamento Facilitado | Sai por ${formattedPrice} (${installmentsText}) na ${detectedStore}.`,
      `⚠️ Alerta de Estoque | ${conditionTag} — unidades costumam esgotar em poucos minutos.`,
    ];
  }

  const caption =
    `${badge} ${cleanTitle} (${cleanSubtitle}) saindo por apenas ${formattedPrice} (${installmentsText}) na ${detectedStore}! 🚀\n\n` +
    (conditionTag.includes("SEMINOVO")
      ? `⚠️ Atenção: Unidade na condição Seminovo — oportunidade única nesse valor e parcelado sem juros!\n\n`
      : "") +
    `${highlights.map((h) => h.replace(" | ", ": ")).join("\n")}` +
    (couponCode ? `\n🎟️ Cupom: ${couponCode}` : "") +
    `\n\n📲 Acesse nosso grupo pelo link na bio (@atpromoo) 👇\n\n*Ofertas esgotam rápido! Verifique o frete para sua região.\n\n#ofertas #tecnologia #pcgamer #hardware #promocao #atpromoo`;

  return {
    badge,
    condition: conditionTag,
    title: cleanTitle,
    subtitle: cleanSubtitle,
    oldPrice: formattedOldPrice,
    price: formattedPrice,
    installments: installmentsText,
    store: detectedStore,
    coupon: couponCode,
    highlights,
    caption,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelayMs(retryAfterHeader: string | null, errorBodyText: string, attempt: number): number {
  if (retryAfterHeader) {
    const seconds = parseFloat(retryAfterHeader);
    if (!isNaN(seconds) && seconds > 0) {
      return Math.min(Math.max(Math.ceil(seconds * 1000), 1000), 10000);
    }
  }

  // Groq costuma retornar ex: "Please try again in 2.45s" ou "Please try again in 1400ms"
  const msMatch = errorBodyText.match(/try again in\s+(\d+(?:\.\d+)?)ms/i);
  if (msMatch) {
    const ms = parseFloat(msMatch[1]);
    if (!isNaN(ms) && ms > 0) {
      return Math.min(Math.max(Math.ceil(ms + 250), 1000), 10000);
    }
  }

  const secMatch = errorBodyText.match(/try again in\s+(\d+(?:\.\d+)?)s/i);
  if (secMatch) {
    const sec = parseFloat(secMatch[1]);
    if (!isNaN(sec) && sec > 0) {
      return Math.min(Math.max(Math.ceil(sec * 1000 + 250), 1000), 10000);
    }
  }

  // Backoff exponencial padrão (2s, 4s...)
  return Math.min(2000 * Math.pow(2, attempt), 8000);
}

function cleanJsonString(rawContent: string): string {
  let cleaned = rawContent.trim();
  // Remove blocos <think>...</think> caso algum modelo retorne tags de raciocínio
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Remove cercas markdown ```json ... ``` se presentes
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return cleaned;
}

async function generateWithGroq(
  model: string,
  raw: string,
  angle: string,
  customApiKey?: string,
  maxRetries = 2
): Promise<Record<string, any>> {
  const activeKey =
    customApiKey ||
    process.env.GROQ_API_KEY ||
    (process.env.GEMINI_API_KEY?.startsWith("gsk_") ? process.env.GEMINI_API_KEY : undefined);

  if (!activeKey) {
    const missingErr: any = new Error("GROQ_API_KEY não configurada no servidor.");
    missingErr.missingApiKey = true;
    throw missingErr;
  }

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: buildSystemInstruction(String(angle)),
          },
          {
            role: "user",
            content: raw,
          },
        ],
        reasoning_effort: "low",
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (response.status === 429) {
      const errBody = await response.text().catch(() => "");
      const rateErr: any = new Error(`Groq 429 Rate Limit on ${model}: ${errBody}`);
      rateErr.status = 429;
      lastError = rateErr;

      if (attempt < maxRetries) {
        const waitMs = parseRetryDelayMs(response.headers.get("retry-after"), errBody, attempt);
        console.warn(
          `[Groq] Limite 429 atingido em ${model}. Aguardando ${waitMs}ms antes da tentativa ${attempt + 2}/${maxRetries + 1}...`
        );
        await sleep(waitMs);
        continue;
      }

      throw rateErr;
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      const apiErr: any = new Error(`Groq API error (${response.status}) on ${model}: ${errBody}`);
      apiErr.status = response.status;
      throw apiErr;
    }

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error(`Resposta vazia do modelo Groq ${model}`);
    }

    const parsed = JSON.parse(cleanJsonString(content));
    return {
      ...parsed,
      modelUsed: model,
    };
  }

  throw lastError || new Error(`Falha ao gerar com Groq (${model})`);
}

app.post("/api/extract-offer", async (req, res) => {
  if (!verifyHeaderCredentials(req)) {
    res.status(401).json({ error: "Não autorizado. Faça login novamente." });
    return;
  }

  const { raw, angle = "price-alert", customApiKey } = req.body;
  const activeApiKey =
    (req.headers["x-groq-api-key"] as string) ||
    (req.headers["x-api-key"] as string) ||
    (req.headers["x-gemini-api-key"] as string) ||
    customApiKey ||
    undefined;

  if (!raw || typeof raw !== "string") {
    res.status(400).json({ error: "Texto da oferta inválido." });
    return;
  }

  // 1. Tentar primeiro o modelo principal recomendado na Groq: openai/gpt-oss-120b (raciocínio no mínimo + retry no 429)
  try {
    const result = await generateWithGroq(GROQ_PRIMARY_MODEL, raw, String(angle), activeApiKey, 2);
    res.json(result);
    return;
  } catch (err: any) {
    const errString = String(err?.message || err || "");
    const isMissingKey = Boolean(err?.missingApiKey);
    const isQuotaError =
      err?.status === 429 ||
      err?.code === 429 ||
      /rate_limit|quota|429|too many requests|tokens per minute/i.test(errString);

    if (!isMissingKey) {
      console.warn(
        `[Groq] ${GROQ_PRIMARY_MODEL} indisponível (${isQuotaError ? "429 Rate Limit" : errString}). Tentando fallback rápido ${GROQ_FALLBACK_MODEL}...`
      );
      try {
        const fallbackModelResult = await generateWithGroq(
          GROQ_FALLBACK_MODEL,
          raw,
          String(angle),
          activeApiKey,
          1
        );
        res.json(fallbackModelResult);
        return;
      } catch (secondaryErr: any) {
        console.warn(
          `[Groq] Modelo secundário ${GROQ_FALLBACK_MODEL} também falhou. Acionando leitor local por regex.`
        );
      }
    } else {
      console.warn("[Groq] GROQ_API_KEY ausente. Acionando leitor local por regex.");
    }

    // Fallback gracioso: motor local editorial de alta precisão por regex
    const localResult = parseOfferLocally(raw, String(angle));
    res.json({
      ...localResult,
      fromFallback: true,
      quotaExceeded: isQuotaError,
      missingApiKey: isMissingKey,
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
