/* CUTROOM Cloud v1 — browser client, Supabase RLS, per-user projects.
   Credentials exposed to the browser MUST be publishable/anon only, never secret/service-role. */
(function () {
'use strict';
const bridge = window.CutroomBridge;
if (!bridge) { console.error('CUTROOM bridge is unavailable'); return; }
const body = document.body;
const status = document.createElement('div');
status.className = 'cloud-status';
status.id = 'cloudStatus';
status.setAttribute('role','status');
status.innerHTML = '<span id="cloudMessage">클라우드 연결 확인 중…</span><button id="cloudImport" hidden>기존 기록 가져오기</button><button id="cloudLogout" hidden>로그아웃</button>';
document.body.append(status);
const auth = document.createElement('div');
auth.className = 'cloud-auth-screen';
auth.id = 'cloudAuthScreen';
auth.hidden = true;
auth.innerHTML = '<div class="cloud-auth-card"><div class="cloud-auth-mark">c.</div><div class="cloud-auth-kicker">CUTROOM STUDIO</div><h1>나만의 콘텐츠 작업실</h1><p>구글 계정으로 로그인하면 모든 기기에서<br>영상 기획서와 체크리스트를 이어서 작성할 수 있어요.</p><button id="cloudGoogleLogin" type="button">G &nbsp; Google 계정으로 시작하기</button><p class="cloud-auth-sub" id="cloudAuthHint">로그인한 사용자만 자신의 기록을 볼 수 있습니다.</p></div>';
document.body.append(auth);
const $ = id => document.getElementById(id);
let client = null, user = null, synced = null, saving = false, pending = false, timer = null, poll = null, busy = false, legacy = bridge.snapshot();
const json = o => JSON.stringify(o || null);
const copy = o => JSON.parse(JSON.stringify(o));
const empty = () => ({accounts:[],projects:[],activeAccountId:null,activeId:null});
const cacheKey = uid => 'cutroom-cloud-local-' + uid;
const baseKey = uid => 'cutroom-cloud-baseline-' + uid;
function writeStatus(message) { $('cloudMessage').textContent = message; }
function setLock(lock) {
 body.classList.toggle('cloud-locked',!!lock);
 body.classList.remove('cloud-booting');
 auth.hidden = !lock;
}
function hasLegacy() {
 if (!legacy || !Array.isArray(legacy.projects)) return false;
 if (legacy.projects.length > 1 || legacy.accounts.length > 1) return true;
 const p = legacy.projects[0];
 return !!(p && (Object.keys(p.checks||{}).length || Object.values(p.fields||{}).some(Boolean) ||
   (p.chips && Object.values(p.chips).some(a=>a?.length)) || (p.title !== '첫 번째 영상 기획')));
}
function updateControls() {
 $('cloudImport').hidden = !(user && hasLegacy() && localStorage.getItem('cutroom-cloud-imported-' + user.id) !== 'yes');
 $('cloudLogout').hidden = !user;
}
function changes(a,b) { return json(a) !== json(b); }
function rowsById(arr) { return new Map((arr||[]).map(o=>[o.id,o])); }
function mergeCollections(remote, local, baseline) {
 const r=rowsById(remote), l=rowsById(local), b=rowsById(baseline), result=[];
 for (const id of new Set([...r.keys(),...l.keys(),...b.keys()])) {
  const rv=r.get(id), lv=l.get(id), bv=b.get(id);
  const lc=changes(lv,bv), rc=changes(rv,bv);
  let chosen;
  if (lc && !rc) chosen=lv;
  else if (!lc && rc) chosen=rv;
  else if (!lc && !rc) chosen=rv;
  else if (!rv || !lv) chosen=rv || lv; // preserve edited material in deletion conflicts
  else chosen=Date.parse(lv.updatedAt||lv.createdAt||0) > Date.parse(rv.updatedAt||rv.createdAt||0) ? lv : rv;
  if (chosen) result.push(chosen);
 }
 return result;
}
function mergeStates(remote, local, baseline) {
 const accounts=mergeCollections(remote.accounts,local.accounts,baseline.accounts);
 const accountIds=new Set(accounts.map(a=>a.id));
 const projects=mergeCollections(remote.projects,local.projects,baseline.projects).filter(p=>accountIds.has(p.accountId));
 return {accounts,projects,activeAccountId:local.activeAccountId || remote.activeAccountId,
   activeId:local.activeId || remote.activeId};
}
function saveCache() {
 if (!user || busy) return;
 try { localStorage.setItem(cacheKey(user.id),json(bridge.snapshot())); } catch(e) { writeStatus('☁ 기기 저장 용량을 확인해 주세요'); }
}
function saveBaseline() {
 if (!user || !synced) return;
 try { localStorage.setItem(baseKey(user.id),json(synced)); } catch(e) {}
}
function loadJson(k) { try {return JSON.parse(localStorage.getItem(k));}catch{return null;} }
function throwIfError(result) { if (result.error) throw result.error; return result.data; }
async function fetchRemote() {
 const [a,p] = await Promise.all([
  client.from('cutroom_accounts').select('id,data,updated_at').order('updated_at',{ascending:false}).limit(500),
  client.from('cutroom_projects').select('id,account_id,data,updated_at').order('updated_at',{ascending:false}).limit(2000)
 ]);
 throwIfError(a); throwIfError(p);
 return {accounts:a.data.map(x=>x.data),projects:p.data.map(x=>x.data),activeAccountId:null,activeId:null};
}
async function syncOnce() {
 if (!user || !synced || busy || saving) return;
 saving=true; pending=false; clearTimeout(timer);
 const before=copy(synced), current=bridge.snapshot();
 const prevAcc=rowsById(before.accounts),prevProj=rowsById(before.projects);
 const nowAcc=rowsById(current.accounts),nowProj=rowsById(current.projects);
 const uid=user.id;
 try {
  const changedAcc=current.accounts.filter(a=>changes(a,prevAcc.get(a.id)));
  const changedProj=current.projects.filter(p=>changes(p,prevProj.get(p.id)));
  const removedProj=before.projects.filter(p=>!nowProj.has(p.id)).map(p=>p.id);
  const removedAcc=before.accounts.filter(a=>!nowAcc.has(a.id)).map(a=>a.id);
  if (changedAcc.length) throwIfError(await client.from('cutroom_accounts').upsert(
   changedAcc.map(a=>({id:a.id,user_id:uid,data:a,updated_at:new Date().toISOString()})),
   {onConflict:'user_id,id'}));
  if (changedProj.length) throwIfError(await client.from('cutroom_projects').upsert(
   changedProj.map(p=>({id:p.id,user_id:uid,account_id:p.accountId,data:p,updated_at:new Date().toISOString()})),
   {onConflict:'user_id,id'}));
  if (removedProj.length) throwIfError(await client.from('cutroom_projects').delete().eq('user_id',uid).in('id',removedProj));
  if (removedAcc.length) throwIfError(await client.from('cutroom_accounts').delete().eq('user_id',uid).in('id',removedAcc));
  synced=current; saveBaseline(); writeStatus('☁ 클라우드에 저장됨 · ' + (user.email||'Google 로그인'));
 } catch (e) {
  pending=true; writeStatus('☁ 저장 실패 · 연결 복구 후 재시도 (' + String(e.message||e).slice(0,65) + ')');
  setTimeout(()=>{ if(user) scheduleSave(); },10000);
 } finally {
  saving=false;
  if (changes(bridge.snapshot(),current)) scheduleSave();
 }
}
function scheduleSave() {
 if (!user || busy) return;
 saveCache();
 if (!synced) return;
 if (!changes(bridge.snapshot().accounts,synced.accounts) && !changes(bridge.snapshot().projects,synced.projects)) return;
 pending=true; writeStatus('☁ 저장 중…');
 clearTimeout(timer);timer=setTimeout(syncOnce,950);
}
async function refresh() {
 if(!user||busy||saving||pending||!synced||document.hidden) return;
 try {
  const remote=await fetchRemote();
  const local=bridge.snapshot();
  const merged=mergeStates(remote,local,synced);
  synced=remote;saveBaseline();
  if (changes(local.accounts,merged.accounts)||changes(local.projects,merged.projects)) {
   busy=true;bridge.restore(merged);busy=false;
  }
  if(changes(merged.accounts,remote.accounts)||changes(merged.projects,remote.projects)) scheduleSave();
 } catch(e) { writeStatus('☁ 새 기록 확인 실패 · 네트워크 확인'); }
}
async function activate(session) {
 const u=session?.user;
 if(!u) {
  clearTimeout(timer);clearInterval(poll);user=null;synced=null;pending=false;
  setLock(true);writeStatus('Google 로그인 필요');updateControls();return;
 }
 if(user?.id===u.id && synced) return;
 user=u;setLock(true);writeStatus('☁ 내 클라우드 기록을 불러오는 중…');
 busy=true;
 try {
  const remote=await fetchRemote();
  const localCache=loadJson(cacheKey(u.id));
  const baseline=loadJson(baseKey(u.id));
  const merged=localCache && baseline ? mergeStates(remote,localCache,baseline) : remote;
  synced=remote;saveBaseline();
  bridge.restore(merged);setLock(false);
  writeStatus('☁ 동기화 연결됨 · ' + (u.email||'Google 로그인'));updateControls();
  if(changes(merged.accounts,remote.accounts)||changes(merged.projects,remote.projects)) setTimeout(scheduleSave,80);
 } catch(e) {
  const localCache=loadJson(cacheKey(u.id));
  if(localCache){bridge.restore(localCache);setLock(false);writeStatus('☁ 오프라인 기록 표시 중 · 서버 연결을 확인하세요');}
  else {setLock(true);$('cloudAuthHint').textContent='DB 연결 실패: '+String(e.message||e)+' · SQL 테이블과 RLS 설정을 확인하세요.';}
  synced=null;
 } finally {busy=false;}
 clearInterval(poll);
 poll=setInterval(async()=>{if(!user)return;if(!synced){const {data,error}=await client.auth.getSession();if(!error&&data.session){user=null;await activate(data.session);} }else await refresh();},30000);
 updateControls();
}
async function importLegacy(){
 if(!user||!legacy||!hasLegacy())return;
 if(!confirm('이 기기에 남아 있는 이전 영상 기록을 현재 Google 계정의 클라우드에 추가할까요?\n다른 사용자의 기록이 아닌지 확인해 주세요. 기존 클라우드 기록은 보존됩니다.')) return;
 const active=bridge.snapshot(), accountMap=new Map(active.accounts.map(a=>[a.id,a])),projectMap=new Map(active.projects.map(p=>[p.id,p]));
 for(const a of legacy.accounts||[])if(!accountMap.has(a.id))accountMap.set(a.id,a);
 for(const p of legacy.projects||[])if(!projectMap.has(p.id))projectMap.set(p.id,p);
 bridge.restore({accounts:[...accountMap.values()],projects:[...projectMap.values()],
   activeAccountId:legacy.activeAccountId,activeId:legacy.activeId});
 localStorage.setItem('cutroom-cloud-imported-'+user.id,'yes');
 updateControls();scheduleSave();writeStatus('☁ 이전 기록을 클라우드로 옮기는 중…');
}
async function loadSupabase(){
 const response=await fetch('/api/config',{cache:'no-store'});
 if(!response.ok) throw Error('config endpoint returned '+response.status);
 const config=await response.json();
 if(!config.configured) return null;
 if(!/^https:\/\/[a-z0-9.-]+\/?$/i.test(config.url)||!config.publishableKey)throw Error('invalid config');
 await new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.76.1/dist/umd/supabase.min.js';
  s.onload=resolve;s.onerror=()=>reject(Error('Supabase SDK 다운로드 실패'));document.head.append(s);
 });
 if(!window.supabase?.createClient)throw Error('Supabase SDK 초기화 실패');
 return window.supabase.createClient(config.url,config.publishableKey,{
  auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}
 });
}
$('cloudGoogleLogin').addEventListener('click', async ()=>{
 if(!client)return;
 $('cloudGoogleLogin').disabled=true;writeStatus('Google 로그인 페이지로 이동 중…');
 const {error}=await client.auth.signInWithOAuth({
  provider:'google',options:{redirectTo:location.origin+location.pathname}
 });
 if(error){$('cloudAuthHint').textContent='로그인 실패: '+error.message;writeStatus('Google 로그인 실패');}
 $('cloudGoogleLogin').disabled=false;
});
$('cloudImport').addEventListener('click',importLegacy);
$('cloudLogout').addEventListener('click',async ()=>{
 if(!client||!user)return;
 if(pending)await syncOnce();
 const {error}=await client.auth.signOut();
 if(error)writeStatus('로그아웃 실패: '+error.message);
 else {user=null;synced=null;setLock(true);writeStatus('Google 로그인 필요');updateControls();}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('online',()=>{if(user){if(synced)scheduleSave();else location.reload();}});
window.CutroomCloud={
 isAuthenticated:()=>!!user,
 getUserId:()=>user?.id||null,
 scheduleSave,
 isLocked:()=>!!client&&!user
};
(async ()=>{
 try {
  client=await loadSupabase();
  if(!client){setLock(false);writeStatus('☁ 클라우드 설정 대기 중 · 현재 기기에만 저장');return;}
  setLock(true);
  client.auth.onAuthStateChange((event,session)=>{
   if(['SIGNED_IN','INITIAL_SESSION','SIGNED_OUT','USER_UPDATED'].includes(event)){
    setTimeout(()=>activate(session),0);
   }
  });
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  await activate(data.session);
 } catch(e) {
  setLock(false);
  writeStatus('☁ 클라우드 접속 오류 · 현재 로컬 모드 ('+String(e.message||e).slice(0,60)+')');
  console.error('CUTROOM cloud setup',e);
 }
})();
})();