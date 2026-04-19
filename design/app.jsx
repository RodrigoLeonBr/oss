/* global React, Icon, KpiStrip, LineChart, BarChart, Donut, VariationDense, VariationCards, VariationMatrix, StatusBadge, Progress, Sparkline, INDICATORS, ALL_INDICATORS, DsDoc */
const { useState, useEffect, useMemo } = React;

// ============================================================
// DATA ENTRY MODAL
// ============================================================
const EntryModal = ({ indicator, onClose, onSave }) => {
  const [value, setValue] = useState("");
  const [desc, setDesc] = useState("");
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!indicator) return null;
  const num = parseFloat(value);
  const pct = !isNaN(num) ? (indicator.invert ? (indicator.meta / num) * 100 : (num / indicator.meta) * 100) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Entrada de dados · {indicator.code}</div>
            <h3 className="ds-h3" style={{ marginBottom: 2 }}>{indicator.nome}</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{indicator.desc}</p>
          </div>
          <button className="btn-icon" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="info-box">
            <div className="info-box-row"><span className="info-box-label">Meta mensal</span><span className="info-box-value">{indicator.meta} {indicator.unidade}</span></div>
            <div className="info-box-row"><span className="info-box-label">Competência</span><span className="info-box-value">03/2026</span></div>
            <div className="info-box-row"><span className="info-box-label">Último valor</span><span className="info-box-value">{indicator.realizado} {indicator.unidade}</span></div>
          </div>

          <div>
            <label className="field-label field-required">Valor realizado</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="input mono" placeholder="0,00" value={value} onChange={e => setValue(e.target.value)} style={{ flex: 1 }}/>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", width: 64 }}>{indicator.unidade}</span>
            </div>
          </div>

          {pct !== null && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", borderRadius: "var(--r-3)",
              background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)"
            }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 2 }}>Preview</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{pct.toFixed(1)}%</div>
              </div>
              <StatusBadge pct={pct}/>
            </div>
          )}

          <div>
            <label className={`field-label ${pct !== null && pct < 95 ? "field-required" : ""}`}>
              Descrição de desvios
            </label>
            <textarea className="textarea" rows="3" value={desc} onChange={e => setDesc(e.target.value)}
                      placeholder="Descreva causas e plano de ação (obrigatório abaixo da meta)..."/>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave()}>
            <Icon name="check" size={13}/>Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SIDEBAR
