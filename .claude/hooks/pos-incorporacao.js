#!/usr/bin/env node
// Hook PostToolUse do Claude Code (registrado em .claude/settings.json).
// Quando um comando Bash incorpora ou altera dados da prestação, roda a rotina
// pos-incorporacao e devolve ao Claude, como additionalContext, o registro e as
// pendências de memória. Nunca bloqueia: em qualquer falha sai com código 0.

const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const { detectar, inferirParametros } = require(path.join(RAIZ, 'src', 'incorporacao', 'gatilhos.js'));

function responder(texto) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: texto.slice(0, 9000) },
  }));
  process.exit(0);
}

let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { entrada += c; });
process.stdin.on('end', () => {
  let evento;
  try { evento = JSON.parse(entrada || '{}'); } catch (e) { process.exit(0); }
  if (evento.tool_name !== 'Bash') process.exit(0);
  const comando = (evento.tool_input && evento.tool_input.command) || '';
  const det = detectar(comando);
  if (!det) process.exit(0);

  const { unidade, competencia } = inferirParametros(comando);
  const args = [path.join(RAIZ, 'src', 'incorporacao', 'posIncorporacao.js'), '--gatilho=hook', `--comando=${comando.slice(0, 500)}`];
  if (unidade) args.push(`--unidade=${unidade}`);
  if (competencia) args.push(`--competencia=${competencia}`);

  const r = spawnSync(process.execPath, args, { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) {
    responder(`Hook pos-incorporacao: o comando foi reconhecido como ${det.tipo}, mas a rotina falhou (${(r.stderr || r.error || '').toString().slice(0, 400)}). A rotina pode ser repetida com npm run pos-incorporacao.`);
  }

  let res = {};
  try { res = JSON.parse(r.stdout); } catch (e) { /* segue com o que houver */ }
  const faltam = (res.etapas || []).filter((e) => e.status === 'nao_implementada').map((e) => `${e.id} (${e.fase})`);
  const erros = (res.etapas || []).filter((e) => e.status === 'erro').map((e) => `${e.id}: ${e.detalhe}`);

  responder([
    `Hook pos-incorporacao: comando reconhecido como ${det.tipo}. Registro ${res.id || '?'} gravado em logs/incorporacao.jsonl.`,
    `Unidade inferida: ${res.unidade || 'não identificada'}; competência inferida: ${res.competencia || 'não identificada'} (inferência pelo texto do comando, sujeita a conferência).`,
    faltam.length ? `Etapas ainda sem automação, que dependem de conferência manual: ${faltam.join(', ')}.` : 'Todas as etapas automáticas foram executadas.',
    erros.length ? `Etapas com erro: ${erros.join('; ')}.` : '',
    `Pendências de memória abertas: ${res.pendencias_memoria ?? '?'} (logs/memoria-pendente.jsonl). A etapa de memória da skill incorporacao descreve o que atualizar; a pendência é fechada com npm run pos-incorporacao -- --concluir=${res.id || '<id>'}.`,
  ].filter(Boolean).join('\n'));
});
