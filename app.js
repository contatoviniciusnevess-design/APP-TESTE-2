/* Meu Diário Fitness - aplicação inicial
   Os dados são isolados por usuário com Row Level Security no Supabase. */
const $ = (id) => document.getElementById(id);
const config = window.APP_CONFIG || {};
let supabaseClient, currentUser, meals = [], workouts = [], photos = [];
window.getFitnessSchedule = () => ({ meals, workouts });
const today = () => new Date().toLocaleDateString('en-CA');
const niceDate = (d=today()) => new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
const configured = () => config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.includes('COLE_AQUI') && !config.SUPABASE_ANON_KEY.includes('COLE_AQUI');

function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function showAuth(message=''){ $('authScreen').hidden=false; $('appScreen').hidden=true; $('authMessage').textContent=message; }
function showApp(user){currentUser=user;$('authScreen').hidden=true;$('appScreen').hidden=false;$('userEmail').textContent=user.email||'Minha conta';$('todayLabel').textContent=niceDate().toUpperCase();$('datePill').textContent=niceDate();if(window.initFitnessExtras)window.initFitnessExtras(user);loadAll();}
async function auth(action){
  if(!configured()){ $('setupWarning').hidden=false; $('authMessage').textContent='Configure primeiro o arquivo config.js.';return; }
  const email=$('email').value.trim(),password=$('password').value;
  if(!email||!password){$('authMessage').textContent='Informe e-mail e senha.';return;}
  $('authMessage').textContent='Aguarde...';
  const result= action==='login'
    ? await supabaseClient.auth.signInWithPassword({email,password})
    : await supabaseClient.auth.signUp({email,password});
  if(result.error){$('authMessage').textContent=result.error.message;return;}
  if(action==='signup'&&!result.data.session){$('authMessage').textContent='Conta criada! Confira seu e-mail para confirmar o cadastro.';return;}
  if(result.data.user)showApp(result.data.user);
}
async function loadAll(){
  const [m,w,p]=await Promise.all([
    supabaseClient.from('meals').select('*').order('meal_time'),
    supabaseClient.from('workouts').select('*').order('created_at'),
    supabaseClient.from('photo_logs').select('*').order('created_at',{ascending:false})
  ]);
  if(m.error||w.error||p.error){toast('Não foi possível carregar os dados. Confira a configuração do banco.');console.error(m.error,w.error,p.error);return;}
  meals=m.data||[];workouts=w.data||[];photos=p.data||[];
  // Bucket privado: cria links temporários para exibir cada foto ao usuário autenticado.
  for (const photo of photos) {
    const signed = await supabaseClient.storage.from('fitness-photos').createSignedUrl(photo.storage_path, 60 * 60);
    photo.signed_url = signed.data?.signedUrl || '';
  }
  render();
}
function render(){
  const day=today(),dayMeals=meals.filter(x=>x.log_date===day),dayWorkouts=workouts.filter(x=>x.log_date===day);
  const doneM=dayMeals.filter(x=>x.completed).length,doneW=dayWorkouts.filter(x=>x.completed).length;
  $('mealStat').textContent=`${doneM}/${dayMeals.length}`;$('workoutStat').textContent=`${doneW}/${dayWorkouts.length}`;$('photoStat').textContent=photos.length;
  $('mealProgress').style.width=(dayMeals.length?doneM/dayMeals.length*100:0)+'%';
  $('workoutProgress').style.width=(dayWorkouts.length?doneW/dayWorkouts.length*100:0)+'%';
  $('dashboardMeals').innerHTML=dayMeals.length?dayMeals.map(x=>compact(x,'meal')).join(''):'<div class="empty-state">Nenhuma refeição cadastrada para hoje.</div>';
  $('dashboardWorkouts').innerHTML=dayWorkouts.length?dayWorkouts.map(x=>compact(x,'workout')).join(''):'<div class="empty-state">Nenhum treino cadastrado para hoje.</div>';
  $('mealsList').innerHTML=meals.length?meals.map(x=>record(x,'meal')).join(''):'<div class="panel empty-state">Você ainda não cadastrou refeições. Clique em “Nova refeição” para começar.</div>';
  $('workoutsList').innerHTML=workouts.length?workouts.map(x=>record(x,'workout')).join(''):'<div class="panel empty-state">Você ainda não cadastrou treinos. Clique em “Novo treino” para começar.</div>';
  $('galleryGrid').innerHTML=photos.length?photos.map(photoCard).join(''):'<div class="panel empty-state">Suas fotos aparecerão aqui depois do primeiro envio.</div>';
  const history=[...meals.map(x=>({...x,kind:'Refeição'})),...workouts.map(x=>({...x,kind:'Treino'}))].sort((a,b)=>(b.log_date||'').localeCompare(a.log_date||''));
  $('historyList').innerHTML=history.length?history.map(x=>`<div class="record-card"><div class="record-main"><div class="record-top"><h4>${esc(x.name)}</h4><span class="record-time">${x.kind}</span></div><p class="record-description">${esc(x.log_date||'')}</p><span class="${x.completed?'done-label':'muted'}">${x.completed?'✓ Concluído':'Pendente'}</span></div></div>`).join(''):'<div class="panel empty-state">Seu histórico aparecerá aqui.</div>';
}
function compact(x,type){return `<div class="compact-row"><div><strong>${esc(x.name)}</strong><small>${esc(type==='meal'?(x.meal_time||'Sem horário'):(x.schedule||'Treino'))}</small></div><button class="check-dot ${x.completed?'done':''}" data-action="toggle" data-type="${type}" data-id="${x.id}" aria-label="Marcar como concluído">${x.completed?'✓':''}</button></div>`}
function record(x,type){return `<article class="record-card"><button class="check-dot ${x.completed?'done':''}" data-action="toggle" data-type="${type}" data-id="${x.id}">${x.completed?'✓':''}</button><div class="record-main"><div class="record-top"><h4>${esc(x.name)}</h4><span class="record-time">${type==='meal'?esc(x.meal_time||'Sem horário'):esc(x.schedule||'Treino')}</span>${x.completed?'<span class="done-label">Concluído</span>':''}</div><p class="record-description">${esc(x.description||'Sem detalhes cadastrados.')}</p><div class="record-actions"><button class="small-btn" data-action="edit" data-type="${type}" data-id="${x.id}">Editar</button><button class="small-btn danger" data-action="delete" data-type="${type}" data-id="${x.id}">Excluir</button></div></div></article>`}
function photoCard(x){return `<article class="photo-card"><img src="${esc(x.signed_url||'')}" alt="${esc(x.caption||x.photo_type)}"><div class="photo-info"><strong>${esc(x.caption||x.photo_type)}</strong><span>${esc(x.photo_type)} • ${new Date(x.created_at).toLocaleDateString('pt-BR')}</span><br><button class="small-btn danger" data-action="delete-photo" data-id="${x.id}" data-path="${esc(x.storage_path)}">Excluir foto</button></div></article>`}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openDialog(id){$(id).showModal()}
function closeDialog(id){$(id).close()}
function resetForm(type){$(type+'Form').reset();$(type+'Id').value='';}
async function saveItem(type,data,id){
  const table=type==='meal'?'meals':'workouts';
  const payload={...data,user_id:currentUser.id,log_date:today()};
  const result=id?await supabaseClient.from(table).update(payload).eq('id',id).eq('user_id',currentUser.id):await supabaseClient.from(table).insert(payload);
  if(result.error){toast('Erro ao salvar: '+result.error.message);return false;}
  await loadAll();toast('Registro salvo!');return true;
}
async function toggle(type,id){
  const list=type==='meal'?meals:workouts,item=list.find(x=>String(x.id)===String(id));if(!item)return;
  const table=type==='meal'?'meals':'workouts';
  const {error}=await supabaseClient.from(table).update({completed:!item.completed,log_date:today()}).eq('id',id).eq('user_id',currentUser.id);
  if(error){toast('Não foi possível atualizar.');return;}await loadAll();
}
async function deleteItem(type,id){
  const table=type==='meal'?'meals':'workouts';
  const {error}=await supabaseClient.from(table).delete().eq('id',id).eq('user_id',currentUser.id);
  if(error){toast('Erro ao excluir.');return;}await loadAll();toast('Registro excluído.');
}
function editItem(type,id){
  const item=(type==='meal'?meals:workouts).find(x=>String(x.id)===String(id));if(!item)return;
  if(type==='meal'){$('mealId').value=item.id;$('mealName').value=item.name;$('mealTime').value=item.meal_time||'';$('mealDescription').value=item.description||'';$('mealDialogTitle').textContent='Editar refeição';openDialog('mealDialog');}
  else{$('workoutId').value=item.id;$('workoutName').value=item.name;$('workoutSchedule').value=item.schedule||'';$('workoutDescription').value=item.description||'';$('workoutDialogTitle').textContent='Editar treino';openDialog('workoutDialog');}
}
async function uploadPhoto(){
  const file=$('photoFile').files[0];if(!file)return;
  if(!file.type.startsWith('image/')){toast('Selecione um arquivo de imagem.');return;}
  if(file.size>8*1024*1024){toast('A imagem deve ter até 8 MB.');return;}
  const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'');
  const path=`${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const up=await supabaseClient.storage.from('fitness-photos').upload(path,file,{contentType:file.type,upsert:false});
  if(up.error){toast('Erro no envio: '+up.error.message);return;}
  const insert=await supabaseClient.from('photo_logs').insert({user_id:currentUser.id,photo_type:$('photoType').value,caption:$('photoCaption').value,storage_path:path});
  if(insert.error){await supabaseClient.storage.from('fitness-photos').remove([path]);toast('Erro ao registrar foto.');return;}
  closeDialog('photoDialog');$('photoForm').reset();await loadAll();toast('Foto enviada com sucesso!');
}
async function deletePhoto(id,path){
  if(!confirm('Excluir esta foto?'))return;
  const [a,b]=await Promise.all([supabaseClient.storage.from('fitness-photos').remove([path]),supabaseClient.from('photo_logs').delete().eq('id',id).eq('user_id',currentUser.id)]);
  if(a.error||b.error){toast('Não foi possível excluir a foto.');return;}await loadAll();toast('Foto excluída.');
}
function navigate(view){
  document.querySelectorAll('.view').forEach(v=>v.hidden=true);
  $(view+'View').hidden=false;
  document.querySelectorAll('.nav-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const titles={dashboard:'Visão geral',diet:'Minha alimentação',training:'Meus treinos',gallery:'Galeria de fotos',history:'Histórico'};
  $('pageTitle').textContent=titles[view];document.querySelector('.sidebar').classList.remove('open');
}
document.addEventListener('click',async e=>{
  const close=e.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return;}
  const go=e.target.closest('[data-go]');if(go){navigate(go.dataset.go);return;}
  const nav=e.target.closest('[data-view]');if(nav){navigate(nav.dataset.view);return;}
  const a=e.target.closest('[data-action]');if(!a)return;
  if(a.dataset.action==='toggle')await toggle(a.dataset.type,a.dataset.id);
  if(a.dataset.action==='edit')editItem(a.dataset.type,a.dataset.id);
  if(a.dataset.action==='delete'&&confirm('Excluir este registro?'))await deleteItem(a.dataset.type,a.dataset.id);
  if(a.dataset.action==='delete-photo')await deletePhoto(a.dataset.id,a.dataset.path);
});
$('loginBtn').onclick=()=>auth('login');$('signupBtn').onclick=()=>auth('signup');
$('logoutBtn').onclick=async()=>{await supabaseClient.auth.signOut();showAuth('Você saiu da sua conta.')};
$('addMealBtn').onclick=()=>{resetForm('meal');$('mealDialogTitle').textContent='Nova refeição';openDialog('mealDialog')};
$('addWorkoutBtn').onclick=()=>{resetForm('workout');$('workoutDialogTitle').textContent='Novo treino';openDialog('workoutDialog')};
$('addPhotoBtn').onclick=()=>openDialog('photoDialog');
$('mealForm').onsubmit=async e=>{e.preventDefault();const ok=await saveItem('meal',{name:$('mealName').value.trim(),meal_time:$('mealTime').value,description:$('mealDescription').value.trim()},$('mealId').value||null);if(ok)closeDialog('mealDialog')};
$('workoutForm').onsubmit=async e=>{e.preventDefault();const ok=await saveItem('workout',{name:$('workoutName').value.trim(),schedule:$('workoutSchedule').value,description:$('workoutDescription').value.trim()},$('workoutId').value||null);if(ok)closeDialog('workoutDialog')};
$('photoForm').onsubmit=async e=>{e.preventDefault();await uploadPhoto()};
$('mobileMenu').onclick=()=>$('appScreen').querySelector('.sidebar').classList.toggle('open');
document.querySelectorAll('[data-go]').forEach(()=>{});
if(!configured()){showAuth();$('setupWarning').hidden=false;}
else{
  supabaseClient=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY);
  supabaseClient.auth.getSession().then(({data})=>data.session?showApp(data.session.user):showAuth());
  supabaseClient.auth.onAuthStateChange((_event,session)=>{if(session&&!currentUser)showApp(session.user);});
}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));