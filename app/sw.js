// Service worker do aplicativo de celular.
//
// MORA EM app/ DE PROPOSITO: um service worker so intercepta o que esta na
// pasta dele e abaixo. Daqui ele nunca enxerga o sistema (index.html, css/,
// js/ na raiz) — nenhuma pagina do sistema passa por este cache.
//
// Guarda so a "casca" do app (pagina, icones, manifest, fontes, biblioteca do
// Supabase) para abrir instantaneo e funcionar mesmo sem sinal. DADO NUNCA e
// guardado aqui: tudo que fala com o Supabase passa direto pela rede, senao o
// app mostraria numero velho achando que e o atual. Os ultimos dados buscados
// ficam no localStorage, e a propria pagina avisa na faixa do topo quando
// estiver mostrando dados guardados.
//
// Trocou o app/index.html? Suba o numero da versao abaixo, senao o celular de
// quem ja instalou continua abrindo a pagina antiga.
var VERSAO = 'frota-v3';

var CASCA = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(VERSAO).then(function(c){
      // addAll falha inteiro se um arquivo faltar; aqui cada um vai por conta
      return Promise.all(CASCA.map(function(u){ return c.add(u).catch(function(){}); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){ return k===VERSAO ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;                       // login e consultas POST: nunca tocar
  var url = new URL(req.url);
  if(url.hostname.indexOf('supabase.co') >= 0) return;   // dado do banco sempre da rede

  // cinto e suspensorio: so toca em arquivo de dentro de app/ (ou dos CDNs que
  // o app carrega). Qualquer coisa da raiz do site segue direto para a rede.
  var daPastaDoApp = url.href.indexOf(self.registration.scope) === 0;
  var deCDN = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if(!daPastaDoApp && !deCDN) return;

  // Casca: responde do cache na hora e busca a versao nova por tras.
  e.respondWith(
    caches.open(VERSAO).then(function(cache){
      return cache.match(req).then(function(guardado){
        var daRede = fetch(req).then(function(res){
          if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(function(){ return guardado; });
        return guardado || daRede;
      });
    })
  );
});
