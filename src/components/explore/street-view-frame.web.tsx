import { createElement } from 'react';

/** Website: Google's Street View embed in an iframe (Maps Embed API). */
export function StreetViewFrame({ src, title }: { src: string; title: string }) {
  return createElement('iframe', {
    src,
    title,
    allowFullScreen: true,
    loading: 'eager',
    style: { border: 0, width: '100%', height: '100%', display: 'block' },
  });
}
