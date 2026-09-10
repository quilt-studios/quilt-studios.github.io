(()=>{'use strict';
const KEY='posixjs-labs-mobilemode';
let root=null;
const enabled=()=>{try{return localStorage.getItem(KEY)==='1'}catch{return false}};
const setStored=v=>{try{localStorage.setItem(KEY,v?'1':'0')}catch{}};
function shell(){return window.POSIXShell}
function input(){return document.querySelector('#c')}
function sendKey(key){const I=input(),S=shell();if(!I||!S)return;if(key==='ENTER'){I.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return}if(key==='BACKSPACE'){I.value=I.value.slice(0,-1);return}if(key==='UP'||key==='DOWN'){I.dispatchEvent(new KeyboardEvent('keydown',{key:key==='UP'?'ArrowUp':'ArrowDown',bubbles:true}));return}if(key==='TAB'){I.value+='  ';return}if(key==='CTRL-C'){if(I.value){S.out('^C');I.value='';S.prompt()}return}I.value+=key}
function button(label,key=label,cls=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls;b.addEventListener('pointerdown',e=>{e.preventDefault();sendKey(key)});return b}
function build(){if(root)return;root=document.createElement('section');root.id='posix-mobile-keyboard';root.className='posix-mobile-keyboard';root.setAttribute('aria-label','POSIX.js experimental mobile keyboard');const tools=document.createElement('div');tools.className='pmk-tools';[['ls','ls '],['cd','cd '],['..','../'],['~','~'],['/','/'],['-','-'],['_','_'],['.','.'],['|','|'],['>','>']].forEach(([l,k])=>tools.append(button(l,k,'pmk-tool')));root.append(tools);for(const row of ['1234567890','qwertyuiop','asdfghjkl','zxcvbnm']){const r=document.createElement('div');r.className='pmk-row';for(const ch of row)r.append(button(ch));root.append(r)}const last=document.createElement('div');last.className='pmk-row pmk-special';last.append(button('↑','UP'),button('↓','DOWN'),button('Ctrl-C','CTRL-C'),button('Tab','TAB'),button('Space',' ','pmk-space'),button('⌫','BACKSPACE'),button('Enter','ENTER','pmk-enter'));root.append(last);document.body.append(root)}
function apply(v){const I=input();if(!I)return false;if(v){build();root.hidden=false;document.body.classList.add('mobilemode');I.inputMode='none';I.readOnly=true;I.setAttribute('aria-label','POSIX.js command input using custom mobile keyboard')}else{if(root)root.hidden=true;document.body.classList.remove('mobilemode');I.readOnly=false;I.inputMode='text'}setStored(v);return v}
function init(){apply(enabled())}
window.POSIXLabsMobile={enabled,apply,init};
})();
