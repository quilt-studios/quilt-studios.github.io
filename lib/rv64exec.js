/* POSIX.js RV64 Linux userspace ABI. Browser-safe: no SharedArrayBuffer required. */
(()=>{'use strict';
const E={ENOENT:2,EINTR:4,EIO:5,EBADF:9,EAGAIN:11,ENOMEM:12,EACCES:13,EFAULT:14,EINVAL:22,ENOTTY:25,ENOSYS:38,ENOTSOCK:88,EADDRINUSE:98,ECONNREFUSED:111};
const neg=n=>BigInt.asUintN(64,-BigInt(n));
const sx=(v,b)=>{let s=64n-BigInt(b);return BigInt.asIntN(64,BigInt(v)<<s)>>s};
const align=(n,a=4096)=>Math.ceil(n/a)*a;
const enc=new TextEncoder(),dec=new TextDecoder();
const socketBus={paths:new Map,register(path,endpoint){this.paths.set(path,endpoint)},unregister(path){this.paths.delete(path)},get(path){return this.paths.get(path)}};
let nextPid=100,nextShmId=1;
const sharedSegments=new Map;
class RV64Process{
 constructor(bytes,args=[],io={}){
  this.file=bytes;this.args=args;this.io=io;this.pid=nextPid++;this.mem=new Uint8Array(64*1024*1024);this.dv=new DataView(this.mem.buffer);this.x=Array(32).fill(0n);this.pc=0n;this.exitCode=null;this.brk=0x2000000n;this.mmapTop=0x3000000;this.cwd=window.POSIX?.cwd||'/';this.fds=new Map([[0,{type:'stdin',pos:0}],[1,{type:'stdout'}],[2,{type:'stderr'}]]);this.nextFd=3;this.loadELF(bytes)
 }
 check(a,n=1){a=Number(a);if(a<0||a+n>this.mem.length)throw Error('guest memory fault @ 0x'+a.toString(16));return a}
 u8(a){return this.mem[this.check(a)]} u16(a){return this.dv.getUint16(this.check(a,2),true)} u32(a){return this.dv.getUint32(this.check(a,4),true)} u64(a){return this.dv.getBigUint64(this.check(a,8),true)}
 w8(a,v){this.mem[this.check(a)]=Number(v)&255} w16(a,v){this.dv.setUint16(this.check(a,2),Number(v)&65535,true)} w32(a,v){this.dv.setUint32(this.check(a,4),Number(BigInt(v)&0xffffffffn),true)} w64(a,v){this.dv.setBigUint64(this.check(a,8),BigInt.asUintN(64,BigInt(v)),true)}
 bytes(a,n){a=this.check(a,n);return this.mem.slice(a,a+n)} put(a,b){a=this.check(a,b.length);this.mem.set(b,a)} cstr(a,max=4096){let p=this.check(a),e=p;while(e<this.mem.length&&e-p<max&&this.mem[e])e++;return dec.decode(this.mem.slice(p,e))}
 ret(v){this.x[10]=BigInt.asUintN(64,BigInt(v))} errno(n){this.x[10]=neg(n)} allocFd(o){let fd=this.nextFd++;this.fds.set(fd,o);return fd}
 resolve(path,dirfd=-100){if(!path)return this.cwd;if(path[0]==='/')return window.POSIX?.norm?POSIX.norm(path):path;let base=this.cwd;if(dirfd!==-100){let d=this.fds.get(dirfd);if(d?.path)base=d.path}return window.POSIX?.norm?POSIX.norm(base+'/'+path):base+'/'+path}
 loadELF(b){let d=new DataView(b.buffer,b.byteOffset,b.byteLength);if(d.getUint32(0,true)!==0x464c457f||b[4]!==2||b[5]!==1)throw Error('not ELF64 little-endian');if(d.getUint16(18,true)!==243)throw Error('ELF is not RISC-V');let ph=Number(d.getBigUint64(32,true)),psz=d.getUint16(54,true),pn=d.getUint16(56,true);this.pc=d.getBigUint64(24,true);for(let i=0;i<pn;i++){let o=ph+i*psz,t=d.getUint32(o,true);if(t!==1)continue;let off=Number(d.getBigUint64(o+8,true)),va=Number(d.getBigUint64(o+16,true)),fs=Number(d.getBigUint64(o+32,true)),ms=Number(d.getBigUint64(o+40,true));if(va+ms>this.mem.length)throw Error('ELF exceeds VM memory');this.mem.set(b.slice(off,off+fs),va);this.brk=BigInt(Math.max(Number(this.brk),align(va+ms)))}this.setupStack()}
 setupStack(){let sp=this.mem.length-0x10000,ptr=[];for(let i=this.args.length-1;i>=0;i--){let z=enc.encode(this.args[i]+'\0');sp-=z.length;this.mem.set(z,sp);ptr.unshift(BigInt(sp))}sp&=~15;const push=v=>{sp-=8;this.w64(sp,v)};push(0n);push(0n);for(let i=ptr.length-1;i>=0;i--)push(ptr[i]);push(BigInt(ptr.length));this.x[2]=BigInt(sp);this.x[10]=BigInt(ptr.length);this.x[11]=BigInt(sp+8)}
 statTo(addr,node){for(let i=0;i<128;i++)this.w8(addr+i,0);let mode=node?.t==='d'?0o040755:node?.t==='l'?0o120777:0o100755,size=node?.t==='b'?(node.d?.byteLength||0):node?.t==='f'?enc.encode(String(node.d||'')).length:0;this.w64(addr+16,1);this.w32(addr+24,mode);this.w32(addr+28,1);this.w64(addr+48,size);this.w64(addr+56,4096);this.w64(addr+64,Math.ceil(size/512));let sec=BigInt(Math.floor((node?.time||Date.now())/1000));this.w64(addr+72,sec);this.w64(addr+88,sec);this.w64(addr+104,sec)}
 fileBytes(node){if(!node)return null;if(node.t==='b')return node.d instanceof Uint8Array?node.d:new Uint8Array(node.d||[]);if(node.t==='f')return enc.encode(String(node.d||''));return new Uint8Array}
 async socketWrite(s,b){if(s.peer){s.peer.queue.push(b);return b.length}if(s.endpoint){let r=await s.endpoint.receive?.(b,s,this);if(r){if(Array.isArray(r))s.queue.push(...r);else s.queue.push(r instanceof Uint8Array?r:new Uint8Array(r))}return b.length}return -E.ECONNREFUSED}
 async syscall(){let n=Number(this.x[17]),a=this.x,A=i=>Number(a[10+i]),B=i=>a[10+i];try{switch(n){
  case 17:{let p=A(0),sz=A(1),b=enc.encode(this.cwd+'\0');if(b.length>sz)return this.errno(E.ERANGE||34);this.put(p,b);return this.ret(p)}
  case 23:{let old=this.fds.get(A(0));if(!old)return this.errno(E.EBADF);return this.ret(this.allocFd({...old}))}
  case 24:{let old=this.fds.get(A(0)),fd=A(1);if(!old)return this.errno(E.EBADF);this.fds.set(fd,{...old});return this.ret(fd)}
  case 29:return this.errno(E.ENOTTY);
  case 34:{let path=this.resolve(this.cstr(B(1)),A(0));POSIX.md(path);return this.ret(0)}
  case 35:{let path=this.resolve(this.cstr(B(1)),A(0));if(!POSIX.fs.has(path))return this.errno(E.ENOENT);POSIX.fs.delete(path);return this.ret(0)}
  case 49:{let p=this.resolve(this.cstr(B(0)));if(POSIX.fs.get(p)?.t!=='d')return this.errno(E.ENOENT);this.cwd=p;return this.ret(0)}
  case 56:{let dirfd=A(0),path=this.resolve(this.cstr(B(1)),dirfd),flags=A(2),node=POSIX.fs.get(path);if(!node&&(flags&64)){POSIX.write(path,'');node=POSIX.fs.get(path)}if(!node)return this.errno(E.ENOENT);return this.ret(this.allocFd({type:'file',path,node,pos:0,flags}))}
  case 57:{let fd=A(0);if(!this.fds.has(fd))return this.errno(E.EBADF);this.fds.delete(fd);return this.ret(0)}
  case 59:{let p=A(0),q1={type:'socket',queue:[]},q2={type:'socket',queue:[]};q1.peer=q2;q2.peer=q1;let f1=this.allocFd(q1),f2=this.allocFd(q2);this.w32(p,f1);this.w32(p+4,f2);return this.ret(0)}
  case 62:{let fd=A(0),off=Number(BigInt.asIntN(64,B(1))),wh=A(2),f=this.fds.get(fd);if(!f)return this.errno(E.EBADF);let data=f.type==='file'?this.fileBytes(POSIX.fs.get(f.path)):new Uint8Array;if(wh===0)f.pos=off;else if(wh===1)f.pos=(f.pos||0)+off;else if(wh===2)f.pos=data.length+off;return this.ret(f.pos||0)}
  case 63:{let fd=A(0),p=A(1),l=A(2),f=this.fds.get(fd);if(!f)return this.errno(E.EBADF);if(f.type==='stdin')return this.ret(0);if(f.type==='socket'){let q=f.queue.shift();if(!q)return this.errno(E.EAGAIN);q=q.slice(0,l);this.put(p,q);return this.ret(q.length)}if(f.type!=='file')return this.errno(E.EBADF);let d=this.fileBytes(POSIX.fs.get(f.path)),z=d.slice(f.pos||0,(f.pos||0)+l);this.put(p,z);f.pos=(f.pos||0)+z.length;return this.ret(z.length)}
  case 64:{let fd=A(0),p=A(1),l=A(2),f=this.fds.get(fd),b=this.bytes(p,l);if(fd===1||fd===2){this.io.write?.(dec.decode(b));return this.ret(l)}if(!f)return this.errno(E.EBADF);if(f.type==='socket'){let r=await this.socketWrite(f,b);return r<0?this.errno(-r):this.ret(r)}if(f.type==='file'){let old=this.fileBytes(POSIX.fs.get(f.path)),pos=f.flags&1024?old.length:(f.pos||0),neu=new Uint8Array(Math.max(old.length,pos+l));neu.set(old);neu.set(b,pos);POSIX.write(f.path,neu,true);f.pos=pos+l;return this.ret(l)}return this.errno(E.EBADF)}
  case 66:{let fd=A(0),iov=A(1),cnt=A(2),sum=0;for(let i=0;i<cnt;i++){let p=Number(this.u64(iov+i*16)),l=Number(this.u64(iov+i*16+8)),f=this.fds.get(fd),b=this.bytes(p,l);if(fd===1||fd===2)this.io.write?.(dec.decode(b));else if(f?.type==='socket')await this.socketWrite(f,b);sum+=l}return this.ret(sum)}
  case 78:{let pth=this.resolve(this.cstr(B(1)),A(0)),node=POSIX.fs.get(pth);if(node?.t!=='l')return this.errno(E.EINVAL);let b=enc.encode(node.target),l=Math.min(A(3),b.length);this.put(A(2),b.slice(0,l));return this.ret(l)}
  case 79:{let pth=this.resolve(this.cstr(B(1)),A(0)),node=POSIX.fs.get(pth);if(!node)return this.errno(E.ENOENT);this.statTo(A(2),node);return this.ret(0)}
  case 80:{let f=this.fds.get(A(0));if(!f)return this.errno(E.EBADF);this.statTo(A(1),f.path?POSIX.fs.get(f.path):{t:'f'});return this.ret(0)}
  case 93:case 94:this.exitCode=A(0);return;
  case 98:return this.ret(0);
  case 101:{let req=A(0),sec=Number(this.u64(req)),ns=Number(this.u64(req+8)),ms=Math.min(1000,sec*1000+ns/1e6);await new Promise(r=>setTimeout(r,ms));return this.ret(0)}
  case 113:{let p=A(1),ms=performance.timeOrigin+performance.now(),s=Math.floor(ms/1000),ns=Math.floor((ms-s*1000)*1e6);this.w64(p,s);this.w64(p+8,ns);return this.ret(0)}
  case 124:await new Promise(r=>setTimeout(r,0));return this.ret(0);
  case 160:{let p=A(0),fields=['Linux','posixjs','6.6-posixjs','POSIX.js RV64','riscv64','(none)'];for(let i=0;i<fields.length;i++){let b=enc.encode(fields[i]+'\0');this.put(p+i*65,b.slice(0,65))}return this.ret(0)}
  case 169:{let p=A(0),ms=Date.now();this.w64(p,Math.floor(ms/1000));this.w64(p+8,(ms%1000)*1000);return this.ret(0)}
  case 172:return this.ret(this.pid);case 173:return this.ret(1);case 174:case 175:case 176:case 177:return this.ret(1000);case 178:return this.ret(this.pid);
  case 194:{let size=A(1),id=nextShmId++;sharedSegments.set(id,{size,data:new Uint8Array(size),refs:0});return this.ret(id)}
  case 195:return this.ret(0);
  case 196:{let seg=sharedSegments.get(A(0));if(!seg)return this.errno(E.EINVAL);let at=A(1)||this.mmapTop,len=align(seg.size);if(!A(1))this.mmapTop+=len;if(at+len>this.mem.length)return this.errno(E.ENOMEM);this.mem.set(seg.data,at);seg.refs++;return this.ret(at)}
  case 197:return this.ret(0);
  case 198:{let domain=A(0),type=A(1);if(domain!==1)return this.errno(E.ENOSYS);return this.ret(this.allocFd({type:'socket',domain,type,queue:[],path:null,peer:null,endpoint:null}))}
  case 199:{let domain=A(0),p=A(3);if(domain!==1)return this.errno(E.ENOSYS);let s1={type:'socket',queue:[]},s2={type:'socket',queue:[]};s1.peer=s2;s2.peer=s1;let f1=this.allocFd(s1),f2=this.allocFd(s2);this.w32(p,f1);this.w32(p+4,f2);return this.ret(0)}
  case 200:{let s=this.fds.get(A(0));if(s?.type!=='socket')return this.errno(E.ENOTSOCK);let path=this.cstr(B(1)+2,108);if(socketBus.get(path))return this.errno(E.EADDRINUSE);s.path=path;socketBus.register(path,{socket:s,receive:b=>{s.queue.push(b)}});return this.ret(0)}
  case 201:return this.ret(0);
  case 202:return this.errno(E.EAGAIN);
  case 203:{let s=this.fds.get(A(0));if(s?.type!=='socket')return this.errno(E.ENOTSOCK);let path=this.cstr(B(1)+2,108),ep=socketBus.get(path);if(!ep)return this.errno(E.ECONNREFUSED);s.path=path;s.endpoint=ep;ep.connect?.(s,this);return this.ret(0)}
  case 204:case 205:return this.ret(0);
  case 206:{let s=this.fds.get(A(0));if(s?.type!=='socket')return this.errno(E.ENOTSOCK);let r=await this.socketWrite(s,this.bytes(A(1),A(2)));return r<0?this.errno(-r):this.ret(r)}
  case 207:{let s=this.fds.get(A(0));if(s?.type!=='socket')return this.errno(E.ENOTSOCK);let q=s.queue.shift();if(!q)return this.errno(E.EAGAIN);q=q.slice(0,A(2));this.put(A(1),q);return this.ret(q.length)}
  case 208:case 209:case 210:return this.ret(0);
  case 214:if(B(0))this.brk=B(0);return this.ret(this.brk);
  case 215:return this.ret(0);
  case 222:{let addr=A(0),len=align(A(1));if(!addr){addr=this.mmapTop;this.mmapTop+=len}if(addr+len>this.mem.length)return this.errno(E.ENOMEM);this.mem.fill(0,addr,addr+len);let fd=A(4),off=Number(B(5)),f=this.fds.get(fd);if(f?.type==='file'){let d=this.fileBytes(POSIX.fs.get(f.path));this.mem.set(d.slice(off,off+len),addr)}return this.ret(addr)}
  case 226:case 227:case 233:return this.ret(0);
  case 261:return this.ret(0);
  case 278:{let p=A(0),l=A(1);crypto.getRandomValues(this.mem.subarray(p,p+l));return this.ret(l)}
  case 279:{let name=this.cstr(B(0)),path='/tmp/.memfd-'+this.pid+'-'+name;POSIX.write(path,new Uint8Array,true);return this.ret(this.allocFd({type:'file',path,pos:0,flags:2}))}
  case 291:return this.errno(E.ENOSYS);
  default:return this.errno(E.ENOSYS)
 }}catch(e){if(e instanceof RangeError)return this.errno(E.EFAULT);throw e}}
 async step(){let pc=this.pc,i=this.u32(pc),op=i&127,rd=(i>>>7)&31,f3=(i>>>12)&7,r1=(i>>>15)&31,r2=(i>>>20)&31,f7=i>>>25,next=pc+4n,A=this.x[r1],B=this.x[r2],immI=sx(i>>>20,12),immS=sx(((i>>>25)<<5)|((i>>>7)&31),12),immB=sx(((i>>>31)<<12)|(((i>>>7)&1)<<11)|(((i>>>25)&63)<<5)|(((i>>>8)&15)<<1),13),immU=sx(i&0xfffff000,32),immJ=sx(((i>>>31)<<20)|(((i>>>12)&255)<<12)|(((i>>>20)&1)<<11)|(((i>>>21)&1023)<<1),21);let v=null;
  if(op===0x37)v=immU;else if(op===0x17)v=pc+immU;else if(op===0x6f){v=next;next=pc+immJ}else if(op===0x67){v=next;next=(A+immI)&~1n}else if(op===0x63){let q=false;if(f3===0)q=A===B;else if(f3===1)q=A!==B;else if(f3===4)q=BigInt.asIntN(64,A)<BigInt.asIntN(64,B);else if(f3===5)q=BigInt.asIntN(64,A)>=BigInt.asIntN(64,B);else if(f3===6)q=A<B;else if(f3===7)q=A>=B;if(q)next=pc+immB}else if(op===0x03){let ad=A+immI;if(f3===0)v=sx(this.u8(ad),8);else if(f3===1)v=sx(this.u16(ad),16);else if(f3===2)v=sx(this.u32(ad),32);else if(f3===3)v=this.u64(ad);else if(f3===4)v=BigInt(this.u8(ad));else if(f3===5)v=BigInt(this.u16(ad));else if(f3===6)v=BigInt(this.u32(ad))}else if(op===0x23){let ad=A+immS;if(f3===0)this.w8(ad,B);else if(f3===1)this.w16(ad,B);else if(f3===2)this.w32(ad,B);else if(f3===3)this.w64(ad,B)}else if(op===0x13){if(f3===0)v=A+immI;else if(f3===2)v=BigInt(BigInt.asIntN(64,A)<immI);else if(f3===3)v=BigInt(A<BigInt.asUintN(64,immI));else if(f3===4)v=A^BigInt.asUintN(64,immI);else if(f3===6)v=A|BigInt.asUintN(64,immI);else if(f3===7)v=A&BigInt.asUintN(64,immI);else if(f3===1)v=A<<BigInt((i>>>20)&63);else if(f3===5)v=(i>>>30)&1?BigInt.asIntN(64,A)>>BigInt((i>>>20)&63):A>>BigInt((i>>>20)&63)}else if(op===0x1b){let sh=BigInt((i>>>20)&31),w;if(f3===0)w=BigInt.asIntN(32,A+immI);else if(f3===1)w=BigInt.asIntN(32,A<<sh);else if(f3===5)w=(i>>>30)&1?BigInt.asIntN(32,A)>>sh:BigInt.asIntN(32,BigInt.asUintN(32,A)>>sh);v=BigInt.asIntN(64,w)}else if(op===0x33){if(f7===1){if(f3===0)v=BigInt.asIntN(64,A)*BigInt.asIntN(64,B);else if(f3===4)v=B?BigInt.asIntN(64,A)/BigInt.asIntN(64,B):-1n;else if(f3===5)v=B?A/B:(2n**64n-1n);else if(f3===6)v=B?BigInt.asIntN(64,A)%BigInt.asIntN(64,B):A;else if(f3===7)v=B?A%B:A}else if(f3===0)v=f7===32?A-B:A+B;else if(f3===1)v=A<<(B&63n);else if(f3===2)v=BigInt(BigInt.asIntN(64,A)<BigInt.asIntN(64,B));else if(f3===3)v=BigInt(A<B);else if(f3===4)v=A^B;else if(f3===5)v=f7===32?BigInt.asIntN(64,A)>>(B&63n):A>>(B&63n);else if(f3===6)v=A|B;else if(f3===7)v=A&B}else if(op===0x3b){let sh=B&31n,w;if(f7===1&&f3===0)w=BigInt.asIntN(32,A)*BigInt.asIntN(32,B);else if(f7===1&&f3===4)w=BigInt.asIntN(32,B)?BigInt.asIntN(32,A)/BigInt.asIntN(32,B):-1n;else if(f7===1&&f3===6)w=BigInt.asIntN(32,B)?BigInt.asIntN(32,A)%BigInt.asIntN(32,B):A;else if(f3===0)w=f7===32?A-B:A+B;else if(f3===1)w=A<<sh;else if(f3===5)w=f7===32?BigInt.asIntN(32,A)>>sh:BigInt.asUintN(32,A)>>sh;v=BigInt.asIntN(64,BigInt.asIntN(32,w))}else if(op===0x0f){v=null}else if(op===0x73&&i===0x73)await this.syscall();else throw Error('unsupported RV64 instruction 0x'+i.toString(16)+' @ 0x'+pc.toString(16));if(rd&&v!==null)this.x[rd]=BigInt.asUintN(64,v);this.x[0]=0n;this.pc=next}
 async run(limit=5000000){let n=0;while(this.exitCode===null&&n<limit){for(let k=0;k<10000&&this.exitCode===null&&n<limit;k++,n++)await this.step();await new Promise(r=>setTimeout(r,0))}if(this.exitCode===null)throw Error('instruction limit reached');return this.exitCode}
}
window.POSIXRV64={VERSION:'0.3',exec:async(bytes,args,io)=>new RV64Process(bytes,args,io).run(),RV64Process,socketBus,sharedSegments,syscalls:['getcwd','openat','close','read','write','writev','lseek','fstat','newfstatat','mmap','munmap','mprotect','brk','futex','clock_gettime','nanosleep','getrandom','memfd_create','shmget','shmat','shmdt','socket','socketpair','bind','connect','sendto','recvfrom']};
})();