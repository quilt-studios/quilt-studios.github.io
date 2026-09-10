(()=>{'use strict';const S=POSIXShell,P=S.P;S.register('mkdir',async({a})=>{if(!a.length)throw Error('usage: mkdir DIR...');a.forEach(P.md)});})();
