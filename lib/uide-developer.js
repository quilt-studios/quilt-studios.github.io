(()=>{'use strict';const P=window.POSIX,U=window.UIDE;if(!U)return;
function row(label,value){const r=U.make('div','uide-dev-row'),a=U.make('span','uide-dev-label',label),b=U.make('span','uide-dev-value',value);r.append(a,b);return r}
function open(){const wrap=U.make('div','uide-dev'),info=U.make('div','uide-dev-grid');
  info.append(row('Version',P.VERSION),row('Build',window.POSIX_BUILD||'unknown'),row('Mobile mode',window.POSIXLabsMobile?.enabled()?'enabled':'disabled'),row('Nerd Font',document.documentElement.dataset.nerdFont||'auto/off'),row('Wayland',window.POSIXWayland?.version||'off'),row('Viewport',innerWidth+'×'+innerHeight));
  const actions=U.make('div','uide-dev-actions'),mobile=U.make('button','','Toggle mobile keyboard'),designs=U.make('button','','Open designs'),cache=U.make('button','','Clear web caches'),mobileUI=U.make('button','','Open mobile UIDE');
  mobile.onclick=()=>{const M=window.POSIXLabsMobile;if(!M)return U.toast('mobilemode unavailable');M.apply(!M.enabled());U.toast('mobilemode '+(M.enabled()?'enabled':'disabled'))};
  designs.onclick=()=>window.POSIXDesignPicker?.open?.();
  mobileUI.onclick=()=>{U.close();setTimeout(()=>P.uide?.(['mobile'],()=>{}),0)};
  cache.onclick=async()=>{try{if('caches'in window)for(const k of await caches.keys())await caches.delete(k);U.toast('Web caches cleared')}catch(e){U.toast('Cache: '+e.message)}};
  actions.append(mobile,mobileUI,designs,cache);wrap.append(info,actions);U.win('Developer options',wrap)}
U.registerApp('developer',{name:'Developer',icon:'⚙',desktop:true,open});
})();
