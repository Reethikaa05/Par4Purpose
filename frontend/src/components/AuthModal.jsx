import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI, charitiesAPI, subscriptionsAPI } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthModal({ initialMode = 'login', onClose }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [charities, setCharities] = useState([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', email: '', password: '',
    plan: 'monthly', charityId: 1, charityPercentage: 10,
    cardNumber: '', cardExpiry: '', cardCvc: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    charitiesAPI.list().then(r => setCharities(r.data.charities)).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setErr = (k, v) => setErrors(e => ({ ...e, [k]: v }));

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name required';
    if (!form.email.includes('@')) e.email = 'Valid email required';
    if (form.password.length < 8) e.password = 'Min 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    setLoading(true);
    try {
      const res = await authAPI.login({ email: form.email, password: form.password });
      login(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name || res.data.user.email.split('@')[0]}!`);
      onClose();
      navigate(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleSignupStep1 = (e) => { e.preventDefault(); if (validateStep1()) setStep(2); };
  const handleSignupStep2 = (e) => { e.preventDefault(); setStep(3); };

  const handleSignupStep3 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.register({
        name: form.name, email: form.email, password: form.password,
        plan: form.plan, charityId: form.charityId, charityPercentage: form.charityPercentage,
      });
      login(res.data.token, res.data.user);
      // Auto-activate subscription (demo)
      try { await subscriptionsAPI.create({ plan: form.plan }); } catch (_) {}
      toast.success(`Welcome to GolfGives, ${form.name}! 🏌️`);
      onClose();
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed';
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const PRICES = { monthly: '€9.99/mo', yearly: '€89.99/yr' };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-dark">
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="tabs tabs-dark">
          <button className={`tab-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setStep(1); }}>Sign in</button>
          <button className={`tab-btn ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setStep(1); }}>Create account</button>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="modal-title">Welcome back</div>
            <div className="modal-sub">Sign in to your GolfGives account</div>
            <div className="form-group">
              <label className="form-label form-label-light">Email</label>
              <input className="form-input form-input-dark" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label form-label-light">Password</label>
              <input className="form-input form-input-dark" type="password" placeholder="••••••••"
                value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(201,168,76,0.08)', borderRadius: 10, fontSize: 13, color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(201,168,76,0.15)' }}>
              <strong style={{ color: 'rgba(201,168,76,0.8)' }}>Demo:</strong> user@golfgives.com / user1234 &nbsp;|&nbsp; admin@golfgives.com / admin123
            </div>
          </form>
        )}

        {mode === 'signup' && step === 1 && (
          <form onSubmit={handleSignupStep1}>
            <div className="modal-title">Create account</div>
            <div className="modal-sub">Step 1 of 3 — Your details</div>
            <div className="step-indicator">
              <div className="step-dot active" /><div className="step-dot" /><div className="step-dot" />
            </div>
            <div className="form-group">
              <label className="form-label form-label-light">Full name</label>
              <input className="form-input form-input-dark" placeholder="Your name"
                value={form.name} onChange={e => set('name', e.target.value)} required />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label form-label-light">Email address</label>
              <input className="form-input form-input-dark" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} required />
              {errors.email && <div className="form-error">{errors.email}</div>}
            </div>
            <div className="form-group">
              <label className="form-label form-label-light">Password</label>
              <input className="form-input form-input-dark" type="password" placeholder="Minimum 8 characters"
                value={form.password} onChange={e => set('password', e.target.value)} required />
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>
            <button className="btn btn-primary btn-full" type="submit">Continue →</button>
          </form>
        )}

        {mode === 'signup' && step === 2 && (
          <form onSubmit={handleSignupStep2}>
            <div className="modal-title">Choose your plan</div>
            <div className="modal-sub">Step 2 of 3 — Subscription</div>
            <div className="step-indicator">
              <div className="step-dot done" /><div className="step-dot active" /><div className="step-dot" />
            </div>
            {[{ key: 'monthly', label: 'Monthly', price: '€9.99/month', save: null },
              { key: 'yearly', label: 'Yearly', price: '€89.99/year', save: 'Save €29.89 vs monthly' }].map(p => (
              <div key={p.key} className={`plan-card plan-card-dark ${form.plan === p.key ? 'selected' : ''}`}
                onClick={() => set('plan', p.key)}>
                <div>
                  <div className="plan-name" style={{ color: 'rgba(255,255,255,0.9)' }}>{p.label}</div>
                  {p.save && <div className="plan-save">{p.save}</div>}
                </div>
                <div className="plan-price">{p.price}</div>
              </div>
            ))}
            <div style={{ marginTop: 4, marginBottom: 18, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              10% of your subscription is automatically donated to your chosen charity. Card details below are for demo only — no real charge.
            </div>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label form-label-light">Card number</label>
                <input className="form-input form-input-dark" placeholder="4242 4242 4242 4242"
                  value={form.cardNumber} onChange={e => set('cardNumber', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label form-label-light">Expiry / CVC</label>
                <input className="form-input form-input-dark" placeholder="MM/YY · 123"
                  value={form.cardExpiry} onChange={e => set('cardExpiry', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-outline-white btn-sm" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>Continue →</button>
            </div>
          </form>
        )}

        {mode === 'signup' && step === 3 && (
          <form onSubmit={handleSignupStep3}>
            <div className="modal-title">Pick your charity</div>
            <div className="modal-sub">Step 3 of 3 — Your contribution supports them</div>
            <div className="step-indicator">
              <div className="step-dot done" /><div className="step-dot done" /><div className="step-dot active" />
            </div>
            <div className="charity-pick-grid" style={{ marginBottom: 20 }}>
              {charities.slice(0, 6).map(c => (
                <div key={c.id}
                  className={`charity-pick-card dark-card ${form.charityId === c.id ? 'selected' : ''}`}
                  onClick={() => set('charityId', c.id)}>
                  <span className="charity-pick-icon">{c.emoji}</span>
                  <div className="charity-pick-name" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{c.name}</div>
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label form-label-light">Charity contribution: <strong style={{ color: 'var(--gold)' }}>{form.charityPercentage}%</strong></label>
              <input type="range" min={10} max={100} step={5}
                value={form.charityPercentage} onChange={e => set('charityPercentage', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--gold)' }} />
              <div className="form-hint" style={{ color: 'rgba(255,255,255,0.3)' }}>Minimum 10% — thank you for giving more!</div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-outline-white btn-sm" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Creating account...' : 'Complete signup →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
