export default function Head() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#F8FAFC" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="KalanNyetaa" />
      <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
      <link rel="icon" type="image/png" sizes="384x384" href="/icons/icon-384x384.png" />
      <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
      <script dangerouslySetInnerHTML={{ __html: `
        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          window.deferredPrompt = e;
        });
      `}} />
    </>
  )
}
