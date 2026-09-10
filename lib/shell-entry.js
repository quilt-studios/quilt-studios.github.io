(()=>{'use strict';
const S=window.POSIXShell,P=S.P,I=S.I;
I.onkeydown=async e=>{if(e.key==='Enter'){let s=I.value.trim();I.value='';if(s){S.history.push(s);S.historyIndex=S.history.length;S.out(S.Q.textContent+' '+s);await S.run(s)}}else if(e.key==='ArrowUp'){e.preventDefault();if(S.historyIndex)I.value=S.history[--S.historyIndex]||''}else if(e.key==='ArrowDown'){e.preventDefault();if(S.historyIndex<S.history.length-1)I.value=S.history[++S.historyIndex]||'';else{S.historyIndex=S.history.length;I.value=''}}};
(async()=>{const loaded=await P.load();if(!loaded)P.init();if(typeof P.updateSystem==='function')await P.updateSystem();S.out('POSIX.js '+P.VERSION);S.prompt();I.focus()})().catch(e=>S.out('shell: startup failed: '+e.message));
})();
