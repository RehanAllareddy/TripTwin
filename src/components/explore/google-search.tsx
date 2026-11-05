/**
 * Phone app: Google's Places UI Kit autocomplete inside a WebView (site origin, so the
 * referrer-restricted browser key works). The WebView grows while suggestions are open.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { GOOGLE_MAPS_BROWSER_KEY, SITE_URL } from '@/lib/explore/config';
import { isValidPlaceId, mapsScriptUrl } from '@/lib/explore/ratings';

import { WebView, type WebViewMessageEvent } from './web-view';

const html = () => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;background:transparent;font-family:-apple-system,Roboto,sans-serif}gmp-basic-place-autocomplete{width:100%;color-scheme:light}</style></head>
<body><div id="h"></div><script>
var post=function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));};
function size(){post({type:'height',h:Math.ceil(document.documentElement.scrollHeight)});}
window.__ready=function(){google.maps.importLibrary('places').then(function(lib){
  var el=new lib.BasicPlaceAutocompleteElement();
  el.placeholder='Search any place: city, address, restaurant…';
  el.addEventListener('gmp-select',function(e){if(e.place&&e.place.id){post({type:'select',id:e.place.id});var i=el.shadowRoot&&el.shadowRoot.querySelector('input');if(i)i.blur();}});
  el.addEventListener('gmp-error',function(){post({type:'error'});});
  document.getElementById('h').appendChild(el);
  new ResizeObserver(size).observe(document.body); new MutationObserver(size).observe(document.body,{subtree:true,childList:true,attributes:true}); size();
}).catch(function(){post({type:'error'});});};
</script><script async src=${JSON.stringify(mapsScriptUrl(GOOGLE_MAPS_BROWSER_KEY, '__ready'))} onerror="post({type:'error'})"></script></body></html>`;

export function GoogleSearch({ onSelect, onError }: { onSelect: (placeId: string) => void; onError: () => void }) {
  const [height, setHeight] = useState(52);
  const source = useMemo(() => ({ html: html(), baseUrl: SITE_URL }), []);
  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; id?: string; h?: number };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'height' && typeof m.h === 'number') setHeight(Math.min(420, Math.max(52, m.h)));
    else if (m.type === 'select' && m.id && isValidPlaceId(m.id)) onSelect(m.id);
    else if (m.type === 'error') onError();
  };
  return (
    <View style={{ height }}>
      <WebView source={source} originWhitelist={['*']} onMessage={onMessage} scrollEnabled={false} keyboardDisplayRequiresUserAction={false} style={{ backgroundColor: 'transparent' }} />
    </View>
  );
}
