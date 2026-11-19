/* Onisep – Idéo-Actions de dispositif, ODbL. Lecture du GeoJSON officiel. */
(function(root){
'use strict';
const URL='https://data.onisep.fr/api/v1/downloads/60867458bb600/60867458bb600.geojson';
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const types=[['arts et metiers du spectacle','Arts et métiers du spectacle'],['mathematiques','Mathématiques et sciences'],['arts plastiques','Arts plastiques'],['cinema','Cinéma'],['musique','Musique'],['danse','Danse'],['theatre','Théâtre']];
const trim=v=>typeof v==='string'?v.trim():typeof v==='number'?String(v):'';
function parse(geo,kind,local=[]){
 if(geo?.type!=='FeatureCollection'||!Array.isArray(geo.features))throw Error('Format GeoJSON Onisep non reconnu.');
 const out=new Map();const old=new Map(local.map(e=>[e.uai,e]));let relevant=0,unlocated=0;
 for(const feature of geo.features){
  const p=Object.entries(feature.properties||{}).map(([k,v])=>[norm(k),trim(v)]);
  const values=p.map(([,v])=>v).filter(Boolean);
  const labels=values.filter(v=>kind==='cha'?/classe[s]? a horaire[s]? amenage[s]?/.test(norm(v))||/^(cham|chad|chat|chaap|chaams|chams)$/.test(norm(v)):/unite[s]? pedagogique[s]? pour eleves allophones|upe2a/.test(norm(v)));
  if(!labels.length)continue;
  relevant++;
  const get=(...patterns)=>{for(const re of patterns){const match=p.find(([k,v])=>re.test(k)&&v);if(match)return match[1]}return ''};
  const uai=(get(/(?:^| )uai(?: |$)/,/code uai/)||values.find(v=>/^\d{7}[A-Z]$/i.test(v))||'').toUpperCase();
  if(!/^\d{7}[A-Z]$/.test(uai))continue;
  const fallback=old.get(uai)||{};
  const coords=feature.geometry?.type==='Point'?feature.geometry.coordinates:null;
  let lat=coords?.[1]??fallback.lat,lng=coords?.[0]??fallback.lng;
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){unlocated++;continue}
  let nom=get(/^(ens|structure|etablissement) (libelle|nom)( |$)/,/^(libelle|nom) (ens|structure|etablissement)( |$)/,/^nom etablissement$/)||fallback.nom||values.find(v=>/^(coll[eè]ge|lyc[eé]e|[eé]cole|[eé]tablissement r[eé]gional|ere[a]\b)/i.test(v));
  if(!nom)continue;
  const typeText=get(/^(ens|structure|etablissement) type( |$)/,/^type (ens|structure|etablissement)( |$)/)||nom;
  const type=/coll/.test(norm(typeText))?'Collège':/lycee|lyc/.test(norm(typeText))?'Lycée':/ecole/.test(norm(typeText))?'École':/erea|regional d enseignement adapte/.test(norm(typeText))?'EREA':'Autre';
  const cp=get(/^(ens|structure|etablissement) (code postal|cp)( |$)/,/^code postal( |$)/,/^cp$/)||fallback.cp||values.find(v=>/^\d{5}$/.test(v))||'';
  const dept=get(/^(ens|structure|etablissement) (code )?departement( |$)/,/^code departement( |$)/)||fallback.dept||(cp.startsWith('97')||cp.startsWith('98')?cp.slice(0,3):cp.slice(0,2));
  const ville=get(/^(ens|structure|etablissement) (commune|ville)( |$)/,/^(commune|ville)( |$)/)||fallback.ville||'';
  const adr=get(/^(ens|structure|etablissement) adresse( |$)/,/^adresse( |$)/)||fallback.adr||'';
  const academie=get(/^(ens|structure|etablissement) academie( |$)/,/^academie( |$)/)||fallback.academie||'';
  const tel=get(/^(ens|structure|etablissement) (telephone|tel)( |$)/,/^(telephone|tel)( |$)/)||fallback.tel||'';
  const web=get(/^(ens|structure|etablissement) (site web|web|url site)( |$)/,/^site web( |$)/)||fallback.web||'';
  const statut=get(/^(ens|structure|etablissement) statut( |$)/,/^statut( |$)/)||fallback.statut||'';
  let e=out.get(uai)||{uai,nom,adr,cp,ville,dept,lat,lng,type,academie,tel,web,statut,specialites:[],source:'Onisep — Idéo-Actions de dispositif (ODbL)'};
  if(kind==='cha'){
   const specs=types.filter(([q])=>labels.some(v=>norm(v).includes(q))).map(([,v])=>v);
   const acronyms={cham:'Musique',chad:'Danse',chat:'Théâtre',chaap:'Arts plastiques',chaams:'Arts et métiers du spectacle',chams:'Mathématiques et sciences'};
   for(const v of labels)if(acronyms[norm(v)])specs.push(acronyms[norm(v)]);
   e.specialites=[...new Set([...e.specialites,...(specs.length?specs:['Autre CHA'])])];
  }else{
   const nsa=values.some(v=>/upe2a nsa|non scolarises anterieurement|peu ou pas scolarises|non ou peu scolarises/.test(norm(v)));
   e.nsa=nsa||e.nsa===true?true:null;e.specialites=e.nsa?['UPE2A','UPE2A-NSA']:['UPE2A'];
  }
  out.set(uai,e);
 }
 if(out.size<Math.max(local.length,kind==='upe2a'?100:100))throw Error('Le catalogue ne fournit que '+out.size+' correspondances utilisables. L’inventaire local est conservé.');
 // Ne pas perdre les dispositifs locaux spécifiquement documentés et absents du catalogue.
 for(const item of local){const e=out.get(item.uai);if(e){if(item.sourcesSpecialites){e.sourcesSpecialites=item.sourcesSpecialites;e.specialites=[...new Set([...e.specialites,...item.specialites])]}if(item.nsa===true){e.nsa=true;e.specialites=[...new Set([...e.specialites,'UPE2A-NSA'])]}for(const k of ['ville','adr','cp','dept','tel','web'])if(!e[k]&&item[k])e[k]=item[k]}else out.set(item.uai,item)}
 return{rows:[...out.values()],relevant,unlocated};
}
async function load(kind,local=[],file=null){
 let geo;if(file){geo=JSON.parse(await file.text())}
 else{const r=await fetch(URL,{signal:AbortSignal.timeout(90000),cache:'default'});if(!r.ok)throw Error('HTTP '+r.status);geo=await r.json()}
 return parse(geo,kind,local);
}
root.PortalOnisep={load,parse,URL};
})(window);
