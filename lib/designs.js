(()=>{'use strict';
const KEY='posixjs-design';
const themes={
  classic:{bg:'#000000',fg:'#d8d8d8',prompt:'#5ee47c',muted:'#9aa0a6',panel:'#121821ee'},
  midnight:{bg:'#07111f',fg:'#dbeafe',prompt:'#60a5fa',muted:'#94a3b8',panel:'#0f172aee'},
  matrix:{bg:'#020703',fg:'#8cff9b',prompt:'#39ff5a',muted:'#57a866',panel:'#061108ee'},
  nord:{bg:'#2e3440',fg:'#d8dee9',prompt:'#88c0d0',muted:'#a3b1c2',panel:'#3b4252ee'},
  solarized:{bg:'#002b36',fg:'#eee8d5',prompt:'#2aa198',muted:'#93a1a1',panel:'#073642ee'},
  light:{bg:'#f6f7f9',fg:'#1f2937',prompt:'#087f5b',muted:'#64748b',panel:'#fffffff2'}
};
function apply(name){const t=themes[name];if(!t)throw Error('unknown design: '+name);const r=document.documentElement.style;r.setProperty('--posix-bg',t.bg);r.setProperty('--posix-fg',t.fg);r.setProperty('--posix-prompt',t.prompt);r.setProperty('--posix-muted',t.muted);r.setProperty('--posix-panel',t.panel);document.documentElement.dataset.posixDesign=name;try{localStorage.setItem(KEY,name)}catch{}return name}
function current(){try{const n=localStorage.getItem(KEY);if(n&&themes[n])return n}catch{}return'classic'}
window.POSIXDesigns={themes,apply,current};
apply(current());
})();
