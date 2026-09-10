(()=>{'use strict';
const S=window.POSIXShell,P=S.P,out=S.out,raw=S.raw;
const need=(a,msg)=>{if(!a.length)throw Error(msg)};
const displaySize=n=>n?.t==='b'?(n.d?.byteLength||0):n?.t==='f'?new TextEncoder().encode(String(n.d||'')).length:n?.t==='l'?String(n.target||'').length:0;
function sl(){out('      ====        ________                ___________');out('  _D _|  |_______/        \\__I_I_____===__|_________|');out('   |(_)---  |   H\\________/ |   |        =|___ ___|');out('   /     |  |   H  |  |     |   |         ||_| |_||');out('  |      |  |   H  |__--------------------| [___] |');out('  | ________|___H__/__|_____/[][]~\\_______|       |');out('  |/ |   |-----------I_____I [][] []  D   |=======|__')}
S.register('help',async()=>{
  out('POSIX.js '+P.VERSION+' commands');
  out('');
  out('Filesystem : ls cat cd pwd mkdir touch rm rmdir cp mv find tree stat readlink ln basename dirname du df');
  out('Text       : echo printf head tail wc sort');
  out('System     : status uname hostname uptime date id whoami env sync');
  out('Shell      : help clear history which type true false sleep seq sudo sl exec');
  out('Packages   : apk');
  out('Services   : systemctl journalctl');
  out('Network    : fetch');
  out('Desktop    : uide');
  const listed=new Set('ls cat cd pwd mkdir touch rm rmdir cp mv find tree stat readlink ln basename dirname du df echo printf head tail wc sort status uname hostname uptime date id whoami env sync help clear history which type true false sleep seq sudo sl exec apk systemctl journalctl fetch uide'.split(' '));
  const extra=[...S.commands.keys()].filter(x=>!listed.has(x)).sort();
  if(extra.length)out('Other      : '+extra.join(' '));
  out('');
  out('Tip: ls supports -a, -l, -la and multiple paths.');
});
S.register('clear',async()=>{S.O.textContent=''});
S.register('pwd',async()=>out(P.cwd));
S.register('cd',async({a})=>{let p=P.resolve(a[0]||'~');if(P.fs.get(p)?.t!=='d')throw Error('not a directory');P.cwd=p});
S.register('ls',async({a})=>{
  let showAll=false,long=false,paths=[];
  for(const x of a){
    if(x==='--')continue;
    if(x.startsWith('-')&&x!=='-'){
      for(const f of x.slice(1)){
        if(f==='a')showAll=true;
        else if(f==='l')long=true;
        else throw Error('invalid option -- '+f);
      }
    }else paths.push(x);
  }
  if(!paths.length)paths=['.'];
  for(let pi=0;pi<paths.length;pi++){
    const requested=paths[pi],normalized=P.norm(requested),resolved=P.resolve(normalized),node=P.fs.get(resolved);
    if(!node)throw Error(requested+': No such file or directory');
    if(paths.length>1)out((pi?'\n':'')+requested+':');
    if(node.t!=='d'){
      if(long){const type=node.t==='l'?'l':node.t==='b'?'b':'-';out(type+'rw-r--r-- 1 user user '+String(displaySize(node)).padStart(8)+' '+(normalized.split('/').pop()||'/')+(node.t==='l'?' -> '+node.target:''));}
      else out(normalized.split('/').pop()||'/');
      continue;
    }
    let names=P.ls(requested);
    if(!showAll)names=names.filter(n=>!n.startsWith('.'));
    else names=['.','..',...names];
    if(!long){out(names.join('  '));continue;}
    for(const name of names){
      if(name==='.'||name==='..'){out('drwxr-xr-x 1 user user        0 '+name);continue;}
      const child=P.norm(resolved+'/'+name),n=P.fs.get(child);
      if(!n){out('?--------- 1 user user        0 '+name);continue;}
      const type=n.t==='d'?'d':n.t==='l'?'l':n.t==='b'?'b':'-';
      out(type+'rw-r--r-- 1 user user '+String(displaySize(n)).padStart(8)+' '+name+(n.t==='l'?' -> '+n.target:''));
    }
  }
});
S.register('cat',async({a})=>{need(a,'usage: cat FILE');let n=P.fs.get(P.resolve(a[0]));if(!n)throw Error('not found');out(n.t==='b'?new TextDecoder().decode(n.d):n.d)});
S.register('echo',async({a})=>out(a.join(' ')));
S.register('mkdir',async({a})=>{need(a,'usage: mkdir DIR...');a.forEach(P.md)});
S.register('find',async({a})=>{let p=P.norm(a[0]||'.');out([...P.fs.keys()].filter(k=>k===p||k.startsWith(p+'/')).join('\n'))});
S.register('apk',async({a})=>{if(typeof P.apk!=='function')throw Error('apk subsystem unavailable');await P.apk(a,out)});
S.register('uide',async({a})=>{if(typeof P.uide!=='function')throw Error('UIDE unavailable');await P.uide(a,out)});
S.register('systemctl',async({a})=>{if(typeof P.systemctl!=='function')throw Error('systemd compatibility layer unavailable');await P.systemctl(a,out,raw)});
S.register('journalctl',async()=>{let n=P.fs.get('/var/log/journal/posixjs.log');out(n?.d||'-- No entries --')});
S.register('sync',async()=>{await P.save();out('synced')});
S.register('uname',async()=>out('POSIX.js posixjs '+P.VERSION+' rv64-userspace'));
S.register('whoami',async({root})=>out(root?'root':'user'));
S.register('sudo',async({a})=>{need(a,'usage: sudo command [args]');out('[sudo] POSIX.js capability session');await S.run(a.join(' '),true)});
S.register('sl',async()=>sl());
S.register('exec',async({a})=>{let p=a.shift();if(!p)throw Error('usage: exec /path [args]');out('\n[exit '+await P.exec(p,a,raw)+']')});
})();
