'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api, shortDate } from '../../lib/api';

// Contrat réel : GET /admin/drivers → DriverProfile[] {userId, kycStatus, isOnline,
// vehicleType, vehiclePlate, ratingAvg, totalDeliveries, user{phone, fullName, status}}
type Driver = {
  userId: string; kycStatus: string; isOnline: boolean;
  vehicleType: string; vehiclePlate: string | null;
  ratingAvg: string | number; ratingCount: number; totalDeliveries: number;
  user: { fullName: string; phone: string; status: string };
};
// GET /admin/drivers/live → {userId, currentLat, currentLng, lastLocationAt, vehicleType, user{fullName}}
type Live = { userId: string; currentLat: string | number; currentLng: string | number; lastLocationAt: string; vehicleType: string; user: { fullName: string } };

const FILTERS = [
  { id: '', label: 'Tous' },
  { id: 'online', label: '🟢 En ligne' },
  { id: 'offline', label: '⚫ Hors ligne' },
  { id: 'PENDING', label: '⏳ KYC en attente' },
  { id: 'APPROVED', label: '✅ Approuvés' },
  { id: 'REJECTED', label: '⛔ Rejetés' },
];
const VEHICLE: Record<string, string> = { MOTO: '🏍 Moto', BICYCLE: '🚲 Vélo', CAR: '🚗 Voiture' };

export default function DriversPage() {
  const [filter, setFilter] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [live, setLive] = useState<Live[]>([]);

  const load = useCallback(async () => {
    // Le serveur ne filtre que la présence ; le filtre KYC est appliqué localement
    const url = filter === 'online' ? '/admin/drivers?online=true' : filter === 'offline' ? '/admin/drivers?online=false' : '/admin/drivers';
    const rows = await api<Driver[]>(url);
    setDrivers(filter === '' || filter === 'online' || filter === 'offline' ? rows : rows.filter((d) => d.kycStatus === filter));
  }, [filter]);
  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => {
    const tick = () => api<Live[]>('/admin/drivers/live').then(setLive).catch(() => {});
    tick(); const t = setInterval(tick, 10000); return () => clearInterval(t);
  }, []);

  async function approve(d: Driver) {
    try { await api(`/admin/drivers/${d.userId}/approve`, { method: 'POST' }); load(); } catch (e) { alert((e as Error).message); }
  }
  async function suspend(d: Driver) {
    const reason = prompt(`Motif de suspension de ${d.user.fullName || d.user.phone} :`);
    if (!reason) return;
    try { await api(`/admin/drivers/${d.userId}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }); load(); } catch (e) { alert((e as Error).message); }
  }

  const kycBadge = (k: string) => <span className={`badge ${k === 'APPROVED' ? 'green' : k === 'PENDING' ? 'gold' : k === 'REJECTED' ? 'red' : 'grey'}`}>{k === 'APPROVED' ? 'Approuvé' : k === 'PENDING' ? 'En attente' : k === 'REJECTED' ? 'Rejeté' : 'Non soumis'}</span>;

  return (
    <Shell title="Livreurs" sub="Validation KYC, suspensions et positions GPS en direct">
      <div className="row">
        <div className="chips">{FILTERS.map((f) => <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
        <span className="muted small">{drivers.length} livreur(s) · {live.length} position(s) GPS actives</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Livreur</th><th>Véhicule</th><th>KYC</th><th>Statut</th><th>Note</th><th>Courses</th><th></th></tr></thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.userId}>
                <td><b>{d.user.fullName || '—'}</b><br /><span className="muted small mono">{d.user.phone}</span></td>
                <td>{VEHICLE[d.vehicleType] ?? d.vehicleType}<br /><span className="mono small muted">{d.vehiclePlate ?? ''}</span></td>
                <td>{kycBadge(d.kycStatus)}</td>
                <td>
                  {d.user.status === 'SUSPENDED' && <span className="badge red">Suspendu</span>}
                  {d.user.status !== 'SUSPENDED' && (d.isOnline ? <span className="badge green">🟢 En ligne</span> : <span className="badge grey">Hors ligne</span>)}
                </td>
                <td>★ {Number(d.ratingAvg).toFixed(1)} <span className="muted small">({d.ratingCount})</span></td>
                <td><b>{d.totalDeliveries}</b></td>
                <td className="actions">
                  {d.kycStatus === 'PENDING' && <button className="btn sm leaf" onClick={() => approve(d)}>✅ Approuver</button>}
                  {d.kycStatus !== 'REJECTED' && <button className="btn sm danger" onClick={() => suspend(d)}>Suspendre</button>}
                </td>
              </tr>
            ))}
            {drivers.length === 0 && <tr><td colSpan={7} className="muted pad center">Aucun livreur pour ce filtre</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="section-title">🟢 Positions GPS en direct (actualisation 10 s)</div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Livreur</th><th>Véhicule</th><th>Latitude</th><th>Longitude</th><th>Mise à jour</th></tr></thead>
          <tbody>
            {live.map((l) => (
              <tr key={l.userId}>
                <td><b>{l.user.fullName || '—'}</b><br /><span className="mono small muted">{l.userId.slice(0, 8)}…</span></td>
                <td>{VEHICLE[l.vehicleType] ?? l.vehicleType}</td>
                <td className="mono">{Number(l.currentLat).toFixed(5)}</td>
                <td className="mono">{Number(l.currentLng).toFixed(5)}</td>
                <td className="muted small">{shortDate(l.lastLocationAt)}</td>
              </tr>
            ))}
            {live.length === 0 && <tr><td colSpan={5} className="muted pad center">Aucun livreur en ligne — les positions apparaissent dès qu'un livreur passe 🟢 EN LIGNE</td></tr>}
          </tbody>
        </table></div>
      </div>
    </Shell>
  );
}
