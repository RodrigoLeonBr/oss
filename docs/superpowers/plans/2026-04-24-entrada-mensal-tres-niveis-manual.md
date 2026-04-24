# Entrada mensal (3 níveis) — alinhamento ao manual operacional

**Referência:** [Manual-Operacao-Dominio-Contratual.md](../../Manual-Operacao-Dominio-Contratual.md) §§6–8 (indicador, metas e decomposição, acompanhamento).

Este documento **estende** o plano de UI em três níveis (Indicador → resumo de meta / avulsa → detalhe de decomposição) com o que o manual exige **explicitamente** para operação e consistência de cálculo.

---

## 1. Indicador (§6) → Nível 1 da lista

| Manual | Incorporar no plano de lançamento |
|--------|-----------------------------------|
| `tipo`: quantitativo / qualitativo (§6.2) | Rótulo **Produção** / **Qualidade** no cabeçalho do bloco, coerente com o modo de medir o desempenho. |
| `meta_tipo` (maior_igual, menor_igual) (§6.2) | Já usado no record/modal; continua a reger **status** e **faixas** nas linhas folha (§6.4). |
| 1 indicador → N acompanhamentos, cada um a uma **meta** e um **mês** (§6.3) | A lista continua a ser por **folhas**; o nível 1 é apenas **agrupamento visual**, sem nova entidade. |
| `periodicidade` (mensal, bimestral, …) (§6.2) | **Opcional (fase 2):** tooltip ou aviso se o mês selecionado não for mês de verificação daquele indicador; **não** bloquear MVP. |
| `grupo` (auditoria_operacional, …) (§6.2) | **Opcional:** filtro ou subcabeçalho; não obrigatório para o fluxo mínimo. |
| `peso_perc` do **indicador** (§6.2) | Peso do indicador no **repasse/desconto** do contrato; **não** confundir com `peso` da **sub-meta** (§7.2) no F. Se necessário, nota de rodapé na área de repasse, não na tabela de lançamento. |

---

## 2. Metas e decomposição (§7) → Níveis 2 e 3

| Manual | Incorporar |
|--------|------------|
| **avulsa** — uma linha, sem filhos (§7.3) | Nível 2 **com** Lançar/Editar; sem nível 3. |
| **agregada** — total de referência do pacote; **sem** valor realizado direto na regra v1 (§7.3) | Nível 2 **só leitura**: ref. de volume (e rótulo “Total” / pacote). **Sem** modal de valor. |
| **componente** — `peso` > 0, realizado e entrada no F (§7.2–7.3) | Nível 3 com Lançar/Editar. |
| Indicadores **qualitativos** sem decomposição em pacote (§7.3) | Só bloco “indicador + avulsa”; não mostrar fake de pacote. |
| `versao` / vigência (§7.1–7.2) | Já filtrado no backend; se a listagem for por **mês de referência** histórico, o serviço deve usar vigência coerente com esse mês (já anotado no plano técnico). |

### Cálculo F (§7.5) — textos e UI

- Deixar claro (tooltip ou texto de ajuda **curto** na coluna F):
  - F é **média ponderada** \( \frac{\sum w_i f_i}{\sum w_i} \), **não** `soma(realizados) / soma(metas)`.
  - Abaixo de `meta_mínima`, aplica-se **teto (cap)** ao fator (penalidade suave); o valor numérico vem do produto/backend.
- **Peso** \(w_i\) = `peso` do **componente**; a fórmula **normaliza** — não exige somar 100.

### Linha agregada — conferência (§7.5 última frase)

- Exibir, quando houver decomposição, a **soma dos realizados** das folhas no **mesmo mês** (eixo de volume alinhado ao indicador), como **conferência** — alinhado a `realizadoSomaComponentes` / serviço atual.

---

## 3. Acompanhamento mensal (§8) → Comportamento de lançamento

| Manual | Incorporar |
|--------|------------|
| Uma linha por **meta folha** e **mês** (`mes_referencia` dia 1) | Manter; POST/PUT só para folhas. |
| **Snapshot** da meta no lançamento | Já no modelo; modal continua a refletir faixas a partir do record. |
| Não lançar na **agregada** | Evita **dupla contagem** e preserva rastreabilidade por **linha operacional** (§8). Texto **curto** no nível 2 read-only: ex. “Conferência — valor lançado nas sub-metas; total não é somado aqui” ou equivalente. |

---

## 4. Checklist aditivo (para o plano de implementação)

- [ ] Tooltips/ajuda: F (média ponderada + cap), agregada somente leitura, motivo “sem dupla contagem”.
- [ ] Nível 1: `tipo` indicador coerente com o manual (Produção/Qualidade).
- [ ] Nível 2 agregada: mostrar ref. + soma realizados (conferência) + F do grupo, sem botão de lançamento.
- [ ] Nível 2 avulsa + nível 3 componentes: botões Lançar/Editar; `mesReferencia` sempre preenchido (correção de serviço já prevista).
- [ ] (Opcional) `periodicidade` / `grupo` no nível 1.

---

**Relação com outros docs:** a spec de decomposição [2026-04-23-metas-decomposicao-pesos-design.md](../specs/2026-04-23-metas-decomposicao-pesos-design.md) e o [design entrada mensal](../specs/2026-04-21-entrada-mensal-design.md) permanecem válidos; este ficheiro **amarra** a UI ao **Manual de Operação** para revisão clínica e de contrato.
