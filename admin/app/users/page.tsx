'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api, shortDate } from '../../lib/api';

// Contrat réel : GET /admin/users?role=&q=&cursor= → { data: User[], nextCursor }
// User { id, phone, fullName, role, status, language, createdAt,
//        partnerProfile?{kycStatus, businessName}, driverProfile?{kycStatus, isOnline} }
type User = {
  id: string; phone: string; fullName: string; role: string; status: string; language: string; createdAt: string;
  partnerProfile: { kycStatus: string; businessName: string } | null;
  driverProfile: { kycStatus: string; isOnline: boolean } | null;
};

const ROLES = [
  { id: '', label: 'Tous' },
  { id: 'CUSTOMER', label: '👤 Clients' },
  { id: 'PARTNER', label: '🏪 Partenaires' },
  { id: 'DRIVER', label: '🛵 Livreurs' },
  { id: 'ADMIN', label: '🛡 Admins' },
];
const STATUS_BADGE: Record<string, [string, string]> = {
  ACTIVE: ['Actif', 'green'],
  PENDING_VERIFICATION: ['Non vérifié', 'gold'],
  SUSPENDED: ['Suspendu', 'red'],
  DELETED: ['Supprimé', 'grey'],
};

export default function UsersPage() {
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<User[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    const p = new URLSearchParams();
    if (role) p.set('role', role);
    if (q) p.set('q', q);
    if (cursor) p.set('cursor', cursor);
    const r = await api<{ data: User[]; nextCursor: string | null }>(`/admin/users?${p}`);
    setItems((prev) => (append ? [...prev, ...r.data] : r.data));
    setNextCursor(r.nextCursor);
  }, [role, q]);
  useEffect(() => { load(null, false).catch(() => {}); }, [load]);

  async function suspend(u: User) {
    const reason = prompt(`Motif de suspension de ${u.fullName || u.phone} :`);
    if (!reason) return;
    try { await api(`/admin/users/${u.id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }); load(null, false); } catch (e) { alert((e as Error).message); }
  }
  async function reactivate(u: User) {
    try { await api(`/admin/users/${u.id}/reactivate`, { method: 'POST' }); load(null, false); } catch (e) { alert((e as Error).message); }
  }

  const roleBadge = (u: User) => {
    const map: Record<string, [string, string]> = { CUSTOMER: ['👤 Client', 'grey'], PARTNER: ['🏪 Partenaire', 'gold'], DRIVER: ['🛵 Livreur', 'green'], ADMIN: ['🛡 Admin', 'red'] };
    const [label, cls] = map[u.role] || [u.role, 'grey'];
    return <span className={`badge ${cls}`}>{label}</span>;
  };
  const statusBadge = (s: string) => {
    const [label, cls] = STATUS_BADGE[s] || [s, 'grey'];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <Shell title="Utilisateurs" sub="Recherche, suspension et réactivation — la suspension révoque toutes les sessions">
      <div className="row">
        <div className="chips">{ROLES.map((r) => <button key={r.id} className={`chip ${role === r.id ? 'active' : ''}`} onClick={() => setRole(r.id)}>{r.label}</button>)}</div>
        <input className="input search" placeholder="🔍 Nom ou téléphone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Utilisateur</th><th>Téléphone</th><th>Rôle</th><th>Profil métier</th><th>Inscrit le</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td><b>{u.fullName || '—'}</b><br /><span className="muted small">{u.language.toUpperCase()}</span></td>
                <td className="mono small">{u.phone}</td>
                <td>{roleBadge(u)}</td>
                <td className="small">
                  {u.partnerProfile && <>🏪 {u.partnerProfile.businessName} <span className="muted">({u.partnerProfile.kycStatus})</span></>}
                  {u.driverProfile && <>🛵 {u.driverProfile.isOnline ? '🟢 en ligne' : 'hors ligne'} <span className="muted">({u.driverProfile.kycStatus})</span></>}
                  {!u.partnerProfile && !u.driverProfile && <span className="muted">—</span>}
                </td>
                <td className="muted small">{shortDate(u.createdAt)}</td>
                <td>{statusBadge(u.status)}</td>
                <td className="actions">
                  {u.role !== 'ADMIN' && (u.status === 'SUSPENDED'
                    ? <button className="btn sm leaf" onClick={() => reactivate(u)}>Réactiver</button>
                    : <button className="btn sm danger" onClick={() => suspend(u)}>Suspendre</button>)}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="muted pad center">Aucun utilisateur</td></tr>}
          </tbody>
        </table></div>
        {nextCursor && (
          <div className="pad center">
            <button className="btn ghost" onClick={() => load(nextCursor, true)}>Charger plus</button>
          </div>
        )}
      </div>
    </Shell>
  );
}
