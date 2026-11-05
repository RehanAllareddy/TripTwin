/**
 * Self-contained HTML page that runs the same globe.gl engine inside the phone app's WebView.
 * Messages to React Native: ready | interact | marker | globe | alt
 * Commands from React Native: window.TT.setData(json), window.TT.focus(lat, lng, altitude)
 */
import { FOCUS_ALTITUDE, MARKER_STYLE, START_ALTITUDE } from './globe-logic';

/** Pinned to the version installed for the web build (react-globe.gl → globe.gl 2.46.2). */
const GLOBE_GL = 'https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js';

export function buildGlobeHtml(assetBase: string) {
  const img = (f: string) => `${assetBase}/globe/${f}`;
  return `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body,#g{margin:0;height:100%;width:100%;overflow:hidden;background:#03040B;touch-action:none;-webkit-user-select:none;user-select:none}</style>
<script src="${GLOBE_GL}"></script></head><body><div id="g"></div>
<script>
(function(){
  var post=function(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));};
  if(!window.Globe){post({type:'error'});return;}
  var S=${JSON.stringify(MARKER_STYLE)};
  var selected=null, markers=[], labels=[], rings=[], interacted=false;
  var style=function(m){return m.id===selected?S.selected:S[m.kind];};
  var el=document.getElementById('g');
  var g=new Globe(el,{animateIn:true})
    .globeImageUrl(${JSON.stringify(img('earth-blue-marble.jpg'))})
    .bumpImageUrl(${JSON.stringify(img('earth-topology.png'))})
    .backgroundImageUrl(${JSON.stringify(img('night-sky.png'))})
    .atmosphereColor('#9ec5ff').atmosphereAltitude(0.18)
    .width(window.innerWidth).height(window.innerHeight)
    .pointLat('lat').pointLng('lng')
    .pointAltitude(function(m){return m.kind==='trip'?0.03:0.012;})
    .pointRadius(function(m){return style(m).radius*1.4;})
    .pointColor(function(m){return style(m).color;})
    .labelLat('lat').labelLng('lng').labelText('label')
    .labelSize(function(m){return m.id===selected?1.2:0.85;})
    .labelDotRadius(0).labelAltitude(0.02).labelResolution(2)
    .labelColor(function(m){return style(m).label;})
    .ringLat('lat').ringLng('lng').ringMaxRadius(2.2).ringPropagationSpeed(1.6).ringRepeatPeriod(1400)
    .ringColor(function(m){return m.id===selected?'rgba(249,115,22,0.8)':'rgba(129,140,248,0.7)';})
    .onPointClick(function(m){stop();post({type:'marker',id:m.id});})
    .onLabelClick(function(m){stop();post({type:'marker',id:m.id});})
    .onGlobeClick(function(c){stop();post({type:'globe',lat:c.lat,lng:c.lng,alt:g.pointOfView().altitude});})
    .onZoom(function(p){post({type:'alt',alt:p.altitude});});
  g.pointOfView({lat:20,lng:0,altitude:${START_ALTITUDE}},0);
  var c=g.controls(); c.autoRotate=true; c.autoRotateSpeed=0.45; c.enableDamping=true; c.minDistance=101; c.maxDistance=600;
  function stop(){c.autoRotate=false; if(!interacted){interacted=true;post({type:'interact'});}}
  c.addEventListener('start',stop);
  window.addEventListener('resize',function(){g.width(window.innerWidth).height(window.innerHeight);});
  window.TT={
    setData:function(d){selected=d.selectedId||null; g.pointsData(d.points).labelsData(d.labels).ringsData(d.rings);},
    focus:function(lat,lng,alt){stop(); g.pointOfView({lat:lat,lng:lng,altitude:alt||${FOCUS_ALTITUDE}},1200);}
  };
  post({type:'ready'});
})();
</script></body></html>`;
}
