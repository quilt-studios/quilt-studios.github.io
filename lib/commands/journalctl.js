(()=>{'use strict';const S=POSIXShell,P=S.P;S.register('journalctl',async()=>{const n=P.fs.get('/var/log/journal/posixjs.log');S.out(n?.d||'-- No entries --')});})();
