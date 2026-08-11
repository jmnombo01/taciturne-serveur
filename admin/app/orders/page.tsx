'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, badgeClass, fcfa, shortDate, statusLabel } from '@/lib/api';

const FILTERS = ['', 'PARTNER_PENDING', 'PREPARING', 'READY', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (cursor?: string) => {
    try {
      const q = `/admin/orders?${status ? `status=${status}&` : ''}${cursor ? `cursor=${cursor}` : ''}`;
      const res = await api(q);
      setOrders((prev) => (cursor ? [...prev, ...res.data] : res.data));
      setNextCursor(res.nextCursor);
    } catch (e: any) {
      setError(e.message);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(id: string) {
    const d = await api(`/admin/orders/${id}`);
    setDetail(d);
  }

  async function cancel(id: string) {
    const reason = window.prompt('Motif de l’annulation (visible par les équipes) :');
    if (!reason) return;
    try {
      await api(`/admin/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
      setToast('Commande annulée' + ' — remboursement déclenché si payée');
      setDetail(null);
      load();
    } catch (e: any) {
      setToast(e.message);
    }
  }

  return (
    <Shell title="Commandes" sub="Suivi de toutes les commandes de la plateforme">
      {toast && <div className="toast" onAnimationEnd={() => setToast('')}>{toast}</div>}
      <div className="chips">
        {FILTERS.map((s) => (
          <button key={s || 'all'} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
            {s === '' ? 'Toutes' : statusLabel[s]}
          </button>
        ))}
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Code</th><th>Client</th><th>Commerce</th><th>Total</th><th>Paiement</th><th>Statut</th><th>Créée</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o.id)}>
                <td><b>{o.code}</b></td>
                <td>{o.customer?.user?.fullName || o.customer?.user?.phone}</td>
                <td>{o.store?.name ?? '—'}</td>
                <td>{fcfa(o.totalAmount)}</td>
                <td className="muted">{o.payment?.method} · {o.payment?.status}</td>
                <td><span className={`badge ${badgeClass(o.status)}`}>{statusLabel[o.status] ?? o.status}</span></td>
                <td className="muted">{shortDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {nextCursor && (
          <div style={{ padding: 12 }}>
            <button className="btn ghost" onClick={() => load(nextCursor)}>Charger plus</button>
          </div>
        )}
      </div>

      {detail && (
        <>
          <div className="drawer-mask" onClick={() => setDetail(null)} />
          <aside className="drawer">
            <h3>{detail.code}</h3>
            <p className="muted">{detail.store?.name} · {fcfa(detail.totalAmount)}</p>
            <p><span className={`badge ${badgeClass(detail.status)}`}>{statusLabel[detail.status]}</span></p>

            <div className="section-title">Client</div>
            <div className="kv"><span className="k">Nom</span><span>{detail.customer?.user?.fullName}</span></div>
            <div className="kv"><span className="k">Téléphone</span><span>{detail.customer?.user?.phone}</span></div>
            <div className="kv"><span className="k">Adresse</span><span style={{ textAlign: 'right', maxWidth: 240 }}>{detail.deliveryAddress} {detail.deliveryDetails ? `· ${detail.deliveryDetails}` : ''}</span></div>

            <div className="section-title">Articles</div>
            {(detail.items ?? []).map((i: any) => (
              <div className="kv" key={i.id}><span>{i.quantity}× {i.name}</span><span>{fcfa(i.subtotal)}</span></div>
            ))}

            <div className="section-title">Montants</div>
            <div className="kv"><span className="k">Sous-total</span><span>{fcfa(detail.subtotal)}</span></div>
            <div className="kv"><span className="k">Livraison</span><span>{fcfa(detail.deliveryFee)}</span></div>
            <div className="kv"><span className="k">Service</span><span>{fcfa(detail.serviceFee)}</span></div>
            <div className="kv"><span className="k">Commission ({Number(detail.commissionRate)}%)</span><span>{fcfa(detail.commissionAmount)}</span></div>
            <div className="kv"><span className="k"><b>Total</b></span><span><b>{fcfa(detail.totalAmount)}</b></span></div>

            <div className="section-title">Livreur</div>
            {detail.delivery?.driver ? (
              <div className="kv"><span>{detail.delivery.driver.user?.fullName}</span><span className="muted">{detail.delivery.driver.user?.phone}</span></div>
            ) : <p className="muted">Aucun livreur assigné</p>}

            <div className="section-title">Historique du statut</div>
            {(detail.statusHistory ?? []).map((h: any) => (
              <div className="kv" key={h.id}>
                <span>{statusLabel[h.toStatus] ?? h.toStatus}</span>
                <span className="muted">{shortDate(h.createdAt)} · {h.changedByRole ?? 'SYSTEM'}</span>
              </div>
            ))}

            {!['DELIVERED', 'REFUNDED', 'CANCELLED'].includes(detail.status) && (
              <div style={{ marginTop: 20 }}>
                <button className="btn danger" onClick={() => cancel(detail.id)}>Annuler la commande</button>
              </div>
            )}
          </aside>
        </>
      )}
    </Shell>
  );
}
