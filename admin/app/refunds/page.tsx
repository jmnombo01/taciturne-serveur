'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api, fcfa, shortDate } from '../../lib/api';

// Contrats réels :
//  GET /admin/refunds?status=REQUESTED → Refund[] {id, amount, reason, status, createdAt,
//    payment{method, order{code, customerId}}}
//  GET /admin/payments?status=SUCCESS → Payment[] {id, method, status, amount, initiatedAt,
//    paidAt, order{code, customerId}}
//  POST /admin/payments/:id/refund {amount, reason} → crée une demande REQUESTED
//  POST /admin/refunds/:id/approve | /reject → traitement (provider / wallet côté serveur)
type RefundReq = {
  id: string; amount: number; reason: string; status: string; createdAt: string;
  payment: { method: string; order: { code: string; customerId: string } };
};
type Payment = {
  id: string; method: string; status: string; amount: number; initiatedAt: string; paidAt: string | null;
  order: { code: string; customerId: string };
};

const METHOD: Record<string, string> = {
  CASH: '💵 Espèces', ORANGE_MONEY: '🟠 Orange Money', MOOV_MONEY: '🔵 Moov Money',
  WAVE: '🌊 Wave', CARD: '💳 Carte', WALLET: '👛 Wallet',
};

export default function RefundsPage() {
  const [requests, setRequests] = useState<RefundReq[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      api<RefundReq[]>('/admin/refunds?status=REQUESTED'),
      api<Payment[]>('/admin/payments?status=SUCCESS'),
    ]);
    setRequests(r); setPayments(p);
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  async function decide(r: RefundReq, approve: boolean) {
    if (!approve && !confirm(`Rejeter la demande de ${fcfa(r.amount)} (${r.payment.order.code}) ?`)) return;
    try {
      await api(`/admin/refunds/${r.id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' });
      load();
    } catch (e) { alert((e as Error).message); }
  }

  async function requestRefund(p: Payment) {
    const amountStr = prompt(`Montant à rembourser (≤ ${fcfa(p.amount)}) :`, String(p.amount));
    if (!amountStr) return;
    const amount = parseInt(amountStr.replace(/\D/g, ''), 10);
    if (!amount || amount > p.amount) { alert('Montant invalide'); return; }
    const reason = prompt('Motif du remboursement :');
    if (!reason) return;
    try {
      // Crée une DEMANDE (REQUESTED) — un second admin la traite dans la file au-dessus.
      // Le serveur borne le montant au reste réellement remboursable (zéro confiance).
      await api(`/admin/payments/${p.id}/refund`, { method: 'POST', body: JSON.stringify({ amount, reason }) });
      alert('✅ Demande de remboursement créée (statut : en attente de traitement).');
      load();
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <Shell title="Remboursements" sub="Demandes à traiter + remboursements manuels — montants bornés côté serveur">
      <div className="section-title">📥 Demandes en attente de traitement ({requests.length})</div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Commande</th><th>Motif</th><th>Méthode</th><th>Montant</th><th>Demandé le</th><th></th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td><b className="mono small">{r.payment.order.code}</b><br /><span className="muted small mono">{r.payment.order.customerId.slice(0, 8)}…</span></td>
                <td className="small">{r.reason}</td>
                <td>{METHOD[r.payment.method] ?? r.payment.method}</td>
                <td><b>{fcfa(r.amount)}</b></td>
                <td className="muted small">{shortDate(r.createdAt)}</td>
                <td className="actions">
                  <button className="btn sm leaf" onClick={() => decide(r, true)}>✅ Approuver</button>
                  <button className="btn sm danger" onClick={() => decide(r, false)}>⛔ Rejeter</button>
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={6} className="muted pad center">Aucune demande en attente 🎉</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="section-title">💳 Paiements encaissés — créer une demande de remboursement</div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Commande</th><th>Méthode</th><th>Montant</th><th>Payé le</th><th></th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td><b className="mono small">{p.order.code}</b></td>
                <td>{METHOD[p.method] ?? p.method}</td>
                <td><b>{fcfa(p.amount)}</b></td>
                <td className="muted small">{shortDate(p.paidAt ?? p.initiatedAt)}</td>
                <td className="actions"><button className="btn sm ghost" onClick={() => requestRefund(p)}>↩ Rembourser</button></td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="muted pad center">Aucun paiement encaissé</td></tr>}
          </tbody>
        </table></div>
      </div>
      <p className="muted small">
        ⚖️ Circuit à quatre yeux : « Rembourser » crée une demande (REQUESTED) ; son approbation déclenche le
        remboursement réel — provider mobile money (Orange/Moov/Wave) ou recrédit du wallet client. Un paiement
        totalement remboursé repasse la commande en REFUNDED. Chaque étape est journalisée dans le journal d'audit.
      </p>
    </Shell>
  );
}
