/**
 * Taciturne Delivery — flux de DÉMO jouable (client → partenaire → livreur).
 * Mêmes contrats que l'API réelle (zero-trust : montants recalculés ici).
 * État en mémoire, rejouable à volonté (redémarrage = reset).
 * Usage : import { registerFlowRoutes } from './flow.mjs'; registerFlowRoutes(routes);
 */
const h2km = (a, b, c, d) => {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const rnd4 = () => String(1000 + Math.floor(Math.random() * 9000));

const DEMO_OTP = '123456';
const sessions = new Map();                    // token -> userId
const flowUsers = new Map();                   // userId -> user
const phoneIdx = new Map();                    // phone -> userId
function userByPhone(phone) {
  if (phoneIdx.has(phone)) return { user: flowUsers.get(phoneIdx.get(phone)), isNew: false };
  const known = {
    '+22671000001': ['user-partner-fatim', 'Fatimata Ouedraogo', ['PARTNER']],
    '+22671000002': ['user-driver-boureima', 'Boureima Sawadogo', ['DRIVER']],
  }[phone];
  const [uid, name, roles] = known ?? [`user-cust-${phone.replace(/\D/g, '')}`, '', ['CUSTOMER']];
  const user = { id: uid, phone, fullName: name, roles, language: 'fr', createdAt: new Date().toISOString() };
  phoneIdx.set(phone, uid); flowUsers.set(uid, user);
  return { user, isNew: true };
}
const bearer = (h) => {
  const t = (h['authorization'] || '').replace(/^Bearer\s+/i, '');
  const uid = sessions.get(t);
  return uid ? flowUsers.get(uid) : null;
};
const UNAUTH = [401, { error: { code: 'UNAUTHORIZED', message: 'Session requise — reconnectez-vous.' } }];

function mkCatalog(defs) {
  const categories = defs.map(([id, name], i) => ({ id, name, sortOrder: i }));
  return {
    categories,
    products: defs.flatMap(([cid, , prods]) => prods.map(([name, desc, price, promoPrice], i) => ({
      id: `prod-${cid}-${i + 1}`, categoryId: cid, name, description: desc, price, promoPrice: promoPrice ?? null,
      isAvailable: true, trackInventory: false, stockQuantity: null,
    }))),
  };
}
const flowStores = {
  'store-fatim': {
    id: 'store-fatim', name: 'Chez Fatim', type: 'RESTAURANT', sector: 'RESTAURANT',
    address: 'Av. Kwame Nkrumah, Centre-ville', phone: '+22671000001', lat: 12.3720, lng: -1.5185,
    zoneName: 'Centre-ville', ratingAvg: 4.7, preparationTimeMin: 20, minOrderAmount: 0, sponsored: true,
    isOpen: true, acceptsOrders: true, ownerUserId: 'user-partner-fatim',
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: '00:00', closeTime: '23:59', isClosed: false })), // démo : ouvert 24/7
    catalog: mkCatalog([
      ['cat-plats', '🍛 Plats', [
        ['Riz gras poulet', 'Riz rouge au poulet fermier, légumes du marché', 1500, null],
        ['Tô sauce gombo', 'Tô de mil, sauce gombo fraîche + viande', 2000, 1500],
        ['Poulet bicyclette entier', 'Poulet bicyclette grillé au feu de bois', 2500, null],
        ['Riz sauce arachide', 'Sauce arachide maison, viande au choix', 1800, null],
      ]],
      ['cat-boissons', '🥤 Boissons', [
        ['Jus de bissap 50cl', 'Hibiscus glacé, fait maison', 500, 400],
        ['Jus de gingembre 50cl', 'Gingembre pressé du jour', 500, null],
        ['Eau minérale 1L', null, 500, null],
      ]],
    ]),
  },
  'store-pharma': {
    id: 'store-pharma', name: 'Pharmacie du Centre', type: 'PHARMACY', sector: 'PHARMACY',
    address: 'Bd Tansoba, Centre-ville', phone: '+22671000012', lat: 12.3680, lng: -1.5245,
    zoneName: 'Centre-ville', ratingAvg: 4.9, preparationTimeMin: 10, minOrderAmount: 0, sponsored: false,
    isOpen: true, acceptsOrders: true, ownerUserId: 'user-partner-pharma',
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: '00:00', closeTime: '23:59', isClosed: false })), // démo : ouvert 24/7
    catalog: mkCatalog([
      ['cat-medoc', '💊 Médicaments', [
        ['Paracétamol 500mg ×16', 'Boîte de 16 comprimés', 800, null],
        ['Vitamine C 1000mg', 'Tube de 20 comprimés effervescents', 1200, 950],
        ['Sérum physiologique', 'Unidoses ×10', 600, null],
      ]],
    ]),
  },
};
const getProd = (store, pid) => store.catalog.products.find((p) => p.id === pid);
const openState = (st) => {
  if (!st.isOpen) return { openNow: false, openingHint: 'Fermé par le commerçant' };
  if (!st.acceptsOrders) return { openNow: false, openingHint: 'Ne prend pas de commande' };
  const d = new Date(); // Africa/Ouagadougou = UTC
  const appDay = (d.getUTCDay() + 6) % 7; // 0=Lundi … 6=Dimanche
  const h = st.hours.find((x) => x.dayOfWeek === appDay) ?? st.hours[0];
  const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  if (h.isClosed) return { openNow: false, openingHint: 'Fermé aujourd\'hui' };
  if (hm < h.openTime) return { openNow: false, openingHint: `Ouvre à ${h.openTime}` };
  if (hm >= h.closeTime) return { openNow: false, openingHint: `Fermé — rouvre à ${h.openTime}` };
  return { openNow: true, openingHint: null };
};

