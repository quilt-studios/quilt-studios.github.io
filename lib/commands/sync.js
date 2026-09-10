(()=>{'use strict';const S=POSIXShell;S.register('sync',async()=>{await S.P.save();S.out('synced')});})();
