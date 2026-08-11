/**
 * Taciturne Delivery — serveur MOCK de démonstration (rendu visuel)
 * ─────────────────────────────────────────────────────────────────
 * Sert les MÊMES contrats que l'API NestJS (/v1/admin/*, /v1/geo/cities)
 * avec un jeu de données burkinabè réaliste, EN MÉMOIRE.
 *
 * ⚠️ Ce n'est PAS le backend de production : il permet de voir et de cliquer
 * la vraie console Admin (Next.js) sans PostgreSQL/Redis. Toutes les mutations
 * sont rejouables et repartent à zéro au redémarrage. Le backend réel reste
 * apps/api (96 tests, compile ✔).
 *
 * Port : 3001 (la console Admin y accède via le proxy Next /backend/*).
 */
import http from 'node:http';
import { registerFlowRoutes } from './flow.mjs';
import { registerRideRoutes } from './rides.mjs';

const PORT = Number(process.env.PORT || 3001);
const now = Date.now();
const ago = (min) => new Date(now - min * 60_000).toISOString();
const daysAgo = (d, h = 12) => new Date(now - d * 86_400_000 - h * 3_600_000).toISOString();
const id = (() => { let n = 0; return (p) => `${p}-${(++n).toString().padStart(4, '0')}-mock`; })();

/* ─── Référentiel ────────────────────────────────────────────── */
const city = { id: 'city-ouaga', countryId: 'country-bf', name: 'Ouagadougou', isActive: true };

const zones = [
  { id: 'zone-centre', cityId: city.id, name: 'Centre-ville', deliveryBaseFee: 500, deliveryPerKmRate: 100, serviceFee: 200, minOrderAmount: 0, isActive: true, city },
  { id: 'zone-2000', cityId: city.id, name: 'Ouaga 2000', deliveryBaseFee: 500, deliveryPerKmRate: 100, serviceFee: 200, minOrderAmount: 1000, isActive: true, city },
  { id: 'zone-dassasgho', cityId: city.id, name: 'Dassasgho', deliveryBaseFee: 500, deliveryPerKmRate: 100, serviceFee: 200, minOrderAmount: 0, isActive: true, city },
  { id: 'zone-karpala', cityId: city.id, name: 'Karpala / Balkuy', deliveryBaseFee: 700, deliveryPerKmRate: 150, serviceFee: 200, minOrderAmount: 0, isActive: false, city },
];

const stores = {
  fatim: { id: 'store-fatim', name: 'Chez Fatim', address: 'Av. Kwame Nkrumah, Centre-ville', phone: '+22671000001', isActive: true, isOpen: true, sector: 'RESTAURANT' },
  faso: { id: 'store-faso', name: 'Maquis Le Faso', address: 'Rue des Jardins, Ouaga 2000', phone: '+22671000011', isActive: false, isOpen: false, sector: 'RESTAURANT' },
  pharma: { id: 'store-pharma', name: 'Pharmacie du Centre', address: 'Bd Tansoba, Centre-ville', phone: '+22671000012', isActive: true, isOpen: true, sector: 'PHARMACY' },
  zaka: { id: 'store-zaka', name: 'Boutique Zaka', address: 'Marché de Dassasgho', phone: '+22671000013', isActive: false, isOpen: false, sector: 'GROCERY' },
};

const partners = [
  { userId: 'user-partner-fatim', businessName: 'Chez Fatim SARL', registrationNumber: 'RCCM BF-OUA-2021-B-4321', kycStatus: 'APPROVED', commissionRate: '15.00', payoutPhone: '+22671000001', createdAt: daysAgo(210), user: { phone: '+22671000001', fullName: 'Fatimata Ouedraogo', status: 'ACTIVE', createdAt: daysAgo(210) }, stores: [{ id: stores.fatim.id, name: 'Chez Fatim', isActive: true }] },
  { userId: 'user-partner-faso', businessName: 'Maquis Le Faso', registrationNumber: 'RCCM BF-OUA-2024-B-0917', kycStatus: 'PENDING', commissionRate: null, payoutPhone: '+22671000011', createdAt: daysAgo(2, 4), user: { phone: '+22671000011', fullName: 'Seydou Kaboré', status: 'ACTIVE', createdAt: daysAgo(2, 4) }, stores: [{ id: stores.faso.id, name: 'Maquis Le Faso', isActive: false }] },
  { userId: 'user-partner-pharma', businessName: 'Pharmacie du Centre', registrationNumber: 'RCCM BF-OUA-2018-B-1143', kycStatus: 'APPROVED', commissionRate: null, payoutPhone: '+22671000012', createdAt: daysAgo(400), user: { phone: '+22671000012', fullName: 'Dr Awa Compaoré', status: 'ACTIVE', createdAt: daysAgo(400) }, stores: [{ id: stores.pharma.id, name: 'Pharmacie du Centre', isActive: true }] },
  { userId: 'user-partner-zaka', businessName: 'Boutique Zaka', registrationNumber: null, kycStatus: 'REJECTED', commissionRate: null, payoutPhone: null, createdAt: daysAgo(9), user: { phone: '+22671000013', fullName: 'Issouf Zaka', status: 'ACTIVE', createdAt: daysAgo(9) }, stores: [{ id: stores.zaka.id, name: 'Boutique Zaka', isActive: false }] },
];

