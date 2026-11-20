/* Cartes des dispositifs : annuaire MEN, compléments officiels 2026, repli local. */
(() => {
"use strict";
const cfg={
 "ulis":{flag:"ulis",label:"ULIS",min:500,color:"#057a55"},
 "segpa":{flag:"segpa",label:"SEGPA",min:500,color:"#d97706"},
 "sections-sportives":{flag:"section_sport",label:"Section sportive",min:800,color:"#e02424"},
 "sections-internationales":{flag:"section_internationale",label:"Section internationale",min:60,color:"#7e3af2"}
};
const kind=document.body.dataset.dispositif, conf=cfg[kind];
const api="https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education";
const officialURL="https://data.education.gouv.fr/explore/dataset/fr-en-annuaire-education/";
const $=id=>document.getElementById(id);
const inclusive=kind==="ulis"||kind==="segpa";
const labels=kind==="ulis"?{TFC:"TFC – Troubles des fonctions cognitives ou mentales",TSA:"TSA – Troubles du spectre de l’autisme",TSLA:"TSLA – Troubles spécifiques du langage et des apprentissages",TFM:"TFM – Troubles des fonctions motrices",TFA:"TFA – Troubles de la fonction auditive",TFV:"TFV – Troubles de la fonction visuelle",TMA:"TMA – Troubles multiples associés"}:{HAS:"HAS – Hygiène, alimentation, services",ERE:"ERE – Espace rural et environnement",Habitat:"Habitat",VDL:"VDL – Vente, distribution, logistique",PI:"PI – Production industrielle"};
const examples={HAS:"cuisine restauration entretien",ERE:"horticulture jardinage espaces verts",Habitat:"menuiserie peinture bâtiment",VDL:"vente commerce stockage",PI:"fabrication assemblage"};
const unknown=kind==="ulis"?"Type non renseigné":"Champs non renseignés";
let localDetails=null,onisepDetails=null;
function enrich(rows){
 if(!inclusive)return rows;
 const local=localDetails?.[kind];
 const onisep=onisepDetails?.[kind];
 return rows.map(e=>{
   const recent=onisep?.rows?.[e.uai],old=local?.rows?.[e.uai];
   const codes=Array.isArray(recent)?recent:Array.isArray(old)?old:[];
   const known=codes.filter(c=>Object.hasOwn(labels,c));
   return {...e,detailCodes:known,details:known.map(c=>labels[c]),detailSource:known.length?(recent?"Onisep – Idéo Actions de dispositif, export consulté le "+onisepDetails.date+" (ODbL)":local.source):"",detailURL:known.length?(recent?"https://www.data.gouv.fr/datasets/ideo-actions-de-dispositif":local.url):"",detailHistorical:!!(!recent&&old)};
 });
}
function detailStatus(){if(!inclusive)return "";const n=all.filter(e=>e.details?.length).length,old=all.filter(e=>e.detailHistorical).length;return " · "+n+" fiches avec détail, dont "+old+" issues de sources historiques à reconfirmer."}

const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const txt=v=>String(v??"").trim();
const yes=v=>v===1||v===true||["1","oui","true"].includes(norm(v));
const esc=v=>txt(v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function safeWeb(v){try{const u=new URL(v);return ["https:","http:"].includes(u.protocol)?u.href:""}catch{return ""}}
function valid(e){return e&&/^\d{7}[A-Z]$/.test(e.uai)&&txt(e.nom)&&typeof e.lat==="number"&&typeof e.lng==="number"&&Number.isFinite(e.lat)&&Number.isFinite(e.lng)&&Math.abs(e.lat)<=90&&Math.abs(e.lng)<=180&&(e.lat!==0||e.lng!==0)}
function dedup(rows){const m=new Map();for(const e of rows){if(!valid(e))continue;const old=m.get(e.uai);m.set(e.uai,old?{...old,...e,details:[...new Set([...(old.details||[]),...(e.details||[])])]}:e)}return [...m.values()]}
function fromOfficial(r){
 const n=v=>v==null||v===""?NaN:Number(v);
 const code=txt(r.code_departement),cp=txt(r.code_postal).padStart(5,"0");
 const dept=code.length===3&&code.startsWith("0")?code.slice(1):code==="02A"?"2A":code==="02B"?"2B":code||cp.slice(0,2);
 return {uai:txt(r.identifiant_de_l_etablissement).toUpperCase(),nom:txt(r.nom_etablissement),adr:[r.adresse_1,r.adresse_2,r.adresse_3].filter(Boolean).join(", "),cp,ville:txt(r.nom_commune),dept,lat:n(r.latitude??r.position?.lat),lng:n(r.longitude??r.position?.lon),tel:txt(r.telephone),mail:txt(r.mail),web:txt(r.web),statut:txt(r.statut_public_prive),academie:txt(r.libelle_academie),bassin:txt(r.libelle_bassin_formation),dateSource:txt(r.date_maj_ligne)};
}
async function json(url,ms=25000){const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),ms);try{const r=await fetch(url,{signal:ctl.signal,cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(timer)}}
async function live(){
 const where='type_etablissement = "Collège" AND etat = "OUVERT" AND '+conf.flag+' = 1';
 const fields=["identifiant_de_l_etablissement","nom_etablissement","adresse_1","adresse_2","adresse_3","code_postal","nom_commune","code_departement","latitude","longitude","position","telephone","mail","web","statut_public_prive","libelle_academie","libelle_bassin_formation","date_maj_ligne","type_etablissement","etat",conf.flag].join(",");
 const q=new URLSearchParams({where,select:fields});
 const raw=await json(api+"/exports/json?"+q,40000);
 if(!Array.isArray(raw)||raw.length<conf.min||raw.some(r=>!yes(r[conf.flag])||norm(r.type_etablissement)!=="college"||norm(r.etat)!=="ouvert"))throw Error("Export incomplet ou schéma inattendu.");
 const rows=dedup(raw.map(fromOfficial));
 if(rows.length<conf.min||rows.length<raw.length*.95)throw Error("Trop de coordonnées ou d’UAI invalides.");
 return {rows,total:raw.length,excluded:raw.length-rows.length};
}
const status=$("source-status");
function note(message){status.textContent=message;}
const map=L.map("map").setView([46.6,2.3],6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors",maxZoom:19}).addTo(map);
const layer=L.layerGroup().addTo(map);
let all=[],marks=new Map();
const markerIcon=L.divIcon({className:"",html:'<div style="width:10px;height:10px;border-radius:50%;background:'+conf.color+';border:2px solid #fff;box-shadow:0 1px 3px #0005"></div>',iconSize:[10,10],iconAnchor:[5,5]});
function popup(e){const site=safeWeb(e.web);return '<div class="pu-title">'+esc(e.nom)+'</div><span class="pu-badge">'+esc(conf.label)+'</span><div class="pu-info">'+esc(e.adr)+'<br>'+esc(e.cp)+" "+esc(e.ville)+"<br>"+esc(e.statut||"Statut non renseigné")+" · "+esc(e.uai)+(e.academie?"<br>"+esc(e.academie):"")+(e.details?.length?"<br><strong>"+esc(e.details.join(" · "))+"</strong>":inclusive?"<br>"+esc(unknown):"")+(e.detailSource?"<br><small>"+esc(e.detailSource)+"</small>":"")+(e.detailURL&&safeWeb(e.detailURL)?'<br><a href="'+esc(safeWeb(e.detailURL))+'" target="_blank" rel="noopener noreferrer">Source des détails</a>':"")+(e.verification?"<br>"+esc(e.verification):"")+(e.dateSource?"<br>Fiche annuaire : "+esc(e.dateSource):"")+'</div><div class="pu-contact">'+(e.tel?esc(e.tel)+"<br>":"")+(e.mail?esc(e.mail)+"<br>":"")+(site?'<a target="_blank" rel="noopener noreferrer" href="'+esc(site)+'">Site web</a>':"")+'</div>'}
function filtered(){const q=norm($("q").value),dept=$("dept").value,acad=$("acad").value,statut=$("statut").value,detail=$("detail").value;return all.filter(e=>(!q||norm([e.nom,e.ville,e.uai,e.cp,...(e.details||[]),...(inclusive?(e.detailCodes||[]).map(c=>examples[c]||""):[])].join(" ")).includes(q))&&(!dept||e.dept===dept)&&(!acad||e.academie===acad)&&(!statut||(e.statut||"Non renseigné")===statut)&&(!detail||(detail===unknown?!(e.details||[]).length:(e.details||[]).includes(detail))))}
function render(){
 const data=filtered();layer.clearLayers();marks=new Map();
 $("cbar").textContent=data.length+" établissement(s) sur "+all.length;
 for(const e of data){const m=L.marker([e.lat,e.lng],{icon:markerIcon}).bindPopup(popup(e));layer.addLayer(m);marks.set(e.uai,m)}
 const list=$("list");list.replaceChildren();
 for(const e of data){const el=document.createElement("button");el.type="button";el.className="item";el.style.cssText="display:block;width:100%;text-align:left;background:white;border:0;border-bottom:1px solid #eee";const title=document.createElement("div");title.className="iname";title.textContent=e.nom;const info=document.createElement("div");info.className="iloc";info.textContent=[e.cp+" "+e.ville,e.statut,...(e.details?.length?e.details:inclusive?[unknown]:[]),e.detailHistorical?"Source ancienne – à confirmer":""].filter(Boolean).join(" · ");el.append(title,info);el.addEventListener("click",()=>{const m=marks.get(e.uai);map.flyTo(m.getLatLng(),14);m.openPopup()});list.append(el)}
 if(data.length===0)list.textContent="Aucun établissement correspondant.";
}
function options(id,arr,label){const el=$(id),previous=el.value;el.replaceChildren(new Option(label,""));[...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr")).forEach(x=>el.add(new Option(x,x)));if([...el.options].some(o=>o.value===previous))el.value=previous;}
function setRows(rows){all=enrich(dedup(rows)).sort((a,b)=>(a.ville||"").localeCompare(b.ville||"","fr")||a.nom.localeCompare(b.nom,"fr"));options("dept",all.map(e=>e.dept),"Tous les départements");options("acad",all.map(e=>e.academie),"Toutes les académies renseignées");options("statut",all.map(e=>e.statut||"Non renseigné"),"Tous les statuts");options("detail",inclusive?[...Object.values(labels),unknown]:all.flatMap(e=>e.details||[]),kind==="ulis"?"Tous les types ULIS":kind==="segpa"?"Tous les champs professionnels":"Toutes les spécialités renseignées");$("detail").hidden=!inclusive&&all.every(e=>!e.details?.length);$("hcount").textContent=all.length+" collèges";$("loading").style.display="none";render()}
function overlay(rows,verified,isLive){
 const local=kind==="sections-sportives"?verified?.sports:kind==="sections-internationales"?verified?.international:[];
 if(!local?.length)return rows;
 const old=new Map(rows.map(e=>[e.uai,e]));
 // Liste DSDEN complète des sections sportives publiques 2026 du 95 : priorité aux entrées attestées.
 // Entrées supplémentaires de l'annuaire courant maintenues et distinguées.
 const ids=new Set(local.map(e=>e.uai));
 const base=rows.filter(e=>!(kind==="sections-sportives"&&e.dept==="95"&&!ids.has(e.uai)&&!isLive)).map(e=>kind==="sections-sportives"&&e.dept==="95"&&!ids.has(e.uai)?{...e,verification:"Annuaire national ; hors liste DSDEN 95 consultée, à confirmer"}:e);
 return dedup([...base,...local.map(e=>({...e,...old.get(e.uai),details:e.details,verification:e.verification,academie:"Versailles"}))]);
}
for(const id of ["q","dept","acad","statut","detail"])$(id).addEventListener(id==="q"?"input":"change",render);
$("export").addEventListener("click",()=>{const cell=v=>'"'+String(v??"").replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';const cols=["uai","nom","ville","cp","dept","academie","statut","details","detailSource","detailURL","verification","dateSource"];const csv="\ufeff"+[cols.join(";"),...filtered().map(e=>cols.map(k=>cell(Array.isArray(e[k])?e[k].join(" | "):e[k])).join(";"))].join("\r\n");const u=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=u;a.download=kind+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});
$("source-link").href=officialURL;
(async()=>{
 let verified=null,archive=[],archiveOk=false,snapshot=null;
 if(inclusive){await Promise.all([json("data/inclusion-details-95.json",8000).then(x=>localDetails=x).catch(()=>{}),json("data/inclusion-details-onisep.json",8000).then(x=>onisepDetails=x).catch(()=>{})]);}
 try{const m=await json("data/dispositifs-metadata.json",5000);if(m?.source==="Annuaire de l’éducation nationale"&&m?.cartes?.[kind]&&/^\d{4}-\d{2}-\d{2}$/.test(m.date))snapshot=m}catch{}
 
 try{verified=await json("data/dispositifs-verifies-2026.json",8000)}catch{}
 try{const a=await json("data/"+kind+".json",15000);if(!Array.isArray(a))throw Error("Format archive");archive=dedup(a);if(snapshot&&snapshot.cartes[kind].etablissements!==archive.length)snapshot=null;archiveOk=true;setRows(overlay(archive,verified,!!snapshot));note((snapshot?"Export MEN du "+snapshot.date.split("-").reverse().join("/"):"Base historique du 09/06/2026")+(verified&&(kind==="sections-sportives"||kind==="sections-internationales")?" + contrôle Val-d’Oise 2026":"")+" ; recherche de données récentes…"+detailStatus())}catch{note("Chargement de l’annuaire national…")}
 try{const result=await live();const rows=overlay(result.rows,verified,true);setRows(rows);const day=new Date().toLocaleDateString("fr-FR");note("Annuaire MEN consulté le "+day+" · "+result.total+" fiches"+(result.excluded?" · "+result.excluded+" doublon(s)/coordonnée(s) exclu(s)":"")+(verified&&(kind==="sections-sportives"||kind==="sections-internationales")?" · compléments 95 (rentrée 2026)":"")+(inclusive?detailStatus():". Les spécialités hors 95 ne sont pas vérifiées."))}catch(err){if(!archiveOk){$("loading").textContent="Données indisponibles. Réessayez ou consultez l’annuaire officiel.";note("Échec du chargement des sources.");return}note("Mode secours : "+(snapshot?"export MEN du "+snapshot.date.split("-").reverse().join("/"):"base du 09/06/2026")+(verified&&(kind==="sections-sportives"||kind==="sections-internationales")?" + compléments officiels 95 (rentrée 2026)":"")+" ; annuaire en ligne indisponible. Données nationales non revalidées.");console.warn("Dispositifs : source nationale non chargée",err)}
})();
})();