const flowCarts = new Map();
const flowOrders = [];
const flowDeliveries = new Map();
const flowOffers = new Map();
const flowWallets = new Map([['user-partner-fatim', 84500], ['user-partner-pharma', 152300], ['user-driver-boureima', 12800]]);
const driverOnline = new Map();
const idemMap = new Map();
let flowSeq = 0;
const fid = (p) => `${p}-d${(++flowSeq).toString().padStart(4, '0')}`;
const pushHist = (o, to, role) => { o.statusHistory.push({ id: fid('hist'), fromStatus: o.status, toStatus: to, changedByRole: role, createdAt: new Date().toISOString() }); o.status = to; };
const flowAddresses = new Map();

function computeQuote(user, couponCode) {
  const cart = flowCarts.get(user.id);
  if (!cart || cart.items.length === 0) return [400, { error: { code: 'CART_EMPTY', message: 'Votre panier est vide.' } }];
  const st = flowStores[cart.storeId];
  const addr = (flowAddresses.get(user.id) ?? [])[0];
  const km = Math.max(1, Math.round(h2km(st.lat, st.lng, addr?.lat ?? 12.3714, addr?.lng ?? -1.5197) * 10) / 10);
  const items = cart.items.map((it) => {
    const p = getProd(st, it.productId);
    const unitPrice = p.promoPrice ?? p.price;
    return { id: it.id, productId: p.id, name: p.name, quantity: it.quantity, unitPrice, subtotal: unitPrice * it.quantity };
  });
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  if (st.minOrderAmount > 0 && subtotal < st.minOrderAmount) return [400, { error: { code: 'MIN_ORDER_NOT_REACHED', message: `Minimum de commande : ${st.minOrderAmount} FCFA` } }];
  const deliveryFee = 500 + Math.max(0, Math.ceil(km - 3)) * 100; // 500 F base (3 km offerts) + 100 F/km
  const serviceFee = 200;
  let discountAmount = 0;
  if (couponCode) {
    const code = couponCode.toUpperCase();
    if (code === 'BIENVENUE-TD' && subtotal >= 2000) discountAmount = Math.min(Math.round(subtotal * 0.10), 1000);
    else if (code === 'FATIM500' && subtotal >= 3000) discountAmount = 500;
    else return [400, { error: { code: 'COUPON_INVALID', message: code === 'BIENVENUE-TD' || code === 'FATIM500' ? 'Montant minimum non atteint pour ce coupon.' : 'Coupon inconnu.' } }];
  }
  return [200, { subtotal, deliveryFee, serviceFee, distanceKm: km, discountAmount, totalAmount: subtotal + deliveryFee + serviceFee - discountAmount, _st: st, _items: items }];
}
const orderView = (o, forPartner = false) => ({
  id: o.id, code: o.code, status: o.status, createdAt: o.createdAt,
  subtotal: o.subtotal, deliveryFee: o.deliveryFee, serviceFee: o.serviceFee,
  discountAmount: o.discountAmount, totalAmount: o.totalAmount,
  commissionAmount: o.commissionAmount, partnerPayoutAmount: o.partnerPayoutAmount,
  distanceKm: o.distanceKm, customerNote: o.customerNote,
  deliveryAddress: o.deliveryAddress, deliveryDetails: o.deliveryDetails,
  deliveryLat: o.deliveryLat, deliveryLng: o.deliveryLng,
  items: o.items,
  store: forPartner ? o.store : { id: o.store.id, name: o.store.name },
  customer: o.customer,
  statusHistory: o.statusHistory,
  payment: o.payment,
  review: o.review,
  delivery: (() => {
    const d = flowDeliveries.get(o.id);
    if (!d) return null;
    return {
      id: d.id, status: d.status,
      pickupCode: o.status === 'DELIVERED' ? null : d.pickupCode,
      driverEarning: d.driverEarning,
      deliveredAt: d.deliveredAt ?? null,
      driver: d.driver ? { userId: d.driver.userId, vehicleType: 'MOTO', vehiclePlate: 'BF-1234-A', user: d.driver.user } : null,
    };
  })(),
});

