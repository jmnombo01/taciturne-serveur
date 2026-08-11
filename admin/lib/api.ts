// Par défaut : même origine via le proxy Next (/backend/*, voir next.config.mjs) —
// aucune URL absolue n'est codée côté navigateur (fonctionne derrière un reverse proxy).
const API = process.env.NEXT_PUBLIC_API_URL || '/backend/v1';

export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('adminToken');
    window.location.href = '/login';
    throw new Error('Session expirée');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message || `Erreur ${res.status}`);
  }
  return data;
}

export function fcfa(n: number | null | undefined): string {
  return `${(n ?? 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`;
}

export const statusLabel: Record<string, string> = {
  CREATED: 'Créée',
  PAYMENT_PENDING: 'Paiement en cours',
  PAID: 'Payée',
  PARTNER_PENDING: 'Attente partenaire',
  ACCEPTED: 'Acceptée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  DRIVER_ASSIGNED: 'Livreur assigné',
  PICKED_UP: 'Récupérée',
  ON_THE_WAY: 'En route',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REJECTED: 'Refusée',
  FAILED: 'Échouée',
  REFUNDED: 'Remboursée',
};

export function badgeClass(status: string): string {
  if (['DELIVERED'].includes(status)) return 'green';
  if (['CANCELLED', 'REJECTED', 'FAILED'].includes(status)) return 'red';
  if (['REFUNDED'].includes(status)) return 'blue';
  if (['PREPARING', 'ACCEPTED', 'PARTNER_PENDING'].includes(status)) return 'gold';
  if (['READY', 'DRIVER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(status)) return 'orange';
  return 'grey';
}

export function shortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
