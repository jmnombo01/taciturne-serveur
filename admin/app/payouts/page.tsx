'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api, fcfa, shortDate } from '../../lib/api';

// Contrats réels (V1.1) :
//  GET /admin/payouts/balances → Wallet[] {balance, user{id, fullName, phone, role}}
//  GET /admin/payouts?status=REQUESTED → Payout[] {id, amount, method, phone, status,
//    reference, note, createdAt, user{fullName, phone, role}}
//  POST /admin/payouts {userId, amount, method?, phone?, note?}
//  POST /admin/payouts/:id/pay | /reject {reason}
type Payee = { balance: number; user: { id: string; fullName: string; phone: string; role: string } };
type Payout = {
  id: string; amount: number; method: string; phone: string; status: string;
  reference: string; note: string | null; createdAt: string;
  user: { fullName: string; phone: string; role: string };
};

const METHOD: Record<string, string> = {
  ORANGE_MONEY: '🟠 Orange Money', MOOV_MONEY: '🔵 Moov Money', WAVE: '🌊 Wave', BANK: '🏦 Banque',
};

export default function PayoutsPage() {
  const [balances, setBalances] = useState<Payee[]>([]);
  const [pending, setPending] = useState<Payout[]>([]);
  const [done, setDone] = useState<Payout[]>([]);

  const load = useCallback(async () => {
    const [b, p, h] = await Promise.all([
      api<Payee[]>('/admin/payouts/balances'),
      api<Payout[]>('/admin/payouts?status=REQUESTED'),
      api<Payout[]>('/admin/payouts?status=PAID'),
    ]);
    setBalances(b); setPending(p); setDone(h);
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  async function createPayout(p: Payee) {
    if (p.balance <= 0) { alert('Solde nul ou négatif — rien à reverser.'); return; }
    const amountStr = prompt(`Montant du reversement à ${p.user.fullName} (solde : ${fcfa(p.balance)}) :`, String(p.balance));
    if (!amountStr) return;
    const amount = parseInt(amountStr.replace(/\D/g, ''), 10);
    if (!amount || amount < 500) { alert('Montant invalide (minimum 500 FCFA).'); return; }
    const phone = prompt('Numéro de versement (vide = numéro du compte) :') || undefined;
    const note = prompt('Note interne (optionnelle) :') || undefined;
    try {
      await api('/admin/payouts', { method: 'POST', body: JSON.stringify({ userId: p.user.id, amount, phone, note }) });
      alert('✅ Reversement créé — le solde a été débité. Transférez les fonds puis marquez-le « Payé ».');
      load();
    } catch (e) { alert((e as Error).message); }
  }

  async function markPaid(p: Payout) {
    if (!confirm(`Confirmer le transfert de ${fcfa(p.amount)} vers ${p.user.fullName} (${p.phone}) ?`)) return;
    try {
      await api(`/admin/payouts/${p.id}/pay`, { method: 'POST' });
      load();
    } catch (e) { alert((e as Error).message); }
  }

  async function reject(p: Payout) {
    const reason = prompt(`Motif du rejet (${fcfa(p.amount)} seront re-crédités à ${p.user.fullName}) :`);
    if (reason === null) return;
    try {
      await api(`/admin/payouts/${p.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      load();
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <Shell title="Reversements" sub="Paie partenaires & livreurs — le solde est débité à la création, re-crédité en cas de rejet">
      <div className="section-title">⏳ File de paie — à transférer ({pending.length})</div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Bénéficiaire</th><th>Méthode</th><th>Numéro</th><th>Montant</th><th>Référence</th><th>Créé le</th><th></th></tr></thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.id}>
                <td><b>{p.user.fullName}</b><br /><span className="muted small">{p.user.role === 'PARTNER' ? '🏪 Partenaire' : '🛵 Livreur'}</span></td>
                <td>{METHOD[p.method] ?? p.method}</td>
                <td className="mono small">{p.phone}</td>
                <td><b>{fcfa(p.amount)}</b></td>
                <td className="mono small muted">{p.reference}</td>
                <td className="muted small">{shortDate(p.createdAt)}</td>
                <td className="actions">
                  <button className="btn sm leaf" onClick={() => markPaid(p)}>✅ Marquer payé</button>
                  <button className="btn sm danger" onClick={() => reject(p)}>⛔ Rejeter</button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && <tr><td colSpan={7} className="muted pad center">Aucun reversement en attente 🎉</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="section-title">💰 Soldes à reverser — partenaires & livreurs</div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Bénéficiaire</th><th>Téléphone</th><th>Solde</th><th></th></tr></thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.user.id}>
                <td><b>{b.user.fullName}</b><br /><span className="muted small">{b.user.role === 'PARTNER' ? '🏪 Partenaire' : '🛵 Livreur'}</span></td>
                <td className="mono small">{b.user.phone}</td>
                <td><b style={{ color: b.balance < 0 ? 'var(--danger, #B3402E)' : undefined }}>{fcfa(b.balance)}</b>
                  {b.balance < 0 && <span className="muted small"> (dette cash)</span>}</td>
                <td className="actions">
                  <button className="btn sm" onClick={() => createPayout(b)} disabled={b.balance <= 0}>💸 Reverser</button>
                </td>
              </tr>
            ))}
            {balances.length === 0 && <tr><td colSpan={4} className="muted pad center">Aucun solde partenaire/livreur</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="section-title">🧾 Derniers reversements effectués</div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Bénéficiaire</th><th>Méthode</th><th>Montant</th><th>Référence</th><th>Payé le</th></tr></thead>
          <tbody>
            {done.slice(0, 20).map((p) => (
              <tr key={p.id}>
                <td><b>{p.user.fullName}</b></td>
                <td>{METHOD[p.method] ?? p.method}</td>
                <td><b>{fcfa(p.amount)}</b></td>
                <td className="mono small muted">{p.reference}</td>
                <td className="muted small">{shortDate(p.createdAt)}</td>
              </tr>
            ))}
            {done.length === 0 && <tr><td colSpan={5} className="muted pad center">Aucun reversement effectué</td></tr>}
          </tbody>
        </table></div>
      </div>
      <p className="muted small">
        ⚖️ Zéro confiance : le montant est vérifié et débité côté serveur (solde insuffisant → refus),
        l'API est idempotente par référence (double-clic = une seule demande), et chaque action est
        journalisée dans le journal d'audit. Le solde livreur négatif = cash collecté à reverser à la plateforme.
      </p>
    </Shell>
  );
}
