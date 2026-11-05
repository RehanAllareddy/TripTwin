/** Phone app: Google-rendered card for a searched place, in a WebView. */
import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { GOOGLE_MAPS_BROWSER_KEY, SITE_URL } from '@/lib/explore/config';
import { isValidPlaceId, mapsScriptUrl, searchedPlaceMarkup } from '@/lib/explore/ratings';

import { WebView, type WebViewMessageEvent } from './web-view';

export function GooglePlaceDetails({ placeId, onLocation, onError }: { placeId: string; onLocation: (loc: { lat: number; lng: number }) => void; onError: () => void }) {
  const [height, setHeight] = useState(1);
  const source = useMemo(() => {
    const markup = isValidPlaceId(placeId) ? searchedPlaceMarkup(placeId) : '';
    return {
      baseUrl: SITE_URL,
      html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:transparent}</style></head>
<body><div id="h"></div><script>
var post=function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));};
function size(){post({type:'height',h:Math.ceil(document.getElementById('h').getBoundingClientRect().height)});}
window.__ready=function(){google.maps.importLibrary('places').then(function(){
  var h=document.getElementById('h');h.innerHTML=${JSON.stringify(markup)};var el=h.firstElementChild;
  if(!el){post({type:'error'});return;}
  new ResizeObserver(size).observe(h);
  el.addEventListener('gmp-load',function(){var l=el.place&&el.place.location;
    if(l){post({type:'loc',lat:typeof l.lat==='function'?l.lat():l.lat,lng:typeof l.lng==='function'?l.lng():l.lng});}else{post({type:'error'});} size();});
  el.addEventListener('gmp-error',function(){post({type:'error'});});
}).catch(function(){post({type:'error'});});};
</script><script async src=${JSON.stringify(mapsScriptUrl(GOOGLE_MAPS_BROWSER_KEY, '__ready'))} onerror="post({type:'error'})"></script></body></html>`,
    };
  }, [placeId]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; lat?: number; lng?: number; h?: number };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'height' && typeof m.h === 'number') setHeight(Math.max(1, m.h));
    else if (m.type === 'loc' && Number.isFinite(m.lat) && Number.isFinite(m.lng) && Math.abs(m.lat!) <= 90 && Math.abs(m.lng!) <= 180) onLocation({ lat: m.lat!, lng: m.lng! });
    else if (m.type === 'error') onError();
  };

  return (
    <View style={{ height }}>
      <WebView
        source={source}
        originWhitelist={['*']}
        onMessage={onMessage}
        scrollEnabled={false}
        style={{ backgroundColor: 'transparent' }}
        onShouldStartLoadWithRequest={(req) => {
          if (!req.isTopFrame || req.url.startsWith('about:') || req.url.startsWith(SITE_URL) || req.url.startsWith('https://maps.googleapis.com')) return true;
          Linking.openURL(req.url);
          return false;
        }}
      />
    </View>
  );
}
