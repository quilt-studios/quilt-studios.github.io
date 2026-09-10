(()=>{'use strict';
const KEY='posixjs-design';
const themes={
  classic:{bg:'#000000',fg:'#d8d8d8',prompt:'#5ee47c',muted:'#9aa0a6',panel:'#121821ee'},
  midnight:{bg:'#07111f',fg:'#dbeafe',prompt:'#60a5fa',muted:'#94a3b8',panel:'#0f172aee'},
  matrix:{bg:'#020703',fg:'#8cff9b',prompt:'#39ff5a',muted:'#57a866',panel:'#061108ee'},
  nord:{bg:'#2e3440',fg:'#d8dee9',prompt:'#88c0d0',muted:'#a3b1c2',panel:'#3b4252ee'},
  solarized:{bg:'#002b36',fg:'#eee8d5',prompt:'#2aa198',muted:'#93a1a1',panel:'#073642ee'},
  light:{bg:'#f6f7f9',fg:'#1f2937',prompt:'#087f5b',muted:'#64748b',panel:'#fffffff2'},
  dracula:{bg:'#282a36',fg:'#f8f8f2',prompt:'#50fa7b',muted:'#a7a7b3',panel:'#21222cee'},
  monokai:{bg:'#272822',fg:'#f8f8f2',prompt:'#a6e22e',muted:'#a9a98f',panel:'#1f201bee'},
  gruvbox:{bg:'#282828',fg:'#ebdbb2',prompt:'#b8bb26',muted:'#a89984',panel:'#1d2021ee'},
  catppuccin:{bg:'#1e1e2e',fg:'#cdd6f4',prompt:'#a6e3a1',muted:'#9399b2',panel:'#181825ee'},
  tokyo:{bg:'#1a1b26',fg:'#c0caf5',prompt:'#7aa2f7',muted:'#737da0',panel:'#16161eee'},
  ocean:{bg:'#061826',fg:'#d7f2ff',prompt:'#34d3ff',muted:'#7aa9bd',panel:'#0a2233ee'},
  ember:{bg:'#180b07',fg:'#ffe7d6',prompt:'#ff8a4c',muted:'#b88a74',panel:'#24110aee'},
  violet:{bg:'#120d1f',fg:'#efe7ff',prompt:'#b794f4',muted:'#9f8db8',panel:'#1c142bee'},
  paper:{bg:'#f3efe6',fg:'#302b26',prompt:'#7b5e3b',muted:'#7b746d',panel:'#fffaf0f2'},
  cyber:{bg:'#070812',fg:'#e6fbff',prompt:'#00f5d4',muted:'#7a90a4',panel:'#0e1020ee'}
};
function apply(name){const t=themes[name];if(!t)throw Error('unknown design: '+name);const r=document.documentElement.style;r.setProperty('--posix-bg',t.bg);r.setProperty('--posix-fg',t.fg);r.setProperty('--posix-prompt',t.prompt);r.setProperty('--posix-muted',t.muted);r.setProperty('--posix-panel',t.panel);document.documentElement.dataset.posixDesign=name;try{localStorage.setItem(KEY,name)}catch{}return name}
function current(){try{const n=localStorage.getItem(KEY);if(n&&themes[n])return n}catch{}return'classic'}
window.POSIXDesigns={themes,apply,current};
apply(current());
})();
