(()=>{'use strict';
const P=window.POSIX;
if(!P)return;
const parse=v=>String(v||'0').split('.').map(x=>Number.parseInt(x,10)||0);
const cmp=(a,b)=>{const A=parse(a),B=parse(b),n=Math.max(A.length,B.length);for(let i=0;i<n;i++){const x=A[i]||0,y=B[i]||0;if(x!==y)return x<y?-1:1}return 0};
const textNode=p=>{const n=P.fs.get(P.norm(p));return n?.t==='f'?String(n.d||''):''};
const detectedVersion=()=>{const marker=textNode('/var/lib/posixjs/system-version').trim();if(marker)return marker;const os=textNode('/etc/os-release');const m=os.match(/^VERSION=(.+)$/m);return m?m[1].trim().replace(/^['"]|['"]$/g,''):'0'};
const ensureDir=p=>{if(!P.fs.has(P.norm(p)))P.md(p)};
const ensureFile=(p,data)=>{if(!P.fs.has(P.norm(p)))P.write(p,data)};
const stamp=()=>{ensureDir('/var/lib');ensureDir('/var/lib/posixjs');P.write('/var/lib/posixjs/system-version',P.VERSION+'\n');P.write('/etc/os-release','NAME=POSIX.js\nVERSION='+P.VERSION+'\nARCH=riscv64\n')};
const log=line=>{ensureDir('/var/log');const p='/var/log/posixjs-update.log',old=textNode(p);P.write(p,old+new Date().toISOString()+' '+line+'\n')};
const migrations=[
  {version:'26.0.1',run(){['/etc/apk','/etc/systemd/system','/usr/lib/systemd/system','/var/cache/apk','/var/log/journal'].forEach(ensureDir);ensureFile('/etc/hostname','posixjs\n')}},
  {version:'26.0.2',run(){['/run','/run/user','/run/user/1000','/dev','/dev/shm','/tmp'].forEach(ensureDir)}},
  {version:'26.0.2.3',run(){ensureDir('/var/lib');ensureDir('/var/lib/posixjs')}}
];
P.updateSystem=async({force=false}={})=>{
  const from=detectedVersion();
  if(!force&&cmp(from,P.VERSION)>=0){stamp();return{updated:false,from,to:P.VERSION,steps:[]}};
  const snapshot={fs:new Map(P.fs),packages:new Map(P.packages),services:new Map(P.services),cwd:P.cwd};
  const steps=[];
  try{
    for(const m of migrations){if(force||cmp(from,m.version)<0){m.run();steps.push(m.version)}}
    stamp();
    log('updated '+from+' -> '+P.VERSION+(steps.length?' via '+steps.join(', '):''));
    await P.save();
    return{updated:cmp(from,P.VERSION)<0||force,from,to:P.VERSION,steps};
  }catch(error){
    P.fs.clear();for(const [k,v] of snapshot.fs)P.fs.set(k,v);
    P.packages.clear();for(const [k,v] of snapshot.packages)P.packages.set(k,v);
    P.services.clear();for(const [k,v] of snapshot.services)P.services.set(k,v);
    P.cwd=snapshot.cwd;
    throw new Error('system update failed; rollback completed: '+error.message);
  }
};
P.updateInfo=()=>({installed:detectedVersion(),current:P.VERSION,pending:cmp(detectedVersion(),P.VERSION)<0});
window.POSIXUpdate={compare:cmp,detectedVersion,migrations};
})();
