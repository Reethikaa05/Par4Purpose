import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminAPI, drawsAPI, charitiesAPI, winnersAPI } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { id: 'overview', icon: '◉', label: 'Overview' },
  { id: 'users', icon: '👤', label: 'Users', badge: null },
  { id: 'draw', icon: '🎰', label: 'Draw Management' },
  { id: 'charities', icon: '💚', label: 'Charities' },
  { id: 'winners', icon: '🏆', label: 'Winners' },
  { id: 'analytics', icon: '📊', label: 'Analytics' },
];

export default function AdminPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  const [users, setUsers] = useState([]);
  const [charities, setCharities] = useState([]);
  const [winners, setWinners] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [dashSummary, setDashSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Draw state
  const [drawMonth, setDrawMonth] = useState(() => new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
  const [drawMode, setDrawMode] = useState('random');
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

  // Charity edit
  const [editCharity, setEditCharity] = useState(null);
  const [charityLoading, setCharityLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localImagePreview, setLocalImagePreview] = useState(null);

  // User search
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [u, ch, w, an, ds] = await Promise.allSettled([
        adminAPI.users(), charitiesAPI.list(), winnersAPI.list(),
        adminAPI.analytics(), adminAPI.dashboard(),
      ]);
      if (u.status === 'fulfilled') setUsers(u.value.data.users);
      if (ch.status === 'fulfilled') setCharities(ch.value.data.charities);
      if (w.status === 'fulfilled') setWinners(w.value.data.winners);
      if (an.status === 'fulfilled') setAnalytics(an.value.data);
      if (ds.status === 'fulfilled') setDashSummary(ds.value.data);
    } finally { setLoading(false); }
  }

  async function handleSimulate() {
    setSimLoading(true);
    try {
      const res = await drawsAPI.simulate({ month: drawMonth, mode: drawMode });
      setSimResult(res.data);
      toast.success('Draw simulated!');
    } catch (err) { toast.error(err.response?.data?.error || 'Simulation failed'); }
    finally { setSimLoading(false); }
  }

  async function handlePublish() {
    if (!simResult) { toast.error('Run a simulation first'); return; }
    setPublishLoading(true);
    try {
      const res = await drawsAPI.publish({ month: drawMonth, numbers: simResult.numbers, mode: drawMode });
      toast.success(`Draw published! ${res.data.winners.five + res.data.winners.four + res.data.winners.three} winners found.`);
      setSimResult(null);
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Publish failed'); }
    finally { setPublishLoading(false); }
  }

  async function handleUserAction(userId, action) {
    try {
      if (action === 'delete') {
        if (!confirm('Delete this user permanently?')) return;
        await adminAPI.deleteUser(userId);
        setUsers(users.filter(u => u.id !== userId));
        toast.success('User deleted');
      } else if (action === 'deactivate') {
        await adminAPI.updateUser(userId, { subscription_status: 'lapsed' });
        setUsers(users.map(u => u.id === userId ? { ...u, subscription_status: 'lapsed' } : u));
        toast.success('User deactivated');
      } else if (action === 'activate') {
        await adminAPI.updateUser(userId, { subscription_status: 'active' });
        setUsers(users.map(u => u.id === userId ? { ...u, subscription_status: 'active' } : u));
        toast.success('User activated');
      }
    } catch { toast.error('Action failed'); }
  }

  async function handleWinnerAction(id, action, note = '') {
    try {
      if (action === 'approve' || action === 'reject') {
        await winnersAPI.verify(id, { action, note });
        toast.success(`Winner ${action}d`);
      } else if (action === 'payout') {
        await winnersAPI.payout(id);
        toast.success('Payout marked');
      }
      const res = await winnersAPI.list();
      setWinners(res.data.winners);
    } catch { toast.error('Action failed'); }
  }

  function handleImageFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setLocalImagePreview(URL.createObjectURL(file));
  }

  async function uploadSelectedImage() {
    if (!imageFile) return null;
    setUploadingImage(true);
    try {
      const res = await charitiesAPI.uploadImage(imageFile);
      setEditCharity(ec => ({ ...ec, image_url: res.data.image_url }));
      setImageFile(null);
      setLocalImagePreview(res.data.image_url);
      toast.success('Image uploaded successfully');
      return res.data.image_url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Image upload failed');
      throw err;
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveCharity(e) {
    e.preventDefault();
    setCharityLoading(true);
    try {
      const charityData = { ...editCharity };
      if (imageFile) {
        charityData.image_url = await uploadSelectedImage();
      }
      if (charityData.id && charities.find(c => c.id === charityData.id)) {
        await charitiesAPI.update(charityData.id, charityData);
        toast.success('Charity updated');
      } else {
        await charitiesAPI.create(charityData);
        toast.success('Charity added');
      }
      const res = await charitiesAPI.list();
      setCharities(res.data.charities);
      setEditCharity(null);
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setCharityLoading(false); }
  }

  async function handleDeleteCharity(id) {
    if (!confirm('Delete this charity?')) return;
    try {
      await charitiesAPI.delete(id);
      setCharities(charities.filter(c => c.id !== id));
      toast.success('Charity deleted');
    } catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
  }

  async function handleDeleteImage() {
    if (!confirm('Delete this uploaded image?')) return;
    try {
      await charitiesAPI.deleteImage(editCharity.id);
      setEditCharity(ec => ({ ...ec, image_url: null }));
      setLocalImagePreview(null);
      setImageFile(null);
      toast.success('Image deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  }

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const pendingWinners = winners.filter(w => w.verification_status === 'pending').length;

  if (loading) return <div className="loading-page"><div className="spinner" /><div className="loading-text">Loading admin panel...</div></div>;

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-name">GolfGives</div>
          <div className="sidebar-logo-sub" style={{ color: 'rgba(201,168,76,0.6)' }}>Admin Panel</div>
        </div>
        <div className="sidebar-section">
          <span className="sidebar-section-label">Management</span>
          {NAV.map(n => (
            <button key={n.id} className={`sidebar-item ${active === n.id ? 'active' : ''}`} onClick={() => setActive(n.id)}>
              <span className="sidebar-item-icon">{n.icon}</span>
              {n.label}
              {n.id === 'winners' && pendingWinners > 0 && <span className="sidebar-badge">{pendingWinners}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-section" style={{ marginTop: 32 }}>
          <button className="sidebar-item" onClick={() => { logout(); navigate('/'); }}>
            <span className="sidebar-item-icon">↩</span>Sign out
          </button>
        </div>
      </aside>

      <main className="dash-main">

        {active === 'overview' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Admin Overview</div>
              <div className="dash-sub">GolfGives Platform · {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</div>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Total Users</div>
                <div className="stat-value">{analytics?.totalUsers ?? '--'}</div>
                <div className="stat-sub stat-up">↑ Growing</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Subscribers</div>
                <div className="stat-value stat-gold">{analytics?.activeUsers ?? '--'}</div>
                <div className="stat-sub">{analytics?.yearlyPlan ?? 0} yearly · {analytics?.monthlyPlan ?? 0} monthly</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">MRR</div>
                <div className="stat-value stat-gold">€{analytics?.mrr?.toFixed(2) ?? '--'}</div>
                <div className="stat-sub">ARR: €{analytics?.arr?.toFixed(2) ?? '--'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pending Verif.</div>
                <div className="stat-value" style={{ color: pendingWinners > 0 ? 'var(--danger)' : 'var(--charcoal)' }}>{pendingWinners}</div>
                <div className="stat-sub">Winners awaiting review</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">📊</span>Charity Distribution</div>
                {analytics?.charityBreakdown?.map(c => (
                  <div key={c.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13 }}>{c.emoji} {c.name} <span style={{ color: 'var(--mist)', fontSize: 12 }}>({c.member_count} members)</span></span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--emerald-bright)' }}>€{Number(c.total_raised).toLocaleString()}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill progress-fill-emerald" style={{ width: `${Math.min(100, (c.total_raised / (analytics.totalCharity || 1)) * 100 * 3)}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">💰</span>Financial Summary</div>
                <div className="prize-tier"><div style={{ fontWeight: 600 }}>Total Revenue</div><div className="prize-tier-amount" style={{ color: 'var(--charcoal)' }}>€{analytics?.totalRevenue?.toFixed(2)}</div></div>
                <div className="prize-tier"><div style={{ fontWeight: 600 }}>Charity Donated</div><div className="prize-tier-amount" style={{ color: 'var(--emerald-bright)' }}>€{analytics?.totalCharity?.toFixed(2)}</div></div>
                <div className="prize-tier"><div style={{ fontWeight: 600 }}>Prizes Paid</div><div className="prize-tier-amount">€{analytics?.totalPrizes?.toFixed(2)}</div></div>
                <div className="prize-tier"><div style={{ fontWeight: 600 }}>Draws Run</div><div className="prize-tier-amount" style={{ fontSize: 20 }}>{analytics?.drawCount}</div></div>
              </div>
            </div>
          </>
        )}

        {active === 'users' && (
          <>
            <div className="dash-header">
              <div className="dash-title">User Management</div>
              <div className="dash-sub">{users.length} total users</div>
            </div>
            <div className="panel">
              <div style={{ marginBottom: 16 }}>
                <input className="form-input" placeholder="Search by name or email..." value={userSearch}
                  onChange={e => setUserSearch(e.target.value)} style={{ maxWidth: 340 }} />
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Status</th><th>Charity</th><th>Joined</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td style={{ color: 'var(--slate)', fontSize: 13 }}>{u.email}</td>
                        <td><span className="badge badge-gold">{u.subscription_plan || 'none'}</span></td>
                        <td><span className={`badge ${u.subscription_status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{u.subscription_status}</span></td>
                        <td style={{ fontSize: 13 }}>{u.charity_name || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--mist)' }}>{u.created_at?.slice(0, 10)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-icon btn-sm"
                              onClick={() => handleUserAction(u.id, u.subscription_status === 'active' ? 'deactivate' : 'activate')}
                              title={u.subscription_status === 'active' ? 'Deactivate' : 'Activate'}>
                              {u.subscription_status === 'active' ? '🚫' : '✅'}
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleUserAction(u.id, 'delete')}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {active === 'draw' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Draw Management</div>
              <div className="dash-sub">Configure, simulate, and publish monthly draws</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">⚙</span>Draw Configuration</div>
                <div className="form-group">
                  <label className="form-label">Draw month</label>
                  <input className="form-input" value={drawMonth} onChange={e => setDrawMonth(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Draw logic</label>
                  <select className="form-input form-select" value={drawMode} onChange={e => setDrawMode(e.target.value)}>
                    <option value="random">Random (Standard Lottery)</option>
                    <option value="algorithm">Algorithmic (Weighted by Score Frequency)</option>
                  </select>
                </div>
                <div style={{ padding: '12px 14px', background: 'var(--pearl)', borderRadius: 10, fontSize: 13, color: 'var(--slate)', marginBottom: 16, lineHeight: 1.55 }}>
                  {drawMode === 'random'
                    ? '🎲 Standard random number generation — equal odds for all active subscribers.'
                    : '📊 Algorithmic draw: numbers appearing most frequently across all user scores have higher draw probability.'}
                </div>
                <button className="btn btn-primary btn-full" onClick={handleSimulate} disabled={simLoading}>
                  {simLoading ? 'Simulating...' : '🎲 Run Simulation'}
                </button>
                {simResult && (
                  <button className="btn btn-secondary btn-full" style={{ marginTop: 10 }} onClick={handlePublish} disabled={publishLoading}>
                    {publishLoading ? 'Publishing...' : '📢 Publish Official Draw'}
                  </button>
                )}
              </div>
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">🎲</span>Simulation Result</div>
                {!simResult
                  ? <div className="empty-state"><span className="empty-state-icon">🎲</span><div className="empty-state-title">No simulation yet</div><div className="empty-state-sub">Run a simulation to preview results</div></div>
                  : <>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Winning Numbers</div>
                        <div className="draw-balls" style={{ justifyContent: 'flex-start' }}>
                          {simResult.numbers.map((n, i) => <div key={i} className="draw-ball match" style={{ width: 44, height: 44, fontSize: 16 }}>{n}</div>)}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--slate)' }}>
                        5-match: <strong>{simResult.summary.fiveMatch}</strong> · 4-match: <strong>{simResult.summary.fourMatch}</strong> · 3-match: <strong>{simResult.summary.threeMatch}</strong>
                        {simResult.summary.jackpotRolls && <span style={{ marginLeft: 8, color: 'var(--gold)', fontWeight: 600 }}>· Jackpot rolls over!</span>}
                      </div>
                      <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
                        <table className="data-table" style={{ fontSize: 12 }}>
                          <thead><tr><th>User</th><th>Matches</th><th>Prize</th></tr></thead>
                          <tbody>
                            {simResult.results.filter(r => r.matches > 0).map(r => (
                              <tr key={r.id}>
                                <td style={{ fontWeight: 600 }}>{r.name}</td>
                                <td><span className={`badge ${r.matches >= 3 ? 'badge-active' : 'badge-inactive'}`}>{r.matches}</span></td>
                                <td style={{ fontWeight: 700, color: 'var(--gold)', fontFamily: 'monospace' }}>
                                  {r.matches >= 3 ? `€${(r.matches === 5 ? simResult.pool.five : r.matches === 4 ? simResult.pool.four / Math.max(1, simResult.summary.fourMatch) : simResult.pool.three / Math.max(1, simResult.summary.threeMatch)).toFixed(2)}` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                }
              </div>
            </div>
          </>
        )}

        {active === 'charities' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Charity Management</div>
              <div className="dash-sub">{charities.length} active charities</div>
            </div>
            <div className="panel" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div className="panel-title" style={{ marginBottom: 0 }}><span className="panel-title-icon">💚</span>Charities</div>
                <button className="btn btn-primary btn-sm" onClick={() => setEditCharity({ name: '', emoji: '💚', description: '', category: '', total_raised: 0, is_featured: false })}>+ Add Charity</button>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Charity</th><th>Category</th><th>Total Raised</th><th>Featured</th><th>Actions</th></tr></thead>
                  <tbody>
                    {charities.map(c => (
                      <tr key={c.id}>
                        <td style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {c.image_url ? (
                            <img src={c.image_url} alt={c.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.05)', fontSize: 18 }}>{c.emoji || '💚'}</div>
                          )}
                          <strong>{c.name}</strong>
                        </td>
                        <td><span className="badge badge-gold">{c.category}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--emerald-bright)', fontFamily: 'monospace' }}>€{Number(c.total_raised).toLocaleString()}</td>
                        <td>{c.is_featured ? <span className="badge badge-active">Featured</span> : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-icon btn-sm" onClick={() => setEditCharity({ ...c })}>✏️</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCharity(c.id)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {editCharity && (
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">✏️</span>{editCharity.id ? 'Edit Charity' : 'Add Charity'}</div>
                <form onSubmit={handleSaveCharity}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={editCharity.name} onChange={e => setEditCharity(ec => ({ ...ec, name: e.target.value }))} required /></div>
                    <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={editCharity.category} onChange={e => setEditCharity(ec => ({ ...ec, category: e.target.value }))} required /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" style={{ minHeight: 80, fontFamily: 'inherit' }} value={editCharity.description} onChange={e => setEditCharity(ec => ({ ...ec, description: e.target.value }))} required /></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Emoji (optional)</label><input className="form-input" value={editCharity.emoji} onChange={e => setEditCharity(ec => ({ ...ec, emoji: e.target.value }))} placeholder="💚" /></div>
                    <div className="form-group"><label className="form-label">Website URL (optional)</label><input className="form-input" type="url" value={editCharity.website || ''} onChange={e => setEditCharity(ec => ({ ...ec, website: e.target.value }))} placeholder="https://example.com" /></div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Charity image</label>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <input className="form-input" value={editCharity.image_url || ''} onChange={e => setEditCharity(ec => ({ ...ec, image_url: e.target.value }))} placeholder="https://example.com/image.jpg" />
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input type="file" accept="image/*" onChange={handleImageFileChange} />
                        <button type="button" className="btn btn-secondary btn-sm" disabled={!imageFile || uploadingImage} onClick={uploadSelectedImage}>
                          {uploadingImage ? 'Uploading…' : 'Upload selected image'}
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--mist)' }}>Paste an image URL or select a file to upload directly.</div>
                      {localImagePreview && (
                        <div style={{ width: 120, height: 90, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', marginTop: 8 }}>
                          <img src={localImagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      {editCharity.image_url && editCharity.image_url.startsWith('/uploads/') && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteImage} style={{ marginTop: 8 }}>Delete uploaded image</button>
                      )}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Total Raised (€)</label><input className="form-input" type="number" value={editCharity.total_raised || 0} onChange={e => setEditCharity(ec => ({ ...ec, total_raised: Number(e.target.value) }))} /></div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 30 }}>
                      <input type="checkbox" id="featured" checked={!!editCharity.is_featured} onChange={e => setEditCharity(ec => ({ ...ec, is_featured: e.target.checked }))} />
                      <label htmlFor="featured" className="form-label" style={{ marginBottom: 0 }}>Featured charity</label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" type="submit" disabled={charityLoading}>{charityLoading ? 'Saving...' : 'Save charity'}</button>
                    <button type="button" className="btn btn-outline" onClick={() => setEditCharity(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}

        {active === 'winners' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Winners Management</div>
              <div className="dash-sub">Verify submissions and process payouts</div>
            </div>
            {['pending', 'submitted', 'approved', 'rejected'].map(status => {
              const group = winners.filter(w => w.verification_status === status);
              if (group.length === 0) return null;
              return (
                <div key={status} className="panel" style={{ marginBottom: 20 }}>
                  <div className="panel-title">
                    <span className="panel-title-icon">{status === 'pending' ? '⏳' : status === 'submitted' ? '📎' : status === 'approved' ? '✅' : '❌'}</span>
                    {status.charAt(0).toUpperCase() + status.slice(1)} ({group.length})
                  </div>
                  {group.map((w, i) => (
                    <div key={i} className="winner-card" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 12 }}>
                      <div className="winner-avatar">{w.user_name?.charAt(0) || '?'}</div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 700 }}>{w.user_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--mist)' }}>{w.email} · {w.month} · {w.match_tier}-match</div>
                        {w.admin_note && <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 3 }}>Note: {w.admin_note}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="winner-prize">€{Number(w.prize_amount).toFixed(2)}</div>
                        <div style={{ marginTop: 4 }}><span className={`badge ${w.payment_status === 'paid' ? 'badge-active' : 'badge-pending'}`}>{w.payment_status}</span></div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(status === 'pending' || status === 'submitted') && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleWinnerAction(w.id, 'approve')}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleWinnerAction(w.id, 'reject', 'Proof not accepted')}>Reject</button>
                          </>
                        )}
                        {status === 'approved' && w.payment_status !== 'paid' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleWinnerAction(w.id, 'payout')}>Mark Paid</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {winners.length === 0 && (
              <div className="panel"><div className="empty-state"><span className="empty-state-icon">🏆</span><div className="empty-state-title">No winners yet</div><div className="empty-state-sub">Publish a draw to generate winners</div></div></div>
            )}
          </>
        )}

        {active === 'analytics' && (
          <>
            <div className="dash-header">
              <div className="dash-title">Analytics</div>
              <div className="dash-sub">Platform-wide statistics and reports</div>
            </div>
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-label">MRR</div><div className="stat-value stat-gold">€{analytics?.mrr?.toFixed(2)}</div><div className="stat-sub">Monthly recurring</div></div>
              <div className="stat-card"><div className="stat-label">ARR</div><div className="stat-value">€{analytics?.arr?.toFixed(2)}</div><div className="stat-sub">Annualised</div></div>
              <div className="stat-card"><div className="stat-label">Total Charity</div><div className="stat-value stat-emerald">€{analytics?.totalCharity?.toFixed(2)}</div><div className="stat-sub">All-time donations</div></div>
              <div className="stat-card"><div className="stat-label">Prizes Paid</div><div className="stat-value">€{analytics?.totalPrizes?.toFixed(2)}</div><div className="stat-sub">{analytics?.drawCount} draws total</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">💚</span>Charity Leaderboard</div>
                {analytics?.charityBreakdown?.map((c, i) => (
                  <div key={c.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}><span style={{ fontSize: 16, marginRight: 6 }}>{c.emoji}</span>{c.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--emerald-bright)' }}>€{Number(c.total_raised).toLocaleString()}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill progress-fill-emerald"
                        style={{ width: `${Math.min(100, (c.total_raised / Math.max(...analytics.charityBreakdown.map(x => x.total_raised))) * 100)}%` }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 4 }}>{c.member_count} active members</div>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="panel-title"><span className="panel-title-icon">📋</span>Platform Stats</div>
                <div className="prize-tier"><div style={{ fontWeight: 600 }}>Total Draws Run</div><div className="prize-tier-amount" style={{ fontSize: 20 }}>{analytics?.drawCount}</div></div>
                <div className="prize-tier"><div style={{ fontWeight: 600 }}>Active Subscribers</div><div className="prize-tier-amount" style={{ fontSize: 20, color: 'var(--charcoal)' }}>{analytics?.activeUsers}</div></div>
                <div className="prize-tier"><div style={{ fontWeight: 600 }}>Yearly Plan Users</div><div className="prize-tier-amount" style={{ fontSize: 20, color: 'var(--charcoal)' }}>{analytics?.yearlyPlan}</div></div>
                <div className="prize-tier"><div style={{ fontWeight: 600 }}>Total Revenue</div><div className="prize-tier-amount">€{analytics?.totalRevenue?.toFixed(2)}</div></div>
              </div>
            </div>
            <div className="panel" style={{ marginTop: 20 }}>
              <div className="panel-title"><span className="panel-title-icon">💳</span>Recent Payments</div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {analytics?.recentPayments?.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td><span className="badge badge-gold">{p.plan}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--gold)', fontFamily: 'monospace' }}>€{Number(p.amount).toFixed(2)}</td>
                        <td><span className={`badge ${p.status === 'paid' ? 'badge-active' : 'badge-pending'}`}>{p.status}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--mist)' }}>{p.created_at?.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
