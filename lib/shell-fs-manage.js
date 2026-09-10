(()=>{'use strict';
const S=window.POSIXShell,P=S.P,U=S.fsutil;
S.register('touch',async({a})=>{U.need(a,'usage: touch FILE...');for(let f of a){let p=P.norm(f),n=P.fs.get(p);if(n)n.time=Date.now();else P.write(p,'')}});
S.register('rm',async({a})=>{U.need(a,'usage: rm [-r] FILE...');let recursive=['-r','-rf','-fr'].includes(a[0]);if(recursive)a.shift();U.need(a,'usage: rm [-r] FILE...');for(let f of a){let[p,n]=U.node(f);if(n.t==='d'&&!recursive)throw Error(f+': is a directory');U.removeTree(p)}});
S.register('rmdir',async({a})=>{U.need(a,'usage: rmdir DIR...');for(let d of a){let[p,n]=U.node(d);if(n.t!=='d')throw Error(d+': Not a directory');if(P.ls(p).length)throw Error(d+': Directory not empty');if(p==='/')throw Error('cannot remove /');P.fs.delete(p)}});
S.register('cp',async({a})=>{let recursive=['-r','-R'].includes(a[0]);if(recursive)a.shift();if(a.length!==2)throw Error('usage: cp [-r] SOURCE DEST');let[sp,sn]=U.node(a[0]),dest=P.norm(a[1]),dn=P.fs.get(dest);if(sn.t==='d'&&!recursive)throw Error('omitting directory '+a[0]);if(dn?.t==='d')dest=P.norm(dest+'/'+sp.split('/').pop());U.copyTree(sp,dest)});
S.register('mv',async({a})=>{if(a.length!==2)throw Error('usage: mv SOURCE DEST');let[sp,sn]=U.node(a[0]),dest=P.norm(a[1]),dn=P.fs.get(dest);if(dn?.t==='d')dest=P.norm(dest+'/'+sp.split('/').pop());if(dest===sp)return;if(sn.t==='d'&&dest.startsWith(sp+'/'))throw Error('cannot move a directory into itself');U.copyTree(sp,dest);U.removeTree(sp)});
S.register('ln',async({a})=>{if(a[0]!=='-s'||a.length!==3)throw Error('usage: ln -s TARGET LINK');let link=P.norm(a[2]);if(P.fs.has(link))throw Error(a[2]+': File exists');P.md(U.parent(link));P.fs.set(link,{t:'l',target:a[1],time:Date.now()})});
})();
