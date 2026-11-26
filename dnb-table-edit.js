/* Tableau DNB interactif : filtres par colonne, édition locale, export Excel miroir.
 * Aucun téléversement des résultats, aucune persistance des noms.
 * DNB 2027 : grille officielle sur 20, équivalent pédagogique /1000.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const fmt=x=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(x);
const keyCols=[
 {key:'name',label:'Élève',type:'text',width:23},
 {key:'mean',label:'CC /20',type:'number',editable:true,width:12},
 {key:'cc',label:'CC /400*',type:'number',width:13},
 {key:'need',label:'Pour le brevet /600*',type:'number',width:24},
 {key:'required',label:'Moyenne requise /20',type:'number',width:22},
 {key:'fr',label:'Français /20',type:'number',editable:true,width:17},
 {key:'ma',label:'Maths /20',type:'number',editable:true,width:15},
 {key:'hg',label:'Hist.-géo /20',type:'number',editable:true,width:18},
 {key:'emc',label:'EMC /20',type:'number',editable:true,width:14},
 {key:'sc',label:'Sciences /20',type:'number',editable:true,width:16},
 {key:'oral',label:'Oral /20',type:'number',editable:true,width:14},
 {key:'total',label:'Total /1000*',type:'number',width:16},
 {key:'mention',label:'Mention simulée',type:'text',width:34},
 {key:'details',label:'Détails et seuils',type:'text',width:64}
];
const edits=new Map(),filters=Object.create(null);
let current=[],sourceRows=[],visible=[],sort={key:null,ascending:true},onEdit=()=>{},filterReady=false;
const specs=['fr','ma','hg','emc','sc','oral'];
function parseGrade(raw){
 if(raw===''||raw===null||raw===undefined)return null;
 const n=Number(String(raw).trim().replace(',','.'));
 if(!Number.isFinite(n)||n<0||n>20)throw Error('Saisir une note entre 0 et 20.');
 return Math.round(n*100)/100;
}
function numeric(value){return value===null||value===undefined?'':fmt(value)}
function pointsDetail(rec){
 if(!rec.p)return 'Contrôle continu à compléter';
 const a=rec.p.targets;
 const short=['DNB','AB','B','TB','F'];
 return a.map((t,i)=>short[i]+' : '+(t.feasible?numeric(t.points)+' /600':'impossible')).join(' · ');
}
function valueOf(rec,key){
 if(key==='name')return rec.name;
 if(key==='mean')return rec.mean;
 if(key==='cc')return rec.p?.cc??null;
 if(key==='need')return rec.p?.need??null;
 if(key==='required')return rec.p?.need===undefined?null:rec.p.need/30;
 if(specs.includes(key))return rec.preds.find(x=>x.key===key)?.grade??null;
 if(key==='total')return rec.totalPoints;
 if(key==='mention')return rec.mention;
 if(key==='details')return pointsDetail(rec);
 return null;
}
function mentionFor(value){
 if(value>=18)return 'Très bien avec les félicitations du jury';
 if(value>=16)return 'Très bien';
 if(value>=14)return 'Bien';
 if(value>=12)return 'Assez bien';
 if(value>=10)return 'Admis sans mention';
 return 'Non admis';
}
function recalc(rec){
 rec.p=window.DNBPoints.points(rec.mean);
 const complete=rec.mean!==null&&rec.preds.every(x=>x.grade!==null);
 rec.valid=complete;
 if(complete){
  rec.exam=rec.preds.reduce((sum,x)=>sum+x.grade*x.coef,0)/10;
  rec.final=rec.mean*.4+rec.exam*.6;
  rec.examPoints=rec.exam*30;rec.totalPoints=rec.final*50;
  rec.mention=mentionFor(rec.final);
 }else{
  rec.exam=null;rec.final=null;rec.examPoints=null;rec.totalPoints=null;
  rec.mention='À compléter';
 }
 return rec;
}
function applyEdits(rec,index){
 rec.index=index;
 const mod=edits.get(index);
 if(!mod)return rec;
 if(Object.prototype.hasOwnProperty.call(mod,'mean')){
  rec.mean=mod.mean;
  rec.ccManuallyEdited=true;
 }
 for(const pred of rec.preds){
  if(Object.prototype.hasOwnProperty.call(mod,pred.key)){
   pred.grade=mod[pred.key];
   pred.origin='Note ajustée manuellement dans ce tableau';
   pred.examPoints=pred.grade*pred.coef*3;
   pred.manuallyEdited=true;
  }
 }
 return recalc(rec);
}
function setManual(index,key,value){
 const n=parseGrade(value);
 const old=edits.get(index)||{};
 const next={...old};
 if(n===null)delete next[key];else next[key]=n;
 if(Object.keys(next).length)edits.set(index,next);else edits.delete(index);
 onEdit();
}
function textFold(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');}
function passesFilter(v,raw,type){
 const query=raw.trim();
 if(!query)return true;
 if(type==='text')return textFold(v).includes(textFold(query));
 if(v===null||v===undefined)return query==='vide'||query==='—';
 if(query.toLowerCase()==='non vide')return true;
 const num=Number(String(query).replace(',','.'));
 if(Number.isFinite(num)&&query!=='')return Math.abs(v-num)<.000001;
 const condition=query.match(/^(>=|<=|>|<|=)\s*(\d+(?:[.,]\d+)?)$/);
 if(condition){const arg=Number(condition[2].replace(',','.'));
  if(condition[1]==='>=')return v>=arg;
  if(condition[1]==='<=')return v<=arg;
  if(condition[1]==='>')return v>arg;
  if(condition[1]==='<')return v<arg;
  return Math.abs(v-arg)<.000001;
 }
 const interval=query.match(/^(\d+(?:[.,]\d+)?)\s*(?:\.\.|à)\s*(\d+(?:[.,]\d+)?)$/i);
 if(interval){const lo=Number(interval[1].replace(',','.')),hi=Number(interval[2].replace(',','.'));
  return v>=Math.min(lo,hi)&&v<=Math.max(lo,hi);
 }
 return textFold(fmt(v)).includes(textFold(query));
}
function compare(a,b,key){
 const x=valueOf(a,key),y=valueOf(b,key);
 if(x===null&&y!==null)return 1;
 if(y===null&&x!==null)return -1;
 if(x===null)return a.index-b.index;
 if(typeof x==='number'&&typeof y==='number')return x-y;
 return String(x).localeCompare(String(y),'fr',{numeric:true});
}
function pickRows(data,search,order){
 const q=textFold(search||'');
 let out=data.filter(r=>(!q||textFold(r.name).includes(q)||textFold(r.mention).includes(q)) &&
  keyCols.every(c=>passesFilter(valueOf(r,c.key),filters[c.key]||'',c.type)));
 if(sort.key)out.sort((a,b)=>(sort.ascending?1:-1)*compare(a,b,sort.key));
 else if(order&&order!=='source'){
  const byCC=order==='ccdesc'||order==='ccasc';
  const key=byCC?'mean':'total',descending=order==='desc'||order==='ccdesc';
  out.sort((a,b)=>{const x=valueOf(a,key),y=valueOf(b,key);
   if(x===null)return y===null?a.index-b.index:1;
   if(y===null)return -1;
   return (descending?-1:1)*compare(a,b,key)||a.index-b.index;});
 }
 return out;
}
function initColumns(){
 if(filterReady)return;
 const table=$('dnb-points-rows')?.closest('table');
 if(!table)return;
 const head=table.querySelector('thead');
 head.replaceChildren();
 const titles=document.createElement('tr');titles.className='dnb-edit-head';
 const filtering=document.createElement('tr');filtering.className='dnb-filter-head';
 keyCols.forEach(c=>{
  const th=document.createElement('th');
  const button=document.createElement('button');button.type='button';button.className='dnb-sort-head';
  button.textContent=c.label+' ↕';
  button.title='Trier par '+c.label;
  button.addEventListener('click',()=>{
   if(sort.key===c.key)sort.ascending=!sort.ascending;
   else {sort.key=c.key;sort.ascending=true;}
   render(current,sourceRows,$('dnb-class-filter').value,$('dnb-class-order').value);
  });th.append(button);titles.append(th);
  const filter=document.createElement('th');
  const input=document.createElement('input');input.type='search';input.className='dnb-column-filter';
  input.placeholder=c.type==='number'?'ex. >=10':'Filtrer…';
  input.title='Filtrer la colonne '+c.label+' : >10, <=12 ou 10..14 pour les nombres';
  input.setAttribute('aria-label','Filtrer '+c.label);
  input.value=filters[c.key]||'';
  input.addEventListener('input',()=>{filters[c.key]=input.value;refreshTable();});
  filter.append(input);filtering.append(filter);
 });
 head.append(titles,filtering);filterReady=true;
}
function makeInput(rec,col){
 const input=document.createElement('input');input.type='number';input.min='0';input.max='20';input.step='.01';
 input.className='dnb-inline-note';
 const pred=rec.preds.find(p=>p.key===col);
 const v=col==='mean'?rec.mean:pred?.grade;
 input.value=v===null||v===undefined?'':String(Number(v.toFixed(2)));
 const manual=edits.get(rec.index)?.[col]!==undefined;
 if(manual)input.classList.add('is-edited');
 else if(col!=='mean'&&pred&&!pred.origin.startsWith('Note d’épreuve saisie'))input.classList.add('is-estimated');
 input.title=(col==='mean'?'Contrôle continu de référence (estimation)':
   (pred?.origin||'Note non renseignée'))+
   '. Modifier puis quitter le champ ou appuyer sur Entrée pour recalculer. Vider pour revenir à la valeur importée.';
 input.setAttribute('aria-label','Modifier '+keyCols.find(c=>c.key===col).label+' de '+rec.name);
 input.addEventListener('change',()=>{
  try{setManual(rec.index,col,input.value);showNotice('Recalcul automatique effectué.')}catch(err){
   input.setCustomValidity(err.message);input.reportValidity();input.setCustomValidity('');
  }
 });
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}});
 return input;
}
function showNotice(message){const out=$('dnb-edit-feedback');if(out)out.textContent=message;}
function cell(tr,value,cl){
 const td=document.createElement('td');if(cl)td.className=cl;
 td.textContent=value===null||value===undefined?'—':typeof value==='number'?fmt(value):value;
 tr.append(td);return td;
}
function drawRow(rec){
 const tr=document.createElement('tr');
 keyCols.forEach(c=>{
  if(c.editable){
   const td=document.createElement('td');td.className='dnb-input-cell';td.append(makeInput(rec,c.key));tr.append(td);return;
  }
  const v=valueOf(rec,c.key),td=cell(tr,c.key==='cc'&&v!==null?fmt(v)+' / 400':
   c.key==='need'&&v!==null?fmt(v)+' / 600':
   c.key==='total'&&v!==null?fmt(v)+' / 1000':v,c.key==='name'?'dnb-name':c.key==='need'?'dnb-points-strong':'');
  if(c.key==='mention')td.classList.add(rec.valid?(rec.final>=10?'dnb-pass':'dnb-fail'):'dnb-wait');
  if(c.key==='details'){
   td.className='dnb-goals-cell';
   td.title='Points à obtenir aux épreuves pour les mentions, compte tenu de la moyenne CC estimée';
  }
 });
 return tr;
}
function refreshTable(){
 if(!filterReady)initColumns();
 visible=pickRows(current,$('dnb-class-filter').value,$('dnb-class-order').value);
 const body=$('dnb-points-rows');body.replaceChildren();
 for(const rec of visible)body.append(drawRow(rec));
 $('dnb-points-count').textContent=visible.length+' élève(s) affiché(s) sur '+current.length+
 ' · Le fichier Excel reprend exactement les lignes, leur ordre et les colonnes affichées.';
 $('dnb-filter-count').textContent=String(Object.values(filters).filter(Boolean).length);
 $('dnb-class-export').disabled=visible.length===0;
}
function render(data,rows,searchValue,order){
 current=data;sourceRows=rows;initColumns();
 // The existing chart/KPIs are calculated using ALL rows. Column filtering only affects table and export.
 refreshTable();
}
function clear(){
 edits.clear();for(const k of Object.keys(filters))delete filters[k];
 current=[];sourceRows=[];visible=[];sort={key:null,ascending:true};
 for(const inp of document.querySelectorAll('.dnb-column-filter'))inp.value='';
 if($('dnb-edit-feedback'))$('dnb-edit-feedback').textContent='';
 if($('dnb-filter-count'))$('dnb-filter-count').textContent='0';
}
function resetFilters(){
 for(const k of Object.keys(filters))delete filters[k];
 sort={key:null,ascending:true};
 for(const inp of document.querySelectorAll('.dnb-column-filter'))inp.value='';
 refreshTable();
}
function xlsxColumn(n){let out='';for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;}
function cellFormula(ws,col,row,expression,result,type='n'){
 const address=col+row;
 ws[address]={f:expression,t:type};
 if(result!==null&&result!==undefined)ws[address].v=result;
}
async function exportExcel(loadExcel){
 if(!visible.length){showNotice('Aucune ligne affichée : modifiez les filtres avant l’export.');return;}
 showNotice('Préparation du fichier Excel…');
 const book=await loadExcel();
 const data=[keyCols.map(c=>c.label),...visible.map(rec=>keyCols.map(c=>valueOf(rec,c.key)))];
 const ws=book.utils.aoa_to_sheet(data);
 ws['!cols']=keyCols.map(c=>({wch:c.width}));
 ws['!autofilter']={ref:'A1:N'+(visible.length+1)};
 ws['!rows']=[{hpt:32},...visible.map(()=>({hpt:24}))];
 // Every derived cell has a formula and a cached displayed value.
 for(let i=0;i<visible.length;i++){
  const row=i+2,rec=visible[i];
  const B='B'+row,C='C'+row,D='D'+row,E='E'+row,
    F='F'+row,G='G'+row,H='H'+row,I='I'+row,J='J'+row,K='K'+row,
    L='L'+row,M='M'+row,N='N'+row;
  const hasCC=rec.mean!==null,hasFinal=rec.final!==null;
  cellFormula(ws,'C',row,'IF(ISNUMBER('+B+'),'+B+'*20,"")',rec.p?.cc??null);
  cellFormula(ws,'D',row,'IF(ISNUMBER('+B+'),MAX(0,500-'+C+'),"")',rec.p?.need??null);
  cellFormula(ws,'E',row,'IF(ISNUMBER('+B+'),'+D+'/30,"")',rec.p?.need===undefined?null:rec.p.need/30);
  const exam='(2*'+F+'+2*'+G+'+1.5*'+H+'+0.5*'+I+'+2*'+J+'+2*'+K+')';
  cellFormula(ws,'L',row,'IF(COUNT('+B+','+F+':'+K+')=7,'+C+'+3*'+exam+',"")',rec.totalPoints,'n');
  const mention='IF('+L+'="","À compléter",IF('+L+'>=900,"Très bien avec les félicitations du jury",IF('+L+'>=800,"Très bien",IF('+L+'>=700,"Bien",IF('+L+'>=600,"Assez bien",IF('+L+'>=500,"Admis sans mention","Non admis"))))))';
  cellFormula(ws,'M',row,mention,rec.mention,'str');
  const fmtf=(pts)=>'IF('+pts+'>600,"impossible",TEXT(MAX(0,'+pts+'),"0.00")&" /600")';
  const detail='"DNB : "&'+fmtf('500-'+C)+'&" · AB : "&'+fmtf('600-'+C)+
   '&" · B : "&'+fmtf('700-'+C)+'&" · TB : "&'+fmtf('800-'+C)+'&" · F : "&'+fmtf('900-'+C);
  cellFormula(ws,'N',row,'IF(ISNUMBER('+B+'),'+detail+',"Contrôle continu à compléter")',pointsDetail(rec),'str');
 }
 const workbook=book.utils.book_new();
 book.utils.book_append_sheet(workbook,ws,'Résultats affichés');
 workbook.Workbook=workbook.Workbook||{};
 workbook.Workbook.CalcPr={calcId:0,fullCalcOnLoad:true,forceFullCalc:true};
 book.writeFile(workbook,'DNB-2027-tableau-affiche.xlsx',{bookType:'xlsx',compression:true});
 showNotice('Excel créé : seules les lignes visibles ont été exportées ; les cellules calculées ont des formules actualisables dans Excel.');
}
window.DNBTableEdit={
 applyEdits,render,clear,resetFilters,exportExcel,registerOnEdit:callback=>{onEdit=callback;},
 getVisible:()=>visible.slice(),getColumns:()=>keyCols.slice(),
 getEdits:()=>new Map(edits),valueOf,pointsDetail,passesFilter,parseGrade,sortBy:(key,ascending)=>{sort={key,ascending};refreshTable();}
};
})();