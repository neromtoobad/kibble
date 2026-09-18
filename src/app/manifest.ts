import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Night Shift',
    short_name: 'Night Shift',
    description: 'Adopt a Stockling that works the hours your shares cannot — an agent holding a tokenized-stock perpetual on Bitget, paying its own funding, and able to faint.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F5EE',
    theme_color: '#C8FF3D',
    icons: [{ src: '/icon.png', sizes: '1024x1024', type: 'image/png' }],
  };
}