// ============================================================
const Sidebar = ({ view, setView }) => {
  const items = [
    { key: "dashboard", label: "Visão geral", icon: "home", count: null },
    { key: "dashboard", label: "Indicadores", icon: "activity", count: "16", active: true },
    { key: "dashboard", label: "Aprovações", icon: "checkCircle", count: "4" },
    { key: "dashboard", label: "Relatórios CMS", icon: "file", count: null },
    { key: "dashboard", label: "Repasses", icon: "dollar", count: null },
    { key: "dashboard", label: "Contratos OSS", icon: "building", count: null },
  ];
  const admin = [
    { label: "Usuários", icon: "users" },
    { label: "Configurações", icon: "settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">SM</div>
        <div className="sidebar-brand-text">
          <strong>OSS Saúde</strong>
          <span>Americana/SP</span>
        </div>
      </div>
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        <div className="sidebar-section">Operação</div>
        {items.map((it, i) => (
          <div key={i} className={`sidebar-item ${it.active && view === "dashboard" ? "active" : ""}`}
               onClick={() => setView("dashboard")}>
            <Icon name={it.icon} size={15}/>
            <span>{it.label}</span>
            {it.count && <span className="count mono">{it.count}</span>}
          </div>
        ))}
        <div className="sidebar-section">Sistema</div>
        <div className={`sidebar-item ${view === "ds" ? "active" : ""}`} onClick={() => setView("ds")}>
          <Icon name="bar" size={15}/>
          <span>Design System</span>
          <span className="count mono">DS</span>
        </div>
        {admin.map((it, i) => (
          <div key={i} className="sidebar-item">
            <Icon name={it.icon} size={15}/>
            <span>{it.label}</span>
          </div>
        ))}
      </nav>
      <div style={{
        padding: 12, borderTop: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", gap: 8
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: "var(--accent-soft)",
          color: "var(--accent)", display: "grid", placeItems: "center",
          fontSize: 11, fontWeight: 600
        }}>MR</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Marina R. Silva
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Gestor CMS</div>
        </div>
      </div>
    </aside>
  );
};

// ============================================================
// HEADER
// ============================================================
const Header = ({ theme, setTheme, view }) => (
  <header className="app-header">
    <div className="breadcrumbs">
      <Icon name="home" size={13} className="muted"/>
      <span className="sep">/</span>
      <span>Operação</span>
      <span className="sep">/</span>
      <span className="current">{view === "ds" ? "Design System" : "Indicadores · Ciclo Mensal"}</span>
    </div>
    <div style={{ flex: 1 }}/>
    <div className="search-input-wrap" style={{ width: 260 }}>
      <Icon name="search" size={14}/>
      <input className="input" placeholder="Buscar em todo o sistema..." style={{ width: "100%" }}/>
    </div>
    <button className="btn-icon" title="Notificações">
      <Icon name="bell" size={15}/>
    </button>
    <button className="btn-icon" title="Tema" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      <Icon name={theme === "light" ? "moon" : "sun"} size={15}/>
    </button>
  </header>
);

// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = ({ variant, setVariant, onOpenModal }) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [group, setGroup] = useState("all");

  const filteredData = useMemo(() => {
    return INDICATORS.map(g => ({
      ...g,
      items: g.items.filter(it => {
        if (group !== "all" && g.grupo !== group) return false;
        if (query && !(`${it.code} ${it.nome}`.toLowerCase().includes(query.toLowerCase()))) return false;
        if (filter !== "all") {
          const pct = it.invert ? (it.meta / it.realizado) * 100 : (it.realizado / it.meta) * 100;
          const s = pct >= 95 ? "ok" : pct >= 80 ? "warn" : "bad";
          if (s !== filter) return false;
        }
        return true;
      })
    })).filter(g => g.items.length > 0);
  }, [query, filter, group]);

  const counts = useMemo(() => {
    const c = { all: 0, ok: 0, warn: 0, bad: 0 };
    ALL_INDICATORS.forEach(it => {
      const pct = it.invert ? (it.meta / it.realizado) * 100 : (it.realizado / it.meta) * 100;
      const s = pct >= 95 ? "ok" : pct >= 80 ? "warn" : "bad";
      c.all++; c[s]++;
    });
    return c;
  }, []);

  return (
    <div style={{ padding: "20px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page head */}
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Ciclo mensal · Competência 03/2026 · OSS Vida+</div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.01em" }}>
            Indicadores Contratuais
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Acompanhamento mensal dos indicadores pactuados com a Organização Social de Saúde.
            Encerramento em <span className="mono" style={{ color: "var(--text-secondary)" }}>15/04/2026</span>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary"><Icon name="download" size={13}/>Exportar PDF</button>
          <button className="btn btn-secondary"><Icon name="file" size={13}/>Excel</button>
          <button className="btn btn-primary"><Icon name="send" size={13}/>Submeter ao CMS</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiStrip/>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.9fr", gap: 12 }}>
        <div className="chart-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
            <div>
              <div className="eyebrow">Evolução · Taxa de cumprimento</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginTop: 2 }} className="tabular">62.5%</div>
            </div>
            <div className="segmented">
              <button>3M</button><button className="active">6M</button><button>12M</button>
            </div>
          </div>
          <LineChart data={[54, 56, 58, 60, 58, 62, 62.5]} goal={80} height={170}/>
        </div>
        <div className="chart-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
            <div>
              <div className="eyebrow">Cumpridos por eixo assistencial</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginTop: 2 }} className="tabular">10 / 16</div>
            </div>
          </div>
          <BarChart data={[
            { label: "APS", value: 3, highlight: false },
            { label: "AME", value: 2, highlight: false },
            { label: "URG", value: 3, highlight: true },
            { label: "SMT", value: 1, highlight: false },
            { label: "GST", value: 1, highlight: false },
          ]} height={170}/>
        </div>
        <div className="chart-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Distribuição de status</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
            <Donut segments={[
              { value: 10, color: "var(--status-ok)" },
              { value: 4, color: "var(--status-warn)" },
              { value: 2, color: "var(--status-bad)" },
            ]}/>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {[
                { c: "var(--status-ok)", label: "Cumpridos", val: "10" },
                { c: "var(--status-warn)", label: "Parciais", val: "4" },
                { c: "var(--status-bad)", label: "Não cumpridos", val: "2" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, background: r.c, borderRadius: 2, flexShrink: 0 }}/>
                  <span style={{ flex: 1 }}>{r.label}</span>
                  <span className="mono" style={{ fontWeight: 500 }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="panel" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="search-input-wrap" style={{ flex: "0 1 300px" }}>
          <Icon name="search" size={14}/>
          <input className="input" placeholder="Buscar por código ou nome..."
                 value={query} onChange={e => setQuery(e.target.value)} style={{ width: "100%" }}/>
        </div>
        <select className="select" style={{ width: 200 }} value={group} onChange={e => setGroup(e.target.value)}>
          <option value="all">Todos os grupos</option>
          {INDICATORS.map(g => <option key={g.grupo} value={g.grupo}>{g.grupo}</option>)}
        </select>
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 4 }}>
          <Icon name="filter" size={14} className="muted"/>
          <button className={`tab-filter ${filter === "all" ? "active all" : ""}`} onClick={() => setFilter("all")}>
            Todos <span className="mono">{counts.all}</span>
          </button>
          <button className={`tab-filter ${filter === "ok" ? "active ok" : ""}`} onClick={() => setFilter("ok")}>
            Cumpridos <span className="mono">{counts.ok}</span>
          </button>
          <button className={`tab-filter ${filter === "warn" ? "active warn" : ""}`} onClick={() => setFilter("warn")}>
            Parciais <span className="mono">{counts.warn}</span>
          </button>
          <button className={`tab-filter ${filter === "bad" ? "active bad" : ""}`} onClick={() => setFilter("bad")}>
            Não cumpridos <span className="mono">{counts.bad}</span>
          </button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Layout</span>
          <div className="segmented">
            <button className={variant === "dense" ? "active" : ""} onClick={() => setVariant("dense")}>
              <Icon name="bar" size={11}/> Denso
            </button>
            <button className={variant === "cards" ? "active" : ""} onClick={() => setVariant("cards")}>
              <Icon name="folder" size={11}/> Cards
            </button>
            <button className={variant === "matrix" ? "active" : ""} onClick={() => setVariant("matrix")}>
              <Icon name="activity" size={11}/> Matriz
            </button>
          </div>
        </div>
      </div>

      {/* Table variation */}
      {variant === "dense" && <VariationDense data={filteredData} onRowClick={onOpenModal}/>}
      {variant === "cards" && <VariationCards data={filteredData} onRowClick={onOpenModal}/>}
      {variant === "matrix" && <VariationMatrix data={filteredData} onRowClick={onOpenModal}/>}

      {/* Footer strip */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 11, color: "var(--text-muted)", padding: "8px 4px"
      }}>
        <span>Fontes: SIASUS · e-SUS APS · CIHA · TABNET · Registro próprio OSS</span>
        <span className="mono">Última sincronização: 18/04/2026 14:32:08 BRT</span>
      </div>
    </div>
  );
};

