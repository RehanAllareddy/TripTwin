import { Linking } from 'react-native';

import { SITE_URL } from '@/lib/explore/config';

import { WebView } from './web-view';

/** Phone app: the same embed inside a WebView, with the site as origin so the browser key's referrer check passes. */
export function StreetViewFrame({ src, title }: { src: string; title: string }) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;height:100%;width:100%;border:0;background:#000}</style></head>
<body><iframe src="${esc(src)}" title="${esc(title)}" allowfullscreen></iframe></body></html>`;
  return (
    <WebView
      source={{ html, baseUrl: SITE_URL }}
      originWhitelist={['*']}
      allowsFullscreenVideo
      style={{ backgroundColor: '#000' }}
      onShouldStartLoadWithRequest={(req) => {
        if (!req.isTopFrame || req.url.startsWith('about:') || req.url.startsWith(SITE_URL)) return true;
        Linking.openURL(req.url);
        return false;
      }}
    />
  );
}
