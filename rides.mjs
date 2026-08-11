/**
 * rides.mjs — module VTC (voitures avec chauffeur) de la démo Taciturne.
 * Mécanique identique aux livraisons : devis → demande → acceptation →
 * ARRIVED → STARTED (code PIN du client) → COMPLETED, commission 15 %.
 * Usage : registerRideRoutes(routes) — partage flowCtx (sessions, wallets…).
 */
import { flowCtx } from './flow.mjs';

const { bearer, rnd4, h2km, UNAUTH, flowWallets, driverOnline } = flowCtx;

/** Repères d'Ouagadougou proposés au client (coordonnées réelles approx.). */
const LANDMARKS = [
  { id: 'lm-aeroport', name: '✈️ Aéroport de Ouagadougou', lat: 12.3532, lng: -1.5124 },
  { id: 'lm-marche', name: '🛍️ Grand Marché (Rood-Woko)', lat: 12.3697, lng: -1.5247 },
  { id: 'lm-nations', name: '🏛️ Place des Nations Unies', lat: 12.3687, lng: -1.5264 },
  { id: 'lm-2000', name: '🏙️ Ouaga 2000', lat: 12.3068, lng: -1.5063 },
  { id: 'lm-gare', name: '🚌 Gare de l’Est (STAF)', lat: 12.3548, lng: -1.4747 },
  { id: 'lm-chu', name: '🏥 CHU Yalgado', lat: 12.3806, lng: -1.5072 },
  { id: 'lm-univ', name: '🎓 Université Joseph Ki-Zerbo', lat: 12.3903, lng: -1.4838 },
  { id: 'lm-karpala', name: '🏘️ Karpala', lat: 12.3344, lng: -1.5535 },
];

const BASE_FARE = 800;        // FCFA — prise en charge
const PER_KM = 250;           // FCFA par km route
const MIN_FARE = 1000;        // minimum
const COMMISSION = 0.15;      // commission plateforme (comme livraison)

const rides = new Map();      // rideId -> ride
const rideSeq = { n: 0 };
const driverVtc = new Map();  // userId -> bool (mode VTC activé)
const declined = new Map();   // rideId -> Set<userId>

const newRideId = (() => { let n = 0; return () => `ride-${(++n).toString().padStart(4, '0')}`; })();
const codeOf = (id) => { rideSeq.n = Number(id.split('-')[1]); return `VTC-${2100 + rideSeq.n}`; };

function view(r, forUser) {
  return {
    id: r.id, code: r.code, status: r.status,
    from: r.from, to: r.to,
    distanceKm: r.distanceKm, durationMin: r.durationMin,
    fare: r.fare, driverEarning: r.driverEarning,
    pickupCode: forUser === 'customer' && ['ACCEPTED', 'ARRIVED'].includes(r.status) ? r.pickupCode : undefined,
    customer: { fullName: r.customer.fullName || 'Client Taciturne', phone: r.customer.phone },
    driver: r.driver ?? null,
    createdAt: r.createdAt,
  };
}

const fareOf = (km) => Math.max(MIN_FARE, Math.round(BASE_FARE + PER_KM * km));

