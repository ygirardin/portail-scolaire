/* Simulation de classe DNB 2027. Aucun envoi des fichiers : calculs locaux uniquement. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const el=$('dnb-class');
if(!el)return;
const input=$('dnb-class-file'),status=$('dnb-class-status'),results=$('dnb-class-results');
const fmt=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n);
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const headers=['Élève','Moyenne CC','Nb disciplines CC','Option','Épreuve Français','Épreuve Mathématiques','Épreuve Histoire-Géographie','Épreuve EMC','Épreuve Sciences','Épreuve Oral'];
let rows=[],source='',filtered=[];
let libraryPromise=null;
function excelLibrary(){
 if(window.XLSX)return Promise.resolve(window.XLSX);
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
   const sc=document.createElement('script');
   sc.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
   sc.async=true;
   sc.onload=()=>window.XLSX?resolve(window.XLSX):reject(Error('Lecteur Excel indisponible.'));
   sc.onerror=()=>reject(Error('Le lecteur Excel n’a pas pu être chargé. Vérifiez votre connexion ou utilisez un fichier CSV.'));
   document.head.appendChild(sc);
 }).catch(err=>{libraryPromise=null;throw err});
 return libraryPromise;
}
function csvTable(text){
 const raw=String(text).replace(/^\uFEFF/,'');
 const firstLine=raw.split(/\r?\n/,1)[0]||'';
 const counts=[';',',','\t'].map(sep=>{
   let count=0,quoted=false;
   for(let i=0;i<firstLine.length;i++){
     if(firstLine[i]==='"'){if(quoted&&firstLine[i+1]==='"')i++;else quoted=!quoted}
     else if(!quoted&&firstLine[i]===sep)count++;
   }
   return {sep,count};
 });
 counts.sort((a,b)=>b.count-a.count);
 const sep=counts[0].count?counts[0].sep:';';
 const table=[];let line=[],field='',quoted=false;
 for(let i=0;i<raw.length;i++){
   let c=raw[i];
   if(c==='"'){if(quoted&&raw[i+1]==='"'){field+='"';i++}else quoted=!quoted}
   else if(c===sep&&!quoted){line.push(field);field=''}
   else if((c==='\n'||c==='\r')&&!quoted){
     if(c==='\r'&&raw[i+1]==='\n')i++;
     line.push(field);if(line.some(v=>String(v).trim()!==''))table.push(line);
     line=[];field='';
   }else field+=c;
 }
 if(quoted)throw Error('CSV incomplet : guillemets non fermés.');
 line.push(field);if(line.some(v=>String(v).trim()!==''))table.push(line);
 return table;
}
function getKeys(h){
 const names=h.map(norm);
 const lookup=(...aliases)=>names.findIndex(k=>aliases.includes(k));
 const keys={
  name:lookup('eleve','identifiant','identifiant eleve','code eleve','nom prenom','prenom nom'),
  nom:lookup('nom'),prenom:lookup('prenom'),
  cc:lookup('moyenne cc','moyenne controle continu','controle continu','cc moyenne','cc','cc sur 20'),
  ccList:lookup('cc disciplines','moyennes annuelles','moyennes annuelles cc','notes cc'),
  count:lookup('nb disciplines cc','nombre disciplines cc','nombre de disciplines cc','nb disciplines','nombre de disciplines'),
  option:lookup('option','option facultative','moyenne option'),
  fr:lookup('epreuve francais','examen francais','dnb francais'),
  ma:lookup('epreuve mathematiques','epreuve maths','examen mathematiques','examen maths','dnb mathematiques'),
  hg:lookup('epreuve histoire geographie','epreuve histoire geo','epreuve hg','examen histoire geographie','dnb histoire geographie'),
  emc:lookup('epreuve emc','examen emc','dnb emc'),
  sc:lookup('epreuve sciences','epreuve science','examen sciences','dnb sciences'),
  oral:lookup('epreuve oral','epreuve orale','examen oral','dnb oral'),
  ccCols:names.reduce((a,k,i)=>{if(/^cc /.test(k)&&!['cc moyenne','cc disciplines','cc sur 20','cc option','cc nb disciplines'].includes(k))a.push(i);return a},[])
 };
 keys.score=(keys.name>=0||keys.nom>=0?3:0)+(keys.cc>=0||keys.ccList>=0||keys.ccCols.length?5:0)+['fr','ma','hg','emc','sc','oral'].filter(k=>keys[k]>=0).length;
 return keys;
}
function findSheet(tables){
 let best=null;
 for(const entry of tables){
  for(let i=0;i<Math.min(entry.table.length,10);i++){
   const keys=getKeys(entry.table[i].map(String));
   if(!best||keys.score>best.keys.score)best={table:entry.table.slice(i+1),keys,header:entry.table[i],sheet:entry.name};
  }
 }
 if(!best||best.keys.score<5||!(best.keys.cc>=0||best.keys.ccList>=0||best.keys.ccCols.length))
  throw Error('Colonnes de contrôle continu non reconnues. Téléchargez le modèle Excel pour vérifier les intitulés.');
 return best;
}
function grade(value,label,missing){
 if(value===undefined||value===null||String(value).trim()===''){missing.push(label);return null}
 const str=String(value).trim().replace(/\s/g,'').replace(',','.');
 const n=Number(str);
 if(!/^\d+(?:\.\d+)?$/.test(str)||!Number.isFinite(n)||n<0||n>20)throw Error(label+' : note invalide (attendue de 0 à 20).');
 return n;
}
function parseCC(row,keys,missing){
 const option=keys.option>=0?grade(row[keys.option],'Option facultative',[]):null;
 let cc=null;
 if(keys.ccList>=0&&String(row[keys.ccList]??'').trim()!==''){
   const parts=String(row[keys.ccList]).split(/[;\n]+/).map(x=>x.trim());
   if(!parts.length||parts.some(v=>!v))throw Error('Moyennes annuelles : séparer les notes par des points-virgules.');
   cc=parts.map(v=>grade(v,'Moyenne annuelle',[]));
 }else if(keys.ccCols.length&&keys.ccCols.some(i=>String(row[i]??'').trim()!=='')){
   cc=keys.ccCols.map(i=>grade(row[i],String(keys.headerLabels?.[i]||'Discipline CC'),missing));
   if(cc.some(x=>x===null))return {cc:null,option};
 }else if(keys.cc>=0){
   const mean=grade(row[keys.cc],'Moyenne CC',missing);
   if(mean!==null){
     let count=1;
     if(keys.count>=0&&String(row[keys.count]??'').trim()!==''){
       const raw=Number(String(row[keys.count]).trim().replace(',','.'));
       if(!Number.isInteger(raw)||raw<1||raw>20)throw Error('Nb disciplines CC : saisir un entier de 1 à 20.');
       count=raw;
     }else if(option!==null&&option>10)missing.push('Nb disciplines CC (option facultative)');
     cc=Array(count).fill(mean);
   }
 }else missing.push('Contrôle continu');
 return {cc,option};
}
function compute(row,index,keys,hypothesis,estimate){
 let name=keys.name>=0?String(row[keys.name]??'').trim():'';
 if(!name&&(keys.nom>=0||keys.prenom>=0))name=[keys.nom>=0?row[keys.nom]:'',keys.prenom>=0?row[keys.prenom]:''].map(x=>String(x??'').trim()).filter(Boolean).join(' ');
 if(!name)name='Élève '+(index+1);
 const missing=[],invalid=[];
 let cc=null,option=null,notes=[],hypCount=0,exam=null,mean=null,final=null,mention='À compléter';
 try{const c=parseCC(row,keys,missing);cc=c.cc;option=c.option}
 catch(err){invalid.push(err.message)}
 for(const [key,label] of [['fr','Français'],['ma','Mathématiques'],['hg','Histoire-géographie'],['emc','EMC'],['sc','Sciences'],['oral','Oral']]){
  try{
   let n=keys[key]>=0?grade(row[keys[key]],'Épreuve '+label,[]):null;
   if(n===null&&hypothesis){n=estimate;hypCount++}
   else if(n===null)missing.push('Épreuve '+label);
   notes.push(n);
  }catch(err){invalid.push(err.message);notes.push(null)}
 }
 if(cc&&cc.length&&!missing.length&&!invalid.length&&notes.every(v=>v!==null)){
  const exam=(notes[0]*2+notes[1]*2+notes[2]*1.5+notes[3]*.5+notes[4]*2+notes[5]*2)/10;
  mean=Math.min(20,(cc.reduce((a,b)=>a+b,0)+Math.max(0,(option??0)-10))/cc.length);
  final=mean*.4+exam*.6;
  mention=final>=18?'Très bien avec les félicitations du jury':final>=16?'Très bien':final>=14?'Bien':final>=12?'Assez bien':final>=10?'Admis sans mention':'Non admis';
  return {name,index,mean,exam,final,mention,detail: hypCount?'Hypothèse sur '+hypCount+' épreuve(s)':'Notes complètes',hypCount,valid:true};
 }
 return {name,index,mean,exam,final,mention:invalid.length?'À corriger':'À compléter',detail:[...new Set([...invalid,...missing])].join(' · '),hypCount,valid:false};
}
function cell(tr,tag,text,cls){
 const node=document.createElement(tag);node.textContent=text;
 if(cls)node.className=cls;tr.appendChild(node);return node;
}
function render(){
 const enabled=$('dnb-class-hyp').checked;
 const estimate=Number($('dnb-class-estimate').value);
 $('dnb-class-estimate').disabled=!enabled;
 if(enabled&&(!Number.isFinite(estimate)||estimate<0||estimate>20)){
  status.textContent='L’hypothèse doit être comprise entre 0 et 20.';return;
 }
 if(!rows.length)return;
 const computed=rows.map((r,i)=>compute(r.raw,i,r.keys,enabled,estimate));
 const valid=computed.filter(r=>r.valid);
 const passed=valid.filter(r=>r.final>=10);
 const average=valid.length?valid.reduce((s,r)=>s+r.final,0)/valid.length:null;
 $('dnb-class-total').textContent=String(rows.length);
 $('dnb-class-complete').textContent=String(valid.length);
 $('dnb-class-admitted').textContent=valid.length?fmt(passed.length/valid.length*100)+' %':'—';
 $('dnb-class-average').textContent=average===null?'—':fmt(average)+' / 20';
 $('dnb-class-denominator').textContent='Sur '+valid.length+' simulation(s) calculable(s) · '+(rows.length-valid.length)+' à compléter/corriger';
 const dist=$('dnb-class-distribution');dist.replaceChildren();
 const groups=[
  ['Non admis',r=>r.final<10],
  ['Sans mention',r=>r.final>=10&&r.final<12],
  ['Assez bien',r=>r.final>=12&&r.final<14],
  ['Bien',r=>r.final>=14&&r.final<16],
  ['Très bien',r=>r.final>=16&&r.final<18],
  ['Félicitations',r=>r.final>=18]
 ];
 for(const [label,fn] of groups){
  const count=valid.filter(fn).length;
  const p=document.createElement('div');p.className='dnb-dist-row';
  cell(p,'span',label);
  const track=document.createElement('div');track.className='dnb-dist-track';
  const fill=document.createElement('span');fill.style.width=(valid.length?count/valid.length*100:0)+'%';track.append(fill);p.append(track);
  cell(p,'strong',String(count));dist.append(p);
 }
 const q=norm($('dnb-class-filter').value);
 filtered=computed.filter(r=>!q||norm(r.name).includes(q)||norm(r.mention).includes(q));
 const order=$('dnb-class-order').value;
 if(order!=='source')filtered.sort((a,b)=>{
  if(a.final===null&&b.final!==null)return 1;
  if(b.final===null&&a.final!==null)return -1;
  return a.final===null? a.index-b.index : (order==='desc'?b.final-a.final:a.final-b.final)||a.index-b.index;
 });
 const tbody=$('dnb-class-body');tbody.replaceChildren();
 for(const r of filtered){
  const tr=document.createElement('tr');
  cell(tr,'td',r.name);
  cell(tr,'td',r.mean===null?'—':fmt(r.mean));
  cell(tr,'td',r.exam===null?'—':fmt(r.exam));
  cell(tr,'td',r.final===null?'—':fmt(r.final),'dnb-grade');
  cell(tr,'td',r.mention,r.valid?(r.final>=10?'dnb-pass':'dnb-fail'):'dnb-wait');
  cell(tr,'td',r.detail,'dnb-detail');
  tbody.append(tr);
 }
 $('dnb-class-result-count').textContent=filtered.length+' ligne(s) affichée(s)';
 status.textContent=source+' · '+rows.length+' élève(s) importé(s). '+(enabled?'Scénario fictif appliqué aux seules épreuves manquantes.':'Les notes manquantes ne sont pas remplacées par zéro.');
 results.hidden=false;
 $('dnb-class-clear').hidden=false;
}
async function parseFile(file){
 if(!file) return;
 if(file.size>8*1024*1024)throw Error('Fichier trop volumineux (maximum 8 Mo).');
 const lower=file.name.toLowerCase();
 let tables=[];
 if(lower.endsWith('.csv')){
  let content=await file.text();
  if(content.includes('\uFFFD'))content=new TextDecoder('windows-1252').decode(await file.arrayBuffer());
  tables=[{name:'CSV',table:csvTable(content)}];
 }else if(/\.(xlsx|xls)$/.test(lower)){
  const lib=await excelLibrary();
  const wb=lib.read(await file.arrayBuffer(),{type:'array',cellDates:false});
  tables=wb.SheetNames.map(name=>({name,table:lib.utils.sheet_to_json(wb.Sheets[name],{header:1,blankrows:false,defval:'',raw:true})}));
 }else throw Error('Importer un fichier Excel .xlsx, .xls ou CSV.');
 const {table,keys,header,sheet}=findSheet(tables);
 keys.headerLabels=header;
 const max=500;
 const actual=table.map((raw,i)=>({raw,i,keys})).filter(r=>r.raw.some(v=>String(v??'').trim()!==''));
 if(!actual.length)throw Error('Le tableau ne contient aucun élève.');
 if(actual.length>max)throw Error('Maximum '+max+' élèves par import.');
 rows=actual;
 source='Fichier : '+file.name+' · feuille : '+sheet;
 render();
}
function csvSafe(value){
 const str=String(value??'');
 const secure=/^\s*[=+\-@]/.test(str)?"'"+str:str;
 return '"'+secure.replace(/"/g,'""')+'"';
}
function exportCSV(){
 if(!rows.length)return;
 const enabled=$('dnb-class-hyp').checked,estimate=Number($('dnb-class-estimate').value);
 if(enabled&&(estimate<0||estimate>20||!Number.isFinite(estimate)))return;
 const list=rows.map((r,i)=>compute(r.raw,i,r.keys,enabled,estimate));
 const content=[
 ['Élève','Contrôle continu /20','Épreuves /20','Résultat /20','Appréciation indicative','Compléments / hypothèse'].map(csvSafe).join(';'),
 ...list.map(r=>[r.name,r.mean??'',r.exam??'',r.final??'',r.mention,r.detail].map(csvSafe).join(';'))
 ].join('\r\n');
 const a=document.createElement('a');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'}));
 a.href=url;a.download='simulations-DNB-classe-2027.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function template(){
 const lib=await excelLibrary();
 const wb=lib.utils.book_new();
 const data=[headers,
  ['Élève A',13.5,10,'',12,11,12,13,14,15],
  ['Élève B',10.5,10,14,11,9,9,10,10,12],
  ['Élève C',15.25,10,16,14,16,15,14,15,16]
 ];
 const ws=lib.utils.aoa_to_sheet(data);
 ws['!cols']=headers.map((h,i)=>({wch:i===0?22:i<4?21:25}));
 lib.utils.book_append_sheet(wb,ws,'Classe');
 const guide=lib.utils.aoa_to_sheet([
  ['SIMULATEUR DNB 2027 — MODÈLE DE CLASSE'],
  ['Une ligne par élève ; noms ou codes anonymisés au choix.'],
  ['Moyenne CC = moyenne, sur 20, des moyennes annuelles de TOUS les enseignements obligatoires de 3e (hors bonus d’option).'],
  ['Nb disciplines CC = nombre de disciplines prises en compte pour ce calcul (utile si l’option est supérieure à 10/20).'],
  ['Option = meilleure moyenne d’enseignement facultatif, si applicable ; sinon laisser vide.'],
  ['Épreuve Français / Mathématiques / Histoire-Géographie / EMC / Sciences / Oral = notes sur 20, réelles ou hypothétiques.'],
  ['Les cellules des épreuves peuvent rester vides. Un scénario commun peut alors être activé sur le portail.'],
  ['Les résultats sont indicatifs ; ils ne remplacent jamais la délibération du jury.'],
  ['Le fichier reste dans votre navigateur lors de l’analyse, sans téléversement.'],
  ['Référence : https://www.education.gouv.fr/bo/2026/Special4/MENE2623194N']
 ]);
 guide['!cols']=[{wch:110}];
 lib.utils.book_append_sheet(wb,guide,'Mode emploi');
 lib.writeFile(wb,'modele-DNB-2027-classe.xlsx');
}
$('dnb-class-file').addEventListener('change',async()=>{
 const file=input.files?.[0];if(!file)return;
 status.textContent='Lecture et analyse du fichier…';
 rows=[];results.hidden=true;$('dnb-class-clear').hidden=true;
 try{await parseFile(file)}catch(err){status.textContent='Import impossible : '+(err.message||'Fichier non reconnu.');}
 input.value='';
});
$('dnb-class-template').addEventListener('click',async()=>{
 status.textContent='Préparation du modèle Excel…';
 try{await template();status.textContent=rows.length?source+' · Modèle Excel téléchargé.':'Modèle Excel téléchargé.'}
 catch(err){status.textContent=err.message||'Impossible de préparer le modèle.'}
});
$('dnb-class-clear').addEventListener('click',()=>{rows=[];source='';results.hidden=true;$('dnb-class-clear').hidden=true;status.textContent='Données effacées de cette page.';input.value='';});
$('dnb-class-hyp').addEventListener('change',render);
$('dnb-class-estimate').addEventListener('input',render);
$('dnb-class-filter').addEventListener('input',render);
$('dnb-class-order').addEventListener('change',render);
$('dnb-class-export').addEventListener('click',exportCSV);
})();