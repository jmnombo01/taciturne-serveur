'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { api, fcfa, shortDate } from '../../lib/api';

type City = { id: string; name: string };
type Zone = { id: string; name: string; isActive: boolean; deliveryBaseFee: number; deliveryPerKmRate: number; serviceFee: number; minOrderAmount: number; city: City };
type Coupon = { id: string; code: string; type: string; value: number; maxDiscountAmount: number | null; minOrderAmount: number; usedCount: number; totalLimit: number | null; startAt: string; endAt: string; isActive: boolean };
type Sponso = { id: string; placement: string; status: string; pricePerDay: number; startAt: string; endAt: string; store: { name: string } };
type StoreOpt = { id: string; name: string };

const TABS = [
  { id: 'zones', label: '🗺 Zones & tarifs' },
  { id: 'coupons', label: '🎟 Coupons' },
  { id: 'sponsorships', label: '⭐ Sponsoring' },
];

export default function ConfigPage() {
  const [tab, setTab] = useState('zones');
  const [cities, setCities] = useState<City[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [sponsos, setSponsos] = useState<Sponso[]>([]);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [zoneForm, setZoneForm] = useState({ cityId: '', name: '', deliveryBaseFee: '500', deliveryPerKmRate: '100', serviceFee: '200', minOrderAmount: '0' });
  const [couponForm, setCouponForm] = useState({ code: '', type: 'PERCENTAGE', value: '', maxDiscountAmount: '', minOrderAmount: '', totalLimit: '', startAt: '', endAt: '' });
  const [sponsoForm, setSponsoForm] = useState({ storeId: '', placement: 'HOME_FEATURED', pricePerDay: '1000', startAt: '', endAt: '' });
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [zoneEdit, setZoneEdit] = useState({ deliveryBaseFee: '', deliveryPerKmRate: '', serviceFee: '', minOrderAmount: '' });

  const loadZones = useCallback(() => api<Zone[]>('/admin/zones').then(setZones).catch(() => {}), []);
  const loadCoupons = useCallback(() => api<Coupon[]>('/admin/coupons').then(setCoupons).catch(() => {}), []);
  const loadSponsos = useCallback(() => api<Sponso[]>('/admin/sponsorships').then(setSponsos).catch(() => {}), []);

  useEffect(() => {
    api<City[]>('/geo/cities').then(setCities).catch(() => {});
    // /admin/partners renvoie des PartnerProfile avec stores[] imbriquées → on aplatit
    api<{ businessName: string; stores: { id: string; name: string }[] }[]>('/admin/partners?kyc=APPROVED')
      .then((rows) => setStores(rows.flatMap((p) => p.stores.map((st) => ({ id: st.id, name: `${st.name} (${p.businessName})` })))))
      .catch(() => {});
  }, []);
  useEffect(() => { (tab === 'zones' ? loadZones : tab === 'coupons' ? loadCoupons : loadSponsos)(); }, [tab, loadZones, loadCoupons, loadSponsos]);

  async function createZone() {
    try {
      await api('/admin/zones', { method: 'POST', body: JSON.stringify({
        cityId: zoneForm.cityId, name: zoneForm.name.trim(),
        deliveryBaseFee: +zoneForm.deliveryBaseFee, deliveryPerKmRate: +zoneForm.deliveryPerKmRate,
        serviceFee: +zoneForm.serviceFee, minOrderAmount: +zoneForm.minOrderAmount || undefined,
      }) });
      setZoneForm({ ...zoneForm, name: '' }); loadZones();
    } catch (e) { alert((e as Error).message); }
  }
  async function toggleZone(z: Zone) {
    try { await api(`/admin/zones/${z.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !z.isActive }) }); loadZones(); } catch (e) { alert((e as Error).message); }
  }
  async function saveZoneEdit() {
    if (!editZone) return;
    try {
      await api(`/admin/zones/${editZone.id}`, { method: 'PATCH', body: JSON.stringify({
        deliveryBaseFee: +zoneEdit.deliveryBaseFee, deliveryPerKmRate: +zoneEdit.deliveryPerKmRate,
        serviceFee: +zoneEdit.serviceFee, minOrderAmount: +zoneEdit.minOrderAmount,
      }) });
      setEditZone(null); loadZones();
    } catch (e) { alert((e as Error).message); }
  }
  async function createCoupon() {
    try {
      await api('/admin/coupons', { method: 'POST', body: JSON.stringify({
        code: couponForm.code.trim().toUpperCase(), type: couponForm.type, value: +couponForm.value,
        maxDiscountAmount: couponForm.maxDiscountAmount ? +couponForm.maxDiscountAmount : undefined,
        minOrderAmount: couponForm.minOrderAmount ? +couponForm.minOrderAmount : undefined,
        totalLimit: couponForm.totalLimit ? +couponForm.totalLimit : undefined,
        startAt: new Date(couponForm.startAt).toISOString(), endAt: new Date(couponForm.endAt).toISOString(),
      }) });
      setCouponForm({ ...couponForm, code: '', value: '' }); loadCoupons();
    } catch (e) { alert((e as Error).message); }
  }
  async function toggleCoupon(c: Coupon) {
    try { await api(`/admin/coupons/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) }); loadCoupons(); } catch (e) { alert((e as Error).message); }
  }
  async function createSponso() {
    try {
      await api('/admin/sponsorships', { method: 'POST', body: JSON.stringify({
        storeId: sponsoForm.storeId, placement: sponsoForm.placement, pricePerDay: +sponsoForm.pricePerDay,
        startAt: new Date(sponsoForm.startAt).toISOString(), endAt: new Date(sponsoForm.endAt).toISOString(),
      }) });
      setSponsoForm({ ...sponsoForm, storeId: '' }); loadSponsos();
    } catch (e) { alert((e as Error).message); }
  }
  async function setSponsoStatus(s: Sponso, status: string) {
    try { await api(`/admin/sponsorships/${s.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); loadSponsos(); } catch (e) { alert((e as Error).message); }
  }

  const couponTypeLabel = (t: string) => t === 'PERCENTAGE' ? '% pourcentage' : t === 'FIXED_AMOUNT' ? 'FCFA fixes' : '🚚 livraison offerte';
  const sponsoBadge = (s: string) => <span className={`badge ${s === 'ACTIVE' ? 'green' : s === 'PAUSED' ? 'gold' : 'red'}`}>{s === 'ACTIVE' ? 'Active' : s === 'PAUSED' ? 'En pause' : s === 'EXPIRED' ? 'Expirée' : s}</span>;

  return (
    <Shell title="Configuration">
      <div className="chips">{TABS.map((t) => <button key={t.id} className={`chip ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>

      {tab === 'zones' && (
        <>
          <div className="card box-form">
            <h4>➕ Nouvelle zone</h4>
            <div className="form-grid">
              <label>Ville
                <select className="input" value={zoneForm.cityId} onChange={(e) => setZoneForm({ ...zoneForm, cityId: e.target.value })}>
                  <option value="">— choisir —</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>Nom de la zone<input className="input" placeholder="ex. Tampouy" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} /></label>
              <label>Livraison — base (FCFA)<input className="input" inputMode="numeric" value={zoneForm.deliveryBaseFee} onChange={(e) => setZoneForm({ ...zoneForm, deliveryBaseFee: e.target.value })} /></label>
              <label>Livraison — par km (FCFA)<input className="input" inputMode="numeric" value={zoneForm.deliveryPerKmRate} onChange={(e) => setZoneForm({ ...zoneForm, deliveryPerKmRate: e.target.value })} /></label>
              <label>Frais de service (FCFA)<input className="input" inputMode="numeric" value={zoneForm.serviceFee} onChange={(e) => setZoneForm({ ...zoneForm, serviceFee: e.target.value })} /></label>
              <label>Commande min. (FCFA)<input className="input" inputMode="numeric" value={zoneForm.minOrderAmount} onChange={(e) => setZoneForm({ ...zoneForm, minOrderAmount: e.target.value })} /></label>
            </div>
            <button className="btn leaf" disabled={!zoneForm.cityId || zoneForm.name.trim().length < 2} onClick={createZone}>Créer la zone</button>
          </div>

          <div className="card">
            <div className="table-wrap"><table>
              <thead><tr><th>Zone</th><th>Ville</th><th>Base</th><th>Par km</th><th>Service</th><th>Cmd min.</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td><strong>{z.name}</strong></td>
                    <td>{z.city?.name}</td>
                    <td>{fcfa(z.deliveryBaseFee)}</td>
                    <td>{fcfa(z.deliveryPerKmRate)}</td>
                    <td>{fcfa(z.serviceFee)}</td>
                    <td>{z.minOrderAmount ? fcfa(z.minOrderAmount) : '—'}</td>
                    <td>{z.isActive ? <span className="badge green">Active</span> : <span className="badge grey">Inactive</span>}</td>
                    <td className="actions">
                      <button className="btn" onClick={() => { setEditZone(z); setZoneEdit({ deliveryBaseFee: String(z.deliveryBaseFee), deliveryPerKmRate: String(z.deliveryPerKmRate), serviceFee: String(z.serviceFee), minOrderAmount: String(z.minOrderAmount) }); }}>✏️ Tarifs</button>
                      <button className="btn" onClick={() => toggleZone(z)}>{z.isActive ? 'Désactiver' : 'Activer'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {tab === 'coupons' && (
        <>
          <div className="card box-form">
            <h4>➕ Nouveau coupon</h4>
            <div className="form-grid">
              <label>Code<input className="input" placeholder="ex. BIENVENUE-TD" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} /></label>
              <label>Type
                <select className="input" value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}>
                  <option value="PERCENTAGE">Pourcentage (%)</option>
                  <option value="FIXED_AMOUNT">Montant fixe (FCFA)</option>
                  <option value="FREE_DELIVERY">Livraison offerte</option>
                </select>
              </label>
              <label>Valeur {couponForm.type === 'PERCENTAGE' ? '(%)' : '(FCFA)'}<input className="input" inputMode="numeric" placeholder={couponForm.type === 'PERCENTAGE' ? 'ex. 10' : 'ex. 500'} value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} /></label>
              <label>Plafond remise (FCFA, optionnel)<input className="input" inputMode="numeric" value={couponForm.maxDiscountAmount} onChange={(e) => setCouponForm({ ...couponForm, maxDiscountAmount: e.target.value })} /></label>
              <label>Commande min. (FCFA)<input className="input" inputMode="numeric" value={couponForm.minOrderAmount} onChange={(e) => setCouponForm({ ...couponForm, minOrderAmount: e.target.value })} /></label>
              <label>Nb utilisations max (optionnel)<input className="input" inputMode="numeric" value={couponForm.totalLimit} onChange={(e) => setCouponForm({ ...couponForm, totalLimit: e.target.value })} /></label>
              <label>Début<input className="input" type="datetime-local" value={couponForm.startAt} onChange={(e) => setCouponForm({ ...couponForm, startAt: e.target.value })} /></label>
              <label>Fin<input className="input" type="datetime-local" value={couponForm.endAt} onChange={(e) => setCouponForm({ ...couponForm, endAt: e.target.value })} /></label>
            </div>
            <button className="btn leaf" disabled={couponForm.code.trim().length < 3 || !couponForm.value || !couponForm.startAt || !couponForm.endAt} onClick={createCoupon}>Créer le coupon</button>
          </div>

          <div className="card">
            <div className="table-wrap"><table>
              <thead><tr><th>Code</th><th>Type</th><th>Valeur</th><th>Utilisations</th><th>Période</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td><strong className="mono">{c.code}</strong></td>
                    <td className="small">{couponTypeLabel(c.type)}</td>
                    <td><strong>{c.type === 'PERCENTAGE' ? `${c.value} %` : c.type === 'FIXED_AMOUNT' ? fcfa(c.value) : '—'}</strong></td>
                    <td>{c.usedCount}{c.totalLimit ? ` / ${c.totalLimit}` : ''}</td>
                    <td className="muted small">{shortDate(c.startAt)} → {shortDate(c.endAt)}</td>
                    <td>{c.isActive ? <span className="badge green">Actif</span> : <span className="badge grey">Inactif</span>}</td>
                    <td className="actions"><button className="btn" onClick={() => toggleCoupon(c)}>{c.isActive ? 'Désactiver' : 'Activer'}</button></td>
                  </tr>
                ))}
                {coupons.length === 0 && <tr><td colSpan={7} className="muted pad center">Aucun coupon</td></tr>}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {tab === 'sponsorships' && (
        <>
          <div className="card box-form">
            <h4>➕ Nouveau sponsor ⭐</h4>
            <div className="form-grid">
              <label>Commerce
                <select className="input" value={sponsoForm.storeId} onChange={(e) => setSponsoForm({ ...sponsoForm, storeId: e.target.value })}>
                  <option value="">— choisir —</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>Emplacement
                <select className="input" value={sponsoForm.placement} onChange={(e) => setSponsoForm({ ...sponsoForm, placement: e.target.value })}>
                  <option value="HOME_FEATURED">🏠 Accueil — vedette</option>
                  <option value="SEARCH_TOP">🔍 Recherche — en tête</option>
                  <option value="CATEGORY_TOP">🏷 Catégorie — en tête</option>
                </select>
              </label>
              <label>Prix / jour (FCFA)<input className="input" inputMode="numeric" value={sponsoForm.pricePerDay} onChange={(e) => setSponsoForm({ ...sponsoForm, pricePerDay: e.target.value })} /></label>
              <label>Début<input className="input" type="datetime-local" value={sponsoForm.startAt} onChange={(e) => setSponsoForm({ ...sponsoForm, startAt: e.target.value })} /></label>
              <label>Fin<input className="input" type="datetime-local" value={sponsoForm.endAt} onChange={(e) => setSponsoForm({ ...sponsoForm, endAt: e.target.value })} /></label>
            </div>
            <button className="btn leaf" disabled={!sponsoForm.storeId || !sponsoForm.startAt || !sponsoForm.endAt} onClick={createSponso}>Créer le sponsoring</button>
          </div>

          <div className="card">
            <div className="table-wrap"><table>
              <thead><tr><th>Commerce</th><th>Emplacement</th><th>Prix/jour</th><th>Période</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {sponsos.map((s) => (
                  <tr key={s.id}>
                    <td><strong>⭐ {s.store?.name}</strong></td>
                    <td className="small">{s.placement === 'HOME_FEATURED' ? '🏠 Accueil' : s.placement === 'SEARCH_TOP' ? '🔍 Recherche' : '🏷 Catégorie'}</td>
                    <td>{fcfa(s.pricePerDay)}</td>
                    <td className="muted small">{shortDate(s.startAt)} → {shortDate(s.endAt)}</td>
                    <td>{sponsoBadge(s.status)}</td>
                    <td className="actions">
                      {s.status !== 'ACTIVE' && <button className="btn leaf" onClick={() => setSponsoStatus(s, 'ACTIVE')}>Activer</button>}
                      {s.status === 'ACTIVE' && <button className="btn" onClick={() => setSponsoStatus(s, 'PAUSED')}>Pause</button>}
                      <button className="btn danger" onClick={() => setSponsoStatus(s, 'REJECTED')}>Rejeter</button>
                    </td>
                  </tr>
                ))}
                {sponsos.length === 0 && <tr><td colSpan={6} className="muted pad center">Aucun sponsoring — les commerces ⭐ apparaissent en premier côté client</td></tr>}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {editZone && (
        <div className="drawer-mask" onClick={() => setEditZone(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div><strong>✏️ Tarifs — {editZone.name}</strong><div className="muted small">{editZone.city?.name}</div></div>
              <button className="btn" onClick={() => setEditZone(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <p className="muted small">Ces tarifs sont appliqués par le moteur de prix côté serveur à chaque devis — visibles immédiatement dans l'app client.</p>
              <label>Livraison — base (FCFA)<input className="input" inputMode="numeric" value={zoneEdit.deliveryBaseFee} onChange={(e) => setZoneEdit({ ...zoneEdit, deliveryBaseFee: e.target.value })} /></label>
              <label>Livraison — par km (FCFA)<input className="input" inputMode="numeric" value={zoneEdit.deliveryPerKmRate} onChange={(e) => setZoneEdit({ ...zoneEdit, deliveryPerKmRate: e.target.value })} /></label>
              <label>Frais de service (FCFA)<input className="input" inputMode="numeric" value={zoneEdit.serviceFee} onChange={(e) => setZoneEdit({ ...zoneEdit, serviceFee: e.target.value })} /></label>
              <label>Commande min. (FCFA)<input className="input" inputMode="numeric" value={zoneEdit.minOrderAmount} onChange={(e) => setZoneEdit({ ...zoneEdit, minOrderAmount: e.target.value })} /></label>
              <button className="btn leaf" onClick={saveZoneEdit}>💾 Enregistrer (journalisé)</button>
            </div>
          </aside>
        </div>
      )}
    </Shell>
  );
}
