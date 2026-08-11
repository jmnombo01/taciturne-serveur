# Taciturne Delivery — Console Admin (Next.js)

Back-office de la plateforme : pilotage des commandes, validation KYC des
partenaires et livreurs, utilisateurs, remboursements, configuration
(zones & tarifs, coupons, sponsoring ⭐). **Chaque action sensible est
journalisée** dans le journal d'audit côté API.

## Prérequis

- Node.js 20+
- L'API qui tourne (`apps/api`, voir `docs/05-demarrage.md`)

## Lancer

```bash
cd apps/admin
npm install
NEXT_PUBLIC_API_URL=http://localhost:3000/v1 npm run dev   # port 3100
# build de production vérifié : npm run build (12 pages, 0 erreur)
```

Ouvrez http://localhost:3100 → connexion avec le compte admin du seed :
**`admin@taciturne-delivery.bf` / `Admin@123`** (ou téléphone `+22670000000`).

> Le navigateur appelle `/backend/*` (même origine) et le serveur Next proxifie vers
> `NEXT_BACKEND_URL` (**défini au build**, défaut `http://localhost:3000`) — aucune URL
> absolue en dur côté client ; alternative : `NEXT_PUBLIC_API_URL=https://api.example/v1`.

## Démo visuelle sans base (données fictives)

```bash
node ../../apps/mock/server.mjs                       # mock API (port 3001) — même contrat
cd apps/admin
NEXT_BACKEND_URL=http://127.0.0.1:3001 npm run build  # rewrites figées au build !
npm run start -- -p 3100                               # console cliquable, mutations rejouables
```

⚠️ Le mock est **en mémoire** (repart à zéro au redémarrage) et ne remplace pas `apps/api`.

## Pages

| Page | Contenu |
|---|---|
| 📊 `/dashboard` | KPI du cahier des charges (commandes du jour, CA plateforme, livreurs/commerces/clients actifs), graphe 7 jours, positions GPS des livreurs (polling 10–15 s), top commerces |
| 📦 `/orders` | Toutes les commandes, filtres par statut (chips), tiroir de détail complet (articles, paiement, livreur, timeline), **annulation admin motivée** |
| 🛵 `/drivers` | Filtres (en ligne / KYC), approbation KYC, suspension motivée, positions GPS en direct |
| 🏪 `/partners` | Validation KYC (approuver/rejeter avec motif), **taux de commission par commerce** (lu côté serveur à chaque commande) |
| 👥 `/users` | Recherche nom/téléphone, filtres par rôle, suspension/réactivation, pagination |
| 💸 `/refunds` | File des demandes clients (approuver/rejeter) + remboursement manuel d'un paiement (montant **re-validé côté serveur**) |
| ⚙️ `/config` | Zones & tarifs (base livraison, tarif/km, frais de service, commande min.), coupons (%, montant, livraison offerte), sponsoring ⭐ (emplacement, prix/jour, période) |

## Sécurité

- Token JWT admin en `localStorage` (rôle `ADMIN` exigé côté API, garde `RolesGuard`)
- 401 → redirection `/login`
- Aucun prix/commission/montant de remboursement n'est pris en confiance :
  la console ne fait que demander, le serveur calcule et borne
- Les mutations passent par le `journal d'audit` (qui, quoi, avant/après)

## Stack

Next.js 14 (App Router) + React 18 — **100 % client components**, aucun
pré-rendu dépendant de l'API, CSS maison « Bleu nuit » (terracotta/sable/encre/or/feuille)
dans `app/globals.css`. Aucune dépendance UI externe.