const drivers = [
  { userId: 'user-driver-amadou', kycStatus: 'APPROVED', isOnline: true, vehicleType: 'MOTO', vehiclePlate: 'BF-1234-A', ratingAvg: '4.80', ratingCount: 214, totalDeliveries: 1243, currentLat: '12.37140', currentLng: '-1.51970', lastLocationAt: ago(1), user: { fullName: 'Amadou Sawadogo', phone: '+22671000002', status: 'ACTIVE' } },
  { userId: 'user-driver-moussa', kycStatus: 'APPROVED', isOnline: true, vehicleType: 'MOTO', vehiclePlate: 'BF-8841-C', ratingAvg: '4.65', ratingCount: 171, totalDeliveries: 860, currentLat: '12.36210', currentLng: '-1.53320', lastLocationAt: ago(0.4), user: { fullName: 'Moussa Traoré', phone: '+22671000021', status: 'ACTIVE' } },
  { userId: 'user-driver-bibata', kycStatus: 'APPROVED', isOnline: true, vehicleType: 'BICYCLE', vehiclePlate: null, ratingAvg: '4.91', ratingCount: 96, totalDeliveries: 402, currentLat: '12.38730', currentLng: '-1.50440', lastLocationAt: ago(2), user: { fullName: 'Bibata Nikiéma', phone: '+22671000022', status: 'ACTIVE' } },
  { userId: 'user-driver-yao', kycStatus: 'APPROVED', isOnline: false, vehicleType: 'MOTO', vehiclePlate: 'BF-5520-D', ratingAvg: '4.40', ratingCount: 61, totalDeliveries: 377, currentLat: null, currentLng: null, lastLocationAt: ago(900), user: { fullName: 'Yao Kinda', phone: '+22671000023', status: 'ACTIVE' } },
  { userId: 'user-driver-rasmata', kycStatus: 'PENDING', isOnline: false, vehicleType: 'MOTO', vehiclePlate: 'BF-9902-E', ratingAvg: '0.00', ratingCount: 0, totalDeliveries: 0, currentLat: null, currentLng: null, lastLocationAt: null, user: { fullName: 'Rasmata Banhoro', phone: '+22671000024', status: 'ACTIVE' } },
  { userId: 'user-driver-wendpanga', kycStatus: 'PENDING', isOnline: false, vehicleType: 'CAR', vehiclePlate: 'BF-3310-F', ratingAvg: '0.00', ratingCount: 0, totalDeliveries: 0, currentLat: null, currentLng: null, lastLocationAt: null, user: { fullName: 'Wendpanga Ilboudo', phone: '+22671000025', status: 'ACTIVE' } },
];

const customerUsers = [
  ['Aïcha Tapsoba', '+22670010001'], ['Boukary Zongo', '+22670010002'], ['Salamata Ouali', '+22670010003'],
  ['François Yaméogo', '+22670010004'], ['Rasmata Konaté', '+22670010005'], ['Harouna Diallo', '+22670010006'],
  ['Mariam Sanfo', '+22670010007'], ['Oumar Naparé', '+22670010008'],
].map(([fullName, phone], i) => ({ id: `user-cust-${i}`, phone, fullName, role: 'CUSTOMER', status: 'ACTIVE', language: 'fr', createdAt: daysAgo(30 + i * 7), partnerProfile: null, driverProfile: null }));

