(()=>{'use strict';
const P=window.POSIX;
let timer=null;
const make=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e};
function appIcon(id,app,U){const b=make('button','uide-mobile-app'),icon=make('span','uide-mobile-app-icon',app.icon||app.name.slice(0,1)),name=make('span','uide-mobile-app-name',app.name);b.append(icon,name);b.onclick=()=>U.launch(id);return b}
function decorate(desktop,U){desktop.classList.add('uide-mobile-shell');const space=desktop.querySelector('.uide-space');if(!space)return;
  desktop.querySelector('.uide-top')?.remove();desktop.querySelector('.uide-dock')?.remove();space.replaceChildren();
  const status=make('div','uide-mobile-status'),clock=make('span','uide-mobile-clock'),right=make('span','uide-mobile-status-right','POSIX.js '+P.VERSION);status.append(clock,right);
  const home=make('section','uide-mobile-home'),hero=make('div','uide-mobile-hero'),date=make('div','uide-mobile-date'),big=make('div','uide-mobile-bigclock');hero.append(big,date);
  const search=make('button','uide-mobile-search','Search apps');search.onclick=()=>{drawer.hidden=false;filter.focus()};
  const grid=make('div','uide-mobile-grid');for(const [id,a] of U.apps)if(a.mobile!==false)grid.append(appIcon(id,a,U));
  const drawer=make('section','uide-mobile-drawer');drawer.hidden=true;const drawerHead=make('div','uide-mobile-drawer-head'),filter=document.createElement('input'),close=make('button','','×'),drawerGrid=make('div','uide-mobile-drawer-grid');filter.placeholder='Search apps';filter.autocomplete='off';close.onclick=()=>{drawer.hidden=true;filter.value='';renderDrawer('')};drawerHead.append(filter,close);drawer.append(drawerHead,drawerGrid);
  function renderDrawer(q){drawerGrid.replaceChildren();q=q.toLowerCase();for(const [id,a] of U.apps){if(a.mobile===false||!(id+' '+a.name).toLowerCase().includes(q))continue;drawerGrid.append(appIcon(id,a,U))}}filter.oninput=()=>renderDrawer(filter.value);renderDrawer('');
  const dock=make('nav','uide-mobile-dock');for(const id of ['files','terminal','about','developer']){const a=U.apps.get(id);if(a){const b=make('button','',a.icon||a.name[0]);b.title=a.name;b.onclick=()=>U.launch(id);dock.append(b)}}
  const nav=make('nav','uide-mobile-nav'),back=make('button','','‹'),homeBtn=make('button','','○'),recents=make('button','','▢');back.onclick=()=>{const wins=[...space.querySelectorAll('.uide-window')];const top=wins.at(-1);if(top)top.remove();else drawer.hidden=true};homeBtn.onclick=()=>{for(const w of space.querySelectorAll('.uide-window'))w.remove();drawer.hidden=true};recents.onclick=()=>{const wins=[...space.querySelectorAll('.uide-window')];if(wins.length)wins.at(-1).classList.toggle('uide-mobile-peek')};nav.append(back,homeBtn,recents);
  home.append(hero,search,grid);space.append(status,home,drawer,dock,nav);
  const tick=()=>{const d=new Date();clock.textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});big.textContent=clock.textContent;date.textContent=d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})};tick();timer=setInterval(tick,30000);
  let sx=null;space.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,.uide-window'))return;sx=e.clientX},{passive:true});space.addEventListener('pointerup',e=>{if(sx===null)return;const dx=e.clientX-sx;sx=null;if(dx<-70)drawer.hidden=false;else if(dx>70)drawer.hidden=true},{passive:true});
}
function cleanup(){clearInterval(timer);timer=null}
window.UIDEMobile={decorate,cleanup};
})();
