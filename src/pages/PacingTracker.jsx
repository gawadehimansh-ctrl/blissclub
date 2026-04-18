import { useState, useMemo } from "react";
import { useStore } from "../data/store.jsx";
import { CATEGORY_TARGETS, ACCOUNT_TOTALS, BREAKPOINT_TOLERANCE } from "../data/targets.js";
import { fmtINR, fmtPct } from "../utils/formatters.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function ragClass(actual, target, higherIsBetter = true) {
  if (!actual || !target) return "rag-none";
  const ratio = actual / target;
  if (higherIsBetter) {
    if (ratio >= 0.9) return "rag-green";
    if (ratio >= 0.75) return "rag-amber";
    return "rag-red";
  } else {
    // lower is better (CPC, CPS)
    if (ratio <= 1.1) return "rag-green";
    if (ratio <= 1.25) return "rag-amber";
    return "rag-red";
  }
}

function pacePct(actual, target) {
  if (!target) return 0;
  return Math.round((actual / target) * 100);
}

function getBreakpoint(actual, target) {
  if (!actual || !target) return null;
  const checks = [
    { key: "cpc", label: "CPC", higherBetter: false },
    { key: "cplpv", label: "CPLPV", higherBetter: false },
    { key: "sessions", label: "Sessions", higherBetter: true },
    { key: "crPct", label: "CR%", higherBetter: true },
  ];
  const revRatio = actual.ga4Revenue / target.ga4Revenue;
  if (revRatio >= 0.9) return { status: "on-track", label: "On track" };

  for (const c of checks) {
    if (!actual[c.key] || !target[c.key]) continue;
    const ratio = actual[c.key] / target[c.key];
    const broken = c.higherBetter ? ratio < (1 - BREAKPOINT_TOLERANCE) : ratio > (1 + BREAKPOINT_TOLERANCE);
    if (broken) return { status: "breaking", label: `${c.label} breaking` };
  }
  return { status: "underspend", label: "Check spend" };
}

function computeActualsByCategory(metaRows, ga4Rows) {
  // aggregate meta rows by product tag → map to category
  const catMap = {};
  CATEGORY_TARGETS.forEach(c => { catMap[c.id] = { ga4Revenue: 0, spends: 0, sessions: 0, clicks: 0, orders: 0 }; });

  // simple approach: distribute all meta revenue across categories by spend mix
  const totalSpend = metaRows.reduce((s, r) => s + (r.spend || 0), 0);
  const totalRev = ga4Rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalOrders = ga4Rows.reduce((s, r) => s + (r.transactions || 0), 0);
  const totalSessions = ga4Rows.reduce((s, r) => s + (r.sessions || 0), 0);
  const totalClicks = metaRows.reduce((s, r) => s + (r.clicks || 0), 0);

  CATEGORY_TARGETS.forEach(cat => {
    const mix = cat.spendMixPct / 100;
    catMap[cat.id] = {
      ga4Revenue: totalRev * (cat.revenueMixPct / 100),
      spends: totalSpend * mix,
      sessions: totalSessions * mix,
      clicks: totalClicks * mix,
      orders: totalOrders * mix,
    };
    catMap[cat.id].cpc = catMap[cat.id].clicks > 0 ? catMap[cat.id].spends / catMap[cat.id].clicks : 0;
    catMap[cat.id].ga4Roas = catMap[cat.id].spends > 0 ? catMap[cat.id].ga4Revenue / catMap[cat.id].spends : 0;
    catMap[cat.id].crPct = catMap[cat.id].sessions > 0 ? (catMap[cat.id].orders / catMap[cat.id].sessions) * 100 : 0;
    catMap[cat.id].cplpv = catMap[cat.id].clicks > 0 ? catMap[cat.id].spends / catMap[cat.id].clicks : 0;
  });

  return { catMap, totalSpend, totalRev, totalOrders, totalSessions, totalClicks };
}

// ─── sub-components ─────────────────────────────────────────────────────────

function RagBadge({ value, label, rag }) {
  return (
    <span className={`rag-badge ${rag}`}>
      {label || value}
    </span>
  );
}

