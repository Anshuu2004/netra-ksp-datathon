import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NETRA — Crime Intelligence Workstation',
  description: 'Bilingual conversational crime-intelligence workstation for Karnataka State Police (KSP Datathon 2026).',
  icons: {
    // Khaki ground + jade mark, matching the app palette (was the old cyan tile).
    icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#1e1c15"/><rect x="6" y="6" width="88" height="88" rx="14" fill="none" stroke="#4bbd91" stroke-width="4"/><text x="50" y="70" font-size="52" text-anchor="middle" fill="#eeebe2" font-weight="bold" font-family="system-ui,sans-serif">ನೇ</text></svg>'),
  },
};

export const viewport = { themeColor: '#0b0a07' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Only Noto Sans Kannada is loaded from the web — Latin UI uses the platform sans
            (Segoe UI on the Windows police desktops this targets), which is clean, instant,
            and needs no network. Kannada glyphs fall through to Noto for consistent metrics. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
