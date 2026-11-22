---
paths:
  - src/extracao/**
  - prestacao-vault/extracoes/**
---

# Extração assistida por LLM

Princípio: a LLM extrai e resume o que a unidade declarou. Quem avalia é a CAF.

1. Cada registro tem três partes que não se misturam: a declaração da unidade (literal), o resumo (gerado, marcado com `origem = extraida_llm`) e a avaliação da comissão (só humana, pela API com `auditar`).
2. Todo campo extraído traz `pagina` e `trecho_fonte` (até 400 caracteres copiados do original). Sem trecho que o sustente, o campo é `null`.
3. Não inferir, não completar, não corrigir número: valores como aparecem no documento.
4. Resumo em terceira pessoa, atribuído à unidade ("A unidade informa que..."), com até 3 frases e sem juízo de valor.
5. LGPD: nenhum dado de paciente (nome, prontuário, caso identificável). Atas registram participantes por quantidade e cargo. Profissional nominal só quando é o responsável formal pelo indicador.
6. Cada tipo fica em `src/extracao/tipos/<tipo>.js` com: `identificar(documento)`, esquema zod, prompt com `versao`, tabela de destino e chave de idempotência (hash do `.md` + versão do prompt).
7. Saída intermediária em `prestacao-vault/extracoes/<ano>/<unidade>/<mes>/<tipo>.json`. A gravação no banco é só pelo importador (`npm run extracoes:importar`), nunca pelo MCP, que é somente leitura.
8. Registro importado entra como `pendente`. Reprocessar cria revisão e preserva a avaliação já feita.
9. Tabela nova entra em `scripts/claude_ro.sql`. Ao final, rode a rotina pós-incorporação.
