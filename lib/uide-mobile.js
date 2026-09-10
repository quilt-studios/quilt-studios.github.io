(()=>{'use strict';
const P=window.POSIX;
let timer=null,cleanupFns=[];
const make=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e};
const listen=(el,type,fn,opt)=>{el.addEventListener(type,fn,opt);cleanupFns.push(()=>el.removeEventListener(type,fn,opt))};
function appIcon(id,app,U,cls='uide-mobile-app'){const b=make('button',cls),icon=make('span','uide-mobile-app-icon',app.icon||app.name.slice(0,1)),name=make('span','uide-mobile-app-name',app.name);b.dataset.app=id;b.append(icon,name);b.onclick=()=>U.launch(id);return b}
function decorate(desktop,U){desktop.classList.add('uide-mobile-shell');const space=desktop.querySelector('.uide-space');if(!space)return;
 desktop.querySelector('.uide-top')?.remove();desktop.querySelector('.uide-dock')?.remove();space.replaceChildren();
 const status=make('header','uide-mobile-status'),clock=make('span','uide-mobile-clock'),right=make('span','uide-mobile-status-right','POSIX.js '+P.VERSION);status.append(clock,right);
 const home=make('section','uide-mobile-home'),hero=make('section','uide-mobile-hero'),big=make('div','uide-mobile-bigclock'),date=make('div','uide-mobile-date'),build=make('div','uide-mobile-build',window.POSIX_BUILD||P.VERSION);hero.append(big,date,build);
 const search=make('button','uide-mobile-search');search.innerHTML='<span>⌕</span><span>Search apps</span>';const favorites=make('div','uide-mobile-grid');
 const preferred=['files','terminal','about','developer'];for(const id of preferred){const a=U.apps.get(id);if(a&&a.mobile!==false)favorites.append(appIcon(id,a,U))}
 const hint=make('div','uide-mobile-hint','Swipe up for all apps');
 const drawer=make('section','uide-mobile-drawer');drawer.hidden=true;const handle=make('div','uide-mobile-drawer-handle'),drawerHead=make('div','uide-mobile-drawer-head'),filter=document.createElement('input'),close=make('button','uide-mobile-drawer-close','×'),drawerTitle=make('strong','','All apps'),drawerGrid=make('div','uide-mobile-drawer-grid');filter.placeholder='Search apps';filter.autocomplete='off';filter.spellcheck=false;drawerHead.append(drawerTitle,filter,close);drawer.append(handle,drawerHead,drawerGrid);
 function renderDrawer(q=''){drawerGrid.replaceChildren();q=q.trim().toLowerCase();let count=0;for(const [id,a] of U.apps){if(a.mobile===false||!(id+' '+a.name).toLowerCase().includes(q))continue;drawerGrid.append(appIcon(id,a,U));count++}if(!count)drawerGrid.append(make('div','uide-mobile-empty','No apps found'))}
 function openDrawer(focus=false){drawer.hidden=false;requestAnimationFrame(()=>drawer.classList.add('open'));renderDrawer(filter.value);if(focus)setTimeout(()=>filter.focus(),160)}
 function closeDrawer(){drawer.classList.remove('open');filter.blur();setTimeout(()=>{if(!drawer.classList.contains('open'))drawer.hidden=true},180)}
 search.onclick=()=>openDrawer(true);close.onclick=closeDrawer;filter.oninput=()=>renderDrawer(filter.value);renderDrawer();
 const dock=make('nav','uide-mobile-dock');for(const id of preferred){const a=U.apps.get(id);if(!a)continue;const b=make('button','uide-mobile-dock-app',a.icon||a.name[0]);b.title=a.name;b.onclick=()=>U.launch(id);dock.append(b)}
 const nav=make('nav','uide-mobile-nav'),back=make('button','','‹'),homeBtn=make('button','','●'),recents=make('button','','▢');
 function windows(){return [...space.querySelectorAll('.uide-window')].filter(w=>w.isConnected)}
 back.onclick=()=>{const ws=windows();if(ws.length)ws.at(-1).remove();else if(!drawer.hidden)closeDrawer()};homeBtn.onclick=()=>{for(const w of windows())w.remove();closeDrawer()};recents.onclick=()=>{const ws=windows();if(!ws.length)return U.toast('No recent windows');ws.forEach((w,i)=>w.classList.toggle('uide-mobile-peek',i===ws.length-1))};nav.append(back,homeBtn,recents);
 home.append(hero,search,favorites,hint);space.append(status,home,drawer,dock,nav);
 const tick=()=>{const d=new Date();const tm=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});clock.textContent=tm;big.textContent=tm;date.textContent=d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})};tick();timer=setInterval(tick,15000);
 let sy=null;listen(space,'pointerdown',e=>{if(e.target.closest('button,input,.uide-window,.uide-mobile-drawer'))return;sy=e.clientY},{passive:true});listen(space,'pointerup',e=>{if(sy===null)return;const dy=e.clientY-sy;sy=null;if(dy<-55)openDrawer(false);else if(dy>55)closeDrawer()},{passive:true});
 listen(window,'keydown',e=>{if(!desktop.isConnected)return;if(e.key==='Escape'){if(windows().length)windows().at(-1).remove();else closeDrawer()}else if(e.key==='Home'){homeBtn.click()}else if(e.key==='ArrowUp'&&e.altKey)openDrawer(true)});
 if(window.visualViewport){const resize=()=>desktop.style.setProperty('--uide-vh',window.visualViewport.height+'px');resize();listen(window.visualViewport,'resize',resize)}
}
function cleanup(){clearInterval(timer);timer=null;for(const f of cleanupFns.splice(0))try{f()}catch{}}
window.UIDEMobile={decorate,cleanup};
})();