export const flowCtx = {}; // rempli en fin de fichier
export function registerFlowRoutes(routes) {
  Object.assign(routes, {
    'POST /v1/auth/otp/request': (b) => {
      if (!b.phone) return [400, { error: { code: 'PHONE_REQUIRED', message: 'Numéro requis' } }];
      return [200, { devCode: DEMO_OTP, ttlSec: 300, message: `Démo : le code est ${DEMO_OTP}` }];
    },
    'POST /v1/auth/otp/verify': (b) => {
      if (b.code !== DEMO_OTP) return [400, { error: { code: 'OTP_INVALID', message: `Code incorrect (démo : ${DEMO_OTP})` } }];
      const { user, isNew } = userByPhone(b.phone ?? '');
      const accessToken = `tda-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      sessions.set(accessToken, user.id);
      return [200, { accessToken, refreshToken: `tdr-${Math.random().toString(36).slice(2)}`, isNewUser: isNew }];
    },
    'GET /v1/me': (b, q, p, h) => { const u = bearer(h); return u ? [200, u] : UNAUTH; },
    'PATCH /v1/me': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      if (b.fullName != null) u.fullName = String(b.fullName);
      return [200, u];
    },
    'GET /v1/me/wallet': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      return [200, { id: `w-${u.id}`, balance: flowWallets.get(u.id) ?? 0, currency: 'XOF' }];
    },
    'GET /v1/me/addresses': (b, q, p, h) => { const u = bearer(h); return u ? [200, flowAddresses.get(u.id) ?? []] : UNAUTH; },
    'POST /v1/me/addresses': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const list = flowAddresses.get(u.id) ?? [];
      const a = { id: fid('addr'), label: b.label ?? 'Adresse', street: b.street ?? '', landmark: b.landmark ?? null, cityId: b.cityId ?? 'city-ouaga', lat: b.lat ?? 12.3714, lng: b.lng ?? -1.5197, isDefault: list.length === 0 };
      list.push(a); flowAddresses.set(u.id, list);
      return [201, a];
    },
    'GET /v1/stores/nearby': (b, q) => {
      const lat = parseFloat(q.lat ?? '12.3714'), lng = parseFloat(q.lng ?? '-1.5197');
      const rows = Object.values(flowStores)
        .filter((s) => !q.type || s.type === q.type)
        .map((s) => ({
          id: s.id, name: s.name, type: s.type, zoneName: s.zoneName, address: s.address,
          distanceKm: Math.round(h2km(lat, lng, s.lat, s.lng) * 10) / 10,
          preparationTimeMin: s.preparationTimeMin, minOrderAmount: s.minOrderAmount,
          ratingAvg: s.ratingAvg, sponsored: s.sponsored, ...openState(s),
        }))
        .sort((x, y) => (y.openNow - x.openNow) || (x.distanceKm - y.distanceKm));
      return [200, { data: rows }];
    },
    'GET /v1/stores/:id': (b, q, p) => {
      const st = flowStores[p.id];
      if (!st) return [404, { error: { code: 'STORE_NOT_FOUND', message: 'Commerce introuvable' } }];
      return [200, {
        id: st.id, name: st.name, type: st.type, address: st.address, phone: st.phone,
        lat: st.lat, lng: st.lng, zoneName: st.zoneName, ratingAvg: st.ratingAvg,
        preparationTimeMin: st.preparationTimeMin, minOrderAmount: st.minOrderAmount, ...openState(st),
        categories: st.catalog.categories.map((c) => ({
          id: c.id, name: c.name,
          products: st.catalog.products.filter((x) => x.categoryId === c.id && x.isAvailable !== false)
            .map((x) => ({ id: x.id, name: x.name, description: x.description, price: x.price, promoPrice: x.promoPrice, imageUrl: null })),
        })),
      }];
    },
    'GET /v1/cart': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const cart = flowCarts.get(u.id);
      if (!cart) return [200, { store: null, items: [] }];
      const st = flowStores[cart.storeId];
      return [200, { store: { id: st.id, name: st.name }, items: cart.items.map((it) => { const pr = getProd(st, it.productId); return { id: it.id, quantity: it.quantity, product: { id: pr.id, name: pr.name, price: pr.price, promoPrice: pr.promoPrice } }; }) }];
    },
    'POST /v1/cart/items': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => getProd(s, b.productId));
      if (!st) return [404, { error: { code: 'PRODUCT_NOT_FOUND', message: 'Produit introuvable' } }];
      let cart = flowCarts.get(u.id);
      if (cart && cart.storeId !== st.id && cart.items.length > 0) {
        if (b.confirmReplace !== true) return [409, { error: { code: 'CART_DIFFERENT_STORE', message: `Votre panier contient « ${flowStores[cart.storeId].name} ». Remplacer par « ${st.name} » ?` } }];
        cart = undefined;
      }
      if (!cart) { cart = { storeId: st.id, items: [] }; flowCarts.set(u.id, cart); }
      const ex = cart.items.find((i) => i.productId === b.productId);
      if (ex) ex.quantity += b.quantity ?? 1; else cart.items.push({ id: fid('ci'), productId: b.productId, quantity: b.quantity ?? 1 });
      return [201, { ok: true }];
    },
    'PATCH /v1/cart/items/:itemId': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const cart = flowCarts.get(u.id); if (!cart) return [404, { error: { message: 'Panier vide' } }];
      cart.items = cart.items.filter((i) => i.id !== p.itemId || (b.quantity ?? 0) > 0);
      const it = cart.items.find((i) => i.id === p.itemId);
      if (it) it.quantity = Math.max(1, b.quantity ?? it.quantity);
      if (cart.items.length === 0) flowCarts.delete(u.id);
      return [200, { ok: true }];
    },
    'DELETE /v1/cart/items/:itemId': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const cart = flowCarts.get(u.id);
      if (cart) { cart.items = cart.items.filter((i) => i.id !== p.itemId); if (cart.items.length === 0) flowCarts.delete(u.id); }
      return [200, { ok: true }];
    },
    'DELETE /v1/cart': (b, q, p, h) => { const u = bearer(h); if (!u) return UNAUTH; flowCarts.delete(u.id); return [200, { ok: true }]; },
    'POST /v1/orders/quote': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const r = computeQuote(u, b.couponCode);
      if (r[0] !== 200) return r;
      const { _st, _items, ...quote } = r[1];
      return [200, quote];
    },
    'POST /v1/orders': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const key = h['idempotency-key'];
      if (key && idemMap.has(key)) return idemMap.get(key);
      const st0 = flowCarts.get(u.id) ? flowStores[flowCarts.get(u.id).storeId] : null;
      if (st0 && !openState(st0).openNow) return [409, { error: { code: 'STORE_CLOSED', message: 'Le commerce est fermé pour le moment.' } }];
      const r = computeQuote(u, b.couponCode);
      if (r[0] !== 200) return r;
      const { _st: st, _items: items, ...qq } = r[1];
      const addr = (flowAddresses.get(u.id) ?? [])[0] ?? { street: 'Ouagadougou', landmark: null, lat: 12.3714, lng: -1.5197 };
      const commissionAmount = Math.round(qq.subtotal * 0.15);
      const order = {
        id: fid('order'), code: `TD-D${1000 + flowSeq}`, status: 'CREATED', createdAt: new Date().toISOString(),
        ...qq, commissionRate: 15, commissionAmount, partnerPayoutAmount: qq.subtotal - commissionAmount,
        items, customerNote: b.customerNote ?? null,
        deliveryAddress: addr.street, deliveryDetails: addr.landmark ? `${addr.label ?? ''} · ${addr.landmark}` : (addr.label ?? null),
        deliveryLat: addr.lat, deliveryLng: addr.lng,
        store: { id: st.id, name: st.name, address: st.address, phone: st.phone, lat: st.lat, lng: st.lng },
        customer: { userId: u.id, user: { fullName: u.fullName || 'Client démo', phone: u.phone } },
        statusHistory: [{ id: fid('hist'), fromStatus: null, toStatus: 'CREATED', changedByRole: 'CUSTOMER', createdAt: new Date().toISOString() }],
        review: null,
        payment: {
          id: fid('pay'), method: b.paymentMethod ?? 'CASH',
          status: (b.paymentMethod ?? 'CASH') === 'CASH' ? 'PENDING' : 'PROCESSING',
          amount: qq.totalAmount,
          instructions: (b.paymentMethod ?? 'CASH') === 'CASH' ? null : `Démo : validez ${qq.totalAmount} FCFA sur votre mobile (${b.paymentMethod}). Aucun débit réel.`,
        },
      };
      pushHist(order, 'PARTNER_PENDING', 'SYSTEM');
      flowOrders.unshift(order);
      flowDeliveries.set(order.id, { id: fid('del'), orderId: order.id, status: 'PENDING', pickupCode: rnd4(), driverEarning: qq.deliveryFee, driver: null, deliveredAt: null });
      flowCarts.delete(u.id);
      const res = [201, { order: orderView(order), payment: order.payment }];
      if (key) idemMap.set(key, [200, res[1]]);
      return res;
    },
    'GET /v1/orders': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      return [200, { data: flowOrders.filter((o) => o.customer.userId === u.id).map((o) => orderView(o)), nextCursor: null }];
    },
    'GET /v1/orders/:id': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const o = flowOrders.find((x) => x.id === p.id && x.customer.userId === u.id);
      return o ? [200, orderView(o)] : [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
    },
    'POST /v1/orders/:id/cancel': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const o = flowOrders.find((x) => x.id === p.id && x.customer.userId === u.id);
      if (!o) return [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
      if (!['CREATED', 'PAYMENT_PENDING', 'PAID', 'PARTNER_PENDING'].includes(o.status)) return [409, { error: { code: 'CANCEL_NOT_ALLOWED', message: 'Trop tard : le commerce a déjà accepté la commande.' } }];
      pushHist(o, 'CANCELLED', 'CUSTOMER');
      return [200, { cancelled: true }];
    },
    'POST /v1/orders/:id/review': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const o = flowOrders.find((x) => x.id === p.id && x.customer.userId === u.id);
      if (!o) return [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
      if (o.status !== 'DELIVERED') return [409, { error: { code: 'ORDER_NOT_DELIVERED', message: 'Note possible après livraison.' } }];
      o.review = { storeRating: b.storeRating ?? 5, driverRating: b.driverRating ?? 5, createdAt: new Date().toISOString() };
      return [201, o.review];
    },
    'GET /v1/partner/dashboard': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo. Connectez-vous avec +22671000001.' } }];
      const mine = flowOrders.filter((o) => o.store.id === st.id);
      const today = new Date().toISOString().slice(0, 10);
      const doneToday = mine.filter((o) => o.status === 'DELIVERED' && (flowDeliveries.get(o.id)?.deliveredAt ?? '').startsWith(today));
      return [200, {
        store: { id: st.id, name: st.name, isOpen: st.isOpen, acceptsOrders: st.acceptsOrders, preparationTimeMin: st.preparationTimeMin, minOrderAmount: st.minOrderAmount, ...openState(st) },
        orders: {
          pending: mine.filter((o) => o.status === 'PARTNER_PENDING').length,
          preparing: mine.filter((o) => ['ACCEPTED', 'PREPARING'].includes(o.status)).length,
          ready: mine.filter((o) => ['READY', 'DRIVER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(o.status)).length,
          doneToday: doneToday.length,
        },
        todayRevenue: doneToday.reduce((s, o) => s + o.partnerPayoutAmount, 0),
      }];
    },
    'GET /v1/partner/orders': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo.' } }];
      return [200, flowOrders.filter((o) => o.store.id === st.id).map((o) => orderView(o, true))];
    },
    'GET /v1/partner/orders/:id': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const o = flowOrders.find((x) => x.id === p.id);
      if (!o) return [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
      return [200, orderView(o, true)];
    },
    'POST /v1/partner/orders/:id/accept': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const o = flowOrders.find((x) => x.id === p.id);
      if (!o) return [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
      if (o.status !== 'PARTNER_PENDING') return [409, { error: { code: 'BAD_TRANSITION', message: `Déjà traitée (${o.status})` } }];
      pushHist(o, 'ACCEPTED', 'PARTNER');
      return [200, orderView(o, true)];
    },
    'POST /v1/partner/orders/:id/reject': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const o = flowOrders.find((x) => x.id === p.id);
      if (!o) return [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
      if (o.status !== 'PARTNER_PENDING') return [409, { error: { code: 'BAD_TRANSITION', message: `Déjà traitée (${o.status})` } }];
      pushHist(o, 'CANCELLED', 'PARTNER');
      o.cancelReason = b.reason ?? 'Rejetée par le commerce';
      return [200, orderView(o, true)];
    },
    'POST /v1/partner/orders/:id/preparing': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const o = flowOrders.find((x) => x.id === p.id);
      if (!o) return [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
      if (o.status !== 'ACCEPTED') return [409, { error: { code: 'BAD_TRANSITION', message: `Transition invalide (${o.status})` } }];
      pushHist(o, 'PREPARING', 'PARTNER');
      return [200, orderView(o, true)];
    },
    'POST /v1/partner/orders/:id/ready': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const o = flowOrders.find((x) => x.id === p.id);
      if (!o) return [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
      if (o.status !== 'PREPARING') return [409, { error: { code: 'BAD_TRANSITION', message: `Transition invalide (${o.status})` } }];
      pushHist(o, 'READY', 'PARTNER');
      const d = flowDeliveries.get(o.id);
      for (const drv of [...flowUsers.values()].filter((x) => x.roles.includes('DRIVER') && driverOnline.get(x.id))) {
        flowOffers.set(drv.id, {
          deliveryId: d.id, orderId: o.id, code: o.code,
          storeName: o.store.name, pickupAddress: o.store.address,
          dropoffDistanceKm: o.distanceKm, earning: d.driverEarning,
          expiresAt: Date.now() + 60_000,
        });
      }
      return [200, orderView(o, true)];
    },
    'GET /v1/partner/catalog': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo.' } }];
      return [200, { categories: st.catalog.categories, products: st.catalog.products }];
    },
    'POST /v1/partner/categories': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo.' } }];
      if (!b.name) return [400, { error: { message: 'Nom requis' } }];
      const c = { id: fid('cat'), name: b.name, sortOrder: st.catalog.categories.length };
      st.catalog.categories.push(c);
      return [201, c];
    },
    'POST /v1/partner/products': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo.' } }];
      if (!b.name || b.price == null) return [400, { error: { message: 'Nom et prix requis' } }];
      if (b.promoPrice != null && b.promoPrice >= b.price) return [400, { error: { code: 'PROMO_INVALID', message: 'Le prix promo doit être inférieur au prix normal.' } }];
      const pr = { id: fid('prod'), categoryId: b.categoryId ?? null, name: b.name, description: b.description ?? null, price: b.price, promoPrice: b.promoPrice ?? null, isAvailable: true, trackInventory: !!b.trackInventory, stockQuantity: b.stockQuantity ?? null };
      st.catalog.products.push(pr);
      return [201, pr];
    },
    'PATCH /v1/partner/products/:id': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo.' } }];
      const pr = st.catalog.products.find((x) => x.id === p.id);
      if (!pr) return [404, { error: { code: 'PRODUCT_NOT_FOUND', message: 'Produit introuvable' } }];
      const price = b.price ?? pr.price, promo = b.promoPrice !== undefined ? b.promoPrice : pr.promoPrice;
      if (promo != null && promo >= price) return [400, { error: { code: 'PROMO_INVALID', message: 'Le prix promo doit être inférieur au prix normal.' } }];
      Object.assign(pr, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)));
      return [200, pr];
    },
    'PATCH /v1/partner/store': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo.' } }];
      for (const k of ['isOpen', 'acceptsOrders', 'preparationTimeMin', 'minOrderAmount']) if (b[k] !== undefined) st[k] = b[k];
      return [200, { id: st.id, name: st.name, isOpen: st.isOpen, acceptsOrders: st.acceptsOrders, preparationTimeMin: st.preparationTimeMin, minOrderAmount: st.minOrderAmount, ...openState(st) }];
    },
    'GET /v1/partner/hours': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo.' } }];
      return [200, st.hours];
    },
    'PUT /v1/partner/hours': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const st = Object.values(flowStores).find((s) => s.ownerUserId === u.id);
      if (!st) return [403, { error: { code: 'FORBIDDEN', message: 'Compte sans commerce démo.' } }];
      if (!Array.isArray(b.hours) || b.hours.length !== 7) return [400, { error: { message: '7 jours attendus' } }];
      st.hours = b.hours.map((x) => ({ dayOfWeek: x.dayOfWeek, openTime: x.openTime ?? '08:00', closeTime: x.closeTime ?? '20:00', isClosed: !!x.isClosed }));
      return [200, st.hours];
    },
    'POST /v1/driver/status': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      driverOnline.set(u.id, !!b.isOnline);
      return [200, { isOnline: !!b.isOnline }];
    },
    'POST /v1/driver/location': (b, q, p, h) => { const u = bearer(h); return u ? [200, { ok: true }] : UNAUTH; },
    'GET /v1/driver/offers/current': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const of = flowOffers.get(u.id);
      if (!of || of.expiresAt < Date.now()) { flowOffers.delete(u.id); return [200, null]; }
      return [200, of];
    },
    'POST /v1/deliveries/:id/accept': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const d = [...flowDeliveries.values()].find((x) => x.id === p.id);
      if (!d) return [404, { error: { code: 'DELIVERY_NOT_FOUND', message: 'Course introuvable' } }];
      if (d.status !== 'PENDING') return [409, { error: { code: 'DELIVERY_ALREADY_TAKEN', message: 'Course déjà prise.' } }];
      const o = flowOrders.find((x) => x.id === d.orderId);
      d.status = 'ACCEPTED';
      d.driver = { userId: u.id, user: { fullName: u.fullName || 'Livreur démo', phone: u.phone } };
      flowOffers.delete(u.id);
      pushHist(o, 'DRIVER_ASSIGNED', 'SYSTEM');
      return [200, { ok: true }];
    },
    'POST /v1/deliveries/:id/decline': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      flowOffers.delete(u.id);
      return [200, { ok: true }];
    },
    'POST /v1/deliveries/:id/status': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const d = [...flowDeliveries.values()].find((x) => x.id === p.id);
      if (!d || d.driver?.userId !== u.id) return [404, { error: { code: 'DELIVERY_NOT_FOUND', message: 'Course introuvable' } }];
      const chain = ['ACCEPTED', 'TO_STORE', 'AT_STORE', 'PICKED_UP', 'TO_CUSTOMER', 'DELIVERED'];
      const next = chain[chain.indexOf(d.status) + 1];
      if (b.status !== next) return [409, { error: { code: 'BAD_DELIVERY_TRANSITION', message: `Transition invalide (${d.status} → ${b.status}). Attendu : ${next ?? 'terminée'}.` } }];
      const o = flowOrders.find((x) => x.id === d.orderId);
      if (b.status === 'DELIVERED') {
        if (b.pickupCode !== d.pickupCode) return [400, { error: { code: 'BAD_PICKUP_CODE', message: 'Code de remise incorrect — redemandez-le au client.' } }];
        d.deliveredAt = new Date().toISOString();
        const ownerUid = flowStores[o.store.id]?.ownerUserId;
        if (ownerUid) flowWallets.set(ownerUid, (flowWallets.get(ownerUid) ?? 0) + o.partnerPayoutAmount);
        flowWallets.set(u.id, (flowWallets.get(u.id) ?? 0) + d.driverEarning);
        if (o.payment?.method === 'CASH') o.payment.status = 'SUCCESS';
        pushHist(o, 'DELIVERED', 'DRIVER');
      } else {
        if (b.status === 'PICKED_UP') pushHist(o, 'PICKED_UP', 'DRIVER');
        else if (b.status === 'TO_CUSTOMER') pushHist(o, 'ON_THE_WAY', 'DRIVER');
      }
      d.status = b.status;
      return [200, { ok: true, status: d.status }];
    },
    'GET /v1/deliveries/active': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const d = [...flowDeliveries.values()].find((x) => x.driver?.userId === u.id && !['DELIVERED'].includes(x.status));
      if (!d) return [200, null];
      const o = flowOrders.find((x) => x.id === d.orderId);
      return [200, { id: d.id, status: d.status, driverEarning: d.driverEarning, order: orderView(o) }];
    },
    'GET /v1/driver/earnings': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const today = new Date().toISOString().slice(0, 10);
      const mine = [...flowDeliveries.values()].filter((x) => x.driver?.userId === u.id && x.status === 'DELIVERED');
      const todayM = mine.filter((x) => (x.deliveredAt ?? '').startsWith(today));
      return [200, {
        todayEarnings: todayM.reduce((s, x) => s + x.driverEarning, 0),
        todayDeliveries: todayM.length,
        walletBalance: flowWallets.get(u.id) ?? 0,
        totalDeliveries: mine.length,
      }];
    },
    'GET /v1/driver/deliveries': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const rows = [...flowDeliveries.values()].filter((x) => x.driver?.userId === u.id).map((x) => {
        const o = flowOrders.find((y) => y.id === x.orderId);
        return { id: x.id, status: x.status, driverEarning: x.driverEarning, deliveredAt: x.deliveredAt, order: { code: o.code, deliveryAddress: o.deliveryAddress, store: { name: o.store.name } } };
      });
      return [200, { data: rows, nextCursor: null }];
    },
    'GET /v1/geo/directions': (b, q) => {
      const fromLat = parseFloat(q.fromLat ?? '0'), fromLng = parseFloat(q.fromLng ?? '0');
      const toLat = parseFloat(q.toLat ?? '0'), toLng = parseFloat(q.toLng ?? '0');
      const km = Math.round(h2km(fromLat, fromLng, toLat, toLng) * 1.3 * 10) / 10;
      return [200, {
        distanceKm: km, durationMin: Math.max(1, Math.round((km / 24) * 60)), source: 'fallback',
        gmapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`,
      }];
    },
    'POST /v1/geo/delivery-quote': (b) => {
      const km = Math.max(1, b.distanceKm ?? 3);
      return [200, { distanceKm: km, deliveryFee: 500 + Math.max(0, Math.ceil(km - 3)) * 100, serviceFee: 200 }];
    },
  });
}

// Contexte partagé avec rides.mjs (modules du serveur de démo)
Object.assign(flowCtx, { sessions, flowUsers, flowWallets, driverOnline, bearer, rnd4, h2km, UNAUTH });
