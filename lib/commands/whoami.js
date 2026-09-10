(()=>{'use strict';const S=POSIXShell;S.register('whoami',async({root})=>S.out(root?'root':'user'));})();
