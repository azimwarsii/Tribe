/** Tiny client runtime served at /app.js. Server renders pages; this adds actions, sheets, wizards and timers. */
export const CLIENT_JS = `(function(){
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var tt;function toast(m){var t=$('#toast');if(!t)return;$('#toast-t').textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){t.classList.remove('show')},2800)}
window.tribe={toast:toast};
try{var p=sessionStorage.getItem('toast');if(p){sessionStorage.removeItem('toast');toast(p)}}catch(e){}
function post(url,body){return fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){j.ok=r.ok;return j})})}
function done(res){
  if(res.error){toast(res.error);return}
  if(res.redirect){if(res.toast)try{sessionStorage.setItem('toast',res.toast)}catch(e){};location.href=res.redirect;return}
  if(res.reload){if(res.toast)try{sessionStorage.setItem('toast',res.toast)}catch(e){};location.reload();return}
  if(res.toast)toast(res.toast)
}
function collect(sel){var o={};$$('input[name],textarea[name],select[name]',$(sel)||document).forEach(function(i){if(i.type==='checkbox'){o[i.name]=i.checked}else o[i.name]=i.value});return o}
function setVal(scope,name,val){var i=$('input[name="'+name+'"]',scope);if(i)i.value=val;$$('[data-bind="'+name+'"]',scope).forEach(function(b){b.textContent=(b.getAttribute('data-pre')||'')+val+(b.getAttribute('data-suf')||'')})}
function sheet(id,open){var s=document.getElementById(id),b=document.getElementById('bd-'+id);if(!s)return;[s,b].forEach(function(x){if(x)x.classList[open?'add':'remove']('open')})}
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
if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();location.href='/cat/chat?new=1';return}
if(e.key==='Escape'){$$('.sheet.open,.drawer.open,.backdrop.open').forEach(function(x){x.classList.remove('open')});return}
if(typing||e.metaKey||e.ctrlKey||e.altKey)return;
if(e.key==='/'){var s=document.getElementById('wsearch');if(s){e.preventDefault();s.focus()}}
if(e.key.toLowerCase()==='a'){var b=document.getElementById('approve');if(b)b.click()}});
document.addEventListener('input',function(e){var i=e.target;if(!i.name)return;var sc=i.closest('[data-scope]');if(sc)$$('[data-bind="'+i.name+'"]',sc).forEach(function(b){b.textContent=i.value||b.getAttribute('data-ph')||''})});
$$('[data-autoopen]').forEach(function(a){sheet(a.dataset.autoopen,true)});
$$('[data-auto]').forEach(function(a){setTimeout(function(){location.href=a.dataset.auto},Number(a.dataset.delay||2200))});
$$('[data-autogrow]').forEach(function(a){a.addEventListener('input',function(){a.style.height='auto';a.style.height=a.scrollHeight+'px'})});
})();`;