// ============================================================
// APP ROOT
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "tableVariant": "dense",
  "accentHue": "navy"
}/*EDITMODE-END*/;

const App = () => {
  const [theme, setThemeState] = useState(() => localStorage.getItem("oss-theme") || TWEAK_DEFAULTS.theme);
  const [variant, setVariantState] = useState(() => localStorage.getItem("oss-variant") || TWEAK_DEFAULTS.tableVariant);
  const [view, setView] = useState(() => localStorage.getItem("oss-view") || "dashboard");
  const [modalItem, setModalItem] = useState(null);
  const [tweakOpen, setTweakOpen] = useState(false);

  const setTheme = (t) => { setThemeState(t); localStorage.setItem("oss-theme", t); };
  const setVariant = (v) => { setVariantState(v); localStorage.setItem("oss-variant", v); };
  const setViewP = (v) => { setView(v); localStorage.setItem("oss-view", v); };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Tweaks integration
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweakOpen(true);
      else if (e.data?.type === "__deactivate_edit_mode") setTweakOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const pushEdit = (edits) => window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar view={view} setView={setViewP}/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header theme={theme} setTheme={setTheme} view={view}/>
        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-canvas)" }}>
          {view === "dashboard"
            ? <Dashboard variant={variant} setVariant={setVariant} onOpenModal={setModalItem}/>
            : <DsDoc/>}
        </main>
      </div>
      {modalItem && <EntryModal indicator={modalItem} onClose={() => setModalItem(null)} onSave={() => setModalItem(null)}/>}

      {/* Tweaks panel */}
      {tweakOpen && (
        <div style={{
          position: "fixed", bottom: 16, right: 16,
          width: 260, background: "var(--bg-surface)",
          border: "1px solid var(--border-default)", borderRadius: "var(--r-4)",
          boxShadow: "var(--shadow-lg)", zIndex: 100, padding: 14
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span className="eyebrow">Tweaks</span>
            <button className="btn-icon" onClick={() => setTweakOpen(false)}><Icon name="x" size={13}/></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="field-label">Tema</label>
              <div className="segmented" style={{ width: "100%" }}>
                <button className={theme === "light" ? "active" : ""} onClick={() => { setTheme("light"); pushEdit({ theme: "light" }); }} style={{ flex: 1 }}>
                  <Icon name="sun" size={11}/>Claro
                </button>
                <button className={theme === "dark" ? "active" : ""} onClick={() => { setTheme("dark"); pushEdit({ theme: "dark" }); }} style={{ flex: 1 }}>
                  <Icon name="moon" size={11}/>Escuro
                </button>
              </div>
            </div>
            <div>
              <label className="field-label">Layout da tabela</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { k: "dense", l: "Denso · agrupada, expansível" },
                  { k: "cards", l: "Cards · grid visual" },
                  { k: "matrix", l: "Matriz · heatmap temporal" },
                ].map(o => (
                  <button key={o.k}
                          className={`btn btn-sm ${variant === o.k ? "btn-primary" : "btn-secondary"}`}
                          style={{ justifyContent: "flex-start", width: "100%" }}
                          onClick={() => { setVariant(o.k); pushEdit({ tableVariant: o.k }); }}>
                    <Icon name="check" size={11} style={{ opacity: variant === o.k ? 1 : 0 }}/>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Visão</label>
              <div className="segmented" style={{ width: "100%" }}>
                <button className={view === "dashboard" ? "active" : ""} onClick={() => setViewP("dashboard")} style={{ flex: 1 }}>Dashboard</button>
                <button className={view === "ds" ? "active" : ""} onClick={() => setViewP("ds")} style={{ flex: 1 }}>Design System</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
