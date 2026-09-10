(()=>{'use strict';
const S=window.POSIXShell;
S.register('true',async()=>{});
S.register('false',async()=>{throw Error('false returned exit status 1')});
S.register('sleep',async({a})=>{if(a.length!==1)throw Error('usage: sleep SECONDS');let s=Number(a[0]);if(!Number.isFinite(s)||s<0||s>60)throw Error('seconds must be between 0 and 60');await new Promise(r=>setTimeout(r,s*1000))});
})();
