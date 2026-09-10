(()=>{'use strict';
const S=window.POSIXShell,P=S.P,out=S.out;
S.register('which',async({a})=>{if(!a.length)throw Error('usage: which COMMAND...');for(let c of a){if(S.commands.has(c)){out('/bin/'+c);continue}let paths=[c.startsWith('/')?c:'/bin/'+c,'/usr/bin/'+c,'/sbin/'+c,'/usr/sbin/'+c],p=paths.find(x=>P.fs.has(P.norm(x)));if(p)out(P.norm(p));else throw Error(c+': not found')}});
S.register('type',async({a})=>{if(!a.length)throw Error('usage: type COMMAND...');for(let c of a){if(S.commands.has(c))out(c+' is a shell builtin');else{let paths=[c.startsWith('/')?c:'/bin/'+c,'/usr/bin/'+c,'/sbin/'+c,'/usr/sbin/'+c],p=paths.find(x=>P.fs.has(P.norm(x)));if(p)out(c+' is '+P.norm(p));else throw Error(c+': not found')}}});
S.register('history',async({a})=>{if(a.length)throw Error('usage: history');S.history.forEach((x,i)=>out(String(i+1).padStart(4)+'  '+x))});
})();
