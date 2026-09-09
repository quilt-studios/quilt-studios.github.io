/* Minimal Wayland server bridge for POSIX.js UIDE. */
(()=>{'use strict';
const RV=window.POSIXRV64;if(!RV)return;
if(window.POSIX){POSIX.md('/run/user/1000');POSIX.md('/dev');POSIX.md('/dev/shm')}
const enc=new TextEncoder,dec=new TextDecoder;
const pad=n=>(n+3)&~3;
const u32=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(o,true);
const pack=(object,opcode,payload=new Uint8Array)=>{let size=8+payload.length,b=new Uint8Array(size),d=new DataView(b.buffer);d.setUint32(0,object,true);d.setUint32(4,(size<<16)|opcode,true);b.set(payload,8);return b};
const p32=(...v)=>{let b=new Uint8Array(v.length*4),d=new DataView(b.buffer);v.forEach((x,i)=>d.setUint32(i*4,x,true));return b};
const str=s=>{let z=enc.encode(s+'\0'),b=new Uint8Array(4+pad(z.length)),d=new DataView(b.buffer);d.setUint32(0,z.length,true);b.set(z,4);return b};
const cat=(...xs)=>{let n=xs.reduce((a,x)=>a+x.length,0),b=new Uint8Array(n),o=0;for(let x of xs){b.set(x,o);o+=x.length}return b};
class Client{
 constructor(sock,proc){this.sock=sock;this.proc=proc;this.objects=new Map([[1,{iface:'wl_display'}]]);this.serial=1;this.surfaces=new Map;this.buffers=new Map}
 event(id,op,payload){this.sock.queue.push(pack(id,op,payload))}
 global(reg,name,iface,ver){this.event(reg,0,cat(p32(name),str(iface),p32(ver)))}
 handle(msg){if(msg.length<8)return;let id=u32(msg,0),word=u32(msg,4),size=word>>>16,op=word&0xffff;if(size<8||size>msg.length)return;let p=msg.slice(8,size),obj=this.objects.get(id);if(!obj)return;
  if(obj.iface==='wl_display'){
   if(op===0){let cb=u32(p,0);this.objects.set(cb,{iface:'wl_callback'});this.event(cb,0,p32(this.serial++));this.event(1,1,p32(cb));this.objects.delete(cb)}
   else if(op===1){let reg=u32(p,0);this.objects.set(reg,{iface:'wl_registry'});this.global(reg,1,'wl_compositor',4);this.global(reg,2,'wl_shm',1);this.global(reg,3,'xdg_wm_base',1)}
  }else if(obj.iface==='wl_registry'&&op===0){let name=u32(p,0),len=u32(p,4),iface=dec.decode(p.slice(8,8+Math.max(0,len-1))),off=8+pad(len),ver=u32(p,off),newid=u32(p,off+4);this.objects.set(newid,{iface,version:ver,name})}
  else if(obj.iface==='wl_compositor'&&op===0){let newid=u32(p,0);this.objects.set(newid,{iface:'wl_surface'});this.surfaces.set(newid,{id:newid,buffer:null,title:'Wayland app'});window.dispatchEvent(new CustomEvent('posix-wayland-surface',{detail:{type:'create',id:newid}}))}
  else if(obj.iface==='wl_surface'){
   if(op===1){let bid=u32(p,0),s=this.surfaces.get(id);if(s)s.buffer=bid}
   else if(op===6){let surface=this.surfaces.get(id),buffer=surface?this.buffers.get(surface.buffer):null;window.dispatchEvent(new CustomEvent('posix-wayland-surface',{detail:{type:'commit',id,surface,buffer,client:this}}));if(surface?.buffer)this.event(surface.buffer,0,new Uint8Array)}
   else if(op===0){this.surfaces.delete(id);window.dispatchEvent(new CustomEvent('posix-wayland-surface',{detail:{type:'destroy',id}}));this.objects.delete(id)}
  }else if(obj.iface==='wl_shm'&&op===0){let pool=u32(p,0),fd=u32(p,4),size=u32(p,8);this.objects.set(pool,{iface:'wl_shm_pool',fd,size})}
  else if(obj.iface==='wl_shm_pool'){
   if(op===0){let bid=u32(p,0),off=u32(p,4),w=u32(p,8),h=u32(p,12),stride=u32(p,16),format=u32(p,20);this.objects.set(bid,{iface:'wl_buffer'});this.buffers.set(bid,{fd:obj.fd,offset:off,width:w,height:h,stride,format})}
   else if(op===1)this.objects.delete(id)
  }else if(obj.iface==='wl_buffer'&&op===0){this.buffers.delete(id);this.objects.delete(id)}
  else if(obj.iface==='xdg_wm_base'){
   if(op===1){let pos=u32(p,0);this.objects.set(pos,{iface:'xdg_positioner'})}
   else if(op===2){let xid=u32(p,0),surface=u32(p,4);this.objects.set(xid,{iface:'xdg_surface',surface})}
   else if(op===3){this.event(id,0,p32(u32(p,0)))}
  }else if(obj.iface==='xdg_surface'){
   if(op===1){let top=u32(p,0);this.objects.set(top,{iface:'xdg_toplevel',surface:obj.surface});this.event(id,0,p32(this.serial++))}
   else if(op===0)this.objects.delete(id)
  }else if(obj.iface==='xdg_toplevel'){
   if(op===2){let len=u32(p,0),title=dec.decode(p.slice(4,4+Math.max(0,len-1))),s=this.surfaces.get(obj.surface);if(s)s.title=title;window.dispatchEvent(new CustomEvent('posix-wayland-surface',{detail:{type:'title',id:obj.surface,title}}))}
   else if(op===0)this.objects.delete(id)
  }
 }
}
const bridge={version:'0.3',clients:new Set,endpoint:{connect(sock,proc){let c=new Client(sock,proc);sock.waylandClient=c;bridge.clients.add(c)},receive(bytes,sock,proc){let c=sock.waylandClient;if(!c){c=new Client(sock,proc);sock.waylandClient=c;bridge.clients.add(c)}let o=0;while(o+8<=bytes.length){let size=u32(bytes,o+4)>>>16;if(size<8||o+size>bytes.length)break;c.handle(bytes.slice(o,o+size));o+=size}}}};
RV.socketBus.register('/run/user/1000/wayland-0',bridge.endpoint);
RV.socketBus.register('/tmp/wayland-0',bridge.endpoint);
window.POSIXWayland=bridge;
})();