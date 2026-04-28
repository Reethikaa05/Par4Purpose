import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { charitiesAPI } from '../lib/api.js';
import AuthModal from '../components/AuthModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const STEPS = [
  { num: '01', icon: '✍️', title: 'Subscribe', desc: 'Join on a monthly or yearly plan. A fixed share goes straight to your chosen charity every month.' },
  { num: '02', icon: '⛳', title: 'Log Scores', desc: 'Enter your last 5 Stableford scores. Our rolling tracker keeps only the most recent — always current.' },
  { num: '03', icon: '🎰', title: 'Enter the Draw', desc: 'Your scores automatically power your monthly draw entry. No extra steps required.' },
  { num: '04', icon: '🏆', title: 'Win & Give', desc: 'Match 3, 4, or all 5 numbers to win. Verify your result, and claim your prize within days.' },
];

export default function HomePage() {
  const [authModal, setAuthModal] = useState(null);
  const [charities, setCharities] = useState([]);
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { charitiesAPI.list().then(r => setCharities(r.data.charities)).catch(() => {}); }, []);

  const handleCTA = () => {
    if (user) navigate(isAdmin ? '/admin' : '/dashboard');
    else setAuthModal('signup');
  };

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-inner">
          <div>
            <div className="hero-badge">
              <div className="hero-badge-dot" />
              Monthly Draw Now Open
            </div>
            <h1 className="hero-h1">
              Golf. Give.<br /><em>Win Together.</em>
            </h1>
            <p className="hero-sub">
              Track your Stableford scores, join monthly prize draws, and contribute to the charity you care about — all in one beautifully designed platform.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={handleCTA}>
                {user ? 'Go to Dashboard →' : 'Start for €9.99/mo →'}
              </button>
              <a href="#how" className="btn btn-outline-white btn-lg">See how it works</a>
            </div>
            <div className="hero-stats">
              <div>
                <div className="hero-stat-val">€83K+</div>
                <div className="hero-stat-label">Donated to charities</div>
              </div>
              <div>
                <div className="hero-stat-val">2,140</div>
                <div className="hero-stat-label">Active members</div>
              </div>
              <div>
                <div className="hero-stat-val">€42K</div>
                <div className="hero-stat-label">This month's prize pool</div>
              </div>
            </div>
          </div>
          <div className="hero-card-wrap">
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 24, padding: 28, backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'rgba(201,168,76,0.7)', textTransform: 'uppercase', marginBottom: 16 }}>Your Last 5 Scores</div>
              <div className="score-bars">
                {[{v:34,d:'Apr 26'},{v:28,d:'Apr 20'},{v:41,d:'Apr 14'},{v:33,d:'Apr 7'},{v:39,d:'Apr 1'}].map((s,i) => (
                  <div key={i} className="score-bar-item">
                    <div className="score-bar-val" style={{ color: 'var(--white)', fontSize: 13, fontWeight: 700 }}>{s.v}</div>
                    <div className="score-bar-fill" style={{ height: `${(s.v / 45) * 90}px`, background: `hsl(${140 + s.v * 1.5}, 50%, 45%)`, opacity: 0.8 }} />
                    <div className="score-bar-date" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{s.d}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 12, padding: '16px 18px', marginTop: 16 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>APRIL PRIZE POOL</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 34, fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>€42,380</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Draw closes Apr 30 · 2,140 members</div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Charity this month:</span>
                <span style={{ fontSize: 13, color: 'var(--emerald-bright)', fontWeight: 600 }}>🌍 Swing & Hope</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section section-dark" id="how">
        <div className="section-inner">
          <div className="section-tag section-tag-gold">Simple process</div>
          <h2 className="section-title section-title-light">How it works</h2>
          <p className="section-sub section-sub-light">Four steps. Every month. Making every round count for something real.</p>
          <div className="steps-grid">
            {STEPS.map(s => (
              <div key={s.num} className="step-card">
                <div className="step-num">STEP {s.num}</div>
                <span className="step-icon">{s.icon}</span>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHARITIES */}
      <section className="section" id="charities">
        <div className="section-inner">
          <div className="section-tag">Our partners</div>
          <h2 className="section-title">Support a cause<br />that matters to you</h2>
          <p className="section-sub">Choose your charity at signup. At least 10% of every subscription is automatically contributed — you can give more any time.</p>
          <div className="charity-grid">
            {(charities.length ? charities : Array(6).fill(null)).map((c, i) => c ? (
              <div key={c.id} className="charity-card">
                <div className="charity-thumb" style={{ background: c.image_url ? 'transparent' : `hsl(${c.id * 55}, 18%, 94%)`, overflow: 'hidden' }}>
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 48 }}>{c.emoji || '💚'}</span>
                  )}
                </div>
                <div className="charity-body">
                  <div className="charity-name">{c.name}</div>
                  <div className="charity-desc">{c.description}</div>
                  <div className="charity-meta">
                    <div className="charity-raised">€{Number(c.total_raised).toLocaleString()} raised</div>
                    <div className="charity-tag">{c.category}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div key={i} className="charity-card" style={{ height: 260, background: 'rgba(0,0,0,0.03)' }} />
            ))}
          </div>
          {charities.find(c => c.is_featured) && (
            <div className="spotlight">
              {charities.find(c => c.is_featured)?.image_url && (
                <div style={{ position: 'absolute', inset: 0, opacity: 0.15, zIndex: 0 }}>
                  <img src={charities.find(c => c.is_featured)?.image_url} alt="featured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Featured Charity This Month</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                  {charities.find(c => c.is_featured)?.image_url ? (
                    <img src={charities.find(c => c.is_featured)?.image_url} alt="featured" style={{ height: 44, marginRight: 12, borderRadius: 4, objectFit: 'cover', display: 'inline-block', verticalAlign: 'middle' }} />
                  ) : (
                    <span style={{ marginRight: 12 }}>{charities.find(c => c.is_featured)?.emoji || '💚'}</span>
                  )}
                  {charities.find(c => c.is_featured)?.name}
                </div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', maxWidth: 400, lineHeight: 1.6 }}>{charities.find(c => c.is_featured)?.description}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                <div className="spotlight-total">€{Number(charities.find(c => c.is_featured)?.total_raised || 0).toLocaleString()}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>raised all-time</div>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleCTA}>Support them now</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* PRICING */}
      <section className="section section-pearl" id="pricing">
        <div className="section-inner" style={{ textAlign: 'center' }}>
          <div className="section-tag">Join today</div>
          <h2 className="section-title">Simple, transparent pricing</h2>
          <p className="section-sub" style={{ margin: '0 auto' }}>One subscription. Draws, charity, score tracking — everything included.</p>
          <div className="pricing-grid">
            <div className="price-card price-card-standard">
              <div className="price-plan" style={{ color: 'var(--slate)' }}>Monthly</div>
              <div className="price-amount" style={{ color: 'var(--charcoal)' }}>€9<span style={{ fontSize: 26, fontWeight: 400 }}>.99</span></div>
              <div style={{ fontSize: 14, color: 'var(--mist)', marginBottom: 28 }}>per month · cancel anytime</div>
              <ul className="price-features">
                {['Monthly prize draw entry', '5-score rolling tracker', 'Charity contribution (10%+)', 'Winner verification', 'Email notifications'].map(f => (
                  <li key={f} className="price-feature" style={{ color: 'var(--charcoal)' }}><span className="price-check">✓</span>{f}</li>
                ))}
              </ul>
              <button className="btn btn-outline btn-full" onClick={handleCTA}>Get started</button>
            </div>
            <div className="price-card price-card-featured">
              <div className="price-best">Best Value</div>
              <div className="price-plan" style={{ color: 'rgba(255,255,255,0.45)' }}>Yearly</div>
              <div className="price-amount" style={{ color: 'var(--gold)' }}>€89<span style={{ fontSize: 26, fontWeight: 400 }}>.99</span></div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 28 }}>per year · save €29.89</div>
              <ul className="price-features">
                {['Everything in Monthly', '25% extra charity boost', 'Priority winner processing', 'Early draw simulation access', 'Dedicated support'].map(f => (
                  <li key={f} className="price-feature" style={{ color: 'rgba(255,255,255,0.75)' }}><span className="price-check">✓</span>{f}</li>
                ))}
              </ul>
              <button className="btn btn-primary btn-full" onClick={handleCTA}>Get started — best value</button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="section section-dark" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div className="section-inner">
          <h2 className="section-title section-title-light" style={{ maxWidth: 560, margin: '0 auto 16px' }}>Ready to play, give, and win?</h2>
          <p className="section-sub section-sub-light" style={{ margin: '0 auto 40px' }}>Join 2,140 golfers making every round count for something bigger.</p>
          <button className="btn btn-primary btn-lg" onClick={handleCTA}>
            {user ? 'Open Dashboard →' : 'Start for €9.99/month →'}
          </button>
        </div>
      </section>

      <footer style={{ background: '#0F1214', padding: '36px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>GolfGives</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>© 2025 GolfGives · Golf. Give. Win. · Built for Digital Heroes selection process.</div>
      </footer>

      {authModal && <AuthModal initialMode={authModal} onClose={() => setAuthModal(null)} />}
    </>
  );
}
