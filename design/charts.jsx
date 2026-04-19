/* global React, Icon, Sparkline, StatusBadge, Progress, statusOf, statusLabel, INDICATORS, ALL_INDICATORS */
const { useState, useMemo, useEffect } = React;

// ============================================================
// KPI STRIP
// ============================================================
const KpiStrip = () => {
  const kpis = [
    { label: "Indicadores no ciclo", value: "16", delta: null, kind: "accent", hint: "Competência 03/2026" },
    { label: "Taxa de cumprimento", value: "62.5%", delta: "+4.2 pp", trend: "up", kind: "ok", hint: "10 de 16 cumpridos" },
    { label: "Repasse contratualizado", value: "R$ 14.82M", delta: "+1.8%", trend: "up", kind: "accent", hint: "Mensal" },
    { label: "Desconto projetado", value: "R$ 428.1k", delta: "−12.4%", trend: "down", kind: "warn", hint: "Por descumprimento" },
    { label: "Aprovações pendentes", value: "4", delta: null, kind: "bad", hint: "Aguardando CMS" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
      {kpis.map((k, i) => (
        <div key={i} className="kpi">
          <div className={`kpi-accent-bar ${k.kind}`}/>
          <div className="kpi-label">
            {k.label}
          </div>
          <div className="kpi-value tabular">{k.value}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{k.hint}</span>
            {k.delta && (
              <span className={`kpi-delta ${k.trend || "flat"}`}>
                <Icon name={k.trend === "up" ? "arrowUp" : k.trend === "down" ? "arrowDown" : "arrowRight"} size={10}/>
                {k.delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// CHART — line w/ target band
// ============================================================
const LineChart = ({ data, goal, height = 180, color = "var(--accent)" }) => {
  const width = 560, pad = { t: 12, r: 12, b: 22, l: 32 };
  const max = Math.max(goal * 1.15, ...data);
  const min = Math.min(goal * 0.5, ...data, 0);
  const range = max - min || 1;
  const labels = ["set","out","nov","dez","jan","fev","mar"];
  const x = (i) => pad.l + (i / (data.length - 1)) * (width - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / range) * (height - pad.t - pad.b);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(data.length-1).toFixed(1)},${height-pad.b} L${x(0).toFixed(1)},${height-pad.b} Z`;
  const gy = (frac) => pad.t + frac * (height - pad.t - pad.b);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <g className="chart-grid">
        {[0,0.25,0.5,0.75,1].map(f => (
          <line key={f} x1={pad.l} x2={width-pad.r} y1={gy(f)} y2={gy(f)}/>
        ))}
      </g>
      <g className="chart-axis">
        {[0,0.25,0.5,0.75,1].map(f => (
          <text key={f} x={pad.l-6} y={gy(f)+3} textAnchor="end">{(max - f * range).toFixed(0)}</text>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={height-6} textAnchor="middle">{l}</text>
        ))}
      </g>
      {/* target line */}
      <line x1={pad.l} x2={width-pad.r} y1={y(goal)} y2={y(goal)}
            stroke="var(--status-ok)" strokeDasharray="4 3" strokeWidth="1"/>
      <text x={width-pad.r} y={y(goal)-4} textAnchor="end"
            fontFamily="var(--font-mono)" fontSize="10" fill="var(--status-ok)">meta {goal}</text>

      <path d={area} fill={color} opacity="0.08"/>
      <path d={path} stroke={color} strokeWidth="1.5" fill="none"/>
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="var(--bg-surface)" stroke={color} strokeWidth="1.5"/>
      ))}
    </svg>
  );
};

// ============================================================
// BAR CHART
// ============================================================
const BarChart = ({ data, height = 180 }) => {
  const width = 560, pad = { t: 12, r: 12, b: 22, l: 32 };
  const max = Math.max(...data.map(d => d.value));
  const bw = (width - pad.l - pad.r) / data.length * 0.7;
  const step = (width - pad.l - pad.r) / data.length;
  const y = (v) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <g className="chart-grid">
        {[0,0.25,0.5,0.75,1].map(f => (
          <line key={f} x1={pad.l} x2={width-pad.r} y1={pad.t + f * (height-pad.t-pad.b)} y2={pad.t + f * (height-pad.t-pad.b)}/>
        ))}
      </g>
      {data.map((d, i) => {
        const cx = pad.l + step * i + step/2;
        return (
          <g key={i}>
            <rect x={cx - bw/2} y={y(d.value)} width={bw} height={height - pad.b - y(d.value)}
                  fill="var(--accent)" opacity={d.highlight ? 1 : 0.6} rx="1"/>
            <text x={cx} y={height-6} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize="10" fill="var(--text-muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ============================================================
// DONUT
// ============================================================
const Donut = ({ segments, size = 140 }) => {
  const r = 54, c = Math.PI * 2 * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="14"/>
      {segments.map((s, i) => {
        const len = (s.value/total) * c;
        const el = (
          <circle key={i} cx="70" cy="70" r={r} fill="none"
                  stroke={s.color} strokeWidth="14"
                  strokeDasharray={`${len} ${c-len}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 70 70)"
                  strokeLinecap="butt"/>
        );
        offset += len;
        return el;
      })}
      <text x="70" y="66" textAnchor="middle" fontSize="20" fontWeight="500"
            fill="var(--text-primary)" fontFamily="var(--font-sans)">
        {Math.round(segments[0].value / total * 100)}%
      </text>
      <text x="70" y="82" textAnchor="middle" fontSize="10"
            fill="var(--text-muted)" fontFamily="var(--font-mono)"
            letterSpacing=".06em">CUMPRIDO</text>
    </svg>
  );
};

Object.assign(window, { KpiStrip, LineChart, BarChart, Donut });
