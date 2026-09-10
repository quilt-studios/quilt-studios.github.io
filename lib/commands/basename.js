(()=>{'use strict';const S=POSIXShell,P=S.P;S.register('basename',async({a})=>{if(!a.length)throw Error('usage: basename PATH');const p=P.norm(a[0]);S.out(p==='/'?'/':p.split('/').pop())});})();
