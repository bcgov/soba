import './globals.css';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_SOBA_API_BASE_URL || DEFAULT_API_BASE_URL;
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__SOBA_API_BASE_URL=${JSON.stringify(apiBaseUrl)};`,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
