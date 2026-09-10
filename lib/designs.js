(()=>{'use strict';
const KEY='posixjs-design';
const themes={
  classic:{label:'Classic',bg:'#000000',fg:'#d8d8d8',prompt:'#5ee47c',muted:'#9aa0a6',panel:'#121821ee'},
  midnight:{label:'Midnight',bg:'#07111f',fg:'#dbeafe',prompt:'#60a5fa',muted:'#94a3b8',panel:'#0f172aee'},
  matrix:{label:'Matrix',bg:'#020703',fg:'#8cff9b',prompt:'#39ff5a',muted:'#57a866',panel:'#061108ee'},
  nord:{label:'Nord',bg:'#2e3440',fg:'#d8dee9',prompt:'#88c0d0',muted:'#a3b1c2',panel:'#3b4252ee'},
  solarized:{label:'Solarized',bg:'#002b36',fg:'#eee8d5',prompt:'#2aa198',muted:'#93a1a1',panel:'#073642ee'},
  light:{label:'Light',bg:'#f6f7f9',fg:'#1f2937',prompt:'#087f5b',muted:'#64748b',panel:'#fffffff2'},
  dracula:{label:'Dracula',bg:'#282a36',fg:'#f8f8f2',prompt:'#50fa7b',muted:'#a7a7b3',panel:'#21222cee'},
  monokai:{label:'Monokai',bg:'#272822',fg:'#f8f8f2',prompt:'#a6e22e',muted:'#a9a98f',panel:'#1f201bee'},
  gruvbox:{label:'Gruvbox',bg:'#282828',fg:'#ebdbb2',prompt:'#b8bb26',muted:'#a89984',panel:'#1d2021ee'},
  catppuccin:{label:'Catppuccin',bg:'#1e1e2e',fg:'#cdd6f4',prompt:'#a6e3a1',muted:'#9399b2',panel:'#181825ee'},
  tokyo:{label:'Tokyo Night',bg:'#1a1b26',fg:'#c0caf5',prompt:'#7aa2f7',muted:'#737da0',panel:'#16161eee'},
  ocean:{label:'Ocean',bg:'#061826',fg:'#d7f2ff',prompt:'#34d3ff',muted:'#7aa9bd',panel:'#0a2233ee'},
  ember:{label:'Ember',bg:'#180b07',fg:'#ffe7d6',prompt:'#ff8a4c',muted:'#b88a74',panel:'#24110aee'},
  violet:{label:'Violet',bg:'#120d1f',fg:'#efe7ff',prompt:'#b794f4',muted:'#9f8db8',panel:'#1c142bee'},
  paper:{label:'Paper',bg:'#f3efe6',fg:'#302b26',prompt:'#7b5e3b',muted:'#7b746d',panel:'#fffaf0f2'},
  cyber:{label:'Cyber',bg:'#070812',fg:'#e6fbff',prompt:'#00f5d4',muted:'#7a90a4',panel:'#0e1020ee'},
  rose:{label:'Rose Pine',bg:'#191724',fg:'#e0def4',prompt:'#ebbcba',muted:'#908caa',panel:'#1f1d2eee'},
  synth:{label:'Synthwave',bg:'#160b2d',fg:'#f7e7ff',prompt:'#ff7edb',muted:'#a786c8',panel:'#24113fee'},
  forest:{label:'Forest',bg:'#0b1710',fg:'#dcebdc',prompt:'#79c879',muted:'#7f9c86',panel:'#122218ee'},
  amber:{label:'Amber CRT',bg:'#100b00',fg:'#ffd98a',prompt:'#ffb000',muted:'#aa8140',panel:'#1c1202ee'},
  ice:{label:'Ice',bg:'#eef7ff',fg:'#203040',prompt:'#147db3',muted:'#60788a',panel:'#f8fcfff2'}
};
let picker=null,previewName=null,originalName=null,selectedName=null;
function paint(name){const t=themes[name];if(!t)throw Error('unknown design: '+name);const r=document.documentElement.style;r.setProperty('--posix-bg',t.bg);r.setProperty('--posix-fg',t.fg);r.setProperty('--posix-prompt',t.prompt);r.setProperty('--posix-muted',t.muted);r.setProperty('--posix-panel',t.panel);document.documentElement.dataset.posixDesign=name;return name}
function apply(name,{save=true}={}){paint(name);if(save)try{localStorage.setItem(KEY,name)}catch{}return name}
function current(){try{const n=localStorage.getItem(KEY);if(n&&themes[n])return n}catch{}return'classic'}
function names(){return Object.keys(themes)}
function cycle(delta=1){const list=names(),i=list.indexOf(current()),next=list[(Math.max(0,i)+delta+list.length)%list.length];apply(next);return next}
function random(){const list=names().filter(x=>x!==current()),name=list[Math.floor(Math.random()*list.length)]||'classic';apply(name);return name}
function toast(text){let e=document.createElement('div');e.className='posix-design-toast';e.textContent=text;document.body.append(e);setTimeout(()=>e.remove(),1300)}
function close(commit=false){if(!picker)return;if(commit&&selectedName){apply(selectedName);toast('Design: '+themes[selectedName].label)}else if(originalName)paint(originalName);picker.remove();picker=null;previewName=null;selectedName=null;document.querySelector('#c')?.focus()}
function setPreview(name){if(!themes[name])return;previewName=name;selectedName=name;paint(name);for(const c of picker?.querySelectorAll('.posix-design-card')||[]){c.classList.toggle('preview',c.dataset.name===name);c.classList.toggle('active',c.dataset.name===current())}const s=picker?.querySelector('[data-role="selected"]');if(s)s.textContent=themes[name].label}
function open(){if(picker)return;originalName=current();selectedName=originalName;picker=document.createElement('section');picker.className='posix-design-picker';picker.tabIndex=-1;const panel=document.createElement('div');panel.className='posix-design-panel';const head=document.createElement('div');head.className='posix-design-head';const title=document.createElement('strong');title.textContent='Designs';const selected=document.createElement('span');selected.dataset.role='selected';selected.textContent=themes[selectedName].label;const spacer=document.createElement('span');spacer.className='spacer';const hint=document.createElement('span');hint.innerHTML='<kbd>←</kbd> <kbd>→</kbd> preview';const x=document.createElement('button');x.textContent='×';x.setAttribute('aria-label','Close design picker');x.onclick=()=>close(false);head.append(title,selected,spacer,hint,x);const grid=document.createElement('div');grid.className='posix-design-grid';for(const [name,t] of Object.entries(themes)){const card=document.createElement('button');card.className='posix-design-card'+(name===originalName?' active':'');card.dataset.name=name;const sw=document.createElement('div');sw.className='posix-design-swatch';sw.style.background=t.bg;sw.style.color=t.fg;sw.style.borderColor=t.prompt;sw.textContent='user@posixjs:~$';const nm=document.createElement('div');nm.className='posix-design-name';nm.textContent=t.label;const meta=document.createElement('div');meta.className='posix-design-meta';meta.textContent=name;card.append(sw,nm,meta);card.onpointerenter=()=>setPreview(name);card.onclick=()=>{setPreview(name);close(true)};grid.append(card)}const actions=document.createElement('div');actions.className='posix-design-actions';const prev=document.createElement('button');prev.textContent='← Previous';prev.onclick=()=>{const list=names(),i=list.indexOf(selectedName);setPreview(list[(i-1+list.length)%list.length])};const next=document.createElement('button');next.textContent='Next →';next.onclick=()=>{const list=names(),i=list.indexOf(selectedName);setPreview(list[(i+1)%list.length])};const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>close(false);const ok=document.createElement('button');ok.className='apply';ok.textContent='Apply';ok.onclick=()=>close(true);actions.append(prev,next,cancel,ok);panel.append(head,grid,actions);picker.append(panel);picker.addEventListener('pointerdown',e=>{if(e.target===picker)close(false)});picker.addEventListener('keydown',e=>{const list=names(),i=list.indexOf(selectedName);if(e.key==='Escape'){e.preventDefault();close(false)}else if(e.key==='ArrowRight'){e.preventDefault();setPreview(list[(i+1)%list.length])}else if(e.key==='ArrowLeft'){e.preventDefault();setPreview(list[(i-1+list.length)%list.length])}else if(e.key==='Enter'){e.preventDefault();close(true)}});document.body.append(picker);picker.focus()}
window.POSIXDesigns={themes,apply,paint,current,names,cycle,random,open,close,get preview(){return previewName}};
apply(current());
})();
