(()=>{'use strict';const S=POSIXShell;S.register('id',async({root})=>S.out(root?'uid=0(root) gid=0(root) groups=0(root)':'uid=1000(user) gid=1000(user) groups=1000(user)'));})();
