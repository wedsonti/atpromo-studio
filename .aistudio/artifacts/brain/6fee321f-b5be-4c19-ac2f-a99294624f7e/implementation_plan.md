# Plano de Correção: Campo de Preço no Slide 1 e Exportação PNG

## 1. Análise da Falha (Diagnóstico)

Ao analisar a imagem baixada (`image_612efd92.png`), identifica-se exatamente o que provocou a deformação no campo do preço:

1. **Deslocamento do Texto de Sombra**: O preço branco ("R$ 466") permaneceu no lugar correto, mas a camada duplicada em preto (que deveria atuar como sombra sólida de 2.5px) foi deslocada verticalmente cerca de 25px a 30px para baixo.
2. **Causa Raiz no `html2canvas`**: O HTML utilizava a combinação de `<div class="relative inline-block">` com `<span class="absolute top-[2.5px] left-[2.5px]">` e um irmão `<span class="relative ... block">`.
   - Durante a clonagem para a sandbox de renderização do `html2canvas`, a classe dinamicamente processada pelo Tailwind `top-[2.5px]` é avaliada como `top: auto` em estilos computados do nó clonado.
   - Pela regra de posicionamento estático do CSS para elementos `absolute` dentro de `inline-block` com irmãos `block`, o `top: auto` posiciona o elemento após a linha do bloco irmão, empurrando o texto preto exatamente um `line-height` inteiro para baixo (invadindo e vazando por baixo da pílula "À vista no PIX ou parcelado").

---

## 2. Solução Proposta

Para garantir 100% de precisão visual tanto na tela quanto no arquivo PNG baixado:

### Alterações Principais:
1. **Container de Coordenadas Absolutas Explícitas**:
   - Reestruturar o bloco do preço para utilizar um container com altura e alinhamento central fixos (`relative w-full h-[36px] my-0.5`).
   - Definir posicionamento inline explícito no estilo das duas camadas:
     - **Camada Sombra (Preto)**: `style="position: absolute; top: 2px; left: 2px; width: 100%; text-align: center;"`
     - **Camada Principal (Branco)**: `style="position: absolute; top: 0px; left: 0px; width: 100%; text-align: center;"`
   - Dessa forma, o `html2canvas` lê o `top: 2px` diretamente do atributo `style`, zerando qualquer possibilidade de recálculo ou deslocamento vertical.

2. **Revisão e Padronização Geral**:
   - Aplicar essa mesma estrutura nos templates do **Slide 1**, **Story** e **Slide Giro**, mantendo o design neo-brutalista idêntico e à prova de falhas em todos os modos.

---

## 3. Plano de Verificação

1. **Compilação e Teste**: Executar `compile_applet` para garantir sintaxe válida.
2. **Validação de Exportação**: Testar a geração do PNG do Slide 1 e verificar se o preço branco e sua sombra sólida de 2px ficam perfeitamente encaixados, sem sobrepor a pílula de parcelamento.