const users = [
  ...customerUsers,
  ...partners.map((p) => ({ id: p.userId, phone: p.user.phone, fullName: p.user.fullName, role: 'PARTNER', status: p.user.status, language: 'fr', createdAt: p.createdAt, partnerProfile: { kycStatus: p.kycStatus, businessName: p.businessName }, driverProfile: null })),
  ...drivers.map((d) => ({ id: d.userId, phone: d.user.phone, fullName: d.user.fullName, role: 'DRIVER', status: d.user.status, language: 'fr', createdAt: daysAgo(120), partnerProfile: null, driverProfile: { kycStatus: d.kycStatus, isOnline: d.isOnline } })),
  { id: 'user-admin', phone: '+22670000000', fullName: 'Super Admin', role: 'ADMIN', status: 'ACTIVE', language: 'fr', createdAt: daysAgo(500), partnerProfile: null, driverProfile: null },
];

/* ─── Commandes ──────────────────────────────────────────────── */
function mkOrder(n, opts) {
  const subtotal = opts.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const deliveryFee = opts.deliveryFee ?? 700;
  const serviceFee = 200;
  const discountAmount = opts.discount ?? 0;
  const totalAmount = subtotal + deliveryFee + serviceFee - discountAmount;
  const commissionRate = opts.commissionRate ?? 15;
  const commissionAmount = Math.round((subtotal * commissionRate) / 100);
  const cust = customerUsers[n % customerUsers.length];
  const o = {
    id: `order-${n}`, code: `TD-${10450 + n}`, status: opts.status,
    subtotal, deliveryFee, serviceFee, discountAmount, tipAmount: 0, totalAmount,
    commissionRate, commissionAmount, partnerPayoutAmount: subtotal - commissionAmount,
    distanceKm: opts.km ?? 3.2, customerNote: opts.note ?? null,
    deliveryAddress: 'Av. Kwame Nkrumah, secteur 4', deliveryDetails: 'Face à la pharmacie du coin',
    createdAt: opts.at ?? ago(30 + n * 14),
    items: opts.items.map((i, k) => ({ id: `item-${n}-${k}`, productId: `p-${k}`, ...i, subtotal: i.unitPrice * i.quantity, options: [] })),
    customer: { userId: cust.id, user: { fullName: cust.fullName, phone: cust.phone } },
    store: { id: opts.store.id, name: opts.store.name, address: opts.store.address, phone: opts.store.phone },
    payment: null, delivery: null, statusHistory: [],
  };
  if (opts.pay) o.payment = { id: `pay-${n}`, method: opts.pay, status: opts.payStatus ?? 'SUCCESS', amount: totalAmount, paidAt: o.createdAt, refunds: [] };
  if (opts.driver) o.delivery = { id: `del-${n}`, status: opts.deliveryStatus ?? 'PICKED_UP', pickupCode: '4382', driver: { userId: opts.driver.userId, user: { fullName: opts.driver.user.fullName, phone: opts.driver.user.phone } } };
  const chain = ['CREATED', 'PAYMENT_PENDING', 'PAID', 'PARTNER_PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DRIVER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
  const idx = o.status === 'CANCELLED' ? 3 : chain.indexOf(o.status);
  o.statusHistory = chain.slice(0, Math.max(1, idx + 1)).map((toStatus, k) => ({ id: `hist-${n}-${k}`, fromStatus: k ? chain[k - 1] : null, toStatus, changedByRole: k === 0 ? 'CUSTOMER' : k <= 3 ? 'SYSTEM' : k <= 6 ? 'PARTNER' : 'DRIVER', createdAt: new Date(new Date(o.createdAt).getTime() + k * 120_000).toISOString() }));
  if (o.status === 'CANCELLED') o.statusHistory.push({ id: `hist-${n}-x`, fromStatus: 'PARTNER_PENDING', toStatus: 'CANCELLED', changedByRole: 'CUSTOMER', createdAt: new Date(new Date(o.createdAt).getTime() + 480_000).toISOString() });
  return o;
}

const orders = [
  mkOrder(1, { status: 'PARTNER_PENDING', store: stores.fatim, pay: 'ORANGE_MONEY', km: 3.2, items: [{ name: 'Riz gras poulet', unitPrice: 1500, quantity: 2 }, { name: 'Jus de bissap', unitPrice: 500, quantity: 3 }], at: ago(6), note: 'Peu pimenté svp' }),
  mkOrder(2, { status: 'PREPARING', store: stores.fatim, pay: 'CASH', items: [{ name: 'Poulet bicyclette', unitPrice: 2500, quantity: 1 }, { name: 'Tô sauce gombo', unitPrice: 1200, quantity: 2 }], at: ago(18) }),
  mkOrder(3, { status: 'READY', store: stores.pharma, pay: 'WALLET', items: [{ name: 'Paracétamol 500mg ×16', unitPrice: 800, quantity: 2 }, { name: 'Sérum physiologique', unitPrice: 600, quantity: 1 }], km: 1.8, deliveryFee: 500, at: ago(25) }),
  mkOrder(4, { status: 'DRIVER_ASSIGNED', store: stores.fatim, pay: 'MOOV_MONEY', driver: drivers[0], items: [{ name: 'Riz gras poulet', unitPrice: 1500, quantity: 1 }], at: ago(31), km: 4.4, deliveryFee: 700 }),
  mkOrder(5, { status: 'ON_THE_WAY', store: stores.pharma, pay: 'ORANGE_MONEY', driver: drivers[1], deliveryStatus: 'TO_CUSTOMER', items: [{ name: 'Vitamine C 1000mg', unitPrice: 2500, quantity: 1 }], km: 2.6, deliveryFee: 500, at: ago(40) }),
  mkOrder(6, { status: 'DELIVERED', store: stores.fatim, pay: 'CASH', driver: drivers[0], deliveryStatus: 'DELIVERED', items: [{ name: 'Poulet bicyclette', unitPrice: 2500, quantity: 2 }, { name: 'Jus de gingembre', unitPrice: 500, quantity: 2 }], at: ago(96), km: 5.1, deliveryFee: 800 }),
  mkOrder(7, { status: 'DELIVERED', store: stores.fatim, pay: 'WAVE', driver: drivers[2], deliveryStatus: 'DELIVERED', items: [{ name: 'Tô sauce gombo', unitPrice: 1200, quantity: 3 }], discount: 500, at: ago(140), km: 3.9 }),
  mkOrder(8, { status: 'DELIVERED', store: stores.pharma, pay: 'ORANGE_MONEY', driver: drivers[1], deliveryStatus: 'DELIVERED', items: [{ name: 'Thermomètre digital', unitPrice: 3500, quantity: 1 }], at: daysAgo(1, 2), km: 2.2, deliveryFee: 500 }),
  mkOrder(9, { status: 'CANCELLED', store: stores.fatim, pay: 'ORANGE_MONEY', payStatus: 'REFUNDED', items: [{ name: 'Riz gras poulet', unitPrice: 1500, quantity: 4 }], at: daysAgo(1, 6) }),
];

const payments = orders.filter((o) => o.payment).map((o) => ({ ...o.payment, orderId: o.id, initiatedAt: o.createdAt, refundedAt: o.payment.status === 'REFUNDED' ? o.createdAt : null, order: { code: o.code, customerId: o.customer.userId } }));

const refunds = [
  { id: 'refund-1', paymentId: 'pay-6', amount: 1200, reason: 'Une boisson manquait dans le sac', status: 'REQUESTED', createdAt: ago(200), payment: { method: 'CASH', order: { code: 'TD-10456', customerId: orders[5].customer.userId, paymentMethod: 'CASH' } } },
  { id: 'refund-2', paymentId: 'pay-8', amount: 4200, reason: 'Produit reçu endommagé (photo jointe)', status: 'REQUESTED', createdAt: ago(500), payment: { method: 'ORANGE_MONEY', order: { code: 'TD-10458', customerId: orders[7].customer.userId, paymentMethod: 'ORANGE_MONEY' } } },
];

const coupons = [
  { id: 'coupon-1', code: 'BIENVENUE-TD', type: 'PERCENTAGE', value: 10, maxDiscountAmount: 1000, minOrderAmount: 2000, usedCount: 341, totalLimit: 1000, startAt: daysAgo(20), endAt: new Date(now + 40 * 86_400_000).toISOString(), isActive: true },
  { id: 'coupon-2', code: 'FATIM500', type: 'FIXED_AMOUNT', value: 500, maxDiscountAmount: null, minOrderAmount: 3000, usedCount: 88, totalLimit: null, startAt: daysAgo(5), endAt: new Date(now + 10 * 86_400_000).toISOString(), isActive: true },
  { id: 'coupon-3', code: 'LIVRAISON0', type: 'FREE_DELIVERY', value: 0, maxDiscountAmount: null, minOrderAmount: 5000, usedCount: 512, totalLimit: 2000, startAt: daysAgo(60), endAt: daysAgo(1), isActive: false },
];

const wallets = [
  { id: 'w-fatim', balance: 84500, user: { id: 'user-partner-fatim', fullName: 'Fatimata Ouedraogo', phone: '+22671000001', role: 'PARTNER' } },
  { id: 'w-pharma', balance: 152300, user: { id: 'user-partner-pharma', fullName: 'Dr Awa Compaoré', phone: '+22671000012', role: 'PARTNER' } },
  { id: 'w-driver1', balance: 12800, user: { id: 'user-driver-1', fullName: 'Boureima Sawadogo', phone: '+22671000002', role: 'DRIVER' } },
  { id: 'w-driver2', balance: -3600, user: { id: 'user-driver-2', fullName: 'Abdoul Tapsoba', phone: '+22671000003', role: 'DRIVER' } },
];

const payouts = [
  { id: 'po-0001-mock', userId: 'user-partner-fatim', amount: 84500, method: 'ORANGE_MONEY', phone: '+22671000001', status: 'REQUESTED', reference: 'po-demo-week32-fatim', note: 'Reversement semaine 32', rejectReason: null, createdAt: ago(180), user: { fullName: 'Fatimata Ouedraogo', phone: '+22671000001', role: 'PARTNER' } },
  { id: 'po-0002-mock', userId: 'user-driver-1', amount: 12800, method: 'MOOV_MONEY', phone: '+22671000002', status: 'REQUESTED', reference: 'po-demo-week32-driver', note: null, rejectReason: null, createdAt: ago(95), user: { fullName: 'Boureima Sawadogo', phone: '+22671000002', role: 'DRIVER' } },
  { id: 'po-0003-mock', userId: 'user-partner-pharma', amount: 200000, method: 'ORANGE_MONEY', phone: '+22671000012', status: 'PAID', reference: 'po-demo-week31-pharma', note: 'Reversement semaine 31', rejectReason: null, createdAt: daysAgo(6), user: { fullName: 'Dr Awa Compaoré', phone: '+22671000012', role: 'PARTNER' } },
];

const sponsorships = [
  { id: 'sponso-1', storeId: stores.fatim.id, placement: 'HOME_FEATURED', status: 'ACTIVE', pricePerDay: 1000, startAt: daysAgo(3), endAt: new Date(now + 25 * 86_400_000).toISOString(), store: { name: 'Chez Fatim' }, city: { name: 'Ouagadougou' } },
  { id: 'sponso-2', storeId: stores.pharma.id, placement: 'SEARCH_TOP', status: 'PAUSED', pricePerDay: 700, startAt: daysAgo(15), endAt: new Date(now + 15 * 86_400_000).toISOString(), store: { name: 'Pharmacie du Centre' }, city: { name: 'Ouagadougou' } },
];

/* ─── Agrégats tableau de bord ───────────────────────────────── */
const D = (d) => new Date(now - d * 86_400_000).toISOString().slice(0, 10);
const stats = {
  daily: [
    { day: D(6), orders: 31, revenue: '812000', cancelled: 1 }, { day: D(5), orders: 38, revenue: '1045500', cancelled: 0 },
    { day: D(4), orders: 29, revenue: '768400', cancelled: 2 }, { day: D(3), orders: 44, revenue: '1308900', cancelled: 1 },
    { day: D(2), orders: 52, revenue: '1512300', cancelled: 0 }, { day: D(1), orders: 49, revenue: '1426700', cancelled: 1 },
    { day: D(0), orders: 47, revenue: '1248500', cancelled: 0 },
  ],
  topStores: [
    { storeId: stores.fatim.id, _sum: { subtotal: 4862000 }, _count: 412 },
    { storeId: stores.pharma.id, _sum: { subtotal: 2914800 }, _count: 233 },
    { storeId: stores.faso.id, _sum: { subtotal: 1402500 }, _count: 128 },
  ],
};
const dashboard = () => ({
  commandesAujourdhui: 47,
  caPlateforme: 1248500,
  livreursActifs: drivers.filter((d) => d.isOnline && d.kycStatus === 'APPROVED').length,
  commercesActifs: Object.values(stores).filter((s) => s.isActive).length,
  clientsActifs: 1892,
});

/* ─── Routage ────────────────────────────────────────────────── */
const routes = {
  'GET /': () => [200, { status: 'ok', service: 'taciturne-demo', hint: '/v1/geo/cities' }],
  'GET /healthz': () => [200, { status: 'up' }],
  'POST /v1/admin/auth/login': (b) => (b.email === 'admin@taciturne-delivery.bf' && b.password === 'Admin@123')
    ? [200, { accessToken: 'demo-token-admin', refreshToken: 'demo-refresh' }]
    : [401, { error: { code: 'BAD_CREDENTIALS', message: 'Identifiants invalides' } }],

  'GET /v1/admin/dashboard': () => [200, dashboard()],
  'GET /v1/admin/stats': () => [200, stats],
  'GET /v1/admin/drivers/live': () => [200, drivers.filter((d) => d.isOnline).map(({ userId, currentLat, currentLng, lastLocationAt, vehicleType, user }) => ({ userId, currentLat, currentLng, lastLocationAt, vehicleType, user: { fullName: user.fullName } }))],

  'GET /v1/admin/orders': (b, q) => {
    const rows = orders.filter((o) => !q.status || o.status === q.status)
      .map((o) => ({ id: o.id, code: o.code, status: o.status, totalAmount: o.totalAmount, createdAt: o.createdAt, customer: o.customer, store: { id: o.store.id, name: o.store.name }, payment: o.payment ? { method: o.payment.method, status: o.payment.status } : null }));
    return [200, { data: rows, nextCursor: null }];
  },
  'GET /v1/admin/orders/:id': (b, q, p) => { const o = orders.find((x) => x.id === p.id); return o ? [200, o] : [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }]; },
  'POST /v1/admin/orders/:id/cancel': (b, q, p) => {
    const o = orders.find((x) => x.id === p.id);
    if (!o) return [404, { error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' } }];
    if (['DELIVERED', 'REFUNDED'].includes(o.status)) return [409, { error: { code: 'CANCEL_NOT_ALLOWED', message: 'Commande clôturée — passez par un remboursement' } }];
    o.statusHistory.push({ id: id('hist'), fromStatus: o.status, toStatus: 'CANCELLED', changedByRole: 'ADMIN', createdAt: new Date().toISOString() });
    o.status = 'CANCELLED';
    if (o.payment?.status === 'SUCCESS') { o.payment.status = 'REFUNDED'; const pay = payments.find((x) => x.id === o.payment.id); if (pay) pay.status = 'REFUNDED'; }
    return [200, { cancelled: true }];
  },

  'GET /v1/admin/drivers': (b, q) => [200, drivers.filter((d) => q.online === undefined ? true : d.isOnline === (q.online === 'true'))],
  'POST /v1/admin/drivers/:id/approve': (b, q, p) => { const d = drivers.find((x) => x.userId === p.id); if (!d) return [404, { error: { message: 'Introuvable' } }]; d.kycStatus = 'APPROVED'; return [200, d]; },
  'POST /v1/admin/drivers/:id/suspend': (b, q, p) => { const d = drivers.find((x) => x.userId === p.id); if (!d) return [404, { error: { message: 'Introuvable' } }]; d.isOnline = false; d.kycStatus = 'REJECTED'; d.user.status = 'SUSPENDED'; const u = users.find((x) => x.id === p.id); if (u) { u.status = 'SUSPENDED'; u.driverProfile.kycStatus = 'REJECTED'; u.driverProfile.isOnline = false; } return [200, d]; },

  'GET /v1/admin/partners': (b, q) => [200, partners.filter((x) => !q.kyc || x.kycStatus === q.kyc)],
  'POST /v1/admin/partners/:id/approve': (b, q, p) => { const x = partners.find((v) => v.userId === p.id); if (!x) return [404, { error: { message: 'Introuvable' } }]; x.kycStatus = 'APPROVED'; x.stores.forEach((s) => { s.isActive = true; }); return [200, x]; },
  'POST /v1/admin/partners/:id/reject': (b, q, p) => { const x = partners.find((v) => v.userId === p.id); if (!x) return [404, { error: { message: 'Introuvable' } }]; x.kycStatus = 'REJECTED'; return [200, x]; },
  'PATCH /v1/admin/partners/:id/commission': (b, q, p) => { const x = partners.find((v) => v.userId === p.id); if (!x) return [404, { error: { message: 'Introuvable' } }]; if (typeof b.rate !== 'number' || b.rate < 0 || b.rate > 50) return [400, { error: { message: 'rate doit être entre 0 et 50' } }]; x.commissionRate = b.rate.toFixed(2); return [200, x]; },

  'GET /v1/admin/users': (b, q) => {
    const rows = users.filter((u) => (!q.role || u.role === q.role) && (!q.q || u.fullName.toLowerCase().includes(q.q.toLowerCase()) || u.phone.includes(q.q)));
    return [200, { data: rows, nextCursor: null }];
  },
  'POST /v1/admin/users/:id/suspend': (b, q, p) => { const u = users.find((x) => x.id === p.id); if (!u) return [404, { error: { message: 'Introuvable' } }]; u.status = 'SUSPENDED'; return [200, u]; },
  'POST /v1/admin/users/:id/reactivate': (b, q, p) => { const u = users.find((x) => x.id === p.id); if (!u) return [404, { error: { message: 'Introuvable' } }]; u.status = 'ACTIVE'; return [200, u]; },

  'GET /v1/admin/payments': (b, q) => [200, payments.filter((x) => !q.status || x.status === q.status)],
  'POST /v1/admin/payments/:id/refund': (b, q, p) => {
    const pay = payments.find((x) => x.id === p.id);
    if (!pay || pay.status !== 'SUCCESS') return [409, { error: { code: 'REFUND_NOT_POSSIBLE', message: 'Paiement non remboursable' } }];
    if (!b.amount || b.amount > pay.amount) return [400, { error: { code: 'REFUND_EXCEEDS', message: `Montant supérieur au reste remboursable (${pay.amount} FCFA)` } }];
    const r = { id: id('refund'), paymentId: pay.id, amount: b.amount, reason: b.reason, status: 'REQUESTED', createdAt: new Date().toISOString(), payment: { method: pay.method, order: pay.order } };
    refunds.unshift(r);
    return [201, r];
  },
  'GET /v1/admin/refunds': (b, q) => [200, refunds.filter((r) => !q.status || r.status === q.status)],
  'POST /v1/admin/refunds/:id/approve': (b, q, p) => {
    const r = refunds.find((x) => x.id === p.id); if (!r) return [404, { error: { message: 'Introuvable' } }];
    if (r.status !== 'REQUESTED') return [409, { error: { code: 'REFUND_ALREADY_HANDLED', message: 'Déjà traité' } }];
    r.status = 'PROCESSED';
    const pay = payments.find((x) => x.id === r.paymentId);
    if (pay) pay.status = r.amount >= pay.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    return [200, r];
  },
  'POST /v1/admin/refunds/:id/reject': (b, q, p) => { const r = refunds.find((x) => x.id === p.id); if (!r) return [404, { error: { message: 'Introuvable' } }]; if (r.status !== 'REQUESTED') return [409, { error: { code: 'REFUND_ALREADY_HANDLED', message: 'Déjà traité' } }]; r.status = 'REJECTED'; return [200, r]; },

  'GET /v1/admin/zones': () => [200, zones],
  'POST /v1/admin/zones': (b) => { if (!b.name || b.deliveryBaseFee == null) return [400, { error: { message: 'Champs requis manquants' } }]; const z = { id: id('zone'), cityId: b.cityId, name: b.name, deliveryBaseFee: b.deliveryBaseFee, deliveryPerKmRate: b.deliveryPerKmRate ?? 100, serviceFee: b.serviceFee ?? 200, minOrderAmount: b.minOrderAmount ?? 0, isActive: true, city }; zones.push(z); return [201, z]; },
  'PATCH /v1/admin/zones/:id': (b, q, p) => { const z = zones.find((x) => x.id === p.id); if (!z) return [404, { error: { message: 'Introuvable' } }]; Object.assign(z, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined))); return [200, z]; },

  'GET /v1/admin/coupons': () => [200, coupons],
  'POST /v1/admin/coupons': (b) => { if (!b.code || !b.type) return [400, { error: { message: 'Champs requis manquants' } }]; const c = { id: id('coupon'), code: b.code.toUpperCase(), type: b.type, value: b.value ?? 0, maxDiscountAmount: b.maxDiscountAmount ?? null, minOrderAmount: b.minOrderAmount ?? 0, usedCount: 0, totalLimit: b.totalLimit ?? null, startAt: b.startAt, endAt: b.endAt, isActive: true }; coupons.unshift(c); return [201, c]; },
  'PATCH /v1/admin/coupons/:id': (b, q, p) => { const c = coupons.find((x) => x.id === p.id); if (!c) return [404, { error: { message: 'Introuvable' } }]; c.isActive = !!b.isActive; return [200, c]; },

  'GET /v1/admin/sponsorships': () => [200, sponsorships],
  'POST /v1/admin/sponsorships': (b) => { const st = Object.values(stores).find((s) => s.id === b.storeId); if (!st) return [400, { error: { message: 'Commerce introuvable' } }]; const s = { id: id('sponso'), storeId: b.storeId, placement: b.placement, status: 'ACTIVE', pricePerDay: b.pricePerDay ?? 0, startAt: b.startAt, endAt: b.endAt, store: { name: st.name }, city: { name: 'Ouagadougou' } }; sponsorships.unshift(s); return [201, s]; },
  'PATCH /v1/admin/sponsorships/:id': (b, q, p) => { const s = sponsorships.find((x) => x.id === p.id); if (!s) return [404, { error: { message: 'Introuvable' } }]; s.status = b.status; return [200, s]; },

  'GET /v1/geo/cities': () => [200, [{ ...city, country: { code: 'BF', name: 'Burkina Faso', currencyCode: 'XOF', phonePrefix: '+226' }, zones: zones.filter((z) => z.isActive).map(({ id: zid, name, deliveryBaseFee, deliveryPerKmRate, serviceFee, minOrderAmount }) => ({ id: zid, name, deliveryBaseFee, deliveryPerKmRate, serviceFee, minOrderAmount })) }]],

  'GET /v1/admin/payouts': (b, q) => [200, payouts.filter((r) => (!q.status || r.status === q.status) && (!q.userId || r.userId === q.userId))],
  'GET /v1/admin/payouts/balances': () => [200, wallets],
  'POST /v1/admin/payouts': (b) => {
    const w = wallets.find((x) => x.user.id === b.userId);
    if (!w) return [400, { error: { code: 'PAYOUT_INVALID_ROLE', message: 'Bénéficiaire : partenaire ou livreur uniquement' } }];
    if (!b.amount || b.amount < 500) return [400, { error: { message: 'Montant minimum 500 FCFA' } }];
    if (b.amount > w.balance) return [400, { error: { code: 'INSUFFICIENT_BALANCE', message: `Solde insuffisant (${w.balance} FCFA)` } }];
    const dup = payouts.find((x) => b.reference && x.reference === b.reference);
    if (dup) return [200, { ...dup, replayed: true }];
    w.balance -= b.amount;
    const po = { id: id('payout'), userId: b.userId, amount: b.amount, method: b.method ?? 'ORANGE_MONEY', phone: b.phone ?? w.user.phone, status: 'REQUESTED', reference: b.reference ?? `po-mock-${Date.now().toString(36)}`, note: b.note ?? null, rejectReason: null, createdAt: new Date().toISOString(), user: w.user };
    payouts.unshift(po);
    return [201, po];
  },
  'POST /v1/admin/payouts/:id/pay': (b, q, p) => { const po = payouts.find((x) => x.id === p.id); if (!po) return [404, { error: { message: 'Introuvable' } }]; if (po.status !== 'REQUESTED') return [409, { error: { code: 'PAYOUT_ALREADY_HANDLED', message: 'Déjà traité' } }]; po.status = 'PAID'; return [200, po]; },
  'POST /v1/admin/payouts/:id/reject': (b, q, p) => {
    const po = payouts.find((x) => x.id === p.id);
    if (!po) return [404, { error: { message: 'Introuvable' } }];
    if (po.status !== 'REQUESTED') return [409, { error: { code: 'PAYOUT_ALREADY_HANDLED', message: 'Déjà traité' } }];
    po.status = 'REJECTED'; po.rejectReason = b.reason ?? null;
    const w = wallets.find((x) => x.user.id === po.userId);
    if (w) w.balance += po.amount; // re-crédit intégral
    return [200, po];
  },
};

registerFlowRoutes(routes);
registerRideRoutes(routes);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const u = new URL(req.url, `http://x`);
  const path = u.pathname.replace(/\/$/, '');
  const q = Object.fromEntries(u.searchParams);

  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let json = {};
    try { json = body ? JSON.parse(body) : {}; } catch { /* ignore */ }

    for (const [key, handler] of Object.entries(routes)) {
      const [method, pattern] = key.split(' ');
      if (method !== req.method) continue;
      const pp = pattern.split('/'); const up = path.split('/');
      if (pp.length !== up.length) continue;
      const params = {};
      const ok = pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(up[i])), true) : seg === up[i]));
      if (!ok) continue;
      const [status, payload] = handler(json, q, params, req.headers);
      if (method !== 'POST' || !path.includes('auth/login')) console.log(`${method} ${path} → ${status}`);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(payload));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: `${req.method} ${path} — non mocké` } }));
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`🟠 Mock Taciturne Delivery prêt sur :${PORT} (données de DÉMO en mémoire — pas la vraie base)`));
