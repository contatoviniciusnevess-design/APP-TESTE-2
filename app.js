/* Meu Diário Fitness - aplicação inicial
   Os dados são isolados por usuário com Row Level Security no Supabase. */
const $ = (id) => document.getElementById(id);
const config = window.APP_CONFIG || {};
let supabaseClient, currentUser, meals = [], workouts = [], photos = [];
let mealLoadError = '';
const DEFAULT_DIET = [
  {name:'Café da manhã',meal_time:'',description:'2 fatias de pão de forma + 2 ovos'},
  {name:'Almoço',meal_time:'',description:'150 g de arroz cozido + 120 g de carne + 80 g de feijão + salada'},
  {name:'Lanche da tarde',meal_time:'',description:'1 banana + 200 ml de iogurte'},
  {name:'Jantar',meal_time:'',description:'150 g de arroz cozido + 120 g de carne + 80 g de feijão + salada'},
  {name:'Ceia',meal_time:'',description:'250 ml de leite integral + 40 g de whey (20 g de proteína)'}
];
window.getFitnessSchedule = () => ({ meals, workouts });

const DEFAULT_WORKOUT_PLAN = [
  {name:'Superior A — Segunda-feira',schedule:'Segunda-feira • Superior A',description:'PEITO\nSupino reto — 3×8–12\nSupino inclinado com halteres — 2×8–12\n\nCOSTAS\nPuxada alta — 3×8–12\nRemada baixa — 2×10–12\n\nOMBROS E BRAÇOS\nElevação lateral — 2×12–15\nTríceps corda — 2×10–15\nRosca direta — 2×10–12\n\nDuração estimada: 60 min. Descanso: 2 min nos compostos e 60–90 s nos isoladores.'},
  {name:'Inferior A — Terça-feira',schedule:'Terça-feira • Inferior A',description:'ÊNFASE EM QUADRÍCEPS\nAgachamento ou hack — 3×8–10\nLeg press — 3×10–12\nCadeira extensora — 2×12–15\nMesa flexora — 2×10–12\nPanturrilha em pé — 3×12–15\n\nDuração estimada: 60 min. Priorize amplitude confortável e execução controlada.'},
  {name:'Cardio — Quarta-feira',schedule:'Quarta-feira • Cardio exclusivo',description:'CARDIO MODERADO\nEsteira, bicicleta ou elíptico — 35–45 min\nIntensidade: moderada, mantendo capacidade de conversar em frases curtas.\nFinalização: 5 min leves para desacelerar.\nMobilidade opcional — 5 min.\n\nSem musculação neste dia.'},
  {name:'Superior B — Quinta-feira',schedule:'Quinta-feira • Superior B',description:'PEITO E COSTAS\nSupino inclinado na máquina — 3×8–12\nCrucifixo na máquina — 2×12–15\nRemada articulada — 3×8–12\nPuxada neutra — 2×10–12\n\nOMBROS E BRAÇOS\nDesenvolvimento máquina — 2×8–12\nFace pull — 2×12–15\nRosca martelo — 2×10–12\nTríceps na polia — 2×10–12\n\nDuração estimada: 60 min.'},
  {name:'Inferior B — Sexta-feira',schedule:'Sexta-feira • Inferior B',description:'ÊNFASE EM POSTERIOR E GLÚTEOS\nTerra romeno — 3×8–10\nMesa flexora — 3×10–12\nElevação pélvica — 3×8–12\nCadeira abdutora — 2×12–15\nCadeira extensora — 2×12–15\nPanturrilha sentada — 3×12–15\n\nDuração estimada: 60 min.'},
  {name:'Complementar — Sábado',schedule:'Sábado • Ombros, braços e abdômen',description:'OMBROS, BRAÇOS E CORE\nElevação lateral — 3×12–15\nRosca Scott — 3×10–12\nTríceps francês na polia — 3×10–12\nRosca no cabo — 2×12–15\nTríceps corda — 2×12–15\nPrancha — 3×30–45 s\nAbdominal na máquina — 2×12–15\n\nDuração estimada: 50–60 min. Faça em superséries de bíceps/tríceps para caber no tempo.'}
];
function weekDate(dayOffset){
  const d=new Date();d.setHours(12,0,0,0);
  const monday=(d.getDay()+6)%7;d.setDate(d.getDate()-monday+dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
async function ensureWeeklyWorkouts(){
  const start=weekDate(0),end=weekDate(6);
  const existing=workouts.filter(x=>String(x.log_date).slice(0,10)>=start&&String(x.log_date).slice(0,10)<=end);
  const missing=DEFAULT_WORKOUT_PLAN.filter(plan=>!existing.some(x=>x.name===plan.name&&String(x.log_date).slice(0,10)>=start&&String(x.log_date).slice(0,10)<=end));
  if(!missing.length)return;
  const inserted=await supabaseClient.from('workouts').insert(missing.map(item=>({...item,user_id:currentUser.id,log_date:weekDate(DEFAULT_WORKOUT_PLAN.indexOf(item)),completed:false})));
  if(inserted.error){console.error('Erro ao cadastrar a divisão semanal:',inserted.error);toast('Não foi possível cadastrar automaticamente a divisão semanal.');return;}
  const refreshed=await supabaseClient.from('workouts').select('*').order('created_at');
  if(!refreshed.error)workouts=refreshed.data||workouts;
}

const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
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
  mealLoadError = '';
  const [m,w,p]=await Promise.all([
    supabaseClient.from('meals').select('*').order('meal_time'),
    supabaseClient.from('workouts').select('*').order('created_at'),
    supabaseClient.from('photo_logs').select('*').order('created_at',{ascending:false})
  ]);

  if(m.error){
    meals=[];
    mealLoadError='Não foi possível consultar suas refeições no banco: '+m.error.message;
    console.error('Erro ao consultar refeições:',m.error);
  } else {
    meals=m.data||[];
    // Remove duplicatas da dieta padrão criadas em tentativas anteriores,
    // preservando o registro concluído quando houver um.
    const todayMeals=meals.filter(x=>String(x.log_date).slice(0,10)===today());
    const duplicateIds=[];
    for(const plan of DEFAULT_DIET){
      const matches=todayMeals.filter(saved=>saved.name===plan.name);
      if(matches.length>1){
        matches.sort((a,b)=>Number(Boolean(b.completed))-Number(Boolean(a.completed)));
        duplicateIds.push(...matches.slice(1).map(item=>item.id));
      }
    }
    if(duplicateIds.length){
      const removed=await supabaseClient.from('meals').delete().in('id',duplicateIds).eq('user_id',currentUser.id);
      if(removed.error){
        mealLoadError='As refeições estão duplicadas e não foi possível corrigir automaticamente: '+removed.error.message;
        console.error('Erro ao remover refeições duplicadas:',removed.error);
      } else {
        const refreshed=await supabaseClient.from('meals').select('*').order('meal_time');
        if(refreshed.error){
          mealLoadError='As duplicatas foram removidas, mas não foi possível atualizar a lista: '+refreshed.error.message;
        } else {
          meals=refreshed.data||[];
        }
      }
    }
    const currentTodayMeals=meals.filter(x=>String(x.log_date).slice(0,10)===today());
    const missingMeals=DEFAULT_DIET.filter(plan=>!currentTodayMeals.some(saved=>saved.name===plan.name));
    if(missingMeals.length){
      const seeded=await supabaseClient.from('meals').insert(
        missingMeals.map(item=>({...item,meal_time:null,user_id:currentUser.id,log_date:today(),completed:false}))
      );
      if(seeded.error){
        mealLoadError='Não foi possível cadastrar a dieta automática: '+seeded.error.message;
        console.error('Erro ao inserir dieta padrão:',seeded.error);
      } else {
        const refreshed=await supabaseClient.from('meals').select('*').order('meal_time');
        if(refreshed.error){
          mealLoadError='A dieta foi cadastrada, mas não foi possível atualizar a lista: '+refreshed.error.message;
          console.error('Erro ao atualizar refeições:',refreshed.error);
        } else {
          meals=refreshed.data||[];
        }
      }
    }
  }

  workouts=w.error?[]:(w.data||[]);
  if(!w.error)await ensureWeeklyWorkouts();
  photos=p.error?[]:(p.data||[]);
  if(w.error)console.error('Erro ao carregar treinos:',w.error);
  if(p.error)console.error('Erro ao carregar fotos:',p.error);

  for (const photo of photos) {
    const signed = await supabaseClient.storage.from('fitness-photos').createSignedUrl(photo.storage_path, 60 * 60);
    photo.signed_url = signed.data?.signedUrl || '';
  }
  render();
  if(mealLoadError){
    $('mealsList').innerHTML='<div class="panel empty-state">'+esc(mealLoadError)+'<br><br>Confira as permissões da tabela meals no Supabase.</div>';
    toast('A dieta não foi carregada. Veja a mensagem na tela.');
  }
}
function render(){
  const day=today();
  const rawDayMeals=meals.filter(x=>String(x.log_date).slice(0,10)===day);
  // A interface exibe apenas um registro por refeição padrão, mesmo que o banco
  // ainda contenha duplicatas antigas. Prioriza o item já marcado como concluído.
  const dayMeals=[];
  const seenMealNames=new Set();
  const mealGroups=new Map();
  for(const item of rawDayMeals){
    const key=String(item.name||'').trim().toLocaleLowerCase('pt-BR');
    if(!mealGroups.has(key) || (!mealGroups.get(key).completed && item.completed)){
      mealGroups.set(key,item);
    }
  }
  dayMeals.push(...mealGroups.values());
  const dayWorkouts=workouts.filter(x=>String(x.log_date).slice(0,10)===day);
  const doneM=dayMeals.filter(x=>x.completed).length,doneW=dayWorkouts.filter(x=>x.completed).length;
  $('mealStat').textContent=`${doneM}/${dayMeals.length}`;$('workoutStat').textContent=`${doneW}/${dayWorkouts.length}`;$('photoStat').textContent=photos.length;
  $('mealProgress').style.width=(dayMeals.length?doneM/dayMeals.length*100:0)+'%';
  $('workoutProgress').style.width=(dayWorkouts.length?doneW/dayWorkouts.length*100:0)+'%';
  $('dashboardMeals').innerHTML=dayMeals.length?dayMeals.map(x=>compact(x,'meal')).join(''):'<div class="empty-state">Nenhuma refeição cadastrada para hoje.</div>';
  $('dashboardWorkouts').innerHTML=dayWorkouts.length?dayWorkouts.map(x=>compact(x,'workout')).join(''):'<div class="empty-state">Nenhum treino cadastrado para hoje.</div>';
  $('mealsList').innerHTML=dayMeals.length?dayMeals.map(x=>record(x,'meal')).join(''):'<div class="panel empty-state">Sua dieta diária será carregada aqui.</div>';
  $('workoutsList').innerHTML=workouts.length?workouts.map(x=>record(x,'workout')).join(''):'<div class="panel empty-state">Você ainda não cadastrou treinos. Clique em “Novo treino” para começar.</div>';
  $('workoutsList').querySelectorAll('[data-action="open-workout"]').forEach(button=>{button.type='button';button.addEventListener('click',()=>{try{openWorkout(button.dataset.id);}catch(error){console.error('Erro ao abrir exercícios:',error);toast('Não foi possível abrir o guia: '+(error.message||'erro inesperado'));}});});
  $('galleryGrid').innerHTML=photos.length?photos.map(photoCard).join(''):'<div class="panel empty-state">Suas fotos aparecerão aqui depois do primeiro envio.</div>';
  const history=[...meals.map(x=>({...x,kind:'Refeição'})),...workouts.map(x=>({...x,kind:'Treino'}))].sort((a,b)=>(b.log_date||'').localeCompare(a.log_date||''));
  $('historyList').innerHTML=history.length?history.map(x=>`<div class="record-card"><div class="record-main"><div class="record-top"><h4>${esc(x.name)}</h4><span class="record-time">${x.kind}</span></div><p class="record-description">${esc(x.log_date||'')}</p><span class="${x.completed?'done-label':'muted'}">${x.completed?'✓ Concluído':'Pendente'}</span></div></div>`).join(''):'<div class="panel empty-state">Seu histórico aparecerá aqui.</div>';
}

const EXERCISE_VIDEO_LIBRARY=[["supino reto","h7alFPe0SJU",1084,"Peitoral, tríceps e ombros","Pés firmes no chão e escápulas apoiadas|Desça a barra controlando até o peito|Empurre sem perder a estabilidade dos ombros"],["supino inclinado com halteres","h7alFPe0SJU",1696,"Peitoral superior, tríceps","Banco inclinado moderadamente|Desça os halteres ao lado do peito|Empurre sem bater os halteres"],["puxada alta","h7alFPe0SJU",150,"Costas e bíceps","Ajuste o apoio das coxas|Puxe a barra em direção à parte alta do peito|Retorne devagar sem elevar os ombros"],["remada baixa","h7alFPe0SJU",223,"Costas e bíceps","Mantenha coluna neutra|Puxe o pegador em direção ao abdômen|Retorne com controle"],["elevação lateral","h7alFPe0SJU",1865,"Deltoide lateral","Cotovelos levemente flexionados|Eleve os braços até a altura dos ombros|Desça sem usar impulso"],["tríceps corda","Oy3sGRtNyUE",40,"Tríceps","Cotovelos junto ao tronco|Estenda os braços para baixo|Retorne controlando"],["rosca direta","h7alFPe0SJU",621,"Bíceps","Cotovelos próximos ao tronco|Flexione sem balançar o corpo|Desça lentamente"],["agachamento","h7alFPe0SJU",2008,"Quadríceps e glúteos","Pés aproximadamente na largura dos ombros|Desça mantendo joelhos alinhados aos pés|Suba empurrando o chão"],["leg press","h7alFPe0SJU",443,"Quadríceps e glúteos","Apoie toda a planta dos pés|Desça a plataforma com controle|Empurre sem travar bruscamente os joelhos"],["cadeira extensora","h7alFPe0SJU",12,"Quadríceps","Ajuste o rolo próximo à canela|Estenda os joelhos controlando|Retorne sem deixar a carga despencar"],["mesa flexora","h7alFPe0SJU",1037,"Posteriores da coxa","Ajuste o rolo acima dos calcanhares|Flexione os joelhos|Retorne lentamente"],["panturrilha em pé","-qsRtp_PbBM",0,"Panturrilhas","Apoie a parte da frente dos pés|Eleve os calcanhares sem quicar|Desça controlando"],["supino inclinado na máquina","h7alFPe0SJU",557,"Peitoral superior","Ajuste as alças na linha do peito|Empurre mantendo costas apoiadas|Retorne controlando"],["crucifixo na máquina","h7alFPe0SJU",1061,"Peitoral","Alças na altura do peito|Aproxime os braços à frente|Retorne lentamente"],["remada articulada","h7alFPe0SJU",112,"Costas","Ajuste o assento|Puxe as alças em direção ao tronco|Retorne com controle"],["puxada neutra","h7alFPe0SJU",2569,"Costas e bíceps","Use pegador neutro|Puxe em direção ao peito|Suba controlando"],["desenvolvimento máquina","h7alFPe0SJU",78,"Ombros e tríceps","Alças na altura dos ombros|Empurre sem arquear a lombar|Desça lentamente"],["face pull","h7alFPe0SJU",2120,"Deltoide posterior e trapézio","Polia na altura do rosto|Puxe a corda em direção à testa|Retorne devagar"],["rosca martelo","h7alFPe0SJU",1622,"Bíceps e braquial","Palmas voltadas uma para a outra|Flexione sem girar os punhos|Desça lentamente"],["tríceps na polia","h7alFPe0SJU",2719,"Tríceps","Cotovelos junto ao corpo|Estenda os cotovelos|Retorne lentamente"],["terra romeno","h7alFPe0SJU",2073,"Posteriores e glúteos","Leve o quadril para trás|Mantenha coluna neutra e carga perto das pernas|Estenda o quadril para subir"],["elevação pélvica","h7alFPe0SJU",485,"Glúteos","Escápulas apoiadas no banco|Eleve o quadril|Contraia glúteos sem hiperestender a lombar"],["cadeira abdutora","h7alFPe0SJU",1168,"Glúteo médio e mínimo","Ajuste o assento|Abra os joelhos contra a resistência|Retorne devagar"],["panturrilha sentada","h7alFPe0SJU",1932,"Sóleo e panturrilhas","Apoie a parte da frente dos pés|Eleve os calcanhares|Desça lentamente"],["rosca scott","h7alFPe0SJU",1967,"Bíceps","Apoie os braços no banco|Flexione os cotovelos|Desça controlando"],["tríceps francês na polia","h7alFPe0SJU",346,"Tríceps","Segure a corda acima da cabeça|Estenda os cotovelos|Flexione lentamente"],["rosca no cabo","h7alFPe0SJU",2824,"Bíceps","Fique de frente para a polia baixa|Flexione os cotovelos|Retorne lentamente"],["prancha","pSHjTRCQxIw",0,"Abdômen e estabilizadores","Apoie antebraços e pés|Alinhe cabeça, tronco e quadril|Contraia abdômen e glúteos"],["abdominal na máquina","h7alFPe0SJU",373,"Reto abdominal","Mantenha quadril apoiado|Flexione o tronco|Retorne devagar"],["esteira","h7alFPe0SJU",3393,"Sistema cardiovascular e pernas","Comece leve|Aumente até intensidade moderada|Reduza o ritmo no final"],["bicicleta","h7alFPe0SJU",3453,"Sistema cardiovascular e pernas","Ajuste o banco|Pedale em ritmo confortável|Reduza a intensidade no final"],["elíptico","h7alFPe0SJU",3485,"Sistema cardiovascular e pernas","Apoie os pés por completo|Mantenha postura ereta|Diminua o ritmo antes de descer"]];
function parseWorkoutExercises(workout){
 const lines=String(workout.description||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),out=[];
 for(const line of lines){
  const m=line.match(/^(.+?)\s*[—-]\s*(\d+)\s*[×x]\s*(.+)$/i);
  const c=line.match(/^(.+?)\s*[—-]\s*(\d+\s*[–-]\s*\d+\s*min.*)$/i);
  if(m)out.push({name:m[1].trim(),dose:m[2]+' séries · '+m[3].trim()});
  else if(c)out.push({name:c[1].trim(),dose:c[2].trim()});
 }
 return out;
}
function exerciseKey(w,i){return 'fitness-exercises:'+currentUser.id+':'+w.id+':'+String(w.log_date||today()).slice(0,10)+':'+i;}
function exerciseDone(w,i){return localStorage.getItem(exerciseKey(w,i))==='1';}
function openWorkout(id){const w=workouts.find(x=>String(x.id)===String(id));if(!w){toast('Treino não encontrado. Atualize a página e tente novamente.');return;}renderWorkoutDetail(w);const dialog=$('exerciseDialog');if(!dialog.open)dialog.showModal();}
function renderWorkoutDetail(w){
 const items=parseWorkoutExercises(w),done=items.filter((x,i)=>exerciseDone(w,i)).length;
 $('exerciseDialogTitle').textContent=w.name;
 $('exerciseDialogSubtitle').textContent=done+' de '+items.length+' exercícios concluídos';
 $('exerciseProgressText').textContent=(items.length?Math.round(done/items.length*100):0)+'% concluído';
 $('exerciseProgress').style.width=(items.length?done/items.length*100:0)+'%';
 $('exerciseList').innerHTML=items.map((item,i)=>{
  const v=EXERCISE_VIDEO_LIBRARY.find(x=>item.name.toLocaleLowerCase('pt-BR').includes(x[0]));
  const checked=exerciseDone(w,i),steps=v?v[4].split('|'):['Ajuste o equipamento e mantenha posição estável','Execute o movimento sem impulso','Use amplitude confortável e respire continuamente','Retorne lentamente à posição inicial'];
  const video=v?'https://www.youtube-nocookie.com/embed/'+v[1]+'?start='+v[2]+'&rel=0':'';
  return '<article class="exercise-card '+(checked?'is-done':'')+'"><label class="exercise-check"><input type="checkbox" data-action="exercise-toggle" data-workout="'+esc(w.id)+'" data-index="'+i+'" '+(checked?'checked':'')+'><span class="exercise-checkmark"></span><span>'+(checked?'Concluído':'Marcar como feito')+'</span></label><div class="exercise-title-row"><div><h4>'+(i+1)+'. '+esc(item.name)+'</h4><p>'+esc(item.dose)+'</p></div></div><p class="exercise-muscles"><strong>Músculos trabalhados:</strong> '+esc(v?v[3]:'Grupo muscular principal do exercício')+'</p>'+(video?'<div class="exercise-video"><iframe src="'+video+'" title="Demonstração de '+esc(item.name)+'" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><a class="video-link" href="https://www.youtube.com/watch?v='+v[1]+'&t='+v[2]+'s" target="_blank" rel="noopener">Abrir no YouTube ↗</a>':'<p class="tiny muted">Vídeo específico não associado.</p>')+'<div class="exercise-instructions"><strong>Como executar</strong><ol>'+steps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></div><p class="exercise-safety">Use uma carga que permita manter a técnica. Interrompa se sentir dor aguda.</p></article>';
 }).join('')||'<p class="empty-state">Não encontrei exercícios com séries e repetições neste treino.</p>';
}
async function toggleExercise(id,index){
 const w=workouts.find(x=>String(x.id)===String(id));if(!w)return;
 const key=exerciseKey(w,index),next=localStorage.getItem(key)!=='1';
 if(next)localStorage.setItem(key,'1');else localStorage.removeItem(key);
 const items=parseWorkoutExercises(w),all=items.length>0&&items.every((x,i)=>exerciseDone(w,i));
 if(Boolean(w.completed)!==all){
  const result=await supabaseClient.from('workouts').update({completed:all}).eq('id',w.id).eq('user_id',currentUser.id);
  if(result.error)toast('Não foi possível sincronizar o treino.');else w.completed=all;
 }
 renderWorkoutDetail(w);render();
}

function compact(x,type){return `<div class="compact-row"><div><strong>${esc(x.name)}</strong><small>${esc(type==='meal'?(x.meal_time||'Sem horário'):(x.schedule||'Treino'))}</small></div><button class="check-dot ${x.completed?'done':''}" data-action="toggle" data-type="${type}" data-id="${x.id}" aria-label="Marcar como concluído">${x.completed?'✓':''}</button></div>`}
function record(x,type){return `<article class="record-card"><button class="check-dot ${x.completed?'done':''}" data-action="toggle" data-type="${type}" data-id="${x.id}" aria-label="Marcar refeição como concluída">${x.completed?'✓':''}</button><div class="record-main"><div class="record-top"><h4>${esc(x.name)}</h4>${type==='meal'?'':`<span class="record-time">${esc(x.schedule||'Treino')}</span>`}${x.completed?'<span class="done-label">Concluído</span>':''}</div><p class="record-description">${esc(x.description||'Sem detalhes cadastrados.')}</p>${type==='meal'?'':`<div class="record-actions"><button class="small-btn primary" data-action="open-workout" data-id="${x.id}">Ver exercícios e vídeos</button><button class="small-btn" data-action="edit" data-type="${type}" data-id="${x.id}">Editar</button><button class="small-btn danger" data-action="delete" data-type="${type}" data-id="${x.id}">Excluir</button></div>`}</div></article>`}
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
  const changes=type==='meal'?{completed:!item.completed,log_date:today()}:{completed:!item.completed};
  const {error}=await supabaseClient.from(table).update(changes).eq('id',id).eq('user_id',currentUser.id);
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
  if(a.dataset.action==='exercise-toggle')await toggleExercise(a.dataset.workout,Number(a.dataset.index));
  if(a.dataset.action==='edit')editItem(a.dataset.type,a.dataset.id);
  if(a.dataset.action==='delete'&&confirm('Excluir este registro?'))await deleteItem(a.dataset.type,a.dataset.id);
  if(a.dataset.action==='delete-photo')await deletePhoto(a.dataset.id,a.dataset.path);
});
$('loginBtn').onclick=()=>auth('login');$('signupBtn').onclick=()=>auth('signup');
$('logoutBtn').onclick=async()=>{await supabaseClient.auth.signOut();showAuth('Você saiu da sua conta.')};

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