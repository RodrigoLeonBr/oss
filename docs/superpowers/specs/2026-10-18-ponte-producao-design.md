# Ponte de Produção — comparação informado × produção registrada (SIA/SIHD)

Data: 2026-10-18
Status: desenho aprovado (aguardando revisão do spec)

## Objetivo

Comparar, por unidade e competência, o que a OSS **informou na prestação de contas**
(indicadores quantitativos no OSS) contra a **produção oficialmente registrada** nos
bancos SIA e SIH do projeto `consultaprod` (`E:\xampp\htdocs\consultasia`).

O operador define, por indicador, um ou mais filtros de produção (grupo, subgrupo,
forma de organização ou procedimento direto). O sistema soma a produção que casa com
esses filtros e mostra lado a lado: informado × registrado × divergência.

## Contexto / terreno

- **Dois bancos MySQL no mesmo servidor** (`localhost:3306`):
  - `oss` — este projeto (Node 22 + Sequelize 6).
  - `producao` — consultaprod (Laravel 12). Credenciais em `consultasia/.env`
    (`DB_USERNAME=hospital`, `DB_PASSWORD=tebaldi`).
- **Produção registrada:**
  - SIA ambulatorial: tabela `producao.s_prd`. Colunas usadas:
    `prd_uid` (CNES da unidade, = `prestador.re_cunid`), `prd_pa` (código SIGTAP 10 díg),
    `prd_cmp` (competência `AAAAMM`, CHAR(6)), `prd_qt_p` (qtd apresentada),
    `prd_qt_a` (qtd aprovada). ~6,8M linhas — índices em `prd_uid`, `prd_cmp`.
  - SIH: `producao.s_aih` (cabeçalho) + `producao.s_aih_pa` (detalhe). Detalhe tem
    `CNES` (7), `COMPETENCIA` (`AAAAMM`), `PROC_DETALHADO` (10), `QUANTIDADE` (int).
  - Hierarquia SIGTAP embutida no código do procedimento: grupo = 2 primeiros dígitos,
    subgrupo = 4 primeiros, forma de organização = 6 primeiros, procedimento = 10 dígitos.
    (Tabela `producao.forma` descreve grupo/subgrupo/forma.)
- **Informado:** `oss.tb_acompanhamento_mensal.valor_realizado`, por indicador e
  `mes_referencia` (DATEONLY, primeiro dia do mês). Indicador liga à unidade via
  `tb_indicadores.unidade_id → tb_unidades.cnes`.

## Decisões (brainstorm)

1. Ferramenta **separada** dos indicadores (não acopla no fluxo de lançamento).
2. Lado informado **puxa do OSS** (`valor_realizado`), nada digitado à mão.
3. Alinhamento por **mapa salvo por indicador** → nova tabela de-para, reproduzível mês a mês.
4. Quantidade de produção comparada = **apresentada** (`prd_qt_p` / `SUM(QUANTIDADE)` no SIH).
5. Cadastro em **tela própria** "Mapa de Produção" (CRUD padrão do projeto).
6. RBAC **reusa o módulo `relatorios`** (sem novo módulo de permissão).

## Arquitetura

A feature vive inteira no OSS. Nenhuma alteração no consultaprod.

### Conexão secundária read-only ao `producao`

Nova conexão Sequelize dedicada, somente leitura, configurada por env
(`DB_PRODUCAO_HOST/PORT/USER/PASS/NAME`, default apontando para o banco `producao`
local). Usada apenas para `SELECT` via `sequelize.query` (raw). Sem models-espelho,
sem migrações nesse banco.

`ponytail:` raw query em vez de models do Sequelize — são 2 SELECTs agregados, não há
ganho em mapear 6,8M linhas num model.

Arquivo: `src/config/producaoDb.js` (cria e exporta a instância) — carregado pelo
service sob demanda.

### Camadas (padrão do projeto)

```
route/ponteProducaoRoute.js      → auth → checkPermission('relatorios', <action>) → auditar → controller
controllers/PonteProducaoController.js   (classe, métodos arrow)
service/PonteProducaoService.js          (sem estado; monta SQL, agrega, compara)
service/MapaProducaoService.js           (CRUD do de-para)
controllers/MapaProducaoController.js
route/mapaProducaoRoute.js
validator/MapaProducaoValidator.js       (Joi)
models/MapaProducao.js                   (model Sequelize no banco oss)
db/migrations/<ts>-create-tb-mapa-producao.js
```

## Modelo de dados — nova tabela `oss.tb_mapa_producao`

De-para: indicador → filtro(s) de produção. Um indicador pode ter N linhas ativas;
a produção registrada do indicador é a soma de todas.

| coluna | tipo | obs |
|---|---|---|
| mapa_id | CHAR(36) PK, `DEFAULT (UUID())` | padrão do projeto |
| indicador_id | CHAR(36) NOT NULL, FK `tb_indicadores` | |
| fonte | ENUM('sia','sih') NOT NULL | `s_prd` ou `s_aih_pa` |
| tipo_filtro | ENUM('grupo','subgrupo','forma','procedimento') NOT NULL | |
| valor_filtro | VARCHAR(10) NOT NULL | `03` / `0301` / `030101` / `0301010010` |
| ativo | TINYINT(1) NOT NULL default 1 | |
| criado_em / atualizado_em | timestamps | `criado_em`/`atualizado_em` |

Índice em `indicador_id`. Model com `paranoid` desligado (append/soft via `ativo`,
seguindo o uso de `ativo` em `Indicador`). CNES **não** é armazenado aqui — deriva de
`indicador.unidade_id → unidade.cnes` no momento da consulta (fonte única da verdade).

Validação de `valor_filtro` por `tipo_filtro`: comprimento exato (2/4/6/10) e numérico.

