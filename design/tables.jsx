/* global React, Icon, Sparkline, StatusBadge, Progress, statusOf, statusLabel, INDICATORS, ALL_INDICATORS */
const { useState, useMemo } = React;

// ============================================================
// TABLE — 3 VARIATIONS
// Variation A: DENSE — grouped, expandable, multi-select, inline actions
// Variation B: CARDS — indicator cards in a grid
// Variation C: MATRIX — horizontal comparison / heatmap-style
// ============================================================

// ---------- VARIATION A: DENSE TABLE ----------
const VariationDense = ({ data, onRowClick }) => {
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [sortKey, setSortKey] = useState("code");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSel = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleExp = (id) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };
  const allIds = data.flatMap(g => g.items.map(i => i.id));
  const allSelected = selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;
  const selectAll = () => setSelected(new Set(allSelected ? [] : allIds));

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      {/* bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 16px", background: "var(--accent-soft)",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: 12.5
        }}>
          <span style={{ color: "var(--accent)", fontWeight: 500 }}>
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </span>
          <span style={{ color: "var(--text-faint)" }}>·</span>
          <button className="btn btn-sm btn-ghost" style={{ color: "var(--accent)" }}>
            <Icon name="send" size={12}/> Submeter em lote
          </button>
          <button className="btn btn-sm btn-ghost" style={{ color: "var(--accent)" }}>
            <Icon name="download" size={12}/> Exportar seleção
          </button>
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setSelected(new Set())}>
            <Icon name="x" size={12}/> Limpar
          </button>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" className="checkbox"
                       checked={allSelected}
                       ref={el => el && (el.indeterminate = someSelected)}
                       onChange={selectAll}/>
              </th>
              <th style={{ width: 24 }}></th>
              <th style={{ width: 78 }}>Código</th>
              <th>Indicador</th>
              <th className="num" style={{ width: 90 }}>Meta</th>
              <th className="num" style={{ width: 90 }}>Realizado</th>
              <th style={{ width: 150 }}>Cumprimento</th>
              <th style={{ width: 90 }}>Tendência</th>
              <th style={{ width: 130 }}>Status</th>
              <th className="col-actions">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map(group => (
              <React.Fragment key={group.grupo}>
                <tr className="group-header">
                  <td colSpan={10}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="folder" size={12}/>
                      <span>{group.grupo}</span>
                      <span style={{ color: "var(--text-faint)", marginLeft: 4 }}>·</span>
                      <span style={{ color: "var(--text-muted)" }}>{group.items.length} indicadores</span>
                      <span style={{ marginLeft: "auto", fontSize: 10.5 }}>
                        {group.items.filter(i => statusOf((i.realizado/i.meta)*100) === "ok").length}
                        {" / "}{group.items.length} cumpridos
                      </span>
                    </div>
                  </td>
                </tr>
                {group.items.map(it => {
                  const pct = (it.realizado / it.meta) * 100;
                  const adjPct = it.invert ? (it.meta / it.realizado) * 100 : pct;
                  const s = statusOf(adjPct);
                  const isSel = selected.has(it.id);
                  const isExp = expanded.has(it.id);
                  return (
                    <React.Fragment key={it.id}>
                      <tr className={isSel ? "selected" : ""}>
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="checkbox"
                                 checked={isSel}
                                 onChange={() => toggleSel(it.id)}/>
                        </td>
                        <td>
                          <button className="btn-icon" style={{ padding: 2 }} onClick={() => toggleExp(it.id)}>
                            <Icon name={isExp ? "chevronDown" : "chevronRight"} size={14}/>
                          </button>
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                            {it.code}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{it.nome}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{it.desc}</div>
                        </td>
                        <td className="num secondary">{it.meta}<span style={{ color: "var(--text-faint)", marginLeft: 2 }}>{it.unidade === "%" ? "%" : ""}</span></td>
                        <td className="num" style={{ fontWeight: 500 }}>
                          {it.realizado}{it.unidade === "%" ? "%" : ""}
                        </td>
                        <td><Progress value={it.invert ? it.meta : it.realizado} goal={it.invert ? it.realizado : it.meta}/></td>
                        <td>
                          <Sparkline data={it.trend} color={`var(--status-${s})`}/>
                        </td>
                        <td><StatusBadge pct={adjPct}/></td>
                        <td className="col-actions">
                          <div style={{ display: "inline-flex", gap: 2 }}>
                            <button className="btn-icon" title="Entrar dados" onClick={() => onRowClick(it)}>
                              <Icon name="edit" size={13}/>
                            </button>
                            <button className="btn-icon" title="Histórico">
                              <Icon name="history" size={13}/>
                            </button>
                            <button className="btn-icon" title="Mais">
                              <Icon name="moreH" size={13}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExp && (
                        <tr>
                          <td colSpan={10} style={{ background: "var(--bg-sunken)", padding: 0 }}>
                            <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 24 }}>
                              <div>
                                <div className="eyebrow" style={{ marginBottom: 8 }}>Série histórica · 7 meses</div>
                                <div style={{
                                  display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
                                  gap: 2, alignItems: "end", height: 60
                                }}>
                                  {it.trend.map((v, i) => {
                                    const mx = Math.max(...it.trend);
                                    const h = (v / mx) * 100;
                                    return (
                                      <div key={i} style={{
                                        height: `${h}%`,
                                        background: i === it.trend.length - 1 ? `var(--status-${s})` : "var(--border-strong)",
                                        borderRadius: 2, position: "relative"
                                      }} title={`${v}`}/>
                                    );
                                  })}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginTop: 4 }}>
                                  {["set","out","nov","dez","jan","fev","mar"].map(m => (
                                    <div key={m} className="mono" style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>{m}</div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="eyebrow" style={{ marginBottom: 8 }}>Contrato</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span className="muted">Fonte</span><span>SIASUS / e-SUS APS</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span className="muted">Peso no desconto</span><span className="mono">0.08</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span className="muted">Periodicidade</span><span>Mensal</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span className="muted">Último envio</span><span className="mono">{it.ultima}</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <div className="eyebrow" style={{ marginBottom: 8 }}>Ações rápidas</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  <button className="btn btn-sm btn-secondary">
                                    <Icon name="edit" size={12}/> Editar mês
                                  </button>
                                  <button className="btn btn-sm btn-secondary">
                                    <Icon name="file" size={12}/> Anexar evidência
                                  </button>
                                  <button className="btn btn-sm btn-success">
                                    <Icon name="check" size={12}/> Aprovar
                                  </button>
                                  <button className="btn btn-sm btn-ghost">
                                    <Icon name="history" size={12}/> Ver histórico completo
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------- VARIATION B: CARDS GRID ----------
const VariationCards = ({ data, onRowClick }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {data.map(group => (
        <div key={group.grupo}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)"
          }}>
            <Icon name="folder" size={14} className="muted"/>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{group.grupo}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {group.items.length} indicadores</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {group.items.map(it => {
              const pct = (it.realizado / it.meta) * 100;
              const adjPct = it.invert ? (it.meta / it.realizado) * 100 : pct;
              const s = statusOf(adjPct);
              return (
                <div key={it.id} className="panel" style={{ padding: 14, cursor: "pointer", position: "relative" }}
                     onClick={() => onRowClick(it)}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `var(--status-${s})`, borderRadius: "var(--r-4) 0 0 var(--r-4)" }}/>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{it.code}</span>
                    <StatusBadge pct={adjPct}/>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginBottom: 10 }}>{it.nome}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                    <span className="mono tabular" style={{ fontSize: 22, fontWeight: 500 }}>{it.realizado}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{it.unidade}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                      meta <span className="mono">{it.meta}</span>
                    </span>
                  </div>
                  <Progress value={it.invert ? it.meta : it.realizado} goal={it.invert ? it.realizado : it.meta}/>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Sparkline data={it.trend} color={`var(--status-${s})`} width={100}/>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                      {it.ultima}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------- VARIATION C: MATRIX / HEATMAP ----------
const VariationMatrix = ({ data, onRowClick }) => {
  const months = ["set","out","nov","dez","jan","fev","mar"];
  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Código</th>
              <th>Indicador</th>
              <th className="num" style={{ width: 70 }}>Meta</th>
              {months.map(m => (
                <th key={m} className="num" style={{ width: 46 }}>{m}</th>
              ))}
              <th style={{ width: 110 }}>Status</th>
              <th className="col-actions">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.map(group => (
              <React.Fragment key={group.grupo}>
                <tr className="group-header">
                  <td colSpan={11}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="folder" size={12}/>{group.grupo}
                    </div>
                  </td>
                </tr>
                {group.items.map(it => {
                  const pct = (it.realizado / it.meta) * 100;
                  const adjPct = it.invert ? (it.meta / it.realizado) * 100 : pct;
                  const s = statusOf(adjPct);
                  return (
                    <tr key={it.id}>
                      <td><span className="mono secondary" style={{ fontSize: 11.5 }}>{it.code}</span></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{it.nome}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{it.unidade}</div>
                      </td>
                      <td className="num">{it.meta}</td>
                      {it.trend.map((v, i) => {
                        const cellPct = it.invert ? (it.meta / v) * 100 : (v / it.meta) * 100;
                        const cs = statusOf(cellPct);
                        const opacity = Math.min(1, 0.3 + (cellPct / 150) * 0.7);
                        return (
                          <td key={i} className="num" style={{ padding: "6px 4px" }}>
                            <div style={{
                              background: `var(--status-${cs}-bg)`,
                              color: `var(--status-${cs})`,
                              padding: "4px 2px",
                              borderRadius: 3,
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              textAlign: "center",
                              border: i === it.trend.length - 1 ? `1px solid var(--status-${cs})` : `1px solid var(--status-${cs}-border)`,
                              fontWeight: i === it.trend.length - 1 ? 600 : 400
                            }}>
                              {typeof v === "number" && v < 10 ? v.toFixed(1) : Math.round(v)}
                            </div>
                          </td>
                        );
                      })}
                      <td><StatusBadge pct={adjPct}/></td>
                      <td className="col-actions">
                        <button className="btn-icon" onClick={() => onRowClick(it)}>
                          <Icon name="edit" size={13}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

Object.assign(window, { VariationDense, VariationCards, VariationMatrix });
