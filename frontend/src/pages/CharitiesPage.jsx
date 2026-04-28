import { useState, useEffect } from 'react';
import { charitiesAPI } from '../lib/api.js';

export default function CharitiesPage() {
  const [charities, setCharities] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    charitiesAPI.list({ search, category })
      .then(r => setCharities(r.data.charities))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, category]);

  const categories = [...new Set(charities.map(c => c.category).filter(Boolean))];
  const featured = charities.find(c => c.is_featured);

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--charcoal)', padding: '64px 24px 48px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(201,168,76,0.7)', textTransform: 'uppercase', marginBottom: 12 }}>Our Partners</div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 700, color: 'var(--white)', letterSpacing: -2, marginBottom: 14 }}>
            Charities making a <span style={{ color: 'var(--gold)' }}>real difference</span>
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', maxWidth: 520, lineHeight: 1.6 }}>
            Every GolfGives subscription contributes at least 10% to the charity you choose. Browse all our partner organisations below.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '48px 24px' }}>
        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search charities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <select
            className="form-input form-select"
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || category) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setCategory(''); }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Featured spotlight */}
        {featured && !search && !category && (
          <div className="spotlight" style={{ marginTop: 0, marginBottom: 48, overflow: 'hidden' }}>
            {featured.image_url && (
              <div style={{ position: 'absolute', inset: 0, opacity: 0.15, zIndex: 0 }}>
                <img src={featured.image_url} alt="featured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Featured This Month</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                {featured.image_url ? (
                  <img src={featured.image_url} alt={featured.name} style={{ height: 44, marginRight: 12, borderRadius: 4, objectFit: 'cover', display: 'inline-block', verticalAlign: 'middle' }} />
                ) : (
                  <span style={{ marginRight: 12 }}>{featured.emoji || '💚'}</span>
                )}
                {featured.name}
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', maxWidth: 400, lineHeight: 1.6, marginBottom: 16 }}>{featured.description}</div>
              <span className="badge badge-gold">{featured.category}</span>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, position: 'relative', zIndex: 1 }}>
              <div className="spotlight-total">€{Number(featured.total_raised).toLocaleString()}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>raised all-time</div>
            </div>
          </div>
        )}

        {/* Charity grid */}
        {loading
          ? <div className="loading-page" style={{ minHeight: 300 }}><div className="spinner" /></div>
          : charities.length === 0
            ? <div className="empty-state"><span className="empty-state-icon">🔍</span><div className="empty-state-title">No charities found</div><div className="empty-state-sub">Try a different search or category</div></div>
            : <div className="charity-grid">
                {charities.map(c => (
                  <div key={c.id} className="charity-card">
                    <div className="charity-thumb" style={{ background: c.image_url ? 'transparent' : `hsl(${c.id * 55}, 18%, 92%)`, overflow: 'hidden' }}>
                      {c.image_url ? (
                        <img src={c.image_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 52 }}>{c.emoji || '💚'}</span>
                      )}
                    </div>
                    <div className="charity-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div className="charity-name">{c.name}</div>
                        {c.is_featured && <span className="badge badge-active" style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>Featured</span>}
                      </div>
                      <div className="charity-desc">{c.description}</div>
                      <div className="charity-meta">
                        <div className="charity-raised">€{Number(c.total_raised).toLocaleString()} raised</div>
                        <div className="charity-tag">{c.category}</div>
                      </div>
                      {c.website && (
                        <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
                          Visit website →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
        }
      </div>
    </div>
  );
}