## Agregação da produção (PonteProducaoService)

Entrada: `indicador_id`, `competencia` (`AAAAMM`).

1. Carrega indicador → unidade → `cnes`. Se `cnes` vazio → erro de negócio
   (`ApiError`) "Unidade sem CNES cadastrado".
2. Carrega filtros ativos do `tb_mapa_producao` do indicador.
3. Para cada filtro, monta cláusula e soma:

   **SIA** (`fonte='sia'`):
   ```sql
   SELECT COALESCE(SUM(prd_qt_p),0) AS total
   FROM s_prd
   WHERE prd_uid = :cnes AND prd_cmp = :cmp AND <clausulaPa>
   ```
   **SIH** (`fonte='sih'`):
   ```sql
   SELECT COALESCE(SUM(QUANTIDADE),0) AS total
   FROM s_aih_pa
   WHERE CNES = :cnes AND COMPETENCIA = :cmp AND <clausulaProc>
   ```
   `<clausulaPa>` / `<clausulaProc>` por `tipo_filtro`:
   - `grupo` (len 2), `subgrupo` (4), `forma` (6): `<col> LIKE CONCAT(:valor,'%')`
     — usa índice do código e filtra pelo prefixo da hierarquia SIGTAP.
   - `procedimento` (10): `<col> = :valor`.

   Coluna: `prd_pa` (SIA) / `PROC_DETALHADO` (SIH). Valores sempre bindados (sem
   concatenação de string na query).
4. Total registrado do indicador = soma dos totais de todos os filtros.
   (`ponytail:` filtros podem se sobrepor se o operador cadastrar grupo + procedimento
   do mesmo grupo — a soma dupla é responsabilidade do cadastro; documentar na tela.)

Performance: `prd_uid` + `prd_cmp` já reduzem de 6,8M para o conjunto de uma unidade/mês
antes do prefixo. Uma query por filtro (N pequeno por indicador).

## Comparação (saída)

Endpoint: `GET /api/ponte-producao?unidade_id=&competencia=AAAAMM`
(ou `contrato_id` + competência → todas as unidades).

Para cada indicador quantitativo da unidade no escopo:

- `informado` = `valor_realizado` do `tb_acompanhamento_mensal` do indicador cujo
  `mes_referencia` cai na competência (mês/ano). Se não houver → `null`.
- `registrado` = agregação acima. Sem filtros no mapa → `registrado=null` e flag
  `sem_mapeamento=true`.
- `diferenca` = `informado - registrado` (quando ambos não-nulos).
- `divergencia_perc` = `registrado ? (diferenca/registrado)*100 : null`.

Resposta padrão: `{ status:true, data:{ competencia, unidade, linhas:[...] }, message }`.

### Tela (frontend)

Página lazy `PonteProducaoPage.tsx` + rota. Filtros de unidade + competência
(`<input type="month">`, nativo). Tabela: indicador · fonte(s)/filtros · informado ·
registrado · diferença · divergência %, com destaque visual quando `sem_mapeamento`
ou divergência acima de um limiar (ex.: ±10%, só realce, sem regra de negócio v1).
Competência default = mês corrente anterior; editável (produção tem defasagem).

## Cadastro do mapa — tela "Mapa de Produção"

CRUD no padrão do projeto: `types.ts → MapaProducaoList.tsx → MapaProducaoFormModal.tsx
→ MapaProducaoDeleteModal.tsx`, lazy em `App.tsx` + rota. Lista por indicador (busca por
unidade/indicador). FormModal: seleciona indicador, fonte, tipo_filtro, valor_filtro
(com máscara/validação de comprimento). Componentes `Field` fora do modal pai.

## RBAC / escopo / auditoria

- Rotas sob `auth()` → `checkPermission('relatorios', <view|insert|update|delete>)`.
- Escopo por OSS: nas consultas de comparação e no CRUD do mapa, aplicar
  `getOssIdSeEscopoProprio(req)` e filtrar indicadores/unidades pela OSS do usuário
  (via `contrato.oss_id`). Validar posse com os `assert*NoEscopoOSS` do
  `helper/ossScopeHelper.js` antes de operar sobre indicador/unidade informados.
- `producao` é lido só pelo CNES da unidade já validada → não vaza outras OSS.
- `auditar('tb_mapa_producao', <acao>)` em toda escrita do mapa.

## Erros / edge cases

- Unidade sem CNES → `ApiError` claro na comparação; no cadastro, permite mas sinaliza.
- Competência inválida (não `AAAAMM`) → 400 via validator.
- Sem produção no período → `registrado = 0`.
- Sem acompanhamento no período → `informado = null` (não zero — distinguir "não informado").
- Banco `producao` indisponível → erro 503 com mensagem clara (não derruba o resto do OSS).

## Testes

- `src/helper/filtroProducao.js` com self-check embutido (`node ...` imprime `OK`):
  dado (tipo_filtro, valor), devolve `{ coluna_op, bind }` — assert de que `grupo→LIKE 03%`,
  `procedimento→= 0301010010`, e rejeição de comprimento errado. Sem DB.
- 1 spec mocha (`specs/ponte/comparacao.spec.js`): stub da conexão `producao`
  (sinon) retornando totais fixos; verifica soma de múltiplos filtros, `informado`
  vindo do acompanhamento, cálculo de `diferenca`/`divergencia_perc` e flag
  `sem_mapeamento`.

## Fora de escopo (v1)

- Export PDF/Excel da comparação.
- Snapshot persistido da comparação (lê sob demanda; sem histórico próprio).
- Regra de negócio sobre divergência (desconto/alerta) — só realce visual.
- Qualquer escrita no banco `producao`.
