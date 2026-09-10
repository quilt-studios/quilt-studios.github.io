(()=>{'use strict';const S=POSIXShell,P=S.P;S.register('uide',async({a})=>{if(typeof P.uide!=='function')throw Error('UIDE unavailable');await P.uide(a,S.out)});})();
