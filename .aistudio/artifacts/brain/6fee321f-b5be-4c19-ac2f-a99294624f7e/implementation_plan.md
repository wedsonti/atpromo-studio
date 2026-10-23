# Plano de Implementação: Capa Gancho Dedicada no Giro de Ofertas

## 1. Contexto & Objetivo
O usuário confirmou a preferência para o modo **Giro de Ofertas**: o carrossel deve possuir um **Slide 1 Capa Gancho dedicada** antes dos slides de produtos individuais.

Atualmente, no modo `multi-giro`, o carrossel iniciava direto no primeiro produto. Com esta alteração, o carrossel terá a seguinte estrutura organizada:
1. **Slide 1 — Capa Gancho do Giro**: Slide editorial de alto impacto para prender a atenção no feed (ex: *"🔥 GIRO DE OFERTAS TECH • X Promoções Imperdíveis de Hoje"* com mascote e design neo-brutalista).
2. **Slides 2 a N+1 — Produtos em Destaque**: Os slides individuais com foto, preço com sombra sólida, badge de condição e loja.
3. **Slide Final (N+2) — CTA (@atpromoo)**: Slide de encerramento com o sticker do mascote e instrução de automação (ex: *"Comente EU QUERO ou acesse o link da bio"*).

---

## 2. Alterações Propostas em `/index.html`

### 1. Novo Construtor de Layout: `buildGiroHookSlideHtml()`
- Criar a função `buildGiroHookSlideHtml()` no mesmo padrão estético neo-brutalista `@atpromoo` (3px border, `#FAF6EE` background, `#141414` shadows, fonte Plus Jakarta Sans).
- **Elementos Visuais**:
  - Topo com @atpromoo e logo do mascote.
  - Título / Gancho principal expansível (ex: *"GIRO DE OFERTAS TECH"* / *"As Melhores Promoções Selecionadas de Hoje"*).
  - Pílula Laranja chamativa indicando a quantidade total de ofertas inclusas no Giro (ex: *"⚡ 3 OFERTAS VERIFICADAS"*).
  - Ilustração / Mascote com Notebook em destaque no centro.
  - Seta/Indicativo "Arrasta ➔" para engajamento.

### 2. Atualização da Lógica de Renderização (`renderSlidesStage`)
- No bloco `appState.postMode === 'multi-giro'`:
  - Calcular `totalSlides = appState.giroProducts.length + 2` (1 Capa Gancho + N Produtos + 1 CTA Final).
  - Adicionar o **Slide 1 Capa Gancho** no início com nome de arquivo `atpromoo-giro-01-capa-gancho.png`.
  - Renderizar os produtos do Giro a partir do **Slide 2** (`atpromoo-giro-02-produto-1.png`, etc.).
  - Encerrar com o **Slide CTA Final** no último número (`atpromoo-giro-0N-cta.png`).

### 3. Integração com Exportação PNG
- Garantir que todas as camadas do Slide Capa Gancho do Giro utilizem a mesma proteção física contra deslocamentos no `html2canvas` (posicionamento explícito e estilos inline seguros).

---

## 3. Plano de Verificação

1. **Compilação**: Executar `compile_applet` para confirmar a ausência de erros de sintaxe ou referências inválidas.
2. **Visualização no Preview**: Alternar para a aba "Giro de Ofertas" no app e verificar a presença do Slide 1 (Capa Gancho), seguido das ofertas e da CTA final.
3. **Exportação de Imagens**: Testar a geração e o download em PNG dos slides do Giro para validar se a Capa Gancho é exportada perfeitamente em 1080p.
