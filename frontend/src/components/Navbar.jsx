import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const openSignup = () => { setAuthMode('signup'); setAuthOpen(true); };
  const openLogin = () => { setAuthMode('login'); setAuthOpen(true); };

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">Golf<span>Gives</span></Link>
          <div className="nav-links">
            {!user && (
              <>
                <Link to="/#how" className="nav-link">How it works</Link>
                <Link to="/charities" className="nav-link">Charities</Link>
                <Link to="/#pricing" className="nav-link">Pricing</Link>
              </>
            )}
            {user && (
              <>
                {isAdmin
                  ? <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>Admin Panel</Link>
                  : <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>Dashboard</Link>
                }
                <Link to="/charities" className="nav-link">Charities</Link>
              </>
            )}
            {!user ? (
              <>
                <button className="nav-link btn" onClick={openLogin}>Sign in</button>
                <button className="nav-cta btn" onClick={openSignup}>Get started</button>
              </>
            ) : (
              <button className="nav-link btn" onClick={handleLogout} style={{ color: 'rgba(255,255,255,0.5)' }}>Sign out</button>
            )}
          </div>
        </div>
      </nav>
      {authOpen && <AuthModal initialMode={authMode} onClose={() => setAuthOpen(false)} />}
    </>
  );
}
