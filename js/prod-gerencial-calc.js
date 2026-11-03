// ==================== RELATORIO GERENCIAL — CALCULO ====================
// Camada de calculo da visao Diretoria da aba Producao. SEM DOM de proposito: roda no
// navegador e no Node (o mesmo arquivo e conferido por teste-calc.js, em
// Documentos/biomassa-mockups/relatorio-gerencial/, contra 91 consultas no Postgres).
// Nenhum desenho mora aqui; quem desenha e js/prod-gerencial.js.
//
// ENTREGA = linha com LOCAL DESCARGA preenchido e QUANTIDADE > 0 — a mesma regra da aba
// Relatorio (js/relatorio.js:61), nao a da visao Operacional desta aba, que exige o campo
// numerico ENTREGA preenchido. As duas batem no mes a mes (out/2026: 404 pelas duas); a
// diferenca no historico todo e de 21 linhas com descarga e sem o campo ENTREGA, que o
// relatorio da diretoria deve contar, porque houve entrega.
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports=factory();
  else root.GER=factory();
})(typeof self!=='undefined'?self:this, function(){

  // ---------- datas (string YYYY-MM-DD, sem Date pra nao pegar fuso) ----------
  function ymd(d){ return [d.getUTCFullYear(), String(d.getUTCMonth()+1).padStart(2,'0'), String(d.getUTCDate()).padStart(2,'0')].join('-'); }
  function toDate(s){ var p=String(s).slice(0,10).split('-'); return new Date(Date.UTC(+p[0], +p[1]-1, +p[2])); }
  function addDias(s, n){ var d=toDate(s); d.setUTCDate(d.getUTCDate()+n); return ymd(d); }
  function diffDias(ini, fim){ return Math.round((toDate(fim)-toDate(ini))/86400000)+1; }
  function ultimoDiaMes(ano, mes){ return new Date(Date.UTC(ano, mes, 0)).getUTCDate(); }
  function ehDia1(s){ return s.slice(8,10)==='01'; }
  function ehUltimoDia(s){ var p=s.split('-'); return +p[2]===ultimoDiaMes(+p[0], +p[1]); }

  var MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  var MESES_CURTO=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  function dataBR(s){ var p=String(s).slice(0,10).split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }

  // Aceita YYYY-MM-DD (o que vem do Supabase) e DD/MM/AAAA (digitacao antiga), igual ao
  // getMonthYear/formatDateBR do js/utils.js. Devolve sempre YYYY-MM-DD, ou '' se nao der.
  function iso(v){
    if(!v) return '';
    if(Object.prototype.toString.call(v)==='[object Date]'){
      return isNaN(v) ? '' : [v.getFullYear(), String(v.getMonth()+1).padStart(2,'0'), String(v.getDate()).padStart(2,'0')].join('-');
    }
    var s=String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    var m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? m[3]+'-'+m[2]+'-'+m[1] : '';
  }
  // Mesma conversao do num() de js/utils.js, repetida aqui pra este arquivo rodar no Node
  // sozinho (o teste nao carrega utils.js).
  function n(v){
    if(v===null || v===undefined || v==='') return 0;
    if(typeof v==='number') return isFinite(v)?v:0;
    var s=String(v).trim();
    if(s.indexOf(',')>=0) return parseFloat(s.replace(/\./g,'').replace(',','.')) || 0;
    if(/\.\d{3}$/.test(s)) return parseFloat(s.replace(/\./g,'')) || 0;
    return parseFloat(s) || 0;
  }
  function txt(v){ return v==null ? '' : String(v).trim(); }

  // "setembro de 2026" quando o intervalo e um mes fechado; senao "01/07/2026 a 30/09/2026"
  function rotuloPeriodo(ini, fim){
    if(!ini || !fim) return 'Período completo';
    var pi=ini.split('-'), pf=fim.split('-');
    if(ehDia1(ini) && ehUltimoDia(fim)){
      if(pi[0]===pf[0] && pi[1]===pf[1]) return MESES[+pi[1]-1]+' de '+pi[0];
      if(pi[0]===pf[0]) return MESES_CURTO[+pi[1]-1]+' a '+MESES_CURTO[+pf[1]-1]+' de '+pi[0];
    }
    return dataBR(ini)+' a '+dataBR(fim);
  }

  // Periodo anterior comparavel: meses fechados voltam o mesmo numero de meses;
  // qualquer outro intervalo volta o mesmo numero de dias, colado no inicio.
  function periodoAnterior(ini, fim){
    if(!ini || !fim) return null;
    if(ehDia1(ini) && ehUltimoDia(fim)){
      var pi=ini.split('-'), pf=fim.split('-');
      var nMeses=(+pf[0]-+pi[0])*12 + (+pf[1]-+pi[1]) + 1;
      var aIni=new Date(Date.UTC(+pi[0], +pi[1]-1-nMeses, 1));
      var aFimMes=new Date(Date.UTC(+pf[0], +pf[1]-1-nMeses, 1));
      var ultimo=ultimoDiaMes(aFimMes.getUTCFullYear(), aFimMes.getUTCMonth()+1);
      var aFim=new Date(Date.UTC(aFimMes.getUTCFullYear(), aFimMes.getUTCMonth(), ultimo));
      return {ini:ymd(aIni), fim:ymd(aFim)};
    }
    var nd=diffDias(ini, fim);
    return {ini:addDias(ini, -nd), fim:addDias(ini, -1)};
  }

  // ---------- base ----------
  function finalizar(linhas){
    var datas=linhas.map(function(r){return r.data}).sort();
    return {linhas:linhas, dataMin:datas[0]||'', dataMax:datas[datas.length-1]||''};
  }

  // Entrada do sistema: DB.cadastro + BASE.clientesM3 (a lista que o js/data.js monta com os
  // locais de unidade M3, ja incluindo ADM PF e ADM LEM, que sao sempre m³).
  function montarDoCadastro(cadastro, locaisM3){
    var m3={};
    (locaisM3||[]).forEach(function(l){ m3[txt(l)]=1; });
    var linhas=[];
    (cadastro||[]).forEach(function(r){
      var data=iso(r.DATA);
      if(!data) return;
      var des=txt(r['LOCAL DESCARGA']);
      linhas.push({
        data:data,
        mot:txt(r.MOTORISTA),
        // sem espaco: a mesma normalizacao de placa do js/consumo.js, senao "ABC 1234" e
        // "ABC1234" viram dois caminhoes e os trechos de km/L nao fecham
        pla:txt(r.PLACA).replace(/\s/g,''),
        car:txt(r['LOCAL CARGA']),
        des:des,
        qtd:n(r.QUANTIDADE), km:n(r.KM), lit:n(r['QTDADE LITROS']),
        un: des ? (m3[des]?'M³':'TON') : ''
      });
    });
    return finalizar(linhas);
  }

  // Entrada do mockup: dados.json colunar com dicionario de strings (so o teste usa).
  function montarBase(dados){
    var d=dados.dic, uni=dados.unidadePorLocal||{};
    return finalizar(dados.linhas.map(function(l){
      var des=l[4]>=0?d.des[l[4]]:'';
      return {data:l[0], mot:l[1]>=0?d.mot[l[1]]:'', pla:l[2]>=0?d.pla[l[2]]:'',
        car:l[3]>=0?d.car[l[3]]:'', des:des, qtd:l[5]||0, km:l[6]||0, lit:l[7]||0,
        un:des?(uni[des]||'TON'):''};
    }));
  }

  function noPeriodo(r, ini, fim){ return (!ini || r.data>=ini) && (!fim || r.data<=fim); }
  function ehEntrega(r){ return r.qtd>0 && !!r.des; }

  // ---------- km/L tanque-a-tanque ----------
  // Mesma regra de js/consumo.js (calcSegmentosPorPlaca): ordena os abastecimentos da PLACA por
  // KM e fecha trechos entre dois abastecimentos; os litros do trecho sao os do abastecimento que
  // o FECHA. A sequencia usa todos os motoristas da placa — o filtro por motorista so escolhe
  // quais trechos ja fechados sao dele, senao o km rodado por um substituto entra na conta do outro.
  function kmLPorMotorista(linhas){
    var porPlaca={};
    linhas.forEach(function(r){
      if(!r.pla || !r.lit || r.lit<=0) return;
      if(!r.km || r.km<=0) return;
      (porPlaca[r.pla]=porPlaca[r.pla]||[]).push(r);
    });
    var acc={};
    Object.keys(porPlaca).forEach(function(p){
      var ab=porPlaca[p].slice().sort(function(a,b){return a.km-b.km});
      for(var i=1;i<ab.length;i++){
        var trecho=ab[i].km-ab[i-1].km, lit=ab[i].lit, mot=ab[i].mot;
        if(trecho<=0 || lit<=0 || !mot) continue;
        if(!acc[mot]) acc[mot]={km:0, lit:0};
        acc[mot].km+=trecho; acc[mot].lit+=lit;
      }
    });
    var out={};
    Object.keys(acc).forEach(function(m){ if(acc[m].lit>0) out[m]=acc[m].km/acc[m].lit; });
    return out;
  }

  // ---------- agregacoes ----------
  function resumo(entregas){
    var ton=0, m3=0, entTon=0, entM3=0, mot={}, pla={}, dias={};
    entregas.forEach(function(r){
      if(r.un==='M³'){ m3+=r.qtd; entM3++; } else { ton+=r.qtd; entTon++; }
      if(r.mot) mot[r.mot]=1;
      if(r.pla) pla[r.pla]=1;
      dias[r.data]=1;
    });
    var nDias=Object.keys(dias).length;
    return {
      entregas:entregas.length, ton:ton, m3:m3, entTon:entTon, entM3:entM3,
      motoristas:Object.keys(mot).length, caminhoes:Object.keys(pla).length,
      diasOperados:nDias,
      mediaTon:entTon?ton/entTon:0, mediaM3:entM3?m3/entM3:0,
      entregasDia:nDias?entregas.length/nDias:0
    };
  }

  // Agrupa por local (carga ou descarga) mantendo TON e m³ separados — nunca somados.
  function porLocal(entregas, campo){
    var g={};
    entregas.forEach(function(r){
      var k=r[campo] || '(não informado)';
      if(!g[k]) g[k]={local:k, entregas:0, ton:0, m3:0, entTon:0, entM3:0};
      g[k].entregas++;
      if(r.un==='M³'){ g[k].m3+=r.qtd; g[k].entM3++; } else { g[k].ton+=r.qtd; g[k].entTon++; }
    });
    return Object.keys(g).map(function(k){
      var x=g[k];
      // unidade dominante, só pra rotular a linha na tabela
      x.un = x.m3>0 && x.entM3>=x.entTon ? 'M³' : (x.ton>0 ? 'TON' : 'M³');
      return x;
    }).sort(function(a,b){ return b.entregas-a.entregas || b.ton+b.m3-(a.ton+a.m3); });
  }

  function porMotorista(entregas, kml){
    var g={};
    entregas.forEach(function(r){
      var k=r.mot || '(sem motorista)';
      if(!g[k]) g[k]={mot:k, entregas:0, ton:0, m3:0, placas:{}};
      g[k].entregas++;
      if(r.un==='M³') g[k].m3+=r.qtd; else g[k].ton+=r.qtd;
      if(r.pla) g[k].placas[r.pla]=1;
    });
    return Object.keys(g).map(function(k){
      var x=g[k];
      return {mot:x.mot, entregas:x.entregas, ton:x.ton, m3:x.m3,
              placas:Object.keys(x.placas).length, kmL:(kml[x.mot]!=null?kml[x.mot]:null)};
    }).sort(function(a,b){ return b.entregas-a.entregas; });
  }

  // Diario ate 62 dias, mensal acima — senao o eixo vira um borrao de rotulos.
  function evolucao(entregas, ini, fim){
    var dias=diffDias(ini, fim);
    var gran = dias<=62 ? 'dia' : 'mes';
    var g={};
    entregas.forEach(function(r){
      var k = gran==='dia' ? r.data : r.data.slice(0,7);
      if(!g[k]) g[k]={chave:k, entregas:0, ton:0, m3:0};
      g[k].entregas++;
      if(r.un==='M³') g[k].m3+=r.qtd; else g[k].ton+=r.qtd;
    });
    var pontos=[];
    if(gran==='dia'){
      // todos os dias do intervalo, inclusive os parados — o vazio de domingo é informação
      for(var d=ini; d<=fim; d=addDias(d,1)){
        var x=g[d]||{chave:d, entregas:0, ton:0, m3:0};
        x.rotulo=d.slice(8,10)+'/'+d.slice(5,7);
        pontos.push(x);
      }
    } else {
      Object.keys(g).sort().forEach(function(k){
        var x=g[k];
        x.rotulo=MESES_CURTO[+k.slice(5,7)-1]+'/'+k.slice(2,4);
        pontos.push(x);
      });
    }
    return {granularidade:gran, pontos:pontos};
  }

  function variacao(atual, ant){
    if(ant===0 || ant==null) return null;   // sem base de comparacao: a tela mostra "—"
    return (atual-ant)/ant*100;
  }

  // ---------- entrada principal ----------
  function calcular(base, ini, fim){
    ini=ini||base.dataMin; fim=fim||base.dataMax;
    var doPeriodo=base.linhas.filter(function(r){ return noPeriodo(r, ini, fim); });
    var entregas=doPeriodo.filter(ehEntrega);
    var kpis=resumo(entregas);

    var ant=periodoAnterior(ini, fim), kpisAnt=null, vars=null;
    if(ant){
      var entAnt=base.linhas.filter(function(r){ return noPeriodo(r, ant.ini, ant.fim) && ehEntrega(r); });
      kpisAnt=resumo(entAnt);
      vars={};
      ['entregas','ton','m3','motoristas','caminhoes','mediaTon','mediaM3','entregasDia'].forEach(function(k){
        vars[k]=variacao(kpis[k], kpisAnt[k]);
      });
    }

    return {
      periodo:{ini:ini, fim:fim, dias:diffDias(ini,fim), rotulo:rotuloPeriodo(ini,fim)},
      anterior: ant ? {ini:ant.ini, fim:ant.fim, rotulo:rotuloPeriodo(ant.ini,ant.fim), kpis:kpisAnt} : null,
      kpis:kpis, variacao:vars,
      descarga:porLocal(entregas, 'des'),
      carga:porLocal(entregas, 'car'),
      motoristas:porMotorista(entregas, kmLPorMotorista(doPeriodo)),
      evolucao:evolucao(entregas, ini, fim)
    };
  }

  // Top N + "Outros" agregado, pro grafico nao virar sopa de 35 barras no ano inteiro.
  function topN(lista, n){
    if(lista.length<=n) return {itens:lista.slice(), resto:0};
    var itens=lista.slice(0, n), resto=lista.slice(n);
    var o={local:'Outros ('+resto.length+')', entregas:0, ton:0, m3:0, entTon:0, entM3:0, un:'TON', _outros:true};
    resto.forEach(function(x){ o.entregas+=x.entregas; o.ton+=x.ton; o.m3+=x.m3; o.entTon+=x.entTon; o.entM3+=x.entM3; });
    itens.push(o);
    return {itens:itens, resto:resto.length};
  }

  return {montarBase:montarBase, montarDoCadastro:montarDoCadastro, calcular:calcular, topN:topN,
          periodoAnterior:periodoAnterior, rotuloPeriodo:rotuloPeriodo,
          dataBR:dataBR, iso:iso, addDias:addDias, diffDias:diffDias, ultimoDiaMes:ultimoDiaMes};
});
