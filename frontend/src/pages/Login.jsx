import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { Moon } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    // Normally we'd call the backend here and store JWT.
    // For now, redirect straight to the sleek dashboard.
    navigate('/dashboard');
  };

  return (
    <div className="layout-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <GlassCard className="w-full max-w-md p-8" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(0,242,254,0.1)', borderRadius: '50%', marginBottom: '16px' }}>
            <Moon size={40} color="var(--accent-cyan)" />
          </div>
          <h2 style={{ fontSize: '1.8rem' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Sign in to view your sleep metrics</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="glass-input" 
              placeholder="astronaut@space.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              className="glass-input" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
            Access Dashboard
          </button>
        </form>
      </GlassCard>
    </div>
  );
};

export default Login;
