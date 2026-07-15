import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NETRA — Crime Intelligence Copilot',
  description: 'Conversational Crime Intelligence Copilot for Karnataka State Police (KSP Datathon 2026).',
  icons: {
    icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#38bdf8"/><text x="50" y="70" font-size="52" text-anchor="middle" fill="#0a0e14" font-weight="bold" font-family="sans-serif">ನೇ</text></svg>'),
  },
};

export const viewport = { themeColor: '#0a0e14' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
