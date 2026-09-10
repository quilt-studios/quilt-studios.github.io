/* RISC-V C extension for POSIX.js RV64 executor. */
(()=>{'use strict';
const R=window.POSIXRV64;if(!R?.RV64Process)return;
const P=R.RV64Process,old=P.prototype.step;
const sx=(v,b)=>{let s=64n-BigInt(b);return BigInt.asIntN(64,BigInt(v)<<s)>>s};
const bit=(x,n)=>(x>>n)&1;
P.prototype.step=async function(){
 const pc=this.pc,h=this.u16(pc);if((h&3)===3)return old.call(this);
 const q=h&3,f=h>>>13,rd=(h>>>7)&31,rs2=(h>>>2)&31,rp=8+((h>>>7)&7),dp=8+((h>>>2)&7);let next=pc+2n,v=null,d=0;
 const imm6=()=>sx((bit(h,12)<<5)|((h>>>2)&31),6);
 const cj=()=>sx((bit(h,12)<<11)|(bit(h,11)<<4)|(((h>>>9)&3)<<8)|(bit(h,8)<<10)|(bit(h,7)<<6)|(bit(h,6)<<7)|(((h>>>3)&7)<<1)|(bit(h,2)<<5),12);
 const cb=()=>sx((bit(h,12)<<8)|(((h>>>10)&3)<<3)|(((h>>>5)&3)<<6)|(((h>>>3)&3)<<1)|(bit(h,2)<<5),9);
 if(q===0){
  if(f===0){let im=((h>>>7)&15)<<6|bit(h,6)<<2|bit(h,5)<<3|((h>>>11)&3)<<4;if(!im)throw Error('illegal C.ADDI4SPN @ 0x'+pc.toString(16));d=dp;v=this.x[2]+BigInt(im)}
  else if(f===2||f===3){let im=((h>>>10)&7)<<3|bit(h,6)<<2|(f===2?bit(h,5)<<6:((h>>>5)&3)<<6),a=this.x[rp]+BigInt(im);d=dp;v=f===2?sx(this.u32(a),32):this.u64(a)}
  else if(f===6||f===7){let im=((h>>>10)&7)<<3|bit(h,6)<<2|(f===6?bit(h,5)<<6:((h>>>5)&3)<<6),a=this.x[rp]+BigInt(im),s=this.x[dp];if(f===6)this.w32(a,s);else this.w64(a,s)}
  else throw Error('unsupported RV64C 0x'+h.toString(16)+' @ 0x'+pc.toString(16));
 }else if(q===1){
  if(f===0){d=rd;v=this.x[rd]+imm6()}
  else if(f===1){if(!rd)throw Error('illegal C.ADDIW');d=rd;v=BigInt.asIntN(64,BigInt.asIntN(32,this.x[rd]+imm6()))}
  else if(f===2){d=rd;v=imm6()}
  else if(f===3){if(rd===2){let im=bit(h,12)<<9|bit(h,6)<<4|bit(h,5)<<6|((h>>>3)&3)<<7|bit(h,2)<<5;d=2;v=this.x[2]+sx(im,10)}else{if(!rd)throw Error('illegal C.LUI');d=rd;v=sx((bit(h,12)<<17)|((h>>>2)&31)<<12,18)}}
  else if(f===4){let sub=(h>>>10)&3,r=8+((h>>>7)&7);d=r;if(sub===0)v=this.x[r]>>BigInt((h>>>2)&63);else if(sub===1)v=BigInt.asUintN(64,BigInt.asIntN(64,this.x[r])>>BigInt((h>>>2)&63));else if(sub===2)v=this.x[r]&BigInt.asUintN(64,imm6());else{let s=8+((h>>>2)&7),fn=(h>>>5)&3,w=bit(h,12);if(!w){if(fn===0)v=this.x[r]-this.x[s];else if(fn===1)v=this.x[r]^this.x[s];else if(fn===2)v=this.x[r]|this.x[s];else v=this.x[r]&this.x[s]}else{if(fn===0)v=BigInt.asIntN(64,BigInt.asIntN(32,this.x[r]-this.x[s]));else if(fn===1)v=BigInt.asIntN(64,BigInt.asIntN(32,this.x[r]+this.x[s]));else throw Error('illegal RV64C ALU')}}}
  else if(f===5)next=pc+cj();
  else if(f===6||f===7){let r=8+((h>>>7)&7),take=f===6?this.x[r]===0n:this.x[r]!==0n;if(take)next=pc+cb()}
  else throw Error('unsupported RV64C 0x'+h.toString(16)+' @ 0x'+pc.toString(16));
 }else if(q===2){
  if(f===0){if(!rd)throw Error('illegal C.SLLI');d=rd;v=this.x[rd]<<BigInt((h>>>2)&63)}
  else if(f===2){if(!rd)throw Error('illegal C.LWSP');let im=bit(h,12)<<5|((h>>>4)&7)<<2|((h>>>2)&3)<<6;d=rd;v=sx(this.u32(this.x[2]+BigInt(im)),32)}
  else if(f===3){if(!rd)throw Error('illegal C.LDSP');let im=bit(h,12)<<5|((h>>>5)&3)<<3|((h>>>2)&7)<<6;d=rd;v=this.u64(this.x[2]+BigInt(im))}
  else if(f===4){let b12=bit(h,12);if(!b12&&rs2===0){if(!rd)throw Error('illegal C.JR');next=this.x[rd]&~1n}else if(!b12){d=rd;v=this.x[rs2]}else if(rd===0&&rs2===0){throw Error('C.EBREAK')}else if(rs2===0){d=1;v=next;next=this.x[rd]&~1n}else{d=rd;v=this.x[rd]+this.x[rs2]}}
  else if(f===6){let im=((h>>>9)&15)<<2|((h>>>7)&3)<<6;this.w32(this.x[2]+BigInt(im),this.x[rs2])}
  else if(f===7){let im=((h>>>10)&7)<<3|((h>>>7)&7)<<6;this.w64(this.x[2]+BigInt(im),this.x[rs2])}
  else throw Error('unsupported RV64C 0x'+h.toString(16)+' @ 0x'+pc.toString(16));
 }else throw Error('illegal compressed instruction');
 if(d&&v!==null)this.x[d]=BigInt.asUintN(64,v);this.x[0]=0n;this.pc=next;
};
R.VERSION='0.4-rv64c';
})();
