'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@taciturne-delivery.bf');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Connexion impossible');
      localStorage.setItem('adminToken', data.accessToken);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>🛡️ Taciturne Admin</h1>
        <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
          Back-office — accès réservé à l’équipe plateforme
        </p>
        <label className="field">
          Email
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          Mot de passe
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
        <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
