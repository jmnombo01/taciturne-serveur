'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fcfa, shortDate } from '@/lib/api';

export default function DashboardPage() {
  const [dash, setDash] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [live, setLive] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, s, l] = await Promise.all([
        api('/admin/dashboard'),
        api('/admin/stats'),
        api('/admin/drivers/live'),
      ]);
      setDash(d);
      setStats(s);
      setLive(l);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // monitoring quasi temps réel
    return () => clearInterval(t);
  }, [load]);

  const kpis: [string, string, string?, string?][] = [
    ['Commandes aujourd’hui', `${dash?.commandesAujourdhui ?? '…'}`, '', ''],
    ['CA plateforme (livré)', fcfa(dash?.caPlateforme), 'accent', ''],
    ['Livreurs actifs', `${dash?.livreursActifs ?? '…'}`, '', ''],
    ['Commerces actifs', `${dash?.commercesActifs ?? '…'}`, 'leaf', ''],
    ['Clients actifs', `${dash?.clientsActifs ?? '…'}`, '', ''],
  ];

  const daily = (stats?.daily ?? []) as any[];
  const maxRevenue = Math.max(1, ...daily.map((d) => Number(d.revenue) || 0));

  return (
    <Shell title="Tableau de bord" sub="Vue temps réel de la plateforme — actualisation toutes les 15 s">
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="kpi-grid">
        {kpis.map(([label, value, cls]) => (
          <div key={label} className={`kpi ${cls ?? ''}`}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">Revenus des 7 derniers jours</div>
          <div className="chart-wrap">
            {daily.length === 0 && <p className="muted">Aucune donnée — les livraisons apparaîtront ici.</p>}
            {daily.map((d) => (
              <div key={d.day} className="bar" style={{ height: `${Math.max(4, ((Number(d.revenue) || 0) / maxRevenue) * 120)}px` }}>
                <span>{d.orders}</span>
                <small>{d.day.slice(5)}</small>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 22, fontSize: 11.5 }}>
            Chiffre au-dessus des barres = nombre de commandes.
          </p>
        </div>

        <div className="card">
          <div className="section-title">🛵 Livreurs en ligne ({live.length})</div>
          <table>
            <thead>
              <tr><th>Livreur</th><th>Véhicule</th><th>Dernière position</th></tr>
            </thead>
            <tbody>
              {live.length === 0 && <tr><td colSpan={3} className="muted">Aucun livreur en ligne</td></tr>}
              {live.map((d) => (
                <tr key={d.userId}>
                  <td>{d.user?.fullName ?? '—'}</td>
                  <td>{d.vehicleType}</td>
                  <td className="muted">{shortDate(d.lastLocationAt)} · {Number(d.currentLat).toFixed(4)}, {Number(d.currentLng).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-title">🏆 Top commerces (CA cumulé)</div>
        <table>
          <thead><tr><th>Commerce ID</th><th>Commandes livrées</th><th>Chiffre d’affaires</th></tr></thead>
          <tbody>
            {(stats?.topStores ?? []).length === 0 && <tr><td colSpan={3} className="muted">—</td></tr>}
            {(stats?.topStores ?? []).map((s: any) => (
              <tr key={s.storeId}>
                <td className="muted">{String(s.storeId).slice(0, 8)}…</td>
                <td>{s._count}</td>
                <td><b>{fcfa(s._sum?.subtotal)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
