/**
 * Phone app: runs Google's Places UI Kit inside a WebView whose origin is the TripTwin
 * website, so the HTTP-referrer-restricted browser key works. Links open in the browser.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { GOOGLE_MAPS_BROWSER_KEY, SITE_URL } from '@/lib/explore/config';
import { attractionsMarkup, destinationMarkup, googleMapsPlaceIdUrl, isValidPlaceId, mapsScriptUrl, type RatingsEvent, type RatingsTarget } from '@/lib/explore/ratings';

import { WebView, type WebViewHandle, type WebViewMessageEvent } from './web-view';

function buildHtml(target: RatingsTarget) {
  const dest = isValidPlaceId(target.placeId) ? destinationMarkup(target.placeId) : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:-apple-system,Roboto,sans-serif;background:transparent}#wrap{display:flex;flex-direction:column;gap:12px}</style></head>
<body><div id="wrap"><div id="dest"></div><div id="attr"></div></div>
<script>
var post=function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));};
var DEST=${JSON.stringify(dest)}, ATTR=${JSON.stringify(attractionsMarkup(target))};
function size(){post({type:'height',h:document.getElementById('wrap').getBoundingClientRect().height});}
new ResizeObserver(size).observe(document.body);
function rated(el){var r=el.querySelector('gmp-place-rating');if(r&&r.getBoundingClientRect().height>2)return true;return el.getBoundingClientRect().height>44;}
window.__ready=function(){google.maps.importLibrary('places').then(function(){
  if(DEST){var d=document.getElementById('dest');d.innerHTML=DEST;var de=d.firstElementChild;
    de.addEventListener('gmp-load',function(){setTimeout(function(){post({type:'dest',rated:rated(de)});size();},60);});
    de.addEventListener('gmp-error',function(){post({type:'destError'});});}
  var a=document.getElementById('attr');a.innerHTML=ATTR;var ae=a.firstElementChild;
  ae.addEventListener('gmp-load',function(){post({type:'attr',count:(ae.places||[]).length});size();});
  ae.addEventListener('gmp-error',function(){post({type:'attrError'});});
  ae.addEventListener('gmp-select',function(e){if(e.place&&e.place.id)post({type:'select',id:e.place.id});});
}).catch(function(){post({type:'loadError'});});};
window.TT={clear:function(id){var n=document.getElementById(id);if(n)n.innerHTML='';size();}};
</script>
<script async src=${JSON.stringify(mapsScriptUrl(GOOGLE_MAPS_BROWSER_KEY, '__ready'))} onerror="post({type:'loadError'})"></script>
</body></html>`;
}

export function GoogleUiKit({ target, mountDestination, mountAttractions, onEvent }: { target: RatingsTarget; mountDestination: boolean; mountAttractions: boolean; onEvent: (e: RatingsEvent) => void }) {
  const web = useRef<WebViewHandle>(null);
  const [height, setHeight] = useState(1);
  // Build once per destination so re-renders never trigger duplicate requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildHtml(target), [target.placeId, target.name, target.country]);

  // When a block fails, remove it so no stale Google content remains on screen.
  useEffect(() => {
    if (!mountDestination) web.current?.injectJavaScript('window.TT&&window.TT.clear("dest");true;');
  }, [mountDestination]);
  useEffect(() => {
    if (!mountAttractions) web.current?.injectJavaScript('window.TT&&window.TT.clear("attr");true;');
  }, [mountAttractions]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; rated?: boolean; count?: number; h?: number; id?: string };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'height' && typeof m.h === 'number') setHeight(Math.max(1, Math.ceil(m.h)));
    else if (m.type === 'dest') onEvent({ type: 'destinationLoaded', ratingVisible: !!m.rated });
    else if (m.type === 'destError') onEvent({ type: 'destinationError' });
    else if (m.type === 'attr') onEvent({ type: 'attractionsLoaded', count: m.count ?? 0 });
    else if (m.type === 'attrError') onEvent({ type: 'attractionsError' });
    else if (m.type === 'loadError') {
      onEvent({ type: 'destinationError' });
      onEvent({ type: 'attractionsError' });
    } else if (m.type === 'select' && m.id && isValidPlaceId(m.id)) Linking.openURL(googleMapsPlaceIdUrl(m.id));
  };

  if (!SITE_URL) return null;
  return (
    <View style={{ height }}>
      <WebView
        ref={web}
        source={{ html, baseUrl: SITE_URL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        scrollEnabled={false}
        style={{ backgroundColor: 'transparent' }}
        // Links Google renders (attribution, place pages) open outside the app.
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith('about:') || req.url === `${SITE_URL}/` || req.url === SITE_URL || req.url.startsWith('https://maps.googleapis.com') || !req.isTopFrame) return true;
          Linking.openURL(req.url);
          return false;
        }}
      />
    </View>
  );
}
