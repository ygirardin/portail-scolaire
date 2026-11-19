
/* Menu unique du Portail scolaire. Le catalogue ne dépend pas d'une page particulière. */
(function(){
 'use strict';
 if(document.getElementById('ps-shell') || window.self!==window.top)return;
 const groups=[
 ['Orientation',[['voeux-versailles.html','Affelnet — vœux Versailles']]],
 ['Cartes',[['colleges.html','Collèges publics'],['lycees.html','Lycées publics'],['carte-bassins-france.html','Bassins d’éducation — France'],['bassins-95.html','Bassins du Val-d’Oise'],['segpa.html','SEGPA'],['ulis.html','ULIS'],['upe2a.html','UPE2A — élèves allophones'],['classes-ha.html','Classes à horaires aménagés'],['sections-sportives.html','Sections sportives'],['sections-internationales.html','Sections internationales']]],
 ['Statistiques',[['tableau-ecoles.html','Effectifs des écoles'],['tableau-colleges.html','Effectifs et IPS des collèges'],['tableau-lycees.html','Effectifs et IPS des lycées']]],
 ['Gestion',[['repartition-sieges-ececa.html','Répartition des sièges — ECECA'],['convocation-ca.html','Convocation au conseil d’administration']]],
 ['Guides & ressources',[['guide-aed.html','Gestion des AED'],['guide-digicod.html','DIGICOD'],['guide-demact.html','Dém’Act'],['glossaire.html','Glossaire des sigles']]]
 ];
 const raw=location.pathname.split('/').pop()||'index.html';
 const current=raw==='tableau-ecoles-portail.html'?'tableau-ecoles.html':raw;
 const shell=document.createElement('div');shell.id='ps-shell';shell.setAttribute('role','banner');
 const inner=document.createElement('div');inner.className='ps-inner';shell.append(inner);
 const brand=document.createElement('a');brand.href='index.html';brand.className='ps-brand';brand.setAttribute('aria-label','Portail scolaire — accueil');
 brand.innerHTML='<span class="ps-mark" aria-hidden="true">EDU</span><span>Portail Scolaire</span>';
 if(current==='index.html')brand.setAttribute('aria-current','page');
 inner.append(brand);
 const mobile=document.createElement('button');mobile.type='button';mobile.className='ps-toggle';mobile.textContent='☰ Menu';mobile.setAttribute('aria-expanded','false');mobile.setAttribute('aria-controls','ps-nav');
 const nav=document.createElement('nav');nav.className='ps-nav';nav.id='ps-nav';nav.setAttribute('aria-label','Navigation principale du portail');
 inner.append(mobile,nav);
 const items=[];
 function close(group){group.panel.hidden=true;group.button.setAttribute('aria-expanded','false')}
 function closeAll(){items.forEach(close)}
 function closeMobile(){nav.classList.remove('is-open');mobile.setAttribute('aria-expanded','false');closeAll()}
 groups.forEach(([label,links],i)=>{
  const group=document.createElement('div');group.className='ps-group';
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','ps-panel-'+i);button.append(document.createTextNode(label));const caret=document.createElement('span');caret.className='ps-caret';caret.textContent='▾';caret.setAttribute('aria-hidden','true');button.append(caret);
  const panel=document.createElement('div');panel.className='ps-panel';panel.id='ps-panel-'+i;panel.hidden=true;
  links.forEach(([href,title])=>{const a=document.createElement('a');a.href=href;a.textContent=title;if(current===href){a.setAttribute('aria-current','page');group.classList.add('is-current')}panel.append(a)});
  group.append(button,panel);nav.append(group);const item={button,panel};items.push(item);
  button.addEventListener('click',()=>{const open=panel.hidden;closeAll();if(open){panel.hidden=false;button.setAttribute('aria-expanded','true')}});
 });
 mobile.addEventListener('click',()=>{const open=!nav.classList.contains('is-open');if(open){nav.classList.add('is-open');mobile.setAttribute('aria-expanded','true')}else closeMobile()});
 document.addEventListener('click',e=>{if(!shell.contains(e.target))closeMobile()});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const open=items.find(item=>!item.panel.hidden);if(open){close(open);open.button.focus()}else if(nav.classList.contains('is-open')){closeMobile();mobile.focus()}});
 const skip=document.body.querySelector(':scope > a.skip-link');
 if(skip)skip.after(shell);else document.body.prepend(shell);
 document.documentElement.classList.add('ps-ready');
 const header=document.querySelector('body > header:not(.site-header)');const search=document.querySelector('.search-bar');
 const measure=()=>{if(header)document.documentElement.style.setProperty('--ps-secondary-height',header.offsetHeight+'px');if(search)document.documentElement.style.setProperty('--ps-search-height',search.offsetHeight+'px')};
 measure();if('ResizeObserver' in window){const ro=new ResizeObserver(measure);if(header)ro.observe(header);if(search)ro.observe(search)}else window.addEventListener('resize',measure);
 const frame=document.getElementById('ps-frame');
 if(frame){
  const adapt=()=>{try{const doc=frame.contentDocument;if(!doc||!doc.head||!doc.body)return;
   doc.documentElement.setAttribute('data-portal-page',frame.dataset.theme);
   if(!doc.querySelector('link[href*="portail-theme.css"]')){const link=doc.createElement('link');link.rel='stylesheet';link.href='portail-theme.css?v=20261119';doc.head.append(link)}
   const style=doc.createElement('style');style.textContent='body>a[href="index.html"][style*="position:fixed"],header>a[href="index.html"]{display:none!important}';doc.head.append(style);
   doc.querySelectorAll('a[href]').forEach(a=>{const href=a.getAttribute('href');if(href&&/^(?:\.\/)?[\w-]+\.html(?:[?#].*)?$/.test(href))a.target='_top'});
  }catch(error){/* Le fichier source reste utilisable si l’habillage ne peut pas être appliqué. */}};
  frame.addEventListener('load',adapt);if(frame.contentDocument?.readyState==='complete')adapt();
 }
})();
