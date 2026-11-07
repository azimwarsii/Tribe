/** Tiny client runtime served at /app.js. Server renders pages; this adds actions, sheets, wizards and timers. */
export const CLIENT_JS = `(function(){
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var tt;function toast(m,bad){var t=$('#toast');if(!t)return;$('#toast-t').textContent=m;t.classList.toggle('bad',!!bad);t.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){t.classList.remove('show')},bad?8000:2800)}
window.tribe={toast:toast,sheet:sheet,unlock:unlock};
try{var p=sessionStorage.getItem('toast');if(p){sessionStorage.removeItem('toast');toast(p)}}catch(e){}
function post(url,body){return fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){j.ok=r.ok;return j})})}
// A trade just earned a card: it arrives locked, the lock opens, and the card shows. Close stays here; Go to trade opens it.
function unlock(u){var old=$('.unlock');if(old)old.remove();
 var d=document.createElement('div');d.className='unlock';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Tribe Trading Card unlocked');
 d.innerHTML='<div class="uncard"><div class="unglow"></div><img alt="" width="360" height="504"><div class="unsheen"></div><svg class="unlockicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="unshackle" d="M8 11V7a4 4 0 0 1 8 0v4"/><rect x="5" y="11" width="14" height="10" rx="2.5" fill="rgba(0,0,0,.55)"/></svg></div><div class="untext"><b>Card unlocked</b><span data-l></span></div><div class="unbtns"><button class="btn" type="button" data-close>Close</button><button class="btn p" type="button" data-go>Go to trade</button></div>';
 $('img',d).src='/card/'+u.card+'.svg';$('[data-l]',d).textContent='Tribe Trading Card \u00b7 '+u.label;
 var here=location.pathname==='/feed';
 function leave(){location.href=u.href;if(new URL(u.href,location.href).pathname===location.pathname)location.reload()}
 function close(){document.removeEventListener('keydown',esc);if(here)d.remove();else leave()}
 function esc(e){if(e.key==='Escape')close()}
 $('[data-close]',d).onclick=close;$('[data-go]',d).onclick=leave;document.addEventListener('keydown',esc);
 document.body.appendChild(d);$('[data-go]',d).focus()}
function done(res){
  if(res.error){toast(res.error,true);return}
  if(res.unlock){if(res.toast)try{sessionStorage.setItem('toast',res.toast)}catch(e){};unlock(res.unlock);return}
  if(res.redirect){if(res.toast)try{sessionStorage.setItem('toast',res.toast)}catch(e){};var to=new URL(res.redirect,location.href);location.href=res.redirect;if(to.pathname===location.pathname&&to.search===location.search)location.reload();return}
  if(res.reload){if(res.toast)try{sessionStorage.setItem('toast',res.toast)}catch(e){};location.reload();return}
  if(res.toast)toast(res.toast)
}
function collect(sel){var o={};$$('input[name],textarea[name],select[name]',$(sel)||document).forEach(function(i){if(i.type==='checkbox'){o[i.name]=i.checked}else o[i.name]=i.value});return o}
function setVal(scope,name,val){var i=$('input[name="'+name+'"]',scope);if(i)i.value=val;$$('[data-bind="'+name+'"]',scope).forEach(function(b){b.textContent=(b.getAttribute('data-pre')||'')+val+(b.getAttribute('data-suf')||'')})}
function sheet(id,open){var s=document.getElementById(id),b=document.getElementById('bd-'+id);if(!s)return;[s,b].forEach(function(x){if(x)x.classList[open?'add':'remove']('open')})}
// A card with data-href opens its page when clicked anywhere that isn't its own link, button or field.
document.addEventListener('click',function(e){
  var card=e.target.closest('[data-href]');if(!card||e.defaultPrevented||e.target.closest('a,button,input,select,textarea,label,form,[data-act],[role=button]'))return;
  if(window.getSelection&&String(window.getSelection()).length)return;
  if(e.metaKey||e.ctrlKey)window.open(card.dataset.href,'_blank');else location.href=card.dataset.href});
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-open],[data-close],[data-pick],[data-step],[data-goto],[data-act],[data-copy],[data-toggle]');if(!el)return;
  if(el.dataset.open){sheet(el.dataset.open,true);return}
  if(el.dataset.close){sheet(el.dataset.close,false);return}
  if(el.dataset.copy){navigator.clipboard&&navigator.clipboard.writeText(el.dataset.copy);toast('Copied');return}
  if(el.dataset.toggle){var t=document.getElementById(el.dataset.toggle);if(t)t.classList.toggle('hide');return}
  var scope=el.closest('[data-scope]')||document;
  if(el.dataset.pick!==undefined){var name=el.dataset.name,val=el.dataset.val;$$('[data-pick][data-name="'+name+'"]',scope).forEach(function(x){var on=x===el;x.classList.toggle('on',on);x.setAttribute('aria-checked',on?'true':'false')});setVal(scope,name,val);var h=scope.dataset.onpick;if(h&&window[h])window[h](scope,name,val);return}
  if(el.dataset.step!==undefined){var n=el.dataset.name,i=$('input[name="'+n+'"]',scope),v=Number(i.value)+Number(el.dataset.delta);v=Math.max(Number(el.dataset.min||0),v);setVal(scope,n,v);return}
  if(el.dataset.goto){var to=el.dataset.goto;$$('[data-step-id]',scope).forEach(function(s){s.classList.toggle('hide',s.dataset.stepId!==to)});$$('[data-bar]',scope).forEach(function(b){b.style.background=Number(b.dataset.bar)<=Number(to)?'#34D399':'#262626'});var lab=$('[data-steplabel]',scope);if(lab)lab.textContent=(lab.dataset.labels||'').split('|')[Number(to)-1]||'';window.scrollTo(0,0);return}
  if(el.dataset.act){
    if(el.disabled)return;
    if(el.dataset.confirm&&!confirm(el.dataset.confirm))return;
    var body={};try{body=JSON.parse(el.dataset.body||'{}')}catch(x){}
    if(el.dataset.collect)Object.assign(body,collect(el.dataset.collect));
    if(el.getAttribute('role')==='switch'){var on=el.getAttribute('aria-checked')!=='true';el.setAttribute('aria-checked',on?'true':'false');body.value=on}
    var prev=el.textContent;el.disabled=true;
    post(el.dataset.act,body).then(function(r){el.disabled=false;done(r)}).catch(function(){el.disabled=false;toast('Network error')});
  }
});
document.addEventListener('submit',function(e){var f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();var o={};new FormData(f).forEach(function(v,k){o[k]=v});var b=f.querySelector('button[type=submit],button:not([type])');if(b)b.disabled=true;post(f.getAttribute('action'),o).then(function(r){if(b)b.disabled=false;if(r.append){var c=document.getElementById(r.append.target);if(c)c.insertAdjacentHTML('beforeend',r.append.html);f.reset()}done(r)})});
function tick(){$$('[data-expire]').forEach(function(t){var ms=Number(t.dataset.expire)-Date.now();var s=Math.max(0,Math.ceil(ms/1000));t.textContent=s>=60?Math.floor(s/60)+':'+('0'+(s%60)).slice(-2):s+'s';var bar=$('[data-expire-bar]',t.closest('[data-card]')||document);if(bar){var total=Number(t.dataset.total||60000);bar.style.width=Math.max(0,Math.min(100,ms/total*100))+'%'}if(ms<=0&&!t.dataset.done){t.dataset.done=1;if(t.dataset.reload)setTimeout(function(){location.reload()},400)}})}
setInterval(tick,250);tick();
document.addEventListener('keydown',function(e){var t=e.target,typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);
if(e.key==='Escape'){$$('.sheet.open,.drawer.open,.backdrop.open').forEach(function(x){x.classList.remove('open')});return}
if(typing||e.metaKey||e.ctrlKey||e.altKey)return;
if(e.key==='/'){var s=document.getElementById('wsearch');if(s){e.preventDefault();s.focus()}}
if(e.key.toLowerCase()==='a'){var b=document.getElementById('approve');if(b)b.click()}});
document.addEventListener('input',function(e){var i=e.target;if(!i.name)return;var sc=i.closest('[data-scope]');if(sc)$$('[data-bind="'+i.name+'"]',sc).forEach(function(b){b.textContent=i.value||b.getAttribute('data-ph')||''})});
$$('[data-autoopen]').forEach(function(a){sheet(a.dataset.autoopen,true)});
$$('[data-auto]').forEach(function(a){setTimeout(function(){location.href=a.dataset.auto},Number(a.dataset.delay||2200))});
$$('[data-autogrow]').forEach(function(a){a.addEventListener('input',function(){a.style.height='auto';a.style.height=a.scrollHeight+'px'})});

// Installed app: register the worker, and let Settings offer the install where this browser can do it.
(function(){if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});
var box=$('[data-install]');if(!box||matchMedia('(display-mode: standalone)').matches||navigator.standalone)return;
var btn=$('[data-install-btn]',box);
if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){$('[data-install-text]',box).textContent='In Safari, tap Share, then Add to Home Screen';btn.style.display='none';box.hidden=false}
addEventListener('beforeinstallprompt',function(e){e.preventDefault();box.hidden=false;btn.onclick=function(){e.prompt();e.userChoice.then(function(c){if(c.outcome==='accepted')box.hidden=true})}});
addEventListener('appinstalled',function(){box.hidden=true})})();

// MetaMask bridge (live mode, own-wallet accounts): when an action needs a signature, the server queues it, this tab
// claims it, MetaMask shows it, and the answer goes back. Nothing is signed without the user confirming in MetaMask.
(function(){var S=window.TRIBE_SIGNER;if(!S)return;
var tab=Math.random().toString(36).slice(2),box=null;
function show(t){if(!box){box=document.createElement('div');box.className='signbox';box.setAttribute('role','status');document.body.appendChild(box)}box.innerHTML='<span class="live" style="width:8px;height:8px"></span><span><b>Confirm in MetaMask</b><span class="sb-t"></span></span>';box.querySelector('.sb-t').textContent=t;box.hidden=false}
function hide(){if(box)box.hidden=true}
async function ready(){var e=window.ethereum;if(!e)throw new Error('No wallet extension found in this browser');
 var acc=await e.request({method:'eth_requestAccounts'}),me=S.address.toLowerCase();
 if(!acc.some(function(a){return a.toLowerCase()===me}))throw new Error('MetaMask is on another account: switch to '+S.address.slice(0,6)+'...'+S.address.slice(-4));
 if(await e.request({method:'eth_chainId'})!=='0x2105'){try{await e.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x2105'}]})}catch(x){if(x&&x.code===4902)await e.request({method:'wallet_addEthereumChain',params:[{chainId:'0x2105',chainName:'Base',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:['https://mainnet.base.org'],blockExplorerUrls:['https://basescan.org']}]});else throw x}}
 return e}
function hex(s){var b=new TextEncoder().encode(s),h='0x';for(var i=0;i<b.length;i++)h+=('0'+b[i].toString(16)).slice(-2);return h}
async function run(r){var e=await ready(),p=r.payload,a=S.address;
 if(r.kind==='typed')return e.request({method:'eth_signTypedData_v4',params:[a,p.json]});
 if(r.kind==='message')return e.request({method:'personal_sign',params:[hex(p.message),a]});
 if(r.kind==='tx')return e.request({method:'eth_sendTransaction',params:[{from:a,to:p.to,data:p.data,value:p.value?'0x'+BigInt(p.value).toString(16):'0x0'}]});
 throw new Error('Unknown request')}
async function loop(){for(;;){try{var w=await fetch('/api/sign/wait?tab='+tab);if(w.status===401)return;if(!w.ok)throw new Error('wait '+w.status);var j=await w.json();
  if(j&&j.req){show(j.req.label);var body;try{body={result:await run(j.req)}}catch(x){body={error:(x&&(x.message||String(x.code)))||'rejected'};toast(body.error)}
   await fetch('/api/sign/'+j.req.id,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});hide()}
 }catch(x){hide();await new Promise(function(r){setTimeout(r,3000)})}}}
loop()})();
})();`;