function MetricCell({ actual, target, fmt, higherBetter = true, showTarget = true }) {
  const rag = actual != null && target != null ? ragClass(actual, target, higherBetter) : "rag-none";
  return (
    <td className="metric-cell">
      <span className={`rag-badge ${rag}`}>{fmt(actual ?? 0)}</span>
      {showTarget && <span className="target-sub">{fmt(target)}</span>}
    </td>
  );
}

function PaceBar({ pct, rag }) {
  return (
    <div className="pace-bar-wrap">
      <div className={`pace-bar-fill ${rag}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function ProductRow({ product, categoryTarget }) {
  // proportional actuals based on product spend mix within category
  return (
    <tr className="product-row">
      <td className="product-name-cell">
        <span className="product-name">{product.name}</span>
        <span className="product-alias">{product.alias}</span>
      </td>
      <td className="metric-cell">
        <span className="rag-badge rag-none">{fmtINR(product.ga4Revenue)}</span>
        <span className="target-sub">target/day</span>
      </td>
      <td className="metric-cell">
        <span className="rag-badge rag-none">{fmtINR(product.spends)}</span>
        <span className="target-sub">target/day</span>
      </td>
      <td className="metric-cell">
        <span className="rag-badge rag-none">{product.ga4Roas?.toFixed(2)}x</span>
      </td>
      <td className="metric-cell">
        <span className="rag-badge rag-none">₹{product.cpc}</span>
      </td>
      <td className="metric-cell">
        <span className="rag-badge rag-none">₹{product.cps}</span>
      </td>
      <td className="metric-cell">
        <span className="rag-badge rag-none">{product.sessions?.toLocaleString("en-IN")}</span>
      </td>
      <td></td>
    </tr>
  );
}

function CategoryRow({ cat, actual, onToggle, expanded }) {
  const bp = getBreakpoint(actual, cat);
  const revPace = pacePct(actual?.ga4Revenue, cat.ga4Revenue);
  const spendPace = pacePct(actual?.spends, cat.spends);
  const revRag = ragClass(actual?.ga4Revenue, cat.ga4Revenue, true);
  const spendRag = ragClass(actual?.spends, cat.spends, true);
  const roasRag = ragClass(actual?.ga4Roas, cat.ga4Roas, true);
  const cpcRag = ragClass(actual?.cpc, cat.cpc, false);
  const sessionRag = ragClass(actual?.sessions, cat.sessions, true);

  return (
    <>
      <tr className={`cat-row ${expanded ? "cat-row-expanded" : ""}`} onClick={() => onToggle(cat.id)}>
        <td className="cat-name-cell">
          <span className={`expand-icon ${expanded ? "open" : ""}`}>›</span>
          <span className="cat-name">{cat.name}</span>
          <span className="cat-mix">{cat.spendMixPct}%</span>
        </td>

        {/* GA4 Revenue — actual ₹ + pace % */}
        <td className="metric-cell">
          <span className={`rag-badge ${revRag}`}>{fmtINR(actual?.ga4Revenue ?? 0)}</span>
          <div className="pace-row">
            <PaceBar pct={revPace} rag={revRag} />
            <span className="pace-pct">{revPace}%</span>
          </div>
          <span className="target-sub">{fmtINR(cat.ga4Revenue)}/day</span>
        </td>

        {/* Spends — actual ₹ + pace % */}
        <td className="metric-cell">
          <span className={`rag-badge ${spendRag}`}>{fmtINR(actual?.spends ?? 0)}</span>
          <div className="pace-row">
            <PaceBar pct={spendPace} rag={spendRag} />
            <span className="pace-pct">{spendPace}%</span>
          </div>
          <span className="target-sub">{fmtINR(cat.spends)}/day</span>
        </td>

        {/* GA4 ROAS */}
        <td className="metric-cell">
          <span className={`rag-badge ${roasRag}`}>{(actual?.ga4Roas ?? 0).toFixed(2)}x</span>
          <span className="target-sub">{cat.ga4Roas}x target</span>
        </td>

        {/* CPC */}
        <td className="metric-cell">
          <span className={`rag-badge ${cpcRag}`}>₹{(actual?.cpc ?? 0).toFixed(0)}</span>
          <span className="target-sub">₹{cat.cpc} target</span>
        </td>

        {/* Sessions */}
        <td className="metric-cell">
          <span className={`rag-badge ${sessionRag}`}>{(actual?.sessions ?? 0).toLocaleString("en-IN")}</span>
          <span className="target-sub">{cat.sessions.toLocaleString("en-IN")} target</span>
        </td>

        {/* Breakpoint */}
        <td className="breakpoint-cell">
          <span className={`bp-badge bp-${bp?.status}`}>{bp?.label}</span>
        </td>
      </tr>

      {/* Accordion product rows */}
      {expanded && cat.products.map(p => (
        <ProductRow key={p.alias} product={p} categoryTarget={cat} />
      ))}
    </>
  );
}

function InsightBlock({ actuals }) {
  const insights = [];
  CATEGORY_TARGETS.forEach(cat => {
    const actual = actuals[cat.id];
    if (!actual) return;
    const revRatio = (actual.ga4Revenue || 0) / cat.ga4Revenue;
    const cpcRatio = (actual.cpc || 0) / cat.cpc;

    if (revRatio < 0.75) {
      if (cpcRatio > 1.2) {
        insights.push({ type: "red", text: `${cat.name}: CPC at ₹${(actual.cpc||0).toFixed(0)} vs ₹${cat.cpc} target — reduce bids or pause weak adsets.` });
      } else if ((actual.crPct || 0) < cat.crPct * 0.8) {
        insights.push({ type: "amber", text: `${cat.name}: CR% below target — check landing page or creative relevance.` });
      } else {
        insights.push({ type: "amber", text: `${cat.name}: Revenue pacing at ${Math.round(revRatio*100)}% — review session volume and spend delivery.` });
      }
    } else if (revRatio > 1.1) {
      insights.push({ type: "green", text: `${cat.name}: Ahead of pace at ${Math.round(revRatio*100)}% — consider increasing spend to maximise remaining days.` });
    }
  });

  if (insights.length === 0) {
    insights.push({ type: "green", text: "Upload today's CSVs on the Upload page to generate live insights." });
  }

  return (
    <div className="insight-block">
      <div className="insight-header">Auto-generated insights</div>
      {insights.slice(0, 5).map((ins, i) => (
        <div key={i} className={`insight-row insight-${ins.type}`}>
          <span className={`insight-dot dot-${ins.type}`} />
          <span>{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

function AccountSummary({ actuals, totalMeta, totalGA4 }) {
  const totalActualRev = Object.values(actuals).reduce((s, a) => s + (a?.ga4Revenue || 0), 0);
  const totalActualSpend = Object.values(actuals).reduce((s, a) => s + (a?.spends || 0), 0);
  const revPace = pacePct(totalActualRev, ACCOUNT_TOTALS.ga4Revenue);
  const spendPace = pacePct(totalActualSpend, ACCOUNT_TOTALS.spends);
  const blendedRoas = totalActualSpend > 0 ? totalActualRev / totalActualSpend : 0;

  return (
    <div className="account-summary">
      <div className="summary-card">
        <div className="sc-label">Meta GA4 Revenue</div>
        <div className="sc-value">{fmtINR(totalActualRev)}</div>
        <div className="pace-row"><PaceBar pct={revPace} rag={ragClass(totalActualRev, ACCOUNT_TOTALS.ga4Revenue, true)} /><span className="pace-pct">{revPace}%</span></div>
        <div className="sc-sub">vs {fmtINR(ACCOUNT_TOTALS.ga4Revenue)}/day target</div>
      </div>
      <div className="summary-card">
        <div className="sc-label">Total Spend</div>
        <div className="sc-value">{fmtINR(totalActualSpend)}</div>
        <div className="pace-row"><PaceBar pct={spendPace} rag={ragClass(totalActualSpend, ACCOUNT_TOTALS.spends, true)} /><span className="pace-pct">{spendPace}%</span></div>
        <div className="sc-sub">vs {fmtINR(ACCOUNT_TOTALS.spends)}/day target</div>
      </div>
      <div className="summary-card">
        <div className="sc-label">Blended GA4 ROAS</div>
        <div className="sc-value">{blendedRoas.toFixed(2)}x</div>
        <div className="sc-sub">target {ACCOUNT_TOTALS.ga4Roas.toFixed(2)}x</div>
      </div>
      <div className="summary-card">
        <div className="sc-label">Avg CPC</div>
        <div className="sc-value">₹{totalMeta > 0 ? (totalActualSpend / totalMeta).toFixed(0) : "—"}</div>
        <div className="sc-sub">target ₹{ACCOUNT_TOTALS.cpc}</div>
      </div>
      <div className="summary-card">
        <div className="sc-label">Sessions</div>
        <div className="sc-value">{Object.values(actuals).reduce((s,a)=>s+(a?.sessions||0),0).toLocaleString("en-IN")}</div>
        <div className="sc-sub">target {ACCOUNT_TOTALS.sessions.toLocaleString("en-IN")}/day</div>
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function PacingTracker() {
  const { metaData, ga4Data } = useStore();
  const [expandedCats, setExpandedCats] = useState({});
  const [compareMode, setCompareMode] = useState(false);
  const [sidePanelCat, setSidePanelCat] = useState(null);

  const metaRows = metaData?.rows || [];
  const ga4Rows = ga4Data?.rows || [];

  const { catMap, totalSpend, totalRev, totalSessions, totalClicks } = useMemo(
    () => computeActualsByCategory(metaRows, ga4Rows),
    [metaRows, ga4Rows]
  );

  const hasData = metaRows.length > 0 || ga4Rows.length > 0;

  function toggleCat(id) {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="pacing-page">
      <style>{`
        .pacing-page { padding: 24px; font-family: 'DM Sans', sans-serif; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .page-title { font-size: 20px; font-weight: 500; color: var(--color-text-primary); }
        .page-subtitle { font-size: 13px; color: var(--color-text-secondary); margin-top: 2px; }
        .data-warning { background: var(--color-background-warning); border: 0.5px solid var(--color-border-tertiary); border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--color-text-warning); margin-bottom: 16px; }

        /* account summary */
        .account-summary { display: flex; gap: 10px; margin-bottom: 20px; }
        .summary-card { flex: 1; background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: 10px; padding: 12px 14px; }
        .sc-label { font-size: 11px; color: var(--color-text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
        .sc-value { font-size: 20px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 4px; }
        .sc-sub { font-size: 11px; color: var(--color-text-tertiary); margin-top: 4px; }

        /* heatmap table */
        .heatmap-wrap { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
        .heatmap-header { padding: 12px 16px; border-bottom: 0.5px solid var(--color-border-tertiary); font-size: 11px; font-weight: 500; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .heatmap-table { width: 100%; border-collapse: collapse; }
        .heatmap-table th { font-size: 11px; color: var(--color-text-tertiary); font-weight: 400; padding: 8px 12px; text-align: left; border-bottom: 0.5px solid var(--color-border-tertiary); }
        .heatmap-table th:not(:first-child) { text-align: center; }

        /* category rows */
        .cat-row { cursor: pointer; transition: background 0.15s; border-bottom: 0.5px solid var(--color-border-tertiary); }
        .cat-row:hover { background: var(--color-background-secondary); }
        .cat-row-expanded { background: var(--color-background-secondary); }
        .cat-name-cell { padding: 10px 12px; display: flex; align-items: center; gap: 8px; min-width: 160px; }
        .expand-icon { font-size: 16px; color: var(--color-text-tertiary); transition: transform 0.2s; display: inline-block; }
        .expand-icon.open { transform: rotate(90deg); }
        .cat-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
        .cat-mix { font-size: 11px; color: var(--color-text-tertiary); }

        /* product rows */
        .product-row { border-bottom: 0.5px solid var(--color-border-tertiary); background: var(--color-background-secondary); }
        .product-name-cell { padding: 8px 12px 8px 36px; }
        .product-name { font-size: 12px; font-weight: 500; color: var(--color-text-primary); display: block; }
        .product-alias { font-size: 11px; color: var(--color-text-tertiary); }

        /* metric cells */
        .metric-cell { padding: 8px 12px; text-align: center; vertical-align: top; }
        .pace-row { display: flex; align-items: center; gap: 4px; margin: 3px 0; }
        .pace-pct { font-size: 10px; color: var(--color-text-tertiary); min-width: 28px; }
        .target-sub { font-size: 10px; color: var(--color-text-tertiary); display: block; }

        /* pace bar */
        .pace-bar-wrap { flex: 1; height: 4px; background: var(--color-background-secondary); border-radius: 2px; overflow: hidden; min-width: 40px; }
        .pace-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
        .pace-bar-fill.rag-green { background: #3B8BD4; }
        .pace-bar-fill.rag-amber { background: #EF9F27; }
        .pace-bar-fill.rag-red { background: #E24B4A; }
        .pace-bar-fill.rag-none { background: var(--color-border-secondary); }

        /* rag badges */
        .rag-badge { display: inline-block; font-size: 12px; font-weight: 500; padding: 2px 7px; border-radius: 4px; }
        .rag-green { background: #EAF3DE; color: #3B6D11; }
        .rag-amber { background: #FAEEDA; color: #854F0B; }
        .rag-red { background: #FCEBEB; color: #A32D2D; }
        .rag-none { background: var(--color-background-secondary); color: var(--color-text-secondary); }

        /* breakpoint */
        .breakpoint-cell { padding: 8px 12px; text-align: right; vertical-align: top; }
        .bp-badge { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; }
        .bp-on-track { background: #EAF3DE; color: #3B6D11; }
        .bp-breaking { background: #FCEBEB; color: #A32D2D; }
        .bp-underspend { background: #FAEEDA; color: #854F0B; }

        /* insights */
        .insight-block { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
        .insight-header { font-size: 11px; font-weight: 500; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
        .insight-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--color-text-primary); margin-bottom: 8px; line-height: 1.5; }
        .insight-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .dot-red { background: #E24B4A; }
        .dot-amber { background: #EF9F27; }
        .dot-green { background: #3B8BD4; }

        /* no data state */
        .no-data { text-align: center; padding: 48px 24px; color: var(--color-text-secondary); }
        .no-data-title { font-size: 16px; font-weight: 500; margin-bottom: 8px; color: var(--color-text-primary); }
        .no-data-sub { font-size: 13px; line-height: 1.6; }

        /* legend */
        .legend { display: flex; gap: 16px; font-size: 11px; color: var(--color-text-tertiary); margin-bottom: 12px; align-items: center; }
        .legend-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; margin-right: 4px; }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-title">Pacing Tracker</div>
          <div className="page-subtitle">Meta GA4 tracked revenue only · daily targets · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
        </div>
        <div className="legend">
          <span><span className="legend-dot" style={{background:"#3B8BD4"}}/>On/above target</span>
          <span><span className="legend-dot" style={{background:"#EF9F27"}}/>Within 25% of target</span>
          <span><span className="legend-dot" style={{background:"#E24B4A"}}/>Below 75% of target</span>
        </div>
      </div>

      {!hasData && (
        <div className="data-warning">
          No data uploaded yet — showing targets only. Upload today's Meta daily CSV and GA4 CSV on the Upload page to see actuals vs targets.
        </div>
      )}

      <AccountSummary actuals={catMap} totalMeta={totalClicks} totalGA4={totalRev} />

      <InsightBlock actuals={catMap} />

      <div className="heatmap-wrap">
        <div className="heatmap-header">Category breakpoint heatmap — click any row to expand products</div>
        <table className="heatmap-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>GA4 Revenue<br/><span style={{fontWeight:400,fontSize:10}}>actual vs target/day</span></th>
              <th>Spend<br/><span style={{fontWeight:400,fontSize:10}}>actual vs target/day</span></th>
              <th>GA4 ROAS</th>
              <th>CPC</th>
              <th>Sessions</th>
              <th style={{textAlign:"right"}}>Breakpoint</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_TARGETS.map(cat => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                actual={catMap[cat.id]}
                onToggle={toggleCat}
                expanded={!!expandedCats[cat.id]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
