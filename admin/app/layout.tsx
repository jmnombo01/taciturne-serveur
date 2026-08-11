import './globals.css';

export const metadata = {
  title: 'Taciturne Admin',
  description: 'Back-office Taciturne Delivery — pilotage de la plateforme',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
