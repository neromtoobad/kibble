import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kibble',
    short_name: 'Kibble',
    description: 'Adopt a Stockling that works the hours your shares cannot — an agent holding a tokenized-stock perpetual on Bitget, paying its own funding, and able to faint.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F5EE',
    theme_color: '#C8FF3D',
    icons: [{ src: '/icon.png', sizes: '512x512', type: 'image/png' }],
  };
}
