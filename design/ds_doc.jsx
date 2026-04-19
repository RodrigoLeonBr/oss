/* global React, Icon */
const { useState } = React;

// ============================================================
// DS DOCUMENTATION VIEW
// ============================================================

const ColorSwatch = ({ name, cssVar, hex }) => (
  <div className="token-chip">
    <div className="token-swatch" style={{ background: `var(${cssVar})` }}/>
    <div className="token-meta">
      <span className="token-name">{name}</span>
      <span className="token-value">{cssVar}</span>
    </div>
  </div>
);

const TokenSection = ({ title, children }) => (
  <div style={{ marginBottom: 40 }}>
    <div className="eyebrow" style={{ marginBottom: 10 }}>{title}</div>
    {children}
  </div>
);

const DsDoc = () => {
  const brandScale = [900, 800, 700, 600, 500, 400, 300, 200, 100, 50];
  const neutrals = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 95];
  const typeScale = [
    { name: "Display", size: 32, weight: 500, family: "Sans", usage: "Page titles, empty states" },
    { name: "H1", size: 24, weight: 500, family: "Sans", usage: "Section titles" },
    { name: "H2", size: 20, weight: 500, family: "Sans", usage: "Panel headers" },
    { name: "H3", size: 16, weight: 600, family: "Sans", usage: "Card titles" },
    { name: "Body", size: 14, weight: 400, family: "Sans", usage: "Default paragraph" },
    { name: "Body SM", size: 13, weight: 400, family: "Sans", usage: "Table cells, forms" },
    { name: "Caption", size: 12, weight: 400, family: "Sans", usage: "Metadata, hints" },
    { name: "Eyebrow", size: 11, weight: 500, family: "Mono", usage: "Section labels, uppercase" },
    { name: "Numeric", size: 13, weight: 500, family: "Mono", usage: "All figures, codes, values" },
  ];

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Hero */}
      <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Design System · v0.1 · Abril 2026</div>
        <h1 className="ds-h1" style={{ marginBottom: 8 }}>OSS Saúde — Linguagem Institucional</h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 720, margin: 0, lineHeight: 1.55 }}>
          Sistema visual e funcional para dashboards públicos de saúde da Secretaria Municipal
          de Americana. Prioriza densidade informacional, legibilidade, status semântico
          inequívoco e segurança operacional para gestores, auditores e equipes técnicas.
        </p>
        <div style={{ display: "flex", gap: 24, marginTop: 24, fontSize: 12 }}>
          <div><span className="eyebrow">Tipografia</span> <div style={{ marginTop: 2 }}>IBM Plex Sans / Mono</div></div>
          <div><span className="eyebrow">Paleta</span> <div style={{ marginTop: 2 }}>Navy · Teal · Amber · Coral</div></div>
          <div><span className="eyebrow">Grade</span> <div style={{ marginTop: 2 }}>4px base · 12 colunas</div></div>
          <div><span className="eyebrow">Densidade</span> <div style={{ marginTop: 2 }}>Alta (8/10)</div></div>
        </div>
      </div>

      {/* ============ FUNDAÇÃO ============ */}
      <h2 className="ds-h2" style={{ marginBottom: 4 }}>1. Fundação</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
        Tokens são a única fonte de verdade. Todo componente deve se referir a variáveis — nunca a hex literais.
      </p>

      <TokenSection title="Cor institucional — Navy">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {brandScale.map(step => (
            <ColorSwatch key={step} name={`brand.navy.${step}`} cssVar={`--brand-navy-${step}`}/>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Semântica — status de indicador">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { label: "Cumprido", prefix: "--sem-teal", steps: [700, 600, 500, 100, 50] },
            { label: "Parcial", prefix: "--sem-amber", steps: [700, 600, 500, 100, 50] },
            { label: "Não cumprido", prefix: "--sem-coral", steps: [700, 600, 500, 100, 50] },
          ].map(cat => (
            <div key={cat.label}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{cat.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                {cat.steps.map(s => (
                  <div key={s} style={{ height: 40, borderRadius: 3, background: `var(${cat.prefix}-${s})`, border: "1px solid var(--border-subtle)" }}/>
                ))}
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
                700 · 600 · 500 · 100 · 50
              </div>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Neutros — escala cool-slate">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(13, 1fr)", gap: 2 }}>
          {neutrals.map(n => (
            <div key={n} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ height: 50, background: `var(--n-${String(n).padStart(2, "0")})`, border: "1px solid var(--border-subtle)", borderRadius: 3 }}/>
              <span className="mono" style={{ fontSize: 9.5, color: "var(--text-muted)", textAlign: "center" }}>{n}</span>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Tipografia — escala">
        <div className="panel">
          {typeScale.map((t, i) => (
            <div key={t.name} style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 60px 60px 200px",
              alignItems: "baseline",
              padding: "14px 16px",
              borderBottom: i < typeScale.length - 1 ? "1px solid var(--border-subtle)" : "none",
              gap: 16
            }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.name}</span>
              <span style={{
                fontSize: t.size,
                fontWeight: t.weight,
                fontFamily: t.family === "Mono" ? "var(--font-mono)" : "var(--font-sans)",
                letterSpacing: t.size > 20 ? "-0.01em" : "normal"
              }}>
                {t.family === "Mono" ? "0.123 / SUS-42" : "Indicador de cumprimento"}
              </span>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.size}px</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.weight}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.usage}</span>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Espaçamento · Raio · Sombra">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Espaço (base 4px)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[2,4,8,12,16,20,24,32,40,48].map((v, i) => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                  <span className="mono" style={{ width: 40, color: "var(--text-muted)" }}>s-{i+1}</span>
                  <div style={{ width: v, height: 10, background: "var(--accent)" }}/>
                  <span className="mono" style={{ color: "var(--text-muted)" }}>{v}px</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Raio de borda</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[{n:"r-2",v:4},{n:"r-3",v:6},{n:"r-4",v:8},{n:"r-5",v:10},{n:"r-full",v:999}].map(r => (
                <div key={r.n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                  <span className="mono" style={{ width: 50, color: "var(--text-muted)" }}>{r.n}</span>
                  <div style={{ width: 40, height: 22, background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: r.v }}/>
                  <span className="mono" style={{ color: "var(--text-muted)" }}>{r.v}px</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Elevação</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["xs","sm","md","lg"].map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                  <div style={{
                    width: 60, height: 30, background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 4,
                    boxShadow: `var(--shadow-${s})`
                  }}/>
                  <span className="mono" style={{ color: "var(--text-muted)" }}>shadow-{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </TokenSection>

      {/* ============ COMPONENTES ============ */}
      <h2 className="ds-h2" style={{ marginBottom: 4, marginTop: 40 }}>2. Componentes</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
        Um inventário curado. Cada padrão é acompanhado de seus estados primários.
      </p>

      <TokenSection title="Botões — hierarquia">
        <div className="panel panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 110, fontSize: 11, color: "var(--text-muted)" }}>Primary</span>
            <button className="btn btn-primary"><Icon name="send" size={13}/>Submeter</button>
            <button className="btn btn-primary btn-sm">SM</button>
            <button className="btn btn-primary btn-lg">Grande ação</button>
            <button className="btn btn-primary" disabled style={{ opacity: 0.5 }}>Desabilitado</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 110, fontSize: 11, color: "var(--text-muted)" }}>Secondary</span>
            <button className="btn btn-secondary"><Icon name="download" size={13}/>Exportar PDF</button>
            <button className="btn btn-secondary"><Icon name="file" size={13}/>Excel</button>
            <button className="btn btn-secondary">Cancelar</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 110, fontSize: 11, color: "var(--text-muted)" }}>Ghost</span>
            <button className="btn btn-ghost">Cancelar</button>
            <button className="btn btn-ghost"><Icon name="filter" size={13}/>Filtros</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 110, fontSize: 11, color: "var(--text-muted)" }}>Success</span>
            <button className="btn btn-success"><Icon name="check" size={13}/>Aprovar</button>
            <button className="btn btn-danger"><Icon name="alert" size={13}/>Rejeitar</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 110, fontSize: 11, color: "var(--text-muted)" }}>Icon-only</span>
            <button className="btn-icon"><Icon name="edit" size={14}/></button>
            <button className="btn-icon"><Icon name="history" size={14}/></button>
            <button className="btn-icon"><Icon name="moreH" size={14}/></button>
          </div>
        </div>
      </TokenSection>

      <TokenSection title="Campos de formulário">
        <div className="panel panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label className="field-label">E-mail institucional</label>
            <input className="input" placeholder="nome@saude.americana.sp.gov.br" defaultValue="gestor@saude.americana.sp.gov.br"/>
            <div className="field-hint">Domínio autorizado: @saude.americana.sp.gov.br</div>
          </div>
          <div>
            <label className="field-label field-required">Valor realizado</label>
            <input className="input mono" placeholder="0,00" defaultValue="82.4"/>
          </div>
          <div>
            <label className="field-label">Busca</label>
            <div className="search-input-wrap" style={{ width: "100%" }}>
              <Icon name="search" size={14}/>
              <input className="input" placeholder="Buscar indicador..." style={{ width: "100%" }}/>
            </div>
          </div>
          <div>
            <label className="field-label">Grupo</label>
            <select className="select" defaultValue="aps">
              <option value="all">Todos os grupos</option>
              <option value="aps">Atenção Primária</option>
              <option value="ame">Atenção Especializada</option>
              <option value="urg">Urgência</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label field-required">Descrição de desvios</label>
            <textarea className="textarea" rows="2" placeholder="Justificativa obrigatória quando cumprimento < 80%..."/>
          </div>
        </div>
      </TokenSection>

      <TokenSection title="Badges & status">
        <div className="panel panel-body" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span className="badge badge-ok"><span className="badge-dot" style={{background: "currentColor"}}/>Cumprido</span>
          <span className="badge badge-warn"><span className="badge-dot" style={{background: "currentColor"}}/>Parcial</span>
          <span className="badge badge-bad"><span className="badge-dot" style={{background: "currentColor"}}/>Não cumprido</span>
          <span className="badge badge-neutral">Pendente</span>
          <span className="badge badge-accent">Em revisão</span>
          <span className="badge badge-ok">+4.2 pp</span>
          <span className="badge badge-neutral mono">v2.3</span>
        </div>
      </TokenSection>

      <TokenSection title="Tab filters — cor semântica por estado">
        <div className="panel panel-body" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Icon name="filter" size={14} className="muted"/>
          <button className="tab-filter active all">Todos <span className="mono">16</span></button>
          <button className="tab-filter active ok">Cumpridos <span className="mono">10</span></button>
          <button className="tab-filter active warn">Parciais <span className="mono">4</span></button>
          <button className="tab-filter active bad">Não cumpridos <span className="mono">2</span></button>
          <span style={{ marginLeft: 16, fontSize: 11, color: "var(--text-muted)" }}>
            ⌫ cada filtro ativo carrega a cor do estado correspondente
          </span>
        </div>
      </TokenSection>

      <TokenSection title="Padrões de feedback">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="toast success">
            <Icon name="checkCircle" size={16} style={{ color: "var(--status-ok)" }}/>
            <div>
              <div style={{ fontWeight: 500 }}>Indicador salvo</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>APS.01 · Competência 03/2026</div>
            </div>
          </div>
          <div className="toast warn">
            <Icon name="alert" size={16} style={{ color: "var(--status-warn)" }}/>
            <div>
              <div style={{ fontWeight: 500 }}>Descrição de desvios pendente</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Obrigatória para indicadores parciais</div>
            </div>
          </div>
          <div className="toast error">
            <Icon name="alert" size={16} style={{ color: "var(--status-bad)" }}/>
            <div>
              <div style={{ fontWeight: 500 }}>Falha ao conectar com SIASUS</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Tente novamente em alguns instantes</div>
            </div>
          </div>
          <div className="info-box">
            <div className="info-box-row"><span className="info-box-label">Meta mensal</span><span className="info-box-value">85%</span></div>
            <div className="info-box-row"><span className="info-box-label">Unidade</span><span className="info-box-value">percentual</span></div>
            <div className="info-box-row"><span className="info-box-label">Peso no desconto</span><span className="info-box-value">0.08</span></div>
          </div>
        </div>
      </TokenSection>

      <TokenSection title="Regras de densidade">
        <div className="panel panel-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Tabela institucional</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)" }}>
                <li>Altura de linha: <span className="code-inline">38px</span> (padding 10px vertical)</li>
                <li>Números e códigos sempre em <span className="code-inline">Plex Mono</span></li>
                <li>Tabular-nums obrigatório em colunas numéricas</li>
                <li>Agrupamento por eixo assistencial via linha-cabeçalho</li>
                <li>Sticky header ao rolar verticalmente</li>
              </ul>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Hierarquia de leitura</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)" }}>
                <li>Código e nome convivem — código secundário (mono-muted)</li>
                <li>Valor realizado recebe peso 500 (acima da meta em muted)</li>
                <li>Progress bar usa cor semântica, não apenas preenchimento</li>
                <li>Sparkline antecipa tendência antes do badge</li>
                <li>Ações inline seguem ordem: ler · editar · mais</li>
              </ul>
            </div>
          </div>
        </div>
      </TokenSection>
    </div>
  );
};

window.DsDoc = DsDoc;
