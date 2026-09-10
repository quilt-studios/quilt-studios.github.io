/* Linux process-entry stack for POSIX.js RV64. Supplies argv/envp/auxv expected by musl/BusyBox. */
(()=>{'use strict';
const R=window.POSIXRV64;if(!R?.RV64Process)return;
const P=R.RV64Process;
P.prototype.setupStack=function(){
  let sp=this.mem.length-0x10000;
  const putString=s=>{const z=new TextEncoder().encode(s+'\0');sp-=z.length;this.mem.set(z,sp);return BigInt(sp)};
  const argv=[];
  for(let i=this.args.length-1;i>=0;i--)argv.unshift(putString(this.args[i]));
  const execfn=argv[0]||putString('/bin/busybox');
  sp-=16;const random=sp;crypto.getRandomValues(this.mem.subarray(random,random+16));
  sp&=~15;
  const words=[];
  words.push(BigInt(argv.length),...argv,0n); // argc, argv, argv NULL
  words.push(0n);                           // empty envp
  const aux=[
    [6n,4096n],                             // AT_PAGESZ
    [9n,BigInt(this.pc)],                   // AT_ENTRY
    [11n,1000n],[12n,1000n],               // AT_UID / AT_EUID
    [13n,1000n],[14n,1000n],               // AT_GID / AT_EGID
    [17n,100n],                             // AT_CLKTCK
    [23n,0n],                               // AT_SECURE
    [25n,BigInt(random)],                   // AT_RANDOM
    [31n,execfn],                           // AT_EXECFN
    [0n,0n]                                 // AT_NULL
  ];
  for(const [k,v] of aux)words.push(k,v);
  const bytes=words.length*8;
  sp=(sp-bytes)&~15;
  for(let i=0;i<words.length;i++)this.w64(sp+i*8,words[i]);
  this.x[2]=BigInt(sp);
  this.x[10]=BigInt(argv.length);
  this.x[11]=BigInt(sp+8);
};
R.VERSION=(R.VERSION||'0.5')+'-linuxstack';
})();
