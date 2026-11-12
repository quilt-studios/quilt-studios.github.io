/* POSIX.js ELF64 RISC-V PT_INTERP / ET_DYN loader. Musl performs its own relocations. */
(()=>{'use strict';
const R=window.POSIXRV64;if(!R?.RV64Process)return;
const P=R.RV64Process,utf=new TextDecoder();
function parse(bytes,label){
 if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
 if(bytes.length<64)throw Error(label+': truncated ELF');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(d.getUint32(0,true)!==0x464c457f||bytes[4]!==2||bytes[5]!==1||d.getUint16(18,true)!==243)throw Error(label+': expected ELF64 little-endian RISC-V');
 const type=d.getUint16(16,true),entry=d.getBigUint64(24,true),off=Number(d.getBigUint64(32,true)),entsize=d.getUint16(54,true),count=d.getUint16(56,true);
 if(![2,3].includes(type)||entsize<56||off+entsize*count>bytes.length)throw Error(label+': invalid ELF program headers');
 const segments=[],headers=[];let interp=null,phdr=null;
 for(let i=0;i<count;i++){
  const o=off+i*entsize,t=d.getUint32(o,true),p={type:t,off:Number(d.getBigUint64(o+8,true)),va:Number(d.getBigUint64(o+16,true)),filesz:Number(d.getBigUint64(o+32,true)),memsz:Number(d.getBigUint64(o+40,true))};
  if(p.off+p.filesz>bytes.length)throw Error(label+': truncated segment');
  headers.push(p);
  if(t===1){if(p.filesz>p.memsz)throw Error(label+': invalid PT_LOAD size');segments.push(p)}
  if(t===3)interp=utf.decode(bytes.subarray(p.off,p.off+p.filesz)).split('\0')[0];
  if(t===6)phdr=p.va;
 }
 if(!segments.length)throw Error(label+': no PT_LOAD segments');
 if(phdr===null){const s=segments.find(s=>off>=s.off&&off+entsize*count<=s.off+s.filesz);if(s)phdr=s.va+(off-s.off)}
 return{bytes,type,entry,segments,interp,phdr,phentsize:entsize,phnum:count};
}
function mapped(proc,obj,bias,label){
 let max=0;
 for(const s of obj.segments){
  const start=bias+s.va,end=start+s.memsz;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>proc.mem.length)throw Error(label+': PT_LOAD outside guest memory');
  proc.mem.set(obj.bytes.subarray(s.off,s.off+s.filesz),start);
  if(s.memsz>s.filesz)proc.mem.fill(0,start+s.filesz,end);
  max=Math.max(max,end);
 }
 return max;
}
function resolveInterpreter(path){
 const fs=window.POSIX;if(!fs)throw Error('POSIX filesystem unavailable');
 const canonical=fs.resolve(path),node=fs.fs.get(canonical);
 if(!node)throw Error('missing ELF interpreter '+path+'; install the Alpine musl package with: apk add musl');
 if(node.t!=='b')throw Error('ELF interpreter '+canonical+' is not a binary');
 return node.d instanceof Uint8Array?node.d:new Uint8Array(node.d);
}
P.prototype.loadELF=function(bytes){
 const main=parse(bytes,'executable'),mainBias=main.type===3?0x10000:0;
 const end=mapped(this,main,mainBias,'executable');
 this.brk=BigInt(Math.max(Number(this.brk),Math.ceil(end/4096)*4096));
 this.mainEntry=BigInt(mainBias)+main.entry;
 this.elfBase=BigInt(mainBias);
 this.elfPhdr=main.phdr===null?0n:BigInt(mainBias+main.phdr);
 this.elfPhent=BigInt(main.phentsize);this.elfPhnum=BigInt(main.phnum);
 this.interpreterPath=main.interp||null;this.interpreterBase=0n;
 if(main.interp){
  const loader=parse(resolveInterpreter(main.interp),main.interp);
  const loaderBias=loader.type===3?0x1800000:0;
  const loaderMin=Math.min(...loader.segments.map(s=>loaderBias+s.va));
  if(loaderMin<end&&Math.max(...loader.segments.map(s=>loaderBias+s.va+s.memsz))>mainBias)throw Error('ELF interpreter overlaps executable');
  mapped(this,loader,loaderBias,'interpreter');
  this.interpreterBase=BigInt(loaderBias);
  this.pc=BigInt(loaderBias)+loader.entry;
 }else this.pc=this.mainEntry;
 this.setupStack();
};
R.elfInterpreterReady=true;
R.VERSION=(R.VERSION||'0.5')+'-elfinterp';
})();
