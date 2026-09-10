(()=>{'use strict';const S=POSIXShell,P=S.P;S.register('apk',async({a})=>{if(typeof P.apk!=='function')throw Error('apk subsystem unavailable');await P.apk(a,S.out)});})();
