import { useState, useMemo, useContext } from "react";
import { useStore } from "../data/store.jsx";
import { CATEGORY_TARGETS, ACCOUNT_TOTALS, BREAKPOINT_TOLERANCE } from "../data/targets.js";

// Inline formatters — avoids any mismatch with formatters.js exports
const fmtINR = (v) => {
  if (v == null || isNaN(v)) return "₹—";
  const n = Number(v);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

function ragClass(actual, target, higherIsBetter = true) {
  if (!actual || !target) return "rag-none";
  const ratio = actual / target;
  if (higherIsBetter) {
    if (ratio >= 0.9) return "rag-green";
    if (ratio >= 0.75) return "rag-amber";
    return "rag-red";
  } else {
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
  if (!actual || !target) return { status: "no-data", label: "No data" };
  const revRatio = (actual.ga4Revenue || 0) / target.ga4Revenue;
  if (revRatio >= 0.9) return { status: "on-track", label: "On track" };
  const checks = [
    { key: "cpc", label: "CPC", higherBetter: false },
    { key: "cplpv", label: "CPLPV", higherBetter: false },
    { key: "sessions", label: "Sessions", higherBetter: true },
    { key: "crPct", label: "CR%", higherBetter: true },
  ];
  for (const c of checks) {
    if (!actual[c.key] || !target[c.key]) continue;
    const ratio = actual[c.key] / target[c.key];
    const broken = c.higherBetter ? ratio < 0.8 : ratio > 1.2;
    if (broken) return { status: "breaking", label: `${c.label} breaking` };
  }
  return { status: "underspend", label: "Check spend" };
}

function computeActuals(metaRows, ga4Rows) {
  const totalSpend = metaRows.reduce((s, r) => s + (r.spend || 0), 0);
  const totalRev = ga4Rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalOrders = ga4Rows.reduce((s, r) => s + (r.transactions || 0), 0);
  const totalSessions = ga4Rows.reduce((s, r) => s + (r.sessions || 0), 0);
  const totalClicks = metaRows.reduce((s, r) => s + (r.clicks || 0), 0);

  const catMap = {};
  CATEGORY_TARGETS.forEach(cat => {
    const spendMix = cat.spendMixPct / 100;
    const revMix = cat.revenueMixPct / 100;
    const catSpend = totalSpend * spendMix;
    const catRev = totalRev * revMix;
    const catClicks = totalClicks * spendMix;
    const catSessions = totalSessions * spendMix;
    const catOrders = totalOrders * revMix;
    catMap[cat.id] = {
      ga4Revenue: catRev,
      spends: catSpend,
      sessions: catSessions,
      clicks: catClicks,
      orders: catOrders,
      cpc: catClicks > 0 ? catSpend / catClicks : 0,
      cplpv: catClicks > 0 ? catSpend / catClicks : 0,
      ga4Roas: catSpend > 0 ? catRev / catSpend : 0,
      crPct: catSessions > 0 ? (catOrders / catSessions) * 100 : 0,
    };
  });
  return { catMap, totalSpend, totalRev, totalSessions, totalClicks };
}

function PaceBar({ pct, rag }) {
  return (
    <div className="pt-bar-wrap">
      <div className={`pt-bar-fill ${rag}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function AccountSummary({ catMap, totalClicks, totalRev }) {
  const totalActualRev = Object.values(catMap).reduce((s, a) => s + (a?.ga4Revenue || 0), 0);
  const totalActualSpend = Object.values(catMap).reduce((s, a) => s + (a?.spends || 0), 0);
  const totalActualSessions = Object.values(catMap).reduce((s, a) => s + (a?.sessions || 0), 0);
  const revPace = pacePct(totalActualRev, ACCOUNT_TOTALS.ga4Revenue);
  const spendPace = pacePct(totalActualSpend, ACCOUNT_TOTALS.spends);
  const blendedRoas = totalActualSpend > 0 ? totalActualRev / totalActualSpend : 0;
  const avgCpc = totalClicks > 0 ? totalActualSpend / totalClicks : 0;

  const cards = [
    { label: "Meta GA4 Revenue", value: fmtINR(totalActualRev), sub: `vs ${fmtINR(ACCOUNT_TOTALS.ga4Revenue)}/day`, pace: revPace, rag: ragClass(totalActualRev, ACCOUNT_TOTALS.ga4Revenue) },
    { label: "Total Spend", value: fmtINR(totalActualSpend), sub: `vs ${fmtINR(ACCOUNT_TOTALS.spends)}/day`, pace: spendPace, rag: ragClass(totalActualSpend, ACCOUNT_TOTALS.spends) },
    { label: "Blended ROAS", value: `${blendedRoas.toFixed(2)}x`, sub: `target ${ACCOUNT_TOTALS.ga4Roas.toFixed(2)}x`, pace: null },
    { label: "Avg CPC", value: avgCpc > 0 ? `₹${avgCpc.toFixed(0)}` : "—", sub: `target ₹${ACCOUNT_TOTALS.cpc}`, pace: null },
    { label: "Sessions", value: totalActualSessions > 0 ? totalActualSessions.toLocaleString("en-IN") : "—", sub: `target ${ACCOUNT_TOTALS.sessions.toLocaleString("en-IN")}/day`, pace: null },
  ];

  return (
    <div className="pt-summary-row">
      {cards.map((c, i) => (
        <div key={i} className="pt-card">
          <div className="pt-card-label">{c.label}</div>
          <div className="pt-card-value">{c.value}</div>
          {c.pace != null && (
            <div className="pt-pace-row">
              <PaceBar pct={c.pace} rag={c.rag} />
              <span className="pt-pace-pct">{c.pace}%</span>
            </div>
          )}
          <div className="pt-card-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function InsightBlock({ catMap }) {
  const insights = [];
  CATEGORY_TARGETS.forEach(cat => {
    const actual = catMap[cat.id];
    if (!actual) return;
    const revRatio = cat.ga4Revenue > 0 ? (actual.ga4Revenue || 0) / cat.ga4Revenue : 0;
    const cpcRatio = cat.cpc > 0 ? (actual.cpc || 0) / cat.cpc : 0;
    const crRatio = cat.crPct > 0 ? (actual.crPct || 0) / (cat.crPct || 1) : 0;

    if (revRatio < 0.75 && actual.ga4Revenue > 0) {
      if (cpcRatio > 1.2) {
        insights.push({ type: "red", text: `${cat.name}: CPC at ₹${(actual.cpc||0).toFixed(0)} vs ₹${cat.cpc} target — reduce bids or pause weak adsets.` });
      } else if (crRatio < 0.8 && actual.crPct > 0) {
        insights.push({ type: "amber", text: `${cat.name}: CR% below target — check landing page or creative relevance.` });
      } else {
        insights.push({ type: "amber", text: `${cat.name}: Revenue at ${Math.round(revRatio*100)}% of daily target — review session volume and spend.` });
      }
    } else if (revRatio > 1.1 && actual.ga4Revenue > 0) {
      insights.push({ type: "green", text: `${cat.name}: Ahead at ${Math.round(revRatio*100)}% of target — consider increasing spend.` });
    }
  });

  if (insights.length === 0) {
    insights.push({ type: "blue", text: "Upload today's Meta daily CSV and GA4 CSV on the Upload page to generate live insights." });
  }

  return (
    <div className="pt-insight-block">
      <div className="pt-insight-header">Auto-generated insights</div>
      {insights.slice(0, 5).map((ins, i) => (
        <div key={i} className="pt-insight-row">
          <span className={`pt-insight-dot dot-${ins.type}`} />
          <span>{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

function ProductRow({ product }) {
  return (
    <tr className="pt-product-row">
      <td className="pt-product-name-cell">
        <span className="pt-product-name">{product.name}</span>
        {product.alias && <span className="pt-product-alias">{product.alias}</span>}
      </td>
      <td className="pt-metric-cell"><span className="pt-badge pt-rag-none">{fmtINR(product.ga4Revenue)}<span className="pt-target-sub">/day</span></span></td>
      <td className="pt-metric-cell"><span className="pt-badge pt-rag-none">{fmtINR(product.spends)}<span className="pt-target-sub">/day</span></span></td>
      <td className="pt-metric-cell"><span className="pt-badge pt-rag-none">{product.ga4Roas?.toFixed(2)}x</span></td>
      <td className="pt-metric-cell"><span className="pt-badge pt-rag-none">₹{product.cpc}</span></td>
      <td className="pt-metric-cell"><span className="pt-badge pt-rag-none">{product.sessions?.toLocaleString("en-IN")}</span></td>
      <td></td>
    </tr>
  );
}

function CategoryRow({ cat, actual, expanded, onToggle }) {
  const bp = getBreakpoint(actual, cat);
  const revPace = pacePct(actual?.ga4Revenue, cat.ga4Revenue);
  const spendPace = pacePct(actual?.spends, cat.spends);
  const revRag = ragClass(actual?.ga4Revenue, cat.ga4Revenue, true);
  const spendRag = ragClass(actual?.spends, cat.spends, true);
  const roasRag = ragClass(actual?.ga4Roas, cat.ga4Roas, true);
  const cpcRag = ragClass(actual?.cpc, cat.cpc, false);
  const sessRag = ragClass(actual?.sessions, cat.sessions, true);

  return (
    <>
      <tr className={`pt-cat-row${expanded ? " pt-cat-expanded" : ""}`} onClick={() => onToggle(cat.id)}>
        <td className="pt-cat-name-cell">
          <span className={`pt-expand${expanded ? " open" : ""}`}>›</span>
          <div>
            <span className="pt-cat-name">{cat.name}</span>
            <span className="pt-cat-mix">{cat.spendMixPct}% mix</span>
          </div>
        </td>

        <td className="pt-metric-cell">
          <span className={`pt-badge ${revRag}`}>{fmtINR(actual?.ga4Revenue ?? 0)}</span>
          <div className="pt-pace-row">
            <PaceBar pct={revPace} rag={revRag} />
            <span className="pt-pace-pct">{revPace}%</span>
          </div>
          <span className="pt-target-sub">{fmtINR(cat.ga4Revenue)}/day</span>
        </td>

        <td className="pt-metric-cell">
          <span className={`pt-badge ${spendRag}`}>{fmtINR(actual?.spends ?? 0)}</span>
          <div className="pt-pace-row">
            <PaceBar pct={spendPace} rag={spendRag} />
            <span className="pt-pace-pct">{spendPace}%</span>
          </div>
          <span className="pt-target-sub">{fmtINR(cat.spends)}/day</span>
        </td>

        <td className="pt-metric-cell">
          <span className={`pt-badge ${roasRag}`}>{(actual?.ga4Roas ?? 0).toFixed(2)}x</span>
          <span className="pt-target-sub">{cat.ga4Roas}x</span>
        </td>

        <td className="pt-metric-cell">
          <span className={`pt-badge ${cpcRag}`}>₹{(actual?.cpc ?? 0).toFixed(0)}</span>
          <span className="pt-target-sub">₹{cat.cpc}</span>
        </td>

        <td className="pt-metric-cell">
          <span className={`pt-badge ${sessRag}`}>{(actual?.sessions ?? 0).toLocaleString("en-IN")}</span>
          <span className="pt-target-sub">{cat.sessions.toLocaleString("en-IN")}</span>
        </td>

        <td className="pt-bp-cell">
          <span className={`pt-bp bp-${bp.status}`}>{bp.label}</span>
        </td>
      </tr>
      {expanded && cat.products.map(p => <ProductRow key={p.alias} product={p} />)}
    </>
  );
}

export default function PacingTracker() {
  const store = useStore();
  const metaData = store?.metaData ?? store?.meta ?? null;
  const ga4Data = store?.ga4Data ?? store?.ga4 ?? null;

  const [expanded, setExpanded] = useState({});
  const toggleCat = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const metaRows = useMemo(() => metaData?.rows || [], [metaData]);
  const ga4Rows = useMemo(() => ga4Data?.rows || [], [ga4Data]);
  const hasData = metaRows.length > 0 || ga4Rows.length > 0;

  const { catMap, totalClicks, totalRev } = useMemo(
    () => computeActuals(metaRows, ga4Rows),
    [metaRows, ga4Rows]
  );

  return (
    <div className="pt-page">
      <style>{`
        .pt-page{padding:24px;max-width:100%}
        .pt-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px}
        .pt-title{font-size:20px;font-weight:500;color:var(--color-text-primary)}
        .pt-subtitle{font-size:12px;color:var(--color-text-secondary);margin-top:3px}
        .pt-warning{background:var(--color-background-warning);border:0.5px solid var(--color-border-tertiary);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--color-text-warning);margin-bottom:16px}
        .pt-legend{display:flex;gap:12px;font-size:11px;color:var(--color-text-tertiary);align-items:center}
        .pt-leg-dot{width:8px;height:8px;border-radius:2px;display:inline-block;margin-right:3px;vertical-align:middle}

        /* summary */
        .pt-summary-row{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
        .pt-card{flex:1;min-width:140px;background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:10px;padding:12px 14px}
        .pt-card-label{font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
        .pt-card-value{font-size:18px;font-weight:500;color:var(--color-text-primary);margin-bottom:4px}
        .pt-card-sub{font-size:10px;color:var(--color-text-tertiary);margin-top:4px}
        .pt-pace-row{display:flex;align-items:center;gap:4px;margin:3px 0}
        .pt-pace-pct{font-size:10px;color:var(--color-text-tertiary);min-width:26px}
        .pt-bar-wrap{flex:1;height:4px;background:var(--color-background-secondary);border-radius:2px;overflow:hidden;min-width:30px}
        .pt-bar-fill{height:100%;border-radius:2px;transition:width .4s ease}
        .pt-bar-fill.rag-green{background:#3B8BD4}
        .pt-bar-fill.rag-amber{background:#EF9F27}
        .pt-bar-fill.rag-red{background:#E24B4A}
        .pt-bar-fill.rag-none{background:var(--color-border-secondary)}

        /* insights */
        .pt-insight-block{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:10px;padding:14px 16px;margin-bottom:16px}
        .pt-insight-header{font-size:10px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
        .pt-insight-row{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--color-text-primary);margin-bottom:7px;line-height:1.5}
        .pt-insight-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:4px}
        .dot-red{background:#E24B4A}.dot-amber{background:#EF9F27}.dot-green,.dot-blue{background:#3B8BD4}

        /* table */
        .pt-table-wrap{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:10px;overflow:hidden;margin-bottom:16px}
        .pt-table-header{padding:10px 14px;border-bottom:0.5px solid var(--color-border-tertiary);font-size:10px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.05em}
        .pt-table{width:100%;border-collapse:collapse}
        .pt-table th{font-size:10px;color:var(--color-text-tertiary);font-weight:400;padding:8px 10px;text-align:left;border-bottom:0.5px solid var(--color-border-tertiary);white-space:nowrap}
        .pt-table th:not(:first-child){text-align:center}

        /* rows */
        .pt-cat-row{cursor:pointer;border-bottom:0.5px solid var(--color-border-tertiary);transition:background .12s}
        .pt-cat-row:hover{background:var(--color-background-secondary)}
        .pt-cat-expanded{background:var(--color-background-secondary)}
        .pt-cat-name-cell{padding:10px 10px;display:flex;align-items:center;gap:6px;min-width:150px}
        .pt-expand{font-size:15px;color:var(--color-text-tertiary);transition:transform .18s;display:inline-block;line-height:1}
        .pt-expand.open{transform:rotate(90deg)}
        .pt-cat-name{font-size:12px;font-weight:500;color:var(--color-text-primary);display:block}
        .pt-cat-mix{font-size:10px;color:var(--color-text-tertiary)}
        .pt-product-row{border-bottom:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary)}
        .pt-product-name-cell{padding:7px 10px 7px 32px}
        .pt-product-name{font-size:11px;font-weight:500;color:var(--color-text-primary);display:block}
        .pt-product-alias{font-size:10px;color:var(--color-text-tertiary)}

        /* metric cells */
        .pt-metric-cell{padding:8px 10px;text-align:center;vertical-align:top}
        .pt-target-sub{font-size:10px;color:var(--color-text-tertiary);display:block;margin-top:2px}
        .pt-badge{display:inline-block;font-size:11px;font-weight:500;padding:2px 6px;border-radius:4px}
        .rag-green{background:#EAF3DE;color:#3B6D11}
        .rag-amber{background:#FAEEDA;color:#854F0B}
        .rag-red{background:#FCEBEB;color:#A32D2D}
        .pt-rag-none,.rag-none{background:var(--color-background-secondary);color:var(--color-text-secondary)}

        /* breakpoint */
        .pt-bp-cell{padding:8px 10px;text-align:right;vertical-align:top}
        .pt-bp{font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px}
        .bp-on-track{background:#EAF3DE;color:#3B6D11}
        .bp-breaking{background:#FCEBEB;color:#A32D2D}
        .bp-underspend,.bp-no-data{background:#FAEEDA;color:#854F0B}
      `}</style>

      <div className="pt-header">
        <div>
          <div className="pt-title">Pacing Tracker</div>
          <div className="pt-subtitle">Meta GA4 tracked revenue · daily targets · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
        </div>
        <div className="pt-legend">
          <span><span className="pt-leg-dot" style={{background:"#3B8BD4"}}/>On target</span>
          <span><span className="pt-leg-dot" style={{background:"#EF9F27"}}/>Within 25%</span>
          <span><span className="pt-leg-dot" style={{background:"#E24B4A"}}/>Below 75%</span>
        </div>
      </div>

      {!hasData && (
        <div className="pt-warning">
          No data uploaded yet — targets shown below. Upload today's Meta daily CSV + GA4 CSV on the Upload page to see actuals vs targets.
        </div>
      )}

      <AccountSummary catMap={catMap} totalClicks={totalClicks} totalRev={totalRev} />
      <InsightBlock catMap={catMap} />

      <div className="pt-table-wrap">
        <div className="pt-table-header">Category breakpoint heatmap — click any row to expand products</div>
        <table className="pt-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>GA4 Revenue</th>
              <th>Spend</th>
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
                expanded={!!expanded[cat.id]}
                onToggle={toggleCat}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
