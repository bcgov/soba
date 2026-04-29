import './globals.css';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_SOBA_API_BASE_URL || DEFAULT_API_BASE_URL;
  const featuresAllowed = process.env.NEXT_PUBLIC_SOBA_FEATURES_ALLOWED ?? '';
  return (
    <html lang="en">
      <head></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