export function registerRideRoutes(routes) {
  Object.assign(routes, {
    /* ─── Référentiel ─────────────────────────────────────────── */
    'GET /v1/rides/landmarks': () => [200, LANDMARKS],

    /* ─── Devis ───────────────────────────────────────────────── */
    'POST /v1/rides/quote': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const from = LANDMARKS.find((l) => l.id === b.fromId);
      const to = LANDMARKS.find((l) => l.id === b.toId);
      if (!from || !to) return [400, { error: { code: 'LANDMARK_UNKNOWN', message: 'Repère inconnu' } }];
      if (from.id === to.id) return [400, { error: { code: 'SAME_POINT', message: 'Départ et arrivée identiques' } }];
      const km = h2km(from.lat, from.lng, to.lat, to.lng) * 1.3;
      const distanceKm = Math.round(km * 10) / 10;
      const durationMin = Math.max(5, Math.round(distanceKm * 3.2));
      const fare = fareOf(distanceKm);
      return [200, { from, to, distanceKm, durationMin, fare, currency: 'XOF' }];
    },

    /* ─── Création de course (idempotente) ────────────────────── */
    'POST /v1/rides': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const idem = h['idempotency-key'];
      if (idem) {
        const dup = [...rides.values()].find((r) => r.idem === idem && r.customer.phone === u.phone);
        if (dup) return [200, { ...view(dup, 'customer'), replayed: true }];
      }
      const from = LANDMARKS.find((l) => l.id === b.fromId);
      const to = LANDMARKS.find((l) => l.id === b.toId);
      if (!from || !to || from.id === to.id) return [400, { error: { code: 'RIDE_INVALID', message: 'Trajet invalide' } }];
      const km = h2km(from.lat, from.lng, to.lat, to.lng) * 1.3;
      const distanceKm = Math.round(km * 10) / 10;
      const durationMin = Math.max(5, Math.round(distanceKm * 3.2));
      const fare = fareOf(distanceKm);
      const id = newRideId();
      const r = {
        id, code: codeOf(id), status: 'REQUESTED',
        from: { id: from.id, name: from.name, lat: from.lat, lng: from.lng },
        to: { id: to.id, name: to.name, lat: to.lat, lng: to.lng },
        distanceKm, durationMin, fare,
        driverEarning: Math.round(fare * (1 - COMMISSION)),
        commissionAmount: fare - Math.round(fare * (1 - COMMISSION)),
        pickupCode: rnd4(),
        customer: { userId: u.id, fullName: u.fullName, phone: u.phone },
        driver: null, idem: idem ?? null,
        createdAt: new Date().toISOString(),
      };
      rides.set(id, r);
      return [201, view(r, 'customer')];
    },

    /* ⚠️ les routes littérales AVANT les routes « :id » (match par ordre). */
    'GET /v1/rides/mine': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const rows = [...rides.values()].filter((r) => r.customer.userId === u.id).reverse();
      return [200, { data: rows.map((r) => view(r, 'customer')), nextCursor: null }];
    },

    'GET /v1/rides/offers': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      if (!driverVtc.get(u.id) || !driverOnline.get(u.id)) return [200, []];
      const open = [...rides.values()].filter(
        (r) => r.status === 'REQUESTED' && !(declined.get(r.id)?.has(u.id)),
      );
      return [200, open.map((r) => ({ ...view(r, 'driver'), pickupCode: undefined }))];
    },

    'GET /v1/rides/:id': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const r = rides.get(p.id);
      if (!r) return [404, { error: { code: 'RIDE_NOT_FOUND', message: 'Course introuvable' } }];
      const role = r.customer.userId === u.id ? 'customer' : r.driver?.userId === u.id ? 'driver' : null;
      if (!role) return [403, { error: { code: 'FORBIDDEN', message: 'Pas votre course' } }];
      return [200, view(r, role)];
    },

    'POST /v1/rides/:id/cancel': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const r = rides.get(p.id);
      if (!r || r.customer.userId !== u.id) return [404, { error: { code: 'RIDE_NOT_FOUND', message: 'Course introuvable' } }];
      if (!['REQUESTED', 'ACCEPTED'].includes(r.status)) {
        return [409, { error: { code: 'RIDE_CANCEL_TOO_LATE', message: 'Course déjà démarrée — annulation impossible' } }];
      }
      r.status = 'CANCELLED';
      return [200, view(r, 'customer')];
    },

    /* ─── Côté chauffeur VTC ──────────────────────────────────── */
    'GET /v1/driver/vtc': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      return [200, { vtc: !!driverVtc.get(u.id) }];
    },
    'POST /v1/driver/vtc': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      driverVtc.set(u.id, !!b.on);
      return [200, { vtc: !!b.on }];
    },

    'POST /v1/rides/:id/decline': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      if (!declined.has(p.id)) declined.set(p.id, new Set());
      declined.get(p.id).add(u.id);
      return [200, { ok: true }];
    },

    'POST /v1/rides/:id/accept': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const r = rides.get(p.id);
      if (!r) return [404, { error: { code: 'RIDE_NOT_FOUND', message: 'Course introuvable' } }];
      if (r.status !== 'REQUESTED') return [409, { error: { code: 'RIDE_ALREADY_TAKEN', message: 'Course déjà prise par un autre chauffeur.' } }];
      r.status = 'ACCEPTED';
      r.driver = { userId: u.id, user: { fullName: u.fullName || 'Chauffeur démo', phone: u.phone } };
      return [200, view(r, 'driver')];
    },

    'POST /v1/rides/:id/status': (b, q, p, h) => {
      const u = bearer(h); if (!u) return UNAUTH;
      const r = rides.get(p.id);
      if (!r || r.driver?.userId !== u.id) return [404, { error: { code: 'RIDE_NOT_FOUND', message: 'Course introuvable' } }];
      const chain = ['ACCEPTED', 'ARRIVED', 'STARTED', 'COMPLETED'];
      const next = chain[chain.indexOf(r.status) + 1];
      if (b.status !== next) return [409, { error: { code: 'BAD_RIDE_TRANSITION', message: `Transition invalide (${r.status} → ${b.status}). Attendu : ${next ?? 'clôturée'}.` } }];
      if (b.status === 'STARTED') {
        if (b.pickupCode !== r.pickupCode) return [400, { error: { code: 'BAD_PICKUP_CODE', message: 'Code client incorrect — redemandez-le au passager.' } }];
      }
      r.status = b.status;
      if (b.status === 'COMPLETED') {
        r.completedAt = new Date().toISOString();
        flowWallets.set(u.id, (flowWallets.get(u.id) ?? 0) + r.driverEarning);
      }
      return [200, view(r, 'driver')];
    },

    /* ─── Console admin ───────────────────────────────────────── */
    'GET /v1/admin/rides': (b, q, p, h) => {
      const rows = [...rides.values()].reverse().map((r) => ({
        id: r.id, code: r.code, status: r.status, fare: r.fare, commissionAmount: r.commissionAmount,
        driverEarning: r.driverEarning, createdAt: r.createdAt,
        from: { name: r.from.name }, to: { name: r.to.name },
        customer: { fullName: r.customer.fullName || 'Client', phone: r.customer.phone },
        driver: r.driver ? { fullName: r.driver.user.fullName } : null,
      }));
      return [200, { data: rows, nextCursor: null }];
    },
  });
}
