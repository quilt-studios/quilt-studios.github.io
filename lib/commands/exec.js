(()=>{'use strict';const S=POSIXShell;S.register('exec',async({a})=>{const p=a.shift();if(!p)throw Error('usage: exec /path [args]');S.out('\n[exit '+await S.P.exec(p,a,S.raw)+']')});})();
