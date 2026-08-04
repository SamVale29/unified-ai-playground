# AI SDK Playground

**Teste, compare e entenda APIs de IA em um só lugar.**

O AI SDK Playground é um laboratório open source para testar e comparar OpenAI, Anthropic, Google Gemini, xAI, DeepSeek, Mistral AI e OpenRouter. Ele executa experimentos reproduzíveis, mostra o request normalizado e o request nativo, compara streaming e latência e deixa as diferenças entre providers visíveis.

> A demo pública usa fixtures simuladas e determinísticas. Chamadas reais executam localmente pelo gateway que você controla.

## Início rápido

```bash
pnpm install
pnpm dev
```

Para chamadas reais, rode o gateway em outro terminal:

```bash
pnpm dev:gateway
```

Copie `.env.example` para `.env` e configure somente as chaves necessárias. A interface web nunca lê essas variáveis.

```bash
pnpm test
pnpm build
pnpm test:e2e
```

## O que o projeto compara

- respostas lado a lado e streaming;
- TTFT, duração total, tokens por segundo e uso;
- custo estimado e custo informado pelo provider;
- structured outputs, tool calls, erros e finish reason;
- request normalizado, transformação e request nativo;
- compatibilidade, omissões, adaptações e diferenças semânticas;
- exportação sanitizada e configuração compartilhável sem credenciais.

“Compatível” não significa “idêntico”. O projeto não declara um vencedor absoluto; mostra evidências do experimento executado.

## Documentação

Comece por [`docs/security-model.md`](docs/security-model.md), [`docs/provider-compatibility.md`](docs/provider-compatibility.md) e [`docs/known-differences.md`](docs/known-differences.md).

## Licença

Apache-2.0. Projeto independente de Sam Vale, sem afiliação a Vercel ou aos providers listados.
