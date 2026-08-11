'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';

const NAV = [
  { href: '/dashboard', icon: '📊', label: 'Tableau de bord' },
  { href: '/orders', icon: '📦', label: 'Commandes' },
  { href: '/drivers', icon: '🛵', label: 'Livreurs' },
  { href: '/partners', icon: '🏪', label: 'Partenaires' },
  { href: '/users', icon: '👥', label: 'Utilisateurs' },
  { href: '/refunds', icon: '💸', label: 'Paiements & remb.' },
  { href: '/payouts', icon: '🏦', label: 'Reversements' },
  { href: '/config', icon: '⚙️', label: 'Configuration' },
];

export default function Shell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          Taciturne Admin
          <small>Back-office plateforme</small>
        </div>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? 'active' : ''}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
        <button
          className="logout"
          onClick={() => {
            localStorage.removeItem('adminToken');
            router.replace('/login');
          }}
        >
          ⏻ Se déconnecter
        </button>
      </nav>
      <main className="main">
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{sub}</p>
        {children}
      </main>
    </div>
  );
}
