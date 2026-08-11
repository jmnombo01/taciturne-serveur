'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api, shortDate } from '../../lib/api';

// Contrat réel : GET /admin/partners?kyc= → PartnerProfile[] {userId, businessName,
// kycStatus, commissionRate (Decimal|null → taux plateforme), user{phone, fullName, status, createdAt},
// stores[{id, name, isActive}]}
type Partner = {
  userId: string; businessName: string; registrationNumber: string | null;
  kycStatus: string; commissionRate: string | number | null; payoutPhone: string | null;
  createdAt: string;
  user: { phone: string; fullName: string; status: string; createdAt: string };
  stores: { id: string; name: string; isActive: boolean }[];
};

const FILTERS = [
  { id: '', label: 'Tous' },
  { id: 'PENDING', label: '⏳ KYC en attente' },
  { id: 'APPROVED', label: '✅ Approuvés' },
  { id: 'REJECTED', label: '⛔ Rejetés' },
  { id: 'NOT_SUBMITTED', label: '📄 Non soumis' },
];

export default function PartnersPage() {
  const [filter, setFilter] = useState('');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [detail, setDetail] = useState<Partner | null>(null);
  const [rate, setRate] = useState('');

  const load = useCallback(async () => {
    setPartners(await api<Partner[]>(`/admin/partners${filter ? `?kyc=${filter}` : ''}`));
  }, [filter]);
  useEffect(() => { load().catch(() => {}); }, [load]);

  const kycBadge = (k: string) => <span className={`badge ${k === 'APPROVED' ? 'green' : k === 'PENDING' ? 'gold' : k === 'REJECTED' ? 'red' : 'grey'}`}>{k === 'APPROVED' ? 'Approuvé' : k === 'PENDING' ? 'En attente' : k === 'REJECTED' ? 'Rejeté' : 'Non soumis'}</span>;
  const rateLabel = (r: Partner['commissionRate']) => (r === null || r === undefined ? 'Défaut plateforme' : `${Number(r)} %`);

  async function approve(p: Partner) {
    try { await api(`/admin/partners/${p.userId}/approve`, { method: 'POST' }); setDetail(null); load(); } catch (e) { alert((e as Error).message); }
  }
  async function reject(p: Partner) {
    const reason = prompt(`Motif de rejet du dossier de ${p.businessName} :`);
    if (!reason) return;
    try { await api(`/admin/partners/${p.userId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); setDetail(null); load(); } catch (e) { alert((e as Error).message); }
  }
  async function saveRate(p: Partner) {
    const v = parseFloat(rate.replace(',', '.'));
    // Le DTO serveur borne à 0–50 — on valide pareil ici, mais le serveur reste l'autorité
    if (isNaN(v) || v < 0 || v > 50) { alert('Taux invalide (0–50, en %)'); return; }
    try { await api(`/admin/partners/${p.userId}/commission`, { method: 'PATCH', body: JSON.stringify({ rate: v }) }); setDetail(null); load(); } catch (e) { alert((e as Error).message); }
  }

  return (
    <Shell title="Partenaires" sub="Validation KYC des commerces et taux de commission">
      <div className="row">
        <div className="chips">{FILTERS.map((f) => <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
        <span className="muted small">{partners.length} partenaire(s)</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Commerce</th><th>Gérant</th><th>KYC</th><th>Commission</th><th>Boutiques</th><th>Inscrit le</th><th></th></tr></thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.userId}>
                <td><b>{p.businessName}</b><br /><span className="muted small">{p.registrationNumber ?? ''}</span></td>
                <td>{p.user.fullName || '—'}<br /><span className="mono small muted">{p.user.phone}</span></td>
                <td>{kycBadge(p.kycStatus)} {p.user.status === 'SUSPENDED' && <span className="badge red">Suspendu</span>}</td>
                <td><b>{rateLabel(p.commissionRate)}</b></td>
                <td>{p.stores.length === 0 ? '—' : p.stores.map((s) => <span key={s.id} className={`badge ${s.isActive ? 'green' : 'grey'}`} style={{ marginRight: 4 }}>{s.name}</span>)}</td>
                <td className="muted small">{shortDate(p.createdAt)}</td>
                <td className="actions"><button className="btn sm ghost" onClick={() => { setDetail(p); setRate(p.commissionRate === null ? '' : String(Number(p.commissionRate))); }}>Gérer</button></td>
              </tr>
            ))}
            {partners.length === 0 && <tr><td colSpan={7} className="muted pad center">Aucun partenaire pour ce filtre</td></tr>}
          </tbody>
        </table></div>
      </div>

      {detail && (
        <div className="drawer-mask" onClick={() => setDetail(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div><h3>{detail.businessName}</h3><div className="muted small">{detail.user.fullName || '—'} · {detail.user.phone}</div></div>
              <button className="btn sm" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="kv"><span className="k">Dossier KYC</span>{kycBadge(detail.kycStatus)}</div>
              <div className="kv"><span className="k">RCCM / N° enregistrement</span><b>{detail.registrationNumber ?? '—'}</b></div>
              <div className="kv"><span className="k">Reversement (mobile money)</span><b className="mono small">{detail.payoutPhone ?? '—'}</b></div>
              <div className="kv"><span className="k">Boutiques</span><b>{detail.stores.map((s) => s.name).join(', ') || '—'}</b></div>
              <div className="kv"><span className="k">Inscrit le</span><b>{shortDate(detail.createdAt)}</b></div>

              {detail.kycStatus === 'PENDING' && (
                <div className="box">
                  <h4>Validation du dossier</h4>
                  <div className="btn-row">
                    <button className="btn leaf" onClick={() => approve(detail)}>✅ Approuver</button>
                    <button className="btn danger" onClick={() => reject(detail)}>⛔ Rejeter (motif demandé)</button>
                  </div>
                </div>
              )}

              <div className="box">
                <h4>Commission plateforme (%)</h4>
                <p className="muted small">
                  Actuel : <b>{rateLabel(detail.commissionRate)}</b> (0–50, borné par le serveur).
                  Vide = taux par défaut de la plateforme. Ce taux est relu en base à chaque commande —
                  jamais pris en confiance depuis une requête.
                </p>
                <div className="row">
                  <input className="input small-input" value={rate} placeholder="ex. 15" onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
                  <span className="muted">%</span>
                  <button className="btn leaf" disabled={rate.trim() === ''} onClick={() => saveRate(detail)}>💾 Enregistrer</button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </Shell>
  );
}
