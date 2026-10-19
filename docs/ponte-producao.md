# Ponte de Produção — informado × produção registrada (SIA/SIH)

Compara, por **unidade** e **competência**, o que a OSS informou na prestação de contas
(`tb_acompanhamento_mensal.valor_realizado`) contra a **produção oficialmente registrada**
nos bancos SIA/SIH do projeto **consultaprod** (`E:\xampp\htdocs\consultasia`).

Spec e plano de implementação: `docs/superpowers/specs/2026-10-18-ponte-producao-design.md`,
`docs/superpowers/plans/2026-10-18-ponte-producao.md`.

## Como funciona

1. O operador cadastra, na tela **Mapa de Produção**, um ou mais filtros por indicador
   quantitativo: fonte (SIA/SIH) + tipo (grupo/subgrupo/forma/procedimento) + código SIGTAP.
2. A tela **Ponte de Produção** escolhe unidade + competência e mostra, por indicador:
   informado × registrado × diferença × divergência %. Indicador sem filtro = "sem mapeamento".
3. O **registrado** é a soma da produção que casa com os filtros, lida do banco `producao`
   pelo CNES da unidade (`tb_unidades.cnes`) e pela competência (`AAAAMM`).

## Dois bancos no mesmo MySQL (localhost:3306)

| Banco | Projeto | Acesso |
|---|---|---|
| `oss` | este | Sequelize (models) |
| `producao` | consultaprod (Laravel) | conexão **read-only** `src/config/producaoDb.js` (só SELECT) |

Credenciais do `producao` (user `hospital`) vêm de envs `DB_PRODUCAO_*` (ver `env.docker.example`),
default apontando para o banco local. **Nenhuma escrita** é feita no `producao`.

## Fontes de produção

- **SIA** (`s_prd`): `prd_uid` (CNES), `prd_cmp` (`AAAAMM`), `prd_pa` (código SIGTAP 10 díg),
  `prd_qt_p` (quantidade **apresentada** — a comparada).
- **SIH** (`s_aih_pa`, detalhe): `CNES`, `COMPETENCIA` (`AAAAMM`), `PROC_DETALHADO`, `QUANTIDADE`.

Hierarquia SIGTAP é por **prefixo** do código: grupo = 2 díg, subgrupo = 4, forma = 6,
procedimento = 10. O helper `src/helper/filtroProducao.js` é a fonte única dessa regra:
grupo/subgrupo/forma → `coluna LIKE 'valor%'`; procedimento → `coluna = valor`. Os valores
são sempre bindados; só `coluna`/`operador` (constantes do helper) são interpolados.

## Camadas (backend)

```
tb_mapa_producao (model db.mapa_producao)      de-para indicador→filtro
src/config/producaoDb.js                        conexão read-only + pingProducao()
src/helper/filtroProducao.js                    clausulaFiltro / validarValorFiltro (+ self-check)
src/service/MapaProducaoService.js              CRUD do mapa (escopo por OSS)
src/service/PonteProducaoService.js             montarComparacao (pura) + comparar (orquestra)
src/controllers|route Mapa/PonteProducao        /api/mapa-producao, /api/ponte-producao
```

Tabela `tb_mapa_producao`: `mapa_id` (PK UUID), `indicador_id` (FK), `fonte` (`sia|sih`),
`tipo_filtro` (`grupo|subgrupo|forma|procedimento`), `valor_filtro` (2/4/6/10 díg), `ativo`.

## Endpoints

| Método | Rota | Permissão (módulo `relatorios`) |
|---|---|---|
| GET | `/api/mapa-producao?unidadeId=&indicadorId=` | view |
| POST | `/api/mapa-producao` `{indicadorId,fonte,tipoFiltro,valorFiltro}` | insert |
| PUT | `/api/mapa-producao/:id` | update |
| DELETE | `/api/mapa-producao/:id` | delete |
| GET | `/api/ponte-producao?unidadeId=&competencia=AAAAMM` | view |

Todas sob `auth()` + `checkPermission('relatorios', …)` + escopo por OSS
(`getOssIdSeEscopoProprio`, filtra pelo CNES/contrato da OSS do usuário). Escritas do mapa
passam por `auditar('tb_mapa_producao', …)`. A comparação é read-only (sem `auditar`).

## Erros / comportamento

- Unidade sem CNES → 400 ("Unidade sem CNES cadastrado").
- Banco `producao` indisponível → 503.
- `competencia` fora de `AAAAMM` → 400.
- Sem produção no período → registrado 0. Sem acompanhamento → informado `null` (≠ 0).
- Filtros que se sobrepõem (ex.: grupo + procedimento do mesmo grupo) **somam em dobro** —
  responsabilidade do cadastro; a tela avisa.

## Fora de escopo (v1)

Export PDF/Excel, snapshot persistido da comparação, regra de negócio sobre divergência
(só realce visual ±10%), qualquer escrita no banco `producao`.

## Gotcha

`model.create()` devolve a instância com o PK ainda como `Literal '(UUID())'` (MySQL não
retorna o PK gerado). Sempre `findByPk` antes de `.destroy()`/`.update()` — vale para todo o
repo (todos os models usam `DEFAULT (UUID())`). Os services `remover`/`atualizar` já fazem isso.
