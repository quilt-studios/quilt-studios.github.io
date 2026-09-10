(()=>{'use strict';const S=POSIXShell;S.register('dirname',async({a})=>{if(!a.length)throw Error('usage: dirname PATH');S.out(S.fsutil.parent(a[0]))});})();
