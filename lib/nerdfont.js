(()=>{'use strict';
const candidates=['JetBrainsMono Nerd Font','JetBrainsMono Nerd Font Mono','MesloLGS NF','MesloLGM Nerd Font','FiraCode Nerd Font','Hack Nerd Font','CaskaydiaCove Nerd Font','SauceCodePro Nerd Font','UbuntuMono Nerd Font','NotoSansM Nerd Font Mono'];
const fallback='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
let font=null;
try{
  if(document.fonts?.check){
    const probe='\uf07b\uf15b\uf121';
    font=candidates.find(name=>document.fonts.check(`16px "${name}"`,probe))||null;
  }
}catch{}
const stack=font?`"${font}", ${fallback}`:fallback;
document.documentElement.style.setProperty('--posix-mono',stack);
if(font)document.documentElement.classList.add('nerd-font');
const icons={folder:'\uf07b',link:'\uf0c1',binary:'\ueae8',file:'\uf15b',js:'\ue74e',json:'\ue60b',shell:'\ue795',config:'\ue615',archive:'\uf410',image:'\uf1c5',text:'\uf15c',code:'\uf121'};
function iconFor(name,node){
  if(node?.t==='d')return icons.folder;
  if(node?.t==='l')return icons.link;
  const n=String(name||'').toLowerCase();
  if(/\.(js|mjs|cjs)$/.test(n))return icons.js;
  if(/\.json$/.test(n))return icons.json;
  if(/\.(sh|bash|zsh)$/.test(n))return icons.shell;
  if(/\.(conf|ini|cfg|toml|yaml|yml)$/.test(n))return icons.config;
  if(/\.(tar|gz|tgz|xz|bz2|zip|apk)$/.test(n))return icons.archive;
  if(/\.(png|jpe?g|gif|webp|svg)$/.test(n))return icons.image;
  if(/\.(txt|md|log)$/.test(n))return icons.text;
  if(node?.t==='b')return icons.binary;
  return icons.file;
}
window.POSIXNerdFont={enabled:!!font,font,stack,icons,iconFor};
})();
