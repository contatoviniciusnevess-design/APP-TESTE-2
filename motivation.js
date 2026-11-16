/* Recursos de motivação e lembretes locais do Meu Diário Fitness.
   Nesta etapa, os lembretes são disparados enquanto o app está aberto.
   Notificações com o app fechado exigem Web Push, configurado em etapa posterior. */
(() => {
  const KEY='fitness-extras-v1';
  const quotes=[
    ['Seu progresso começa hoje.','Você não precisa fazer tudo perfeitamente. Só precisa dar o próximo passo.'],
    ['A constância transforma.','Um treino de cada vez, uma refeição de cada vez. Continue construindo sua rotina.'],
    ['Respeite seu ritmo.','Comparar sua caminhada com a de outra pessoa não ajuda. Valorize sua própria evolução.'],
    ['Você é capaz de continuar.','Dias difíceis também fazem parte do processo. Recomeçar é uma forma de avançar.'],
    ['Pequenas escolhas importam.','Cada atitude positiva é mais uma prova de compromisso com seus objetivos.'],
    ['Não desista de você.','O resultado é construído também nos dias em que a motivação parece pequena.'],
    ['Celebre suas conquistas.','Reconheça o esforço que você já fez. Sua evolução merece ser valorizada.']
  ];
  let timer=null, firedToday={};
  const $=id=>document.getElementById(id);
  const defaults={dailyMotivation:true,mealReminder:false,mealTime:'12:00',workoutReminder:false,workoutTime:'18:00'};
  const read=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}};
  const save=data=>localStorage.setItem(KEY,JSON.stringify(data));
  const today=()=>new Date().toLocaleDateString('en-CA');
  function showDaily(){
    const data=read();
    if(!data.dailyMotivation||localStorage.getItem(KEY+'-shown')===today())return;
    const quote=quotes[Math.floor(Math.random()*quotes.length)];
    $('motivationTitle').textContent=quote[0];$('motivationText').textContent=quote[1];
    $('motivationDialog').showModal();
    localStorage.setItem(KEY+'-shown',today());
  }
  function notify(title,body){
    if('Notification' in window && Notification.permission==='granted'){
      try{new Notification(title,{body,icon:'assets/icon.svg',tag:title+'-'+today()})}catch(e){console.warn(e)}
    }else if(window.toast){window.toast(body)}
    else alert(body);
  }
  function checkReminders(){
    const data=read(),now=new Date(),hhmm=[String(now.getHours()).padStart(2,'0'),String(now.getMinutes()).padStart(2,'0')].join(':');
    for(const [kind,enabled,time,title,body] of [
      ['meal',data.mealReminder,data.mealTime,'Hora de cuidar da alimentação','Confira seu planejamento alimentar no Meu Diário Fitness.'],
      ['workout',data.workoutReminder,data.workoutTime,'Hora de se movimentar','Seu treino está esperando por você. Respeite seu ritmo e comece!']
    ]){
      const stamp=today()+'-'+kind+'-'+time;
      if(enabled&&time===hhmm&&firedToday[kind]!==stamp){firedToday[kind]=stamp;notify(title,body)}
    }
  }
  function openSettings(){
    const d=read();
    $('dailyMotivationToggle').checked=d.dailyMotivation;
    $('mealReminderToggle').checked=d.mealReminder;
    $('mealReminderTime').value=d.mealTime;
    $('workoutReminderToggle').checked=d.workoutReminder;
    $('workoutReminderTime').value=d.workoutTime;
    $('notificationStatus').textContent=('Notification' in window)?'Permissão de notificações: '+Notification.permission:'Este navegador não oferece notificações.';
    $('extrasDialog').showModal();
  }
  window.initFitnessExtras=()=>{
    if(!$('extrasBtn')||$('extrasBtn').dataset.ready)return;
    $('extrasBtn').dataset.ready='1';
    $('extrasBtn').addEventListener('click',openSettings);
    $('motivationClose').addEventListener('click',()=>$('motivationDialog').close());
    $('saveExtrasBtn').addEventListener('click',()=>{
      save({
        dailyMotivation:$('dailyMotivationToggle').checked,
        mealReminder:$('mealReminderToggle').checked,
        mealTime:$('mealReminderTime').value||'12:00',
        workoutReminder:$('workoutReminderToggle').checked,
        workoutTime:$('workoutReminderTime').value||'18:00'
      });
      $('extrasDialog').close();
      if(window.toast)window.toast('Preferências salvas neste dispositivo.');
    });
    $('notificationPermissionBtn').addEventListener('click',async()=>{
      if(!('Notification' in window)){$('notificationStatus').textContent='Notificações não são suportadas neste navegador.';return}
      try{const permission=await Notification.requestPermission();$('notificationStatus').textContent='Permissão de notificações: '+permission}
      catch{$('notificationStatus').textContent='Não foi possível solicitar a permissão.'}
    });
    if(timer)clearInterval(timer);
    timer=setInterval(checkReminders,15000);
    showDaily();
  };
})();