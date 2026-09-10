/* POSIX.js APK+ package management extensions. */
(()=>{'use strict';
const P=window.POSIX;if(!P?.apk)return;
const base=P.apk,valid=n=>/^[A-Za-z0-9+_.-]+$/.test(n||'');
const cat=async()=>{let r=await P.netFetch('/alpine/packages.tsv?build='+encodeURIComponent(window.POSIX_BUILD||Date.now())),t=await r.text(),m=new Map;for(let l of t.trim().split('\n')){let[p,v,repo,file]=l.split('\t');if(p&&v)m.set(p,{p,v,repo,file})}return m};
const descendants=p=>[...P.fs.keys()].filter(k=>k===p||k.startsWith(p+'/')).sort((a,b)=>b.length-a.length);
const oct=(b,o,n)=>{let s='';for(let i=0;i<n&&b[o+i];i++)s+=String.fromCharCode(b[o+i]);return parseInt(s.trim()||'0',8)||0};
const str=(b,o,n)=>{let e=o;while(e<o+n&&b[e])e++;return new TextDecoder().decode(b.slice(o,e))};
async function inflate(b){return new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())}
function gzStarts(b){let a=[];for(let i=0;i+2<b.length;i++)if(b[i]===31&&b[i+1]===139&&b[i+2]===8)a.push(i);return a}
async function ungzip(b,legacy){if(!legacy)return inflate(b);let s=gzStarts(b),parts=[],i=0;while(i<s.length){let ok=null,j=i+1;for(;j<=s.length;j++){let e=j<s.length?s[j]:b.length;try{ok=await inflate(b.slice(s[i],e));break}catch{}}if(!ok)throw Error('cannot decode APK member');parts.push(ok);i=j}let n=parts.reduce((x,y)=>x+y.length,0),r=new Uint8Array(n),p=0;for(let x of parts){r.set(x,p);p+=x.length}return r}
function tarPaths(b){let r=[],o=0;while(o+512<=b.length){let zero=true;for(let i=0;i<512;i++)if(b[o+i]){zero=false;break}if(zero){o+=512;continue}let n=str(b,o,100),pre=str(b,o+345,155),sz=oct(b,o+124,12);if(pre)n=pre+'/'+n;n=n.replace(/^\.\//,'').replace(/^\//,'').replace(/\/$/,'');if(n&&!n.startsWith('.SIGN.')&&n!=='.PKGINFO')r.push('/'+n);o+=512+Math.ceil(sz/512)*512}return [...new Set(r)]}
async function migrateOne(name,info,out){if(Array.isArray(info.paths)&&info.paths.length)return false;let m=await cat(),pkg=m.get(name);if(!pkg)throw Error('cannot migrate '+name+': package missing from mirror');let baseUrl='/alpine/'+pkg.repo+'/riscv64/',orig=pkg.file,norm=orig.endsWith('.apk')?orig.replace(/\.apk$/,'.browser.tar.gz'):orig,d,file=norm;try{d=await P.download(baseUrl+norm)}catch(e){if(norm===orig)throw e;d=await P.download(baseUrl+orig);file=orig}let payload=await ungzip(d.bytes,file.endsWith('.apk')),paths=tarPaths(payload);/* Keep only paths that actually exist in the current filesystem. */paths=paths.map(x=>P.norm(x)).filter(x=>P.fs.has(x));if(!paths.length)throw Error('cannot migrate '+name+': no installed files matched package archive');P.packages.set(name,{...info,repo:info.repo||pkg.repo,paths,files:paths.length,migrated:Date.now()});out?.('migrated '+name+' · '+paths.length+' tracked entries');return true}
async function migrateAll(out){let changed=0,failed=[];for(let[name,info]of [...P.packages]){if(Array.isArray(info.paths)&&info.paths.length)continue;try{if(await migrateOne(name,info,out))changed++}catch(e){failed.push(name+': '+e.message);out?.('WARNING: '+name+': '+e.message)}}if(changed)await P.save();return{changed,failed}}
async function removeOne(name,out,purge=false){if(!valid(name))throw Error('invalid package name: '+name);let info=P.packages.get(name);if(!info)throw Error(name+' is not installed');if(!Array.isArray(info.paths)||!info.paths.length){out('apk: upgrading legacy package metadata for '+name);await migrateOne(name,info,out);await P.save();info=P.packages.get(name)}let paths=info.paths||[],owned=new Set;for(let[other,x]of P.packages)if(other!==name&&Array.isArray(x.paths))for(let p of x.paths)owned.add(P.norm(p));let removed=0;for(let p of [...paths].sort((a,b)=>b.length-a.length)){p=P.norm(p);if(owned.has(p))continue;let n=P.fs.get(p);if(!n)continue;if(n.t==='d'&&[...P.fs.keys()].some(k=>k!==p&&k.startsWith(p+'/')))continue;P.fs.delete(p);removed++}P.packages.delete(name);if(purge)for(let p of ['/etc/'+name,'/var/lib/'+name,'/var/cache/'+name])for(let x of descendants(p))P.fs.delete(x);await P.save();out('removed '+removed+' filesystem entries');out('OK: '+name+' removed'+(purge?' (purged)':''))}
/* Upgrade old IndexedDB package records automatically after POSIX.js updates. */
setTimeout(()=>{migrateAll(()=>{}).catch(e=>console.warn('APK legacy migration:',e))},0);
P.apk=async(args,out)=>{let a=[...args],cmd=a[0]||'help';
 if(cmd==='del'||cmd==='remove'||cmd==='rm'||cmd==='purge'){a.shift();if(!a.length)throw Error('usage: apk '+cmd+' <package...>');for(let n of a)await removeOne(n,out,cmd==='purge');return}
 if(cmd==='migrate'){let r=await migrateAll(out);out('OK: '+r.changed+' package record(s) migrated'+(r.failed.length?' · '+r.failed.length+' failed':''));return}
 if(cmd==='installed'){if(!P.packages.size)return out('No packages installed.');for(let[n,i]of[...P.packages].sort())out(n+'-'+i.v);return}
 if(cmd==='count')return out(String(P.packages.size));
 if(cmd==='exists'){let n=a[1];if(!n)throw Error('usage: apk exists <package>');return out(P.packages.has(n)?'yes':'no')}
 if(cmd==='version'){let n=a[1],i=P.packages.get(n);if(!i)throw Error((n||'package')+' is not installed');return out(i.v)}
 if(cmd==='repo'){let n=a[1],i=P.packages.get(n);if(!i)throw Error((n||'package')+' is not installed');return out(i.repo||'unknown')}
 if(cmd==='files'){let n=a[1],i=P.packages.get(n);if(!i)throw Error((n||'package')+' is not installed');if(!i.paths?.length){await migrateOne(n,i,out);await P.save();i=P.packages.get(n)}for(let p of i.paths)out(p);return}
 if(cmd==='size'){let n=a[1],i=P.packages.get(n);if(!i)throw Error((n||'package')+' is not installed');let z=0;for(let p of i.paths||[]){let f=P.fs.get(p);if(f?.t==='b')z+=f.d?.byteLength||0;else if(f?.t==='f')z+=new TextEncoder().encode(String(f.d||'')).length}return out(P.fmt(z))}
 if(cmd==='stats'){let files=0,bytes=0;for(let[,i]of P.packages){files+=i.paths?.length||i.files||0;for(let p of i.paths||[]){let f=P.fs.get(p);if(f?.t==='b')bytes+=f.d?.byteLength||0}}return out('packages: '+P.packages.size+'\ntracked files: '+files+'\ntracked binary data: '+P.fmt(bytes))}
 if(cmd==='available')return out(String((await cat()).size));
 if(cmd==='latest'||cmd==='origin'||cmd==='filename'){let m=await cat(),n=a[1],i=m.get(n);if(!n)throw Error('usage: apk '+cmd+' <package>');if(!i)throw Error(n+' not found');return out(cmd==='latest'?i.v:cmd==='origin'?i.repo:i.file)}
 if(cmd==='search-installed'){let q=(a[1]||'').toLowerCase();if(!q)throw Error('usage: apk search-installed <query>');for(let[n,i]of P.packages)if(n.toLowerCase().includes(q))out(n+'-'+i.v);return}
 if(cmd==='upgradeable'){let m=await cat(),c=0;for(let[n,i]of P.packages){let r=m.get(n);if(r&&r.v!==i.v){out(n+' '+i.v+' -> '+r.v);c++}}if(!c)out('All installed packages are current.');return}
 if(cmd==='clean'){for(let k of [...P.fs.keys()])if(k.startsWith('/var/cache/apk/'))P.fs.delete(k);await P.save();return out('OK: apk cache cleared')}
 if(cmd==='cache-size'){let z=0;for(let[k,f]of P.fs)if(k.startsWith('/var/cache/apk/')&&f?.t==='b')z+=f.d?.byteLength||0;return out(P.fmt(z))}
 if(cmd==='verify'){let bad=0;for(let[n,i]of P.packages){if(!i.v){out(n+': invalid package record');bad++}for(let p of i.paths||[])if(!P.fs.has(p)){out(n+': missing '+p);bad++}}return out(bad?'verification: '+bad+' problem(s)':'verification: OK')}
 if(cmd==='who-owns'){let p=P.norm(a[1]||'');if(!a[1])throw Error('usage: apk who-owns <path>');for(let[n,i]of P.packages)if(i.paths?.map(P.norm).includes(p))return out(n+'-'+i.v);return out('No package owns '+p)}
 if(cmd==='manifest'){for(let[n,i]of[...P.packages].sort())out(n+'\t'+i.v+'\t'+(i.repo||'unknown')+'\t'+(i.paths?.length||i.files||0));return}
 if(cmd==='help'){out('APK+ extras: del/remove/rm, purge, migrate, installed, count, exists, version, repo, files, size, stats, available, latest, origin, filename, search-installed, upgradeable, clean, cache-size, verify, who-owns, manifest');return base(args,out)}
 return base(args,out)
};
})();