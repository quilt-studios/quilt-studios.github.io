/* RISC-V A extension for POSIX.js RV64 executor. */
(()=>{'use strict';
const R=window.POSIXRV64;if(!R?.RV64Process)return;
const P=R.RV64Process,old=P.prototype.step;
P.prototype.step=async function(){
 const pc=this.pc,h=this.u16(pc);if((h&3)!==3)return old.call(this);
 const i=this.u32(pc),op=i&127;if(op!==0x2f)return old.call(this);
 const rd=(i>>>7)&31,f3=(i>>>12)&7,rs1=(i>>>15)&31,rs2=(i>>>20)&31,fun=(i>>>27)&31;
 if(f3!==2&&f3!==3)throw Error('illegal RV64A instruction @ 0x'+pc.toString(16));
 const addr=this.x[rs1],src=this.x[rs2],bits=f3===2?32:64;
 const load=()=>f3===2?BigInt(this.u32(addr)):this.u64(addr);
 const store=v=>f3===2?this.w32(addr,v):this.w64(addr,v);
 const signed=v=>BigInt.asIntN(bits,v),mask=v=>BigInt.asUintN(bits,v);
 let oldv=load(),result=oldv,write=true;
 if(fun===2){ /* LR */ write=false;this._reservation=Number(addr); }
 else if(fun===3){ /* SC */ if(this._reservation===Number(addr)){store(src);result=0n}else result=1n;this._reservation=null;write=false; }
 else if(fun===1)result=src; /* AMOSWAP */
 else if(fun===0)result=oldv+src; /* AMOADD */
 else if(fun===4)result=oldv^src;
 else if(fun===12)result=oldv&src;
 else if(fun===8)result=oldv|src;
 else if(fun===16)result=signed(oldv)<signed(src)?oldv:src;
 else if(fun===20)result=signed(oldv)>signed(src)?oldv:src;
 else if(fun===24)result=mask(oldv)<mask(src)?oldv:src;
 else if(fun===28)result=mask(oldv)>mask(src)?oldv:src;
 else throw Error('unsupported RV64A operation '+fun+' @ 0x'+pc.toString(16));
 if(write)store(result);
 if(rd)this.x[rd]=f3===2?BigInt.asUintN(64,BigInt.asIntN(32,oldv)):BigInt.asUintN(64,oldv);
 this.x[0]=0n;this.pc=pc+4n;
};
R.VERSION='0.5-rv64imac';
})();
