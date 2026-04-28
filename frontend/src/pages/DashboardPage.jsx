import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { scoresAPI, drawsAPI, charitiesAPI, subscriptionsAPI, winnersAPI, authAPI } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { id: 'overview', icon: '◉', label: 'Overview' },
  { id: 'scores', icon: '⛳', label: 'My Scores' },
  { id: 'draw', icon: '🎰', label: 'Monthly Draw' },
  { id: 'charity', icon: '💚', label: 'My Charity' },
  { id: 'winnings', icon: '🏆', label: 'Winnings' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

const PRICES = { monthly: 9.99, yearly: 89.99 };

export default function DashboardPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  const [scores, setScores] = useState([]);
  const [charities, setCharities] = useState([]);
  const [drawData, setDrawData] = useState(null);
  const [winnings, setWinnings] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [subStatus, setSubStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Score form
  const [newScore, setNewScore] = useState('');
  const [newDate, setNewDate] = useState('');
  const [editId, setEditId] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  // Draw
  const [drawSim, setDrawSim] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  // Charity
  const [charityPct, setCharityPct] = useState(user?.charity_percentage || 10);
  const [selectedCharity, setSelectedCharity] = useState(user?.charity_id || null);

  // Settings
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [sc, ch, dr, wi, ct, sub] = await Promise.allSettled([
        scoresAPI.list(), charitiesAPI.list(), drawsAPI.current(),
        winnersAPI.my(), subscriptionsAPI.contributions(), subscriptionsAPI.status(),
      ]);
      if (sc.status === 'fulfilled') setScores(sc.value.data.scores);
      if (ch.status === 'fulfilled') setCharities(ch.value.data.charities);
      if (dr.status === 'fulfilled') setDrawData(dr.value.data);
      if (wi.status === 'fulfilled') setWinnings(wi.value.data.winners);
      if (ct.status === 'fulfilled') setContributions(ct.value.data.contributions);
      if (sub.status === 'fulfilled') setSubStatus(sub.value.data);
    } finally { setLoading(false); }
  }

  async function handleAddScore(e) {
    e.preventDefault();
    if (!newScore || !newDate) return;
    setScoreLoading(true);
    try {
      const fn = editId ? scoresAPI.update(editId, { value: parseInt(newScore), date: newDate }) : scoresAPI.add({ value: parseInt(newScore), date: newDate });
      const res = await fn;
      setScores(res.data.scores);
      setNewScore(''); setNewDate(''); setEditId(null);
      toast.success(editId ? 'Score updated!' : 'Score added! Rolling window maintained.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save score');
    } finally { setScoreLoading(false); }
  }

  async function handleDeleteScore(id) {
    try {
      const res = await scoresAPI.delete(id);
      setScores(res.data.scores);
      toast.success('Score deleted');
    } catch { toast.error('Delete failed'); }
  }

  function startEdit(s) { setEditId(s.id); setNewScore(String(s.value)); setNewDate(s.date); }

  async function simulateDraw() {
    setSimLoading(true);
    try {
      const nums = [];
      while (nums.length < 5) { const n = Math.floor(Math.random() * 45) + 1; if (!nums.includes(n)) nums.push(n); }
      setDrawSim(nums);
    } finally { setSimLoading(false); }
  }

  async function updateCharity() {
    try {
      await authAPI.updateProfile({ charityId: selectedCharity, charityPercentage: charityPct });
      await refreshUser();
      toast.success('Charity preferences updated!');
    } catch { toast.error('Update failed'); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  }

  async function handleCancelSub() {
    if (!confirm('Cancel subscription? You keep access until period end.')) return;
    try { await subscriptionsAPI.cancel(); toast.success('Subscription cancelled'); loadAll(); } catch { toast.error('Failed'); }
  }

  async function handleReactivate(plan) {
    try { await subscriptionsAPI.reactivate({ plan }); toast.success('Subscription reactivated!'); loadAll(); refreshUser(); } catch { toast.error('Failed'); }
  }

  const myCharity = charities.find(c => c.id === (selectedCharity || user?.charity_id));
  const priceAmount = PRICES[user?.subscription_plan] || 9.99;
  const charityContrib = (priceAmount * charityPct / 100).toFixed(2);
  const totalWon = winnings.filter(w => w.payment_status === 'paid').reduce((s, w) => s + w.prize_amount, 0);

  const matchCount = drawSim ? scores.filter(s => drawSim.includes(s.value)).length : 0;

  if (loading) return <div className="loading-page"><div className="spinner" /><div className="loading-text">Loading dashboard...</div></div>;

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-name">GolfGives</div>
          <div className="sidebar-logo-sub">{user?.name || user?.email}</div>
        </div>
        <div className="sidebar-section">
          <span className="sidebar-section-label">Menu</span>
          {NAV.map(n => (
            <button key={n.id} className={`sidebar-item ${active === n.id ? 'active' : ''}`} onClick={() => setActive(n.id)}>
              <span className="sidebar-item-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
        <div className="sidebar-section" style={{ marginTop: 32 }}>
          <button className="sidebar-item" onClick={() => { logout(); navigate('/'); }}>
            <span className="sidebar-item-icon">↩</span>Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main">

        {active === 'overview' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋</div>
              <div className="dash-sub">Here's your April 2025 summary</div>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Subscription</div>
                <div className="stat-value"><span className={`badge ${user?.subscription_status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{user?.subscription_status}</span></div>
                <div className="stat-sub">{user?.subscription_plan} plan · {user?.current_period_end ? `Renews ${new Date(user.current_period_end).toLocaleDateString()}` : 'No renewal set'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Latest Score</div>
                <div className="stat-value stat-gold">{scores[0]?.value ?? '--'}</div>
                <div className="stat-sub">Stableford points · {scores[0]?.date || 'No scores yet'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Prize Pool</div>
                <div className="stat-value stat-gold">€{drawData?.pool?.total?.toFixed(2) ?? '0.00'}</div>
                <div className="stat-sub">This month · {drawData?.pool?.activeUsers ?? 0} members</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Won</div>
                <div className="stat-value stat-emerald">€{totalWon.toFixed(2)}</div>
                <div className="stat-sub">{winnings.length} draw{winnings.length !== 1 ? 's' : ''} entered</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">⛳</span>Score History</div>
                {scores.length === 0
                  ? <div className="empty-state"><span className="empty-state-icon">⛳</span><div className="empty-state-title">No scores yet</div><div className="empty-state-sub">Add your first score in the Scores tab</div></div>
                  : <div className="score-bars">
                      {[...scores].reverse().map((s, i) => (
                        <div key={s.id} className="score-bar-item">
                          <div className="score-bar-val" style={{ fontSize: 12, fontWeight: 700 }}>{s.value}</div>
                          <div className="score-bar-fill" style={{ height: `${(s.value / 45) * 90}px`, background: `hsl(${130 + s.value * 2}, 45%, 42%)` }} />
                          <div className="score-bar-date" style={{ fontSize: 10, color: 'var(--mist)' }}>{s.date?.slice(5)}</div>
                        </div>
                      ))}
                    </div>
                }
              </div>
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">💚</span>My Charity</div>
                {myCharity ? (
                  <>
                    {myCharity.image_url ? (
                      <img src={myCharity.image_url} alt={myCharity.name} style={{ width: '100%', height: 120, borderRadius: 8, objectFit: 'cover', marginBottom: 12 }} />
                    ) : (
                      <div style={{ fontSize: 48, marginBottom: 8 }}>{myCharity.emoji}</div>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{myCharity.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14, lineHeight: 1.5 }}>{myCharity.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--mist)' }}>Monthly contribution</span>
                      <span style={{ fontWeight: 700, color: 'var(--emerald-bright)' }}>€{charityContrib}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill progress-fill-emerald" style={{ width: `${charityPct}%` }} /></div>
                    <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>{charityPct}% of your subscription</div>
                  </>
                ) : <div className="empty-state"><span className="empty-state-icon">💚</span><div className="empty-state-title">No charity selected</div></div>}
              </div>
            </div>

            {winnings.length > 0 && (
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">🏆</span>Recent Winnings</div>
                {winnings.slice(0, 3).map((w, i) => (
                  <div key={i} className="winner-card" style={{ marginBottom: 10 }}>
                    <div className="winner-avatar">🏆</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{w.match_tier === 'five' ? '5-Number Match' : w.match_tier === 'four' ? '4-Number Match' : '3-Number Match'}</div>
                      <div style={{ fontSize: 12, color: 'var(--mist)' }}>{w.month} · <span className={`badge ${w.payment_status === 'paid' ? 'badge-active' : 'badge-pending'}`}>{w.payment_status}</span></div>
                    </div>
                    <div className="winner-prize">€{Number(w.prize_amount).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {active === 'scores' && (
          <>
            <div className="dash-header">
              <div className="dash-title">My Scores</div>
              <div className="dash-sub">Rolling 5-score log · Stableford format · 1 score per date</div>
            </div>
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-title"><span className="panel-title-icon">{editId ? '✏️' : '➕'}</span>{editId ? 'Edit Score' : 'Add New Score'}</div>
              <form onSubmit={handleAddScore}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Score (1–45)</label>
                    <input className="form-input" type="number" min={1} max={45} placeholder="e.g. 34"
                      value={newScore} onChange={e => setNewScore(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Date played</label>
                    <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={scoreLoading}>
                    {scoreLoading ? '...' : editId ? 'Save' : 'Add'}
                  </button>
                </div>
                {editId && (
                  <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 12 }}
                    onClick={() => { setEditId(null); setNewScore(''); setNewDate(''); }}>Cancel edit</button>
                )}
              </form>
            </div>
            <div className="panel">
              <div className="panel-title"><span className="panel-title-icon">📋</span>Score Log <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--mist)' }}>({scores.length}/5 slots used)</span></div>
              {scores.length === 0
                ? <div className="empty-state"><span className="empty-state-icon">⛳</span><div className="empty-state-title">No scores yet</div><div className="empty-state-sub">Add your first score above</div></div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {scores.map((s, i) => (
                      <div key={s.id} className="score-chip">
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: `hsl(${130 + s.value * 2}, 45%, 42%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>#{i + 1}</div>
                        <div className="score-chip-val">{s.value} pts</div>
                        <div className="score-chip-date">{s.date}</div>
                        <div className="score-chip-actions">
                          <button className="btn btn-icon btn-sm" onClick={() => startEdit(s)} title="Edit">✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteScore(s.id)} title="Delete">🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              {scores.length === 5 && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--gold-dim)' }}>
                  ⚡ 5-score limit reached. Adding a new score will automatically remove the oldest one.
                </div>
              )}
            </div>
          </>
        )}

        {active === 'draw' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Monthly Draw</div>
              <div className="dash-sub">{drawData?.month || 'Current month'} · Draw closes end of month</div>
            </div>
            <div className="panel" style={{ marginBottom: 20, textAlign: 'center' }}>
              <div className="panel-title" style={{ justifyContent: 'center' }}><span className="panel-title-icon">🎰</span>Your Entry Numbers</div>
              <div style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 16 }}>Your 5 scores are your draw numbers for this month</div>
              {scores.length === 0
                ? <div className="empty-state"><span className="empty-state-icon">⛳</span><div className="empty-state-title">No scores entered</div><div className="empty-state-sub">Add your scores to enter the draw</div></div>
                : <>
                    <div className="draw-balls" style={{ marginBottom: 24 }}>
                      {scores.map(s => (
                        <div key={s.id} className={`draw-ball ${drawSim && drawSim.includes(s.value) ? 'match' : ''}`}>{s.value}</div>
                      ))}
                    </div>
                    {!drawSim
                      ? <button className="btn btn-primary" onClick={simulateDraw} disabled={simLoading}>{simLoading ? 'Drawing...' : '🎲 Simulate Draw'}</button>
                      : <>
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Simulated draw result</div>
                            <div className="draw-balls">
                              {drawSim.map((n, i) => (
                                <div key={i} className={`draw-ball dark ${scores.some(s => s.value === n) ? 'match' : ''}`}>{n}</div>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'inline-block', padding: '16px 28px', background: matchCount >= 3 ? 'var(--emerald-light)' : 'rgba(0,0,0,0.04)', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: matchCount >= 3 ? 'var(--emerald-bright)' : 'var(--slate)' }}>
                              {matchCount >= 5 ? '🏆 JACKPOT! 5 matches!' : matchCount >= 4 ? '🥈 4 matches!' : matchCount >= 3 ? '🥉 3 matches!' : 'No matches this time'}
                            </div>
                            {matchCount >= 3 && drawData?.pool && (
                              <div style={{ fontSize: 14, color: 'var(--slate)', marginTop: 6 }}>
                                Estimated prize: €{matchCount === 5 ? drawData.pool.five?.toFixed(2) : matchCount === 4 ? drawData.pool.four?.toFixed(2) : drawData.pool.three?.toFixed(2)}
                              </div>
                            )}
                          </div>
                          <div><button className="btn btn-outline btn-sm" onClick={() => setDrawSim(null)}>Reset simulation</button></div>
                        </>
                    }
                  </>
              }
            </div>
            <div className="panel">
              <div className="panel-title"><span className="panel-title-icon">💰</span>This Month's Prize Pool</div>
              {drawData?.pool ? (
                <>
                  <div className="prize-tier">
                    <div><div style={{ fontWeight: 600 }}>5-Number Match (Jackpot)</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>40% of pool · rolls over if unclaimed</div></div>
                    <div className="prize-tier-amount">€{drawData.pool.five?.toFixed(2)}</div>
                  </div>
                  <div className="prize-tier">
                    <div><div style={{ fontWeight: 600 }}>4-Number Match</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>35% of pool · split among winners</div></div>
                    <div className="prize-tier-amount">€{drawData.pool.four?.toFixed(2)}</div>
                  </div>
                  <div className="prize-tier">
                    <div><div style={{ fontWeight: 600 }}>3-Number Match</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>25% of pool · split among winners</div></div>
                    <div className="prize-tier-amount">€{drawData.pool.three?.toFixed(2)}</div>
                  </div>
                </>
              ) : <div style={{ color: 'var(--mist)' }}>Loading pool data...</div>}
            </div>
          </>
        )}

        {active === 'charity' && (
          <>
            <div className="dash-header">
              <div className="dash-title">My Charity</div>
              <div className="dash-sub">Your contribution makes a real difference every month</div>
            </div>
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-title"><span className="panel-title-icon">💚</span>Choose your charity</div>
              <div className="charity-pick-grid" style={{ marginBottom: 24 }}>
                {charities.map(c => (
                  <div key={c.id}
                    className={`charity-pick-card ${(selectedCharity || user?.charity_id) === c.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCharity(c.id)}
                    style={{ position: 'relative', overflow: 'hidden', backgroundImage: c.image_url ? `url(${c.image_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    {c.image_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5))', zIndex: 1 }} />}
                    <span className="charity-pick-icon" style={{ position: 'relative', zIndex: 2 }}>{c.emoji}</span>
                    <div className="charity-pick-name" style={{ position: 'relative', zIndex: 2 }}>{c.name}</div>
                  </div>
                ))}
              </div>
              {myCharity && (
                <div style={{ background: 'var(--pearl)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{myCharity.emoji} {myCharity.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--slate)', lineHeight: 1.5 }}>{myCharity.description}</div>
                  <div style={{ fontSize: 13, color: 'var(--emerald-bright)', fontWeight: 700, marginTop: 8 }}>
                    €{Number(myCharity.total_raised).toLocaleString()} raised all-time
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Contribution: <strong style={{ color: 'var(--gold)' }}>{charityPct}%</strong> = <strong style={{ color: 'var(--emerald-bright)' }}>€{charityContrib}/mo</strong></label>
                <input type="range" min={10} max={100} step={5} value={charityPct}
                  onChange={e => setCharityPct(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--gold)', marginBottom: 6 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mist)' }}>
                  <span>10% minimum</span><span>100% maximum</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={updateCharity}>Save charity preferences</button>
            </div>
            <div className="panel">
              <div className="panel-title"><span className="panel-title-icon">📊</span>Contribution History</div>
              {contributions.length === 0
                ? <div className="empty-state"><span className="empty-state-icon">💚</span><div className="empty-state-title">No contributions yet</div></div>
                : <table className="data-table">
                    <thead><tr><th>Charity</th><th>Month</th><th>Amount</th></tr></thead>
                    <tbody>{contributions.map((c, i) => (
                      <tr key={i}><td>{c.emoji} {c.charity_name}</td><td>{c.month}</td><td style={{ fontWeight: 700, color: 'var(--emerald-bright)' }}>€{Number(c.amount).toFixed(2)}</td></tr>
                    ))}</tbody>
                  </table>
              }
            </div>
          </>
        )}

        {active === 'winnings' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Winnings</div>
              <div className="dash-sub">Your prize history and verification status</div>
            </div>
            {winnings.length === 0
              ? <div className="panel"><div className="empty-state"><span className="empty-state-icon">🏆</span><div className="empty-state-title">No winnings yet</div><div className="empty-state-sub">Keep playing — the jackpot rolls over each month!</div></div></div>
              : winnings.map((w, i) => (
                  <div key={i} className="winner-card" style={{ marginBottom: 12 }}>
                    <div className="winner-avatar">{w.match_tier === 'five' ? '🥇' : w.match_tier === 'four' ? '🥈' : '🥉'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                        {w.match_tier === 'five' ? '5-Number Match (Jackpot)' : w.match_tier === 'four' ? '4-Number Match' : '3-Number Match'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--mist)' }}>{w.month} · Verification: <span className={`badge ${w.verification_status === 'approved' ? 'badge-active' : w.verification_status === 'rejected' ? 'badge-danger' : 'badge-pending'}`}>{w.verification_status}</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="winner-prize">€{Number(w.prize_amount).toFixed(2)}</div>
                      <div style={{ marginTop: 4 }}><span className={`badge ${w.payment_status === 'paid' ? 'badge-active' : 'badge-pending'}`}>{w.payment_status}</span></div>
                    </div>
                  </div>
                ))
            }
            <div className="panel" style={{ marginTop: 24 }}>
              <div className="panel-title"><span className="panel-title-icon">✅</span>Winner Verification Process</div>
              <div className="verify-timeline" style={{ marginBottom: 20 }}>
                {['Win Draw', 'Upload Proof', 'Admin Review', 'Payout'].map((s, i) => (
                  <div key={i} className={`verify-step ${i < 2 ? 'done' : i === 2 ? 'current' : ''}`}>
                    <div className="verify-step-circle">{i < 2 ? '✓' : i + 1}</div>
                    <div className="verify-step-label">{s}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>
                To claim a win, upload a screenshot of your scores from your registered golf platform. Admin will verify within 48 hours.
              </div>
              <label style={{ display: 'inline-block', marginTop: 16 }}>
                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files[0];
                    if (!file || winnings.length === 0) return;
                    try {
                      await winnersAPI.uploadProof(winnings[0].id, file);
                      toast.success('Proof uploaded! Admin will review shortly.');
                    } catch { toast.error('Upload failed'); }
                  }} />
                <span className="btn btn-outline" style={{ cursor: 'pointer' }}>📎 Upload proof of score</span>
              </label>
            </div>
          </>
        )}

        {active === 'settings' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Settings</div>
              <div className="dash-sub">Manage your account and subscription</div>
            </div>
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-title"><span className="panel-title-icon">💳</span>Subscription</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                    {user?.subscription_plan === 'yearly' ? 'Yearly Plan — €89.99' : 'Monthly Plan — €9.99'}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mist)' }}>
                    Status: <span className={`badge ${user?.subscription_status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{user?.subscription_status}</span>
                  </div>
                  {user?.current_period_end && <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 6 }}>Valid until {new Date(user.current_period_end).toLocaleDateString()}</div>}
                </div>
              </div>
              {user?.subscription_status === 'active'
                ? <button className="btn btn-danger" onClick={handleCancelSub}>Cancel subscription</button>
                : <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleReactivate('monthly')}>Reactivate Monthly</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleReactivate('yearly')}>Reactivate Yearly</button>
                  </div>
              }
            </div>
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-title"><span className="panel-title-icon">🔐</span>Change Password</div>
              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label className="form-label">Current password</label>
                  <input className="form-input" type="password" value={pwForm.currentPassword}
                    onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">New password</label>
                    <input className="form-input" type="password" value={pwForm.newPassword}
                      onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={8} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm new password</label>
                    <input className="form-input" type="password" value={pwForm.confirm}
                      onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
                  </div>
                </div>
                <button className="btn btn-secondary" type="submit">Update password</button>
              </form>
            </div>
            <div className="panel">
              <div className="panel-title"><span className="panel-title-icon">🔔</span>Notifications</div>
              {['Draw results via email', 'Winner alerts', 'Monthly subscription reminder', 'GolfGives newsletter'].map(n => (
                <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: 14 }}>{n}</span>
                  <span style={{ fontSize: 13, color: 'var(--emerald-bright)', fontWeight: 600, cursor: 'pointer' }}>On</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
