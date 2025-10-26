'use client';

import React, { useEffect } from 'react';

export default function GscDashboardReplica(): JSX.Element {
  // Lightweight client-side smoke tests so we know the DOM mounted correctly.
  useEffect(() => {
    try {
      const tests: Array<[string, boolean]> = [
        ['topbar exists', !!document.querySelector('.topbar')],
        ['has 6 kpis', document.querySelectorAll('.kpis .kpi').length === 6],
        ['chipbox pills count ≥ 5', document.querySelectorAll('.chipbox .pill').length >= 5],
      ];
      // eslint-disable-next-line no-console
      console.log('UI smoke tests', Object.fromEntries(tests.map(([n, ok]) => [n, ok])));
    } catch (e) {
      // Just in case something odd happens with the environment; never throw.
      // eslint-disable-next-line no-console
      console.warn('UI smoke tests skipped:', e);
    }
  }, []);

  return (
    <>
      {/* NOTE: Removed next/head + styled-jsx to avoid runtime errors in environments
          that don't ship those runtimes. Fonts are loaded via CSS @import below. */}

      <div className="wrap-page" data-testid="wrap-page">
        {/* Top Bar */}
        <div className="topbar" data-testid="topbar">
          <span className="dot" />
          <div className="brand">Mindraft</div>
          <div className="chipbox" data-testid="chipbox">
            <span className="pill"><strong>E‑commerce Store</strong></span>
            <span className="pill">ecommerce‑store.com</span>
            <span className="pill">Últimos 28 días</span>
            <span className="pill">Todos los países</span>
            <span className="pill">Todos los dispositivos</span>
            <span className="pill" style={{ minWidth: 240 }}>🔎 Search URLs, queries, widgets…</span>
          </div>
          <div className="right">
            <button className="btn">＋ Add Widget</button>
            <button className="btn secondary">💾 Save Layout</button>
          </div>
        </div>

        <div className="crumbs">
          Home › Projects › <a href="#">E‑commerce Store</a>
        </div>

        {/* KPI Row */}
        <section className="kpis">
          <div className="kpi">
            <h4>Total Clicks</h4>
            <div className="value">
              <b>24,847</b> <span className="delta up">▲ 12.3%</span>
            </div>
          </div>
          <div className="kpi">
            <h4>Impressions</h4>
            <div className="value">
              <b>1.2M</b> <span className="delta up">▲ 18.7%</span>
            </div>
          </div>
          <div className="kpi">
            <h4>Average CTR</h4>
            <div className="value">
              <b>2.1%</b> <span className="delta down">▼ 0.3%</span>
            </div>
          </div>
          <div className="kpi">
            <h4>Avg Position</h4>
            <div className="value">
              <b>28.4</b> <span className="delta up">▲ 2.1</span>
            </div>
          </div>
          <div className="kpi">
            <h4>No impressions</h4>
            <div className="value">
              <b>1,247</b> <span className="delta down">▼ 15.2%</span>
            </div>
          </div>
          <div className="kpi">
            <h4>Open issues</h4>
            <div className="value">
              <b>23</b> <span className="delta up" style={{ color: '#0f766e' }}>+3</span>
            </div>
          </div>
        </section>

        {/* Main grid: left content + right rail */}
        <section className="grid">
          <div>
            {/* GSC Performance Overview */}
            <article className="card">
              <div className="hd">
                <h3>GSC Performance Overview</h3>
                <div className="legend">
                  <span className="tag"><span className="dot-c c-clicks" /> Clicks</span>
                  <span className="tag"><span className="dot-c c-impr" /> Impressions</span>
                  <span className="tag"><span className="dot-c c-ctr" /> CTR</span>
                  <span className="tag"><span className="dot-c c-pos" /> Position</span>
                </div>
              </div>
              <div className="bd chart-area">
                {/* línea estilo captura */}
                <svg viewBox="0 0 730 240" width="100%" height="100%">
                  <defs>
                    <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#a0abdc" stopOpacity=".35" />
                      <stop offset="100%" stopColor="#a0abdc" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="730" height="240" fill="#fff" />
                  {/* grid lines */}
                  <g stroke="#eef1f5" strokeWidth="1">
                    <line x1="0" x2="730" y1="40" y2="40" />
                    <line x1="0" x2="730" y1="90" y2="90" />
                    <line x1="0" x2="730" y1="140" y2="140" />
                    <line x1="0" x2="730" y1="190" y2="190" />
                  </g>
                  {/* area + line */}
                  <path d="M20,170 L120,130 L220,150 L320,110 L420,85 L520,100 L620,80 L710,60 L710,220 L20,220 Z" fill="url(#g1)" />
                  <polyline
                    points="20,170 120,130 220,150 320,110 420,85 520,100 620,80 710,60"
                    fill="none"
                    stroke="#67a0de"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <g fill="#67a0de">
                    <circle cx="20" cy="170" r="3" />
                    <circle cx="120" cy="130" r="3" />
                    <circle cx="220" cy="150" r="3" />
                    <circle cx="320" cy="110" r="3" />
                    <circle cx="420" cy="85" r="3" />
                    <circle cx="520" cy="100" r="3" />
                    <circle cx="620" cy="80" r="3" />
                    <circle cx="710" cy="60" r="3" />
                  </g>
                </svg>
              </div>
            </article>

            {/* Top Queries */}
            <article className="card mt">
              <div className="hd">
                <h3>Top Queries</h3>
                <div className="right-actions small">
                  <span>Top 50</span>
                  <span className="pill">⋮</span>
                </div>
              </div>
              <div className="bd">
                <table>
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Clicks</th>
                      <th>Impressions</th>
                      <th>CTR</th>
                      <th>Position</th>
                      <th>Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>running shoes</td>
                      <td>2,847</td>
                      <td>45,231</td>
                      <td>6.3%</td>
                      <td>4.2</td>
                      <td className="up">+12.4%</td>
                    </tr>
                    <tr>
                      <td>nike shoes</td>
                      <td>1,934</td>
                      <td>38,942</td>
                      <td>5.0%</td>
                      <td>6.1</td>
                      <td className="up">+8.7%</td>
                    </tr>
                    <tr>
                      <td>athletic footwear</td>
                      <td>1,523</td>
                      <td>29,847</td>
                      <td>5.5%</td>
                      <td>5.1</td>
                      <td className="down">−3.2%</td>
                    </tr>
                    <tr>
                      <td>sneakers online</td>
                      <td>1,247</td>
                      <td>24,417</td>
                      <td>5.1%</td>
                      <td>6.8</td>
                      <td className="up">+15.2%</td>
                    </tr>
                    <tr>
                      <td>sports shoes sale</td>
                      <td>987</td>
                      <td>24,156</td>
                      <td>4.1%</td>
                      <td>7.2</td>
                      <td className="up">+5.4%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            {/* Top Pages */}
            <article className="card mt">
              <div className="hd">
                <h3>Top Pages</h3>
                <div className="right-actions small">
                  <span>Top 25</span>
                  <span className="pill">Filter</span>
                </div>
              </div>
              <div className="bd">
                <table>
                  <thead>
                    <tr>
                      <th>Page URL</th>
                      <th>Clicks</th>
                      <th>Impressions</th>
                      <th>CTR</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>/running-shoes</td>
                      <td>4,231</td>
                      <td>67,845</td>
                      <td>6.2%</td>
                      <td>3.8</td>
                      <td><span className="status s-ok">Optimized</span></td>
                      <td className="up">+18.3%</td>
                    </tr>
                    <tr>
                      <td>/nike-shoes</td>
                      <td>3,542</td>
                      <td>59,234</td>
                      <td>6.0%</td>
                      <td>4.2</td>
                      <td><span className="status s-warn">Needs Work</span></td>
                      <td className="up">+12.7%</td>
                    </tr>
                    <tr>
                      <td>/athletic-footwear</td>
                      <td>2,847</td>
                      <td>52,156</td>
                      <td>5.5%</td>
                      <td>5.1</td>
                      <td><span className="status s-ok">Optimized</span></td>
                      <td className="down">−3.2%</td>
                    </tr>
                    <tr>
                      <td>/sneakers</td>
                      <td>2,156</td>
                      <td>48,923</td>
                      <td>4.4%</td>
                      <td>6.8</td>
                      <td><span className="status s-crit">Critical</span></td>
                      <td className="up">+8.9%</td>
                    </tr>
                    <tr>
                      <td>/sports-shoes</td>
                      <td>1,934</td>
                      <td>43,567</td>
                      <td>4.4%</td>
                      <td>7.2</td>
                      <td><span className="status s-warn">Needs Work</span></td>
                      <td className="up">+5.4%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            {/* Internal Links + Competitors row */}
            <div className="grid mt" style={{ gridTemplateColumns: '1fr 330px', gap: '12px' }}>
              <article className="card">
                <div className="hd">
                  <h3>Internal Links Suggestions</h3>
                </div>
                <div className="bd list">
                  <div className="win">
                    <div className="mini" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span className="status s-ok" style={{ borderRadius: 6 }}>High Impact</span>
                      <span className="status" style={{ borderColor: '#dbeafe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6 }}>Authority Boost</span>
                    </div>
                    <div className="small"><b>From:</b> /running‑shoes‑guide</div>
                    <div className="small"><b>To:</b> /best‑running‑shoes‑2024</div>
                    <div className="mini muted">Link from high‑traffic guide to product page with anchor “best running shoes for 2024”.</div>
                    <div style={{ marginTop: 8 }}>
                      <button className="btn mini">Add to Brief</button>
                    </div>
                  </div>

                  <div className="win">
                    <div className="mini" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span className="status" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#92400e', borderRadius: 6 }}>Medium Impact</span>
                      <span className="status" style={{ borderColor: '#ddd', background: '#f9fafb', color: '#4b5563', borderRadius: 6 }}>Relevance</span>
                    </div>
                    <div className="small"><b>From:</b> /nike‑shoes‑collection</div>
                    <div className="small"><b>To:</b> /nike‑air‑max‑sale</div>
                    <div className="mini muted">Cross‑link between related Nike product categories for better navigation.</div>
                    <div style={{ marginTop: 8 }}>
                      <button className="btn mini">Add to Brief</button>
                    </div>
                  </div>

                  <div className="win">
                    <div className="mini" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span className="status" style={{ borderColor: '#e5e7eb', background: '#f9fafb', color: '#374151', borderRadius: 6 }}>Low Impact</span>
                      <span className="status" style={{ borderColor: '#e5e7eb', background: '#f9fafb', color: '#374151', borderRadius: 6 }}>Contextual</span>
                    </div>
                    <div className="small"><b>From:</b> /shoe‑care‑tips</div>
                    <div className="small"><b>To:</b> /shoe‑cleaning‑products</div>
                    <div className="mini muted">Link from care guide to relevant cleaning products for natural flow.</div>
                    <div style={{ marginTop: 8 }}>
                      <button className="btn mini">Add to Brief</button>
                    </div>
                  </div>
                </div>
              </article>

              <article className="card">
                <div className="hd">
                  <h3>Competitors</h3>
                </div>
                <div className="bd list">
                  <div className="issues item" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <div className="small muted">Your Site</div>
                      <div>ecommerce‑store.com</div>
                    </div>
                    <div className="count">24,847 <span className="mini muted">clicks</span></div>
                  </div>
                  <div className="issues item" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <div className="small muted">Competitor A</div>
                      <div>competitor‑a.com</div>
                    </div>
                    <div className="count">31,245 <span className="mini muted">clicks</span></div>
                  </div>
                  <div className="issues item" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <div className="small muted">Competitor B</div>
                      <div>competitor‑b.com</div>
                    </div>
                    <div className="count">28,984 <span className="mini muted">clicks</span></div>
                  </div>
                  <div className="issues item" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <div className="small muted">Competitor C</div>
                      <div>competitor‑c.com</div>
                    </div>
                    <div className="count">19,667 <span className="mini muted">clicks</span></div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 6 }}>
                    <a className="link" href="#">View Detailed Analysis</a>
                  </div>
                </div>
              </article>
            </div>

            {/* CTR Analysis + Keyword Opportunities + Backlinks */}
            <div className="grid mt" style={{ gridTemplateColumns: '1fr 330px', gap: '12px' }}>
              <article className="card">
                <div className="hd">
                  <h3>CTR Analysis by Position</h3>
                </div>
                <div className="bd">
                  <div style={{ height: 220 }}>
                    <svg viewBox="0 0 720 220" width="100%" height="100%">
                      <rect x="0" y="0" width="720" height="220" fill="#fff" />
                      {/* bars */}
                      <g fill="#67a0de">
                        <rect x="40" y="30" width="40" height="150" rx="4" />
                        <rect x="100" y="70" width="40" height="110" rx="4" />
                        <rect x="160" y="95" width="40" height="85" rx="4" />
                        <rect x="220" y="115" width="40" height="65" rx="4" />
                        <rect x="280" y="125" width="40" height="55" rx="4" />
                        <rect x="340" y="135" width="40" height="45" rx="4" />
                        <rect x="400" y="145" width="40" height="35" rx="4" />
                        <rect x="460" y="152" width="40" height="28" rx="4" />
                        <rect x="520" y="158" width="40" height="22" rx="4" />
                        <rect x="580" y="164" width="40" height="16" rx="4" />
                      </g>
                    </svg>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    <div className="issues item" style={{ borderStyle: 'dashed' }}>
                      <div>
                        <div className="small muted">Position 1–3</div>
                        <div className="up" style={{ fontWeight: 800 }}>8.2%</div>
                      </div>
                    </div>
                    <div className="issues item" style={{ borderStyle: 'dashed' }}>
                      <div>
                        <div className="small muted">Position 4–6</div>
                        <div style={{ color: '#f97316', fontWeight: 800 }}>3.1%</div>
                      </div>
                    </div>
                    <div className="issues item" style={{ borderStyle: 'dashed' }}>
                      <div>
                        <div className="small muted">Position 7–10</div>
                        <div className="down" style={{ fontWeight: 800 }}>1.4%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article className="card">
                <div className="hd">
                  <h3>Keyword Opportunities</h3>
                </div>
                <div className="bd list">
                  <div className="win">
                    <h4>waterproof running shoes</h4>
                    <div className="meta">
                      <span>Search Vol: 8,900</span> <span>Difficulty: Medium</span> <span>CPC: $2.40</span>
                      <span className="badge">High</span>
                    </div>
                  </div>
                  <div className="win">
                    <h4>trail running shoes men</h4>
                    <div className="meta">
                      <span>Search Vol: 5,400</span> <span>Difficulty: Low</span> <span>CPC: $1.80</span>
                      <span className="badge" style={{ background: '#f0f9ff', color: '#075985', borderColor: '#bae6fd' }}>Medium</span>
                    </div>
                  </div>
                  <div className="win">
                    <h4>minimalist running shoes</h4>
                    <div className="meta">
                      <span>Search Vol: 3,200</span> <span>Difficulty: Low</span> <span>CPC: $1.10</span>
                      <span className="badge">High</span>
                    </div>
                  </div>
                  <div className="win">
                    <h4>zero drop running shoes</h4>
                    <div className="meta">
                      <span>Search Vol: 2,600</span> <span>Difficulty: Medium</span> <span>CPC: $1.95</span>
                      <span className="badge" style={{ background: '#f0f9ff', color: '#075985', borderColor: '#bae6fd' }}>Medium</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <article className="card mt">
              <div className="hd">
                <h3>Backlinks Overview</h3>
              </div>
              <div className="bd">
                <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <div className="issues item" style={{ borderStyle: 'dashed', justifyContent: 'center', textAlign: 'center' }}>
                    <div>
                      <div className="muted mini">Total Backlinks</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>1,247</div>
                    </div>
                  </div>
                  <div className="issues item" style={{ borderStyle: 'dashed', justifyContent: 'center', textAlign: 'center' }}>
                    <div>
                      <div className="muted mini">Referring Domains</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>234</div>
                    </div>
                  </div>
                  <div className="issues item" style={{ borderStyle: 'dashed', justifyContent: 'center', textAlign: 'center' }}>
                    <div>
                      <div className="muted mini">Domain Authority</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>68</div>
                    </div>
                  </div>
                  <div className="issues item" style={{ borderStyle: 'dashed', justifyContent: 'center', textAlign: 'center' }}>
                    <div>
                      <div className="muted mini">New This Month</div>
                      <div className="up" style={{ fontSize: 22, fontWeight: 800 }}>+23</div>
                    </div>
                  </div>
                </div>

                <div className="mt">
                  <table>
                    <thead>
                      <tr>
                        <th>Referring Domain</th>
                        <th>DR</th>
                        <th>Links</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>First Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>runningmagazine.com</td>
                        <td>72</td>
                        <td>3</td>
                        <td>Follow</td>
                        <td><span className="status s-ok">Active</span></td>
                        <td>2024‑01‑15</td>
                      </tr>
                      <tr>
                        <td>fitnessreview.net</td>
                        <td>65</td>
                        <td>2</td>
                        <td>Follow</td>
                        <td><span className="status s-ok">Active</span></td>
                        <td>2024‑01‑12</td>
                      </tr>
                      <tr>
                        <td>sportblog.org</td>
                        <td>58</td>
                        <td>1</td>
                        <td>Nofollow</td>
                        <td><span className="status s-crit">Broken</span></td>
                        <td>2024‑01‑08</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </article>

            {/* Performance Insights */}
            <div className="cta-row mt">
              <div className="cta">
                <div className="ico" style={{ background: '#ecfdf5', color: '#047857' }}>▲</div>
                <div>
                  <div style={{ fontWeight: 700 }}>Traffic Growth Opportunity</div>
                  <div className="muted small">
                    Optimizing your top 10 underperforming pages could increase traffic by <b>34%</b>.
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>
                    <a className="link" href="#">View Recommendations →</a>
                  </div>
                </div>
              </div>
              <div className="cta">
                <div className="ico" style={{ background: '#f0f9ff', color: '#075985' }}>★</div>
                <div>
                  <div style={{ fontWeight: 700 }}>Keyword Ranking Wins</div>
                  <div className="muted small">12 keywords moved into top 10 positions this week. Great progress!</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    <a className="link" href="#">See Details →</a>
                  </div>
                </div>
              </div>
              <div className="cta">
                <div className="ico" style={{ background: '#fff7ed', color: '#a16207' }}>⚠</div>
                <div>
                  <div style={{ fontWeight: 700 }}>Technical Issues Alert</div>
                  <div className="muted small">5 new crawl errors detected. Address these to maintain search visibility.</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    <a className="link" href="#">Fix issues →</a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Rail (Quick Wins + Technical Issues) */}
          <aside>
            <article className="card">
              <div className="hd">
                <h3>Quick Wins</h3>
              </div>
              <div className="bd list">
                <div className="win">
                  <h4>best running shoes 2024</h4>
                  <div className="meta">
                    <span>Position 11.2</span> <span>Target: Top 10</span>
                    <span>847 impressions</span> <span>23 clicks</span> <span>2.7% CTR</span>
                    <span className="badge">+156 clicks</span>
                  </div>
                </div>
                <div className="win">
                  <h4>nike air max sale</h4>
                  <div className="meta">
                    <span>Position 12.1</span> <span>Target: Top 10</span>
                    <span>653 impressions</span> <span>18 clicks</span> <span>2.8% CTR</span>
                    <span className="badge">+142 clicks</span>
                  </div>
                </div>
                <div className="win">
                  <h4>athletic shoes women</h4>
                  <div className="meta">
                    <span>Position 12.8</span> <span>Target: Top 10</span>
                    <span>523 impressions</span> <span>16 clicks</span> <span>2.7% CTR</span>
                    <span className="badge">+98 clicks</span>
                  </div>
                </div>
              </div>
            </article>

            <article className="card mt">
              <div className="hd">
                <h3>Technical Issues</h3>
              </div>
              <div className="bd issues list">
                <div className="item">
                  <div className="ico red">✖</div>
                  <div>
                    <div><b>404 Errors</b></div>
                    <div className="sub">Pages not found</div>
                  </div>
                  <div className="count">12</div>
                </div>
                <div className="item">
                  <div className="ico amber">⏱</div>
                  <div>
                    <div><b>Slow Pages</b></div>
                    <div className="sub">Core Web Vitals</div>
                  </div>
                  <div className="count">8</div>
                </div>
                <div className="item">
                  <div className="ico blue">ℹ</div>
                  <div>
                    <div><b>Missing Meta</b></div>
                    <div className="sub">Titles & descriptions</div>
                  </div>
                  <div className="count">3</div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <a href="#" className="link">View All Issues</a>
                </div>
              </div>
            </article>
          </aside>
        </section>
      </div>

      {/* Global styles: plain <style> tag (no styled-jsx) to avoid env errors */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root{
          --bg: #fcfcfb;
          --card: #ffffff;
          --border: #e7eaee;
          --text: #1f2430;
          --muted: #5f6472;
          --muted-2:#8b91a1;
          --chip:#f4f6f9;
          --chip-border:#e8ebf1;
          --primary:#6366f0;
          --primary-600:#5458e6;
          --accent:#0ab1d6;
          --accent-600:#0c92b0;
          --accent-2:#67a0de;
          --gold:#e8b109;
          --green:#16a34a;
          --red:#ef4444;
          --amber:#f59e0b;
          --shadow: 0 1px 1px rgba(16,24,40,.04), 0 2px 8px rgba(16,24,40,.06);
          --radius: 10px;
        }
        *{box-sizing:border-box}
        html,body{height:100%}
        body{ margin:0; background:var(--bg); color:var(--text); font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji'; line-height:1.4; }
        .wrap-page{max-width:1180px; margin:0 auto; padding:14px 16px 60px}
        .topbar{display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--border); background:#fff; border-radius:12px; box-shadow:var(--shadow);}
        .dot{width:10px; height:10px; background:var(--primary); border-radius:50%}
        .brand{font-weight:700; font-size:14px}
        .chipbox{display:flex; gap:8px; align-items:center}
        .pill{display:inline-flex; align-items:center; gap:6px; border:1px solid var(--chip-border); background:var(--chip); padding:6px 10px; border-radius:8px; font-size:12px; color:#2d3343}
        .pill strong{font-weight:600}
        .right{margin-left:auto; display:flex; gap:8px; align-items:center}
        .btn{background:var(--primary); color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer}
        .btn.secondary{background:#fff; color:#2c3240; border:1px solid var(--border)}
        .crumbs{margin:10px 0 6px; color:var(--muted-2); font-size:12px}
        .crumbs a{color:var(--muted-2); text-decoration:none}
        .kpis{display:grid; grid-template-columns: repeat(6, 1fr); gap:12px}
        .kpi{background:var(--card); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow); padding:12px}
        .kpi h4{margin:0 0 4px; font-size:12px; color:#6b7280; font-weight:600}
        .kpi .value{display:flex; align-items:baseline; gap:8px}
        .kpi .value b{font-size:22px}
        .delta{font-size:12px; font-weight:600}
        .up{color:var(--green)}
        .down{color:var(--red)}
        .grid{display:grid; grid-template-columns: 1fr 330px; gap:12px; margin-top:12px}
        .card{background:var(--card); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow);}
        .card .hd{padding:12px 12px 0; display:flex; align-items:center; justify-content:space-between}
        .card .hd h3{margin:0; font-size:14px}
        .card .bd{padding:12px}
        .legend{display:flex; gap:8px; flex-wrap:wrap}
        .legend .tag{display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid var(--chip-border); background:var(--chip); border-radius:8px; font-size:12px}
        .dot-c{width:8px; height:8px; border-radius:50%}
        .c-clicks{background:#3b82f6}
        .c-impr{background:#a0abdc}
        .c-ctr{background:#0ab1d6}
        .c-pos{background:#f59e0b}
        .chart-area{height:250px; border-top:1px dashed #eef1f5;}
        table{width:100%; border-collapse:separate; border-spacing:0 8px}
        th{color:#80869a; font-size:12px; text-align:left; padding:0 8px}
        td{background:#fff; border:1px solid var(--border); border-left:none; border-right:none; padding:10px 8px; font-size:13px}
        tr{border-radius:8px}
        tr td:first-child{border-radius:8px 0 0 8px; border-left:1px solid var(--border)}
        tr td:last-child{border-radius:0 8px 8px 0; border-right:1px solid var(--border)}
        .list{display:flex; flex-direction:column; gap:10px}
        .win{border:1px dashed #e7ebf2; border-radius:10px; padding:10px; background:#fbfcff}
        .win h4{margin:0 0 4px; font-size:13px}
        .meta{display:flex; gap:10px; color:#6b7280; font-size:12px}
        .badge{margin-left:auto; background:#ecfdf5; color:var(--green); border:1px solid #d1fadf; padding:4px 6px; border-radius:6px; font-weight:700; font-size:12px}
        .issues .item{display:flex; align-items:center; gap:10px; padding:10px; border:1px solid var(--border); border-radius:10px}
        .issues .ico{width:28px; height:28px; border-radius:8px; display:grid; place-items:center}
        .ico.red{background:#ffe4e6; color:#b42318}
        .ico.amber{background:#fff7ed; color:#a16207}
        .ico.blue{background:#eff6ff; color:#1d4ed8}
        .count{margin-left:auto; font-weight:700; color:#111827}
        .sub{font-size:12px; color:#6b7280}
        .status{font-size:11px; font-weight:700; padding:4px 6px; border-radius:999px; border:1px solid}
        .s-ok{background:#ecfdf5; color:#067647; border-color:#abefc6}
        .s-warn{background:#fffbeb; color:#92400e; border-color:#fde68a}
        .s-crit{background:#fef2f2; color:#b42318; border-color:#fecaca}
        .cta-row{display:grid; grid-template-columns: repeat(3, 1fr); gap:12px}
        .cta{display:flex; gap:10px; align-items:flex-start; border:1px solid var(--border); border-radius:12px; background:#fff; padding:14px}
        .cta .ico{width:36px; height:36px; border-radius:10px; display:grid; place-items:center}
        .mt{margin-top:12px}
        .mb0{margin-bottom:0}
        .muted{color:#6b7280}
        .small{font-size:12px}
        .right-actions{display:flex; gap:6px; align-items:center}
        .link{color:#3b82f6; text-decoration:none; font-weight:600}
        .mini{font-size:11px}
        @media (max-width: 1100px){
          .kpis{grid-template-columns: repeat(3,1fr)}
          .grid{grid-template-columns:1fr}
        }
      `}</style>
    </>
  );
}
