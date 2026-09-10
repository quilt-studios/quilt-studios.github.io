/* POSIX.js APK+ package management extensions. */
(()=>{'use strict';
const P=window.POSIX;if(!P?.apk)return;
const base=P.apk,valid=n=>/^[A-Za-z0-9+_.-]+$/.test(n||'');
const cat=async()=>{let r=await P.netFetch('/alpine/packages.tsv?build='+encodeURIComponent(window.POSIX_BUILD||Date.now())),t=await r.text(),m=new Map;for(let l of t.trim().split('\n')){let[p,v,repo,file]=l.split('\t');if(p&&v)m.set(p,{p,v,repo,file})}return m};
const descendants=p=>[...P.fs.keys()].filter(k=>k===p||k.startsWith(p+'/')).sort((a,b)=>b.length-a.length);
async function removeOne(name,out,purge=false){if(!valid(name))throw Error('invalid package name: '+name);let info=P.packages.get(name);if(!info)throw Error(name+' is not installed');let paths=Array.isArray(info.paths)?info.paths:[];if(!paths.length){out('WARNING: '+name+' was installed before file tracking; package record removed but files kept');}else{let owned=new Set;for(let [other,x] of P.packages)if(other!==name&&Array.isArray(x.paths))for(let p of x.paths)owned.add(p);let removed=0;for(let p of [...paths].sort((a,b)=>b.length-a.length)){p=P.norm(p);if(owned.has(p))continue;let n=P.fs.get(p);if(!n)continue;if(n.t==='d'){let has=[...P.fs.keys()].some(k=>k!==p&&k.startsWith(p+'/'));if(has)continue;}P.fs.delete(p);removed++;}out('removed '+removed+' filesystem entries');}P.packages.delete(name);if(purge){for(let p of ['/etc/'+name,'/var/lib/'+name,'/var/cache/'+name])for(let x of descendants(p))P.fs.delete(x)}await P.save();out('OK: '+name+' removed'+(purge?' (purged)':''));}
P.apk=async(args,out)=>{let a=[...args],cmd=a[0]||'help';try{
 if(cmd==='del'||cmd==='remove'||cmd==='rm'||cmd==='purge'){a.shift();if(!a.length)throw Error('usage: apk '+cmd+' <package...>');for(let n of a)await removeOne(n,out,cmd==='purge');return}
 if(cmd==='installed'){if(!P.packages.size)return out('No packages installed.');for(let[n,i]of[...P.packages].sort())out(n+'-'+i.v);return}
 if(cmd==='count')return out(String(P.packages.size));
 if(cmd==='exists'){let n=a[1];if(!n)throw Error('usage: apk exists <package>');return out(P.packages.has(n)?'yes':'no')}
 if(cmd==='version'){let n=a[1];if(!n)throw Error('usage: apk version <package>');let i=P.packages.get(n);if(!i)throw Error(n+' is not installed');return out(i.v)}
 if(cmd==='repo'){let n=a[1];if(!n)throw Error('usage: apk repo <package>');let i=P.packages.get(n);if(!i)throw Error(n+' is not installed');return out(i.repo||'unknown')}
 if(cmd==='files'){let n=a[1];if(!n)throw Error('usage: apk files <package>');let i=P.packages.get(n);if(!i)throw Error(n+' is not installed');let x=i.paths||[];if(!x.length)return out('No file manifest recorded (reinstall package to enable it).');for(let p of x)out(p);return}
 if(cmd==='size'){let n=a[1];if(!n)throw Error('usage: apk size <package>');let i=P.packages.get(n);if(!i)throw Error(n+' is not installed');let z=0;for(let p of i.paths||[]){let f=P.fs.get(p);if(f?.t==='b')z+=f.d?.byteLength||0;else if(f?.t==='f')z+=new TextEncoder().encode(String(f.d||'')).length}return out(P.fmt(z))}
 if(cmd==='stats'){let files=0,bytes=0;for(let[,i]of P.packages){files+=i.paths?.length||i.files||0;for(let p of i.paths||[]){let f=P.fs.get(p);if(f?.t==='b')bytes+=f.d?.byteLength||0}}return out('packages: '+P.packages.size+'\ntracked files: '+files+'\ntracked binary data: '+P.fmt(bytes))}
 if(cmd==='available'){let m=await cat();out(String(m.size));return}
 if(cmd==='latest'){let m=await cat(),n=a[1];if(!n)throw Error('usage: apk latest <package>');let i=m.get(n);if(!i)throw Error(n+' not found');return out(i.v)}
 if(cmd==='origin'){let m=await cat(),n=a[1];if(!n)throw Error('usage: apk origin <package>');let i=m.get(n);if(!i)throw Error(n+' not found');return out(i.repo)}
 if(cmd==='filename'){let m=await cat(),n=a[1];if(!n)throw Error('usage: apk filename <package>');let i=m.get(n);if(!i)throw Error(n+' not found');return out(i.file)}
 if(cmd==='search-installed'){let q=(a[1]||'').toLowerCase();if(!q)throw Error('usage: apk search-installed <query>');for(let[n,i]of P.packages)if(n.toLowerCase().includes(q))out(n+'-'+i.v);return}
 if(cmd==='upgradeable'){let m=await cat(),c=0;for(let[n,i]of P.packages){let r=m.get(n);if(r&&r.v!==i.v){out(n+' '+i.v+' -> '+r.v);c++}}if(!c)out('All installed packages are current.');return}
 if(cmd==='clean'){for(let k of [...P.fs.keys()])if(k.startsWith('/var/cache/apk/'))P.fs.delete(k);await P.save();out('OK: apk cache cleared');return}
 if(cmd==='cache-size'){let z=0;for(let[k,f]of P.fs)if(k.startsWith('/var/cache/apk/')&&f?.t==='b')z+=f.d?.byteLength||0;return out(P.fmt(z))}
 if(cmd==='verify'){let bad=0;for(let[n,i]of P.packages){if(!i.v){out(n+': invalid package record');bad++}for(let p of i.paths||[])if(!P.fs.has(p)){out(n+': missing '+p);bad++}}out(bad?'verification: '+bad+' problem(s)':'verification: OK');return}
 if(cmd==='who-owns'){let p=P.norm(a[1]||'');if(!a[1])throw Error('usage: apk who-owns <path>');for(let[n,i]of P.packages)if(i.paths?.includes(p))return out(n+'-'+i.v);return out('No package owns '+p)}
 if(cmd==='manifest'){for(let[n,i]of[...P.packages].sort())out(n+'\t'+i.v+'\t'+(i.repo||'unknown')+'\t'+(i.paths?.length||i.files||0));return}
 if(cmd==='help'){out('APK+ extras: del/remove/rm, purge, installed, count, exists, version, repo, files, size, stats, available, latest, origin, filename, search-installed, upgradeable, clean, cache-size, verify, who-owns, manifest');return base(args,out)}
 return base(args,out);
}catch(e){throw e}
};
})();