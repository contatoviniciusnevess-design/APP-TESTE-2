/* Motivação e lembretes do Meu Diário Fitness.
   Os avisos locais são processados enquanto o app está aberto.
   A próxima etapa pode adicionar Web Push para entrega com o app fechado. */
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
  const $=id=>document.getElementById(id);
  const defaults={dailyMotivation:true,mealReminder:false,workoutReminder:false,workoutTime:'18:00'};
  const read=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}};
  const save=data=>localStorage.setItem(KEY,JSON.stringify(data));
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  let firedToday={};
  function showDaily(){
    const data=read();
    if(!data.dailyMotivation||localStorage.getItem(KEY+'-shown')===today())return;
    const quote=quotes[Math.floor(Math.random()*quotes.length)];
    $('motivationTitle').textContent=quote[0];$('motivationText').textContent=quote[1];
    $('motivationDialog').showModal();localStorage.setItem(KEY+'-shown',today());
  }
  async function notify(title,body,tag){
    if(!('Notification' in window)||Notification.permission!=='granted'){
      if(typeof window.toast==='function')window.toast(body);
      return;
    }
    try{
      if('serviceWorker' in navigator){
        const registration=await navigator.serviceWorker.ready;
        await registration.showNotification(title,{body,icon:'assets/icon.svg',tag,renotify:false});
      }else new Notification(title,{body,tag});
    }catch(error){console.warn('Não foi possível exibir a notificação:',error);if(typeof window.toast==='function')window.toast(body)}
  }
  function checkReminders(){
    const data=read(),now=new Date(),hhmm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const schedule=typeof window.getFitnessSchedule==='function'?window.getFitnessSchedule():{meals:[],workouts:[]};
    if(data.mealReminder){
      (schedule.meals||[]).filter(m=>m.meal_time&&!m.completed).forEach(meal=>{
        const tag=today()+'-meal-'+meal.id+'-'+meal.meal_time;
        if(meal.meal_time===hhmm&&firedToday[tag]!==true){firedToday[tag]=true;notify('Hora da refeição: '+meal.name,'Confira os alimentos e orientações cadastrados no seu plano.',tag)}
      });
    }
    if(data.workoutReminder&&data.workoutTime===hhmm){
      const tag=today()+'-workout-'+data.workoutTime;
      if(firedToday[tag]!==true){firedToday[tag]=true;notify('Hora do seu treino','Seu treino está esperando por você. Respeite seu ritmo e comece!',tag)}
    }
  }
  function openSettings(){
    const d=read();
    $('dailyMotivationToggle').checked=d.dailyMotivation;
    $('mealReminderToggle').checked=d.mealReminder;
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
    $('saveExtrasBtn').addEventListener('click',async()=>{
      const preferences={dailyMotivation:$('dailyMotivationToggle').checked,mealReminder:$('mealReminderToggle').checked,workoutReminder:$('workoutReminderToggle').checked,workoutTime:$('workoutReminderTime').value||'18:00'};
      save(preferences);
      if(window.saveFitnessPushPreferences){
        const result=await window.saveFitnessPushPreferences(preferences);
        if(!result.ok){$('notificationStatus').textContent='Preferências locais salvas, mas houve um erro ao sincronizar: '+result.message;return;}
      }
      $('extrasDialog').close();
      if(typeof window.toast==='function')window.toast('Preferências salvas na sua conta.');
    });
    $('notificationPermissionBtn').onclick=async()=>{
      const status=$('notificationStatus'),button=$('notificationPermissionBtn');
      button.disabled=true;
      status.textContent='Iniciando ativação das notificações...';
      try{
        if(!('Notification' in window)){
          status.textContent='Este navegador não oferece suporte à API de notificações.';
          return;
        }
        if(!('serviceWorker' in navigator)){
          status.textContent='Este navegador não oferece suporte a Service Worker.';
          return;
        }
        if(!('PushManager' in window)){
          status.textContent='Este modo do iPhone não oferece suporte a Web Push. Abra o app pelo ícone da Tela de Início.';
          return;
        }
        let permission=Notification.permission;
        if(permission==='default') permission=await Notification.requestPermission();
        status.textContent='Permissão do iPhone: '+permission+'. Preparando o registro do aparelho...';
        if(permission!=='granted'){
          status.textContent='As notificações não foram autorizadas. Permissão atual: '+permission+'. Confira Ajustes do iPhone.';
          return;
        }
        if(typeof window.enableFitnessPush!=='function'){
          status.textContent='O módulo de notificações não foi carregado. Feche e abra novamente o aplicativo.';
          return;
        }
        const result=await window.enableFitnessPush();
        status.textContent=result&&result.ok
          ?'Notificações ativadas neste dispositivo. O aparelho foi registrado no sistema.'
          :'Falha ao registrar o aparelho: '+(result&&result.message?result.message:'resposta inesperada');
      }catch(error){
        console.error('Falha no botão Ativar notificações:',error);
        status.textContent='Erro ao ativar: '+(error&&error.message?error.message:String(error));
      }finally{
        button.disabled=false;
      }
    };
    window.setInterval(checkReminders,15000);
    showDaily();
  };
})();