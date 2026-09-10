(()=>{'use strict';const S=POSIXShell,P=S.P;S.register('cd',async({a})=>{const p=P.resolve(a[0]||'~');if(P.fs.get(p)?.t!=='d')throw Error('not a directory');P.cwd=p});})();
