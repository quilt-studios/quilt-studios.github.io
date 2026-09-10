(()=>{'use strict';const S=POSIXShell;S.register('history',async({a})=>{if(a.length)throw Error('usage: history');S.history.forEach((x,i)=>S.out(String(i+1).padStart(4)+'  '+x))});})();
