(()=>{'use strict';const S=POSIXShell;S.register('date',async({a})=>{if(a.length)throw Error('usage: date');S.out(new Date().toString())});})();
