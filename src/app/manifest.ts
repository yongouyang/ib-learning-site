import type { MetadataRoute } from 'next';

// Palette: brand blue = Tailwind blue-600 (#2563eb, used for links/accents),
// background = light body background (bg-gray-50, #f9fafb). Dark theme is left
// to the OS / prefers-color-scheme media handling.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IBLearn',
    short_name: 'IBLearn',
    description: 'Learn and practise for IB exams',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    categories: ['education'],
    theme_color: '#2563eb',
    background_color: '#f9fafb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
