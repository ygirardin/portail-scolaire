/* DNB 2027 : calcul pédagogique des points et estimation par discipline.
 * La note officielle est sur 20. Les points /1000 sont une représentation pédagogique.
 * Traitement 100 % dans le navigateur, sans données d'élèves dans le code. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const specs=[{key:'fr',name:'Français',coef:2,subject:'Français'},
 {key:'ma',name:'Mathématiques',coef:2,subject:'Mathématiques'},
 {key:'hg',name:'Histoire-géographie',coef:1.5,subject:'Histoire-géographie'},
 {key:'emc',name:'EMC',coef:.5,subject:'EMC'},
 {key:'sc',name:'Sciences',coef:2,subject:null},
 {key:'oral',name:'Oral',coef:2,subject:null}];
const targets=[['Brevet',10],['Assez bien',12],['Bien',14],['Très bien',16],['Félicitations',18]];
const format=x=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(x);
function points(mean){
 if(mean===null||!Number.isFinite(mean))return null;
 const cc=mean*20,need=Math.max(0,500-cc);
 return {cc,need,weighted:mean*.4,
  targets:targets.map(x=>{
    const raw=x[1]*50-cc;
    return {label:x[0],points:Math.max(0,raw),requiredExamMean:Math.max(0,raw)/30,feasible:raw<=600};
  })};
}
function subjectGrade(row,keys,subject){
 if(!keys.pronote||!Array.isArray(keys.pronoteSubjects))return null;
 const idx=keys.pronoteSubjects.indexOf(subject);
 if(idx<0||!keys.ccCols)return null;
 const col=keys.ccCols[idx],raw=String(row[col]??'').trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(raw))return null;
 const grade=Number(raw);
 return Number.isFinite(grade)&&grade>=0&&grade<=20?grade:null;
}
function projection(row,keys,spec){
 if(spec.subject){
  const grade=subjectGrade(row,keys,spec.subject);
  return grade===null?null:{grade,origin:'Moyenne Pronote de '+spec.subject+' (période déclarée)'};
 }
 if(spec.key==='sc'){
  const values=['Physique-chimie','SVT','Technologie'].map(x=>subjectGrade(row,keys,x)).filter(x=>x!==null);
  if(values.length)return {
   grade:values.reduce((sum,n)=>sum+n,0)/values.length,
   origin:'Hypothèse : moyenne des '+values.length+' science(s) disponibles, et non note des deux disciplines officielles'};
 }
 return null;
}
function mention(final){
 return final>=18?'Très bien avec les félicitations du jury':
 final>=16?'Très bien':final>=14?'Bien':final>=12?'Assez bien':
 final>=10?'Admis sans mention':'Non admis';
}
function enrich(row,keys,original,enabled,fallback,style){
 const p=points(original.mean);
 const preds=[],errors=[],missing=[];
 for(const spec of specs){
  let grade=null,origin='Épreuve non renseignée';
  if(keys[spec.key]>=0&&String(row[keys[spec.key]]??'').trim()!==''){
   const value=String(row[keys[spec.key]]).trim().replace(',','.');
   if(/^\d+(?:\.\d+)?$/.test(value)&&Number(value)>=0&&Number(value)<=20){
    grade=Number(value);origin='Note d’épreuve saisie dans le fichier';
   }else errors.push('Note invalide : '+spec.name);
  }else if(enabled){
   const fromSubject=style==='subjects'?projection(row,keys,spec):null;
   if(fromSubject){grade=fromSubject.grade;origin=fromSubject.origin;}
   else{grade=fallback;origin='Hypothèse neutre de repli, ajustable';}
  }else missing.push(spec.name);
  preds.push({key:spec.key,name:spec.name,coef:spec.coef,grade,origin,
   examPoints:grade===null?null:grade*spec.coef*3});
 }
 const invalidCC=original.detail&&/moyennes disciplinaires insuffisantes/i.test(original.detail);
 const valid=p!==null&&!invalidCC&&!errors.length&&preds.every(x=>x.grade!==null);
 const exam=valid?preds.reduce((sum,x)=>sum+x.grade*x.coef,0)/10:null;
 const final=valid?original.mean*.4+exam*.6:null;
 const complete=valid?mention(final):errors.length?'À corriger':'À compléter';
 const noteCount=preds.filter(x=>x.grade!==null&&x.origin!=='Note d’épreuve saisie dans le fichier').length;
 const context=(original.detail||'').split(' · ').filter(x=>/disciplines disponibles|moyennes disciplinaires/i.test(x)).join(' · ');
 return Object.assign(original,{p,preds,exam,final,valid,mention:complete,examPoints:valid?exam*30:null,totalPoints:valid?final*50:null,
  detail:[context,errors.join(', '),noteCount?'Estimation de '+noteCount+' matière(s)':'',missing.length?'À renseigner : '+missing.join(', '):''].filter(Boolean).join(' · ')});
}
function td(tr,text,cls){
 const el=document.createElement('td');el.textContent=text;
 if(cls)el.className=cls;
 tr.append(el);return el;
}
function summaryRow(details,label,needed,mean){
 const tr=document.createElement('tr');
 td(tr,label);
 td(tr,needed);
 td(tr,mean);
 details.append(tr);
}
function render(data,rows,searchValue,order){
 const container=$('dnb-points-dashboard');if(!container)return;
 container.hidden=false;
 const usable=data.filter(x=>x.p);
 const sum=(arr,fn)=>arr.reduce((s,x)=>s+fn(x),0);
 $('dnb-points-cc').textContent=usable.length?format(sum(usable,x=>x.p.cc)/usable.length)+' / 400':'—';
 $('dnb-points-need').textContent=usable.length?format(sum(usable,x=>x.p.need)/usable.length)+' / 600':'—';
 $('dnb-points-pop').textContent=usable.length+' / '+data.length+' élèves';
 $('dnb-points-admit').textContent=data.some(x=>x.valid)?
  format(data.filter(x=>x.valid&&x.final>=10).length/data.filter(x=>x.valid).length*100)+' %':'—';
 const pronote=!!rows[0]?.keys?.pronote;
 const warnings=[];
 if(pronote){
  const classes=[...new Set(rows.map(x=>String(x.raw[x.keys.pronoteClass]??'').trim()))].filter(Boolean);
  const likely4=classes.some(x=>/^4(?:\d|[a-z]|eme|e\b)/i.test(x));
  if(likely4)warnings.push('Classe de 4e détectée : ce contrôle continu est une projection pour une future classe de 3e, pas un résultat acquis au DNB.');
  const period=$('dnb-pronote-period').value;
  if(period!=='annuelle')warnings.push('Moyennes de période : le contrôle continu définitif repose sur les moyennes annuelles de 3e.');
 }
 warnings.push('Points sur 1000 = conversion pédagogique (400 CC + 600 épreuves, brevet dès 500). Note réglementaire du DNB sur 20.');
 $('dnb-points-warning').textContent=warnings.join(' ');
 const tokens=String(searchValue||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 let list=data.filter(x=>!tokens||x.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(tokens)||x.mention.toLowerCase().includes(tokens));
 if(order&&order!=='source'){
  list=list.slice().sort((a,b)=>{
   const grade=order.startsWith('cc')?'mean':'final';
   if(a[grade]===null)return b[grade]===null?a.index-b.index:1;
   if(b[grade]===null)return -1;
   return ((order==='desc'||order==='ccdesc')?b[grade]-a[grade]:a[grade]-b[grade])||a.index-b.index;
  });
 }
 const body=$('dnb-points-rows');body.replaceChildren();
 for(const item of list){
  const tr=document.createElement('tr');
  td(tr,item.name,'dnb-name');
  td(tr,item.mean===null?'—':format(item.mean));
  td(tr,item.p?format(item.p.cc)+' / 400':'—','dnb-points-strong');
  td(tr,item.p?format(item.p.need)+' / 600':'—','dnb-points-strong dnb-points-blue');
  td(tr,item.p?format(item.p.need/30)+' / 20':'—');
  for(const pred of item.preds){
   const cell=td(tr,pred.grade===null?'—':format(pred.grade),pred.origin.startsWith('Note d’épreuve')?'':'dnb-points-hyp');
   cell.title=pred.name+' : '+pred.origin+'. Pts convertis pour cette épreuve : '+
    (pred.examPoints===null?'—':format(pred.examPoints)+' / '+format(pred.coef*60));
  }
  td(tr,item.totalPoints===null?'—':format(item.totalPoints)+' / 1000');
  td(tr,item.mention,item.valid?(item.final>=10?'dnb-pass':'dnb-fail'):'dnb-wait');
  const more=td(tr,'');
  if(item.p){
   const detail=document.createElement('details');detail.className='dnb-points-detail';
   const summary=document.createElement('summary');summary.textContent='Voir les objectifs';detail.append(summary);
   const table=document.createElement('table');
   const head=document.createElement('tr');
   summaryRow(table,'Objectif','Points /600','Moyenne /20');
   for(const target of item.p.targets)summaryRow(table,target.label,
    target.feasible?format(target.points):'Impossible (>600)',
    target.feasible?format(target.requiredExamMean):'>20');
   detail.append(table);more.append(detail);
  }
  body.append(tr);
 }
 $('dnb-points-count').textContent=list.length+' élève(s) affiché(s). Notes orange : estimations, non résultats aux épreuves.';
}
function csvCell(value){
 let s=String(value??'');
 if(/^\s*[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function exportRows(data,period){
 const header=['Élève','Moyenne CC /20 (indicative)','Pts CC /400 (illustration)','Pts nécessaires brevet /600','Moyenne épreuves requise /20',
  ...specs.map(x=>x.name+' note /20'),...specs.map(x=>x.name+' origine de la note'),
  'Moyenne épreuves estimée /20','Total illustratif /1000','Note finale estimée /20','Mention estimée',
  ...targets.map(x=>'Pts pour '+x[0]+' /600'),'Période déclarée','Information'];
 const lines=[header.map(csvCell).join(';')];
 for(const item of data){
  const arr=[item.name,item.mean??'',item.p?.cc??'',item.p?.need??'',item.p?item.p.need/30:'',
   ...item.preds.map(x=>x.grade??''),...item.preds.map(x=>x.origin),
   item.exam??'',item.totalPoints??'',item.final??'',item.mention,
   ...(item.p?item.p.targets.map(x=>x.feasible?x.points:'Impossible'):targets.map(() => '')),
   period,item.detail];
  lines.push(arr.map(csvCell).join(';'));
 }
 return '\uFEFF'+lines.join('\r\n');
}
window.DNBPoints={points,enrich,render,exportRows,projection};
})();