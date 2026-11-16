/* Registro de Web Push do Meu Diário Fitness.
   A chave pública VAPID pode ficar no cliente; a privada permanece no Supabase. */
(() => {
  const VAPID_PUBLIC_KEY='BMNDlIHxoQvnYicJBkl6zX5k6C3w17B0JItdCEYqV11gaVyX_Dyac3-mclVUHsVulog0U-osjrUUGo2PGA_a9zo';
  let client=null,user=null;
  function base64UrlToUint8Array(value){
    const padding='='.repeat((4-value.length%4)%4);
    const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64),output=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)output[i]=raw.charCodeAt(i);
    return output;
  }
  window.initFitnessPush=(activeUser,supabase)=>{
    user=activeUser;client=supabase;
    loadPreferences();
  };
  async function loadPreferences(){
    if(!client||!user)return;
    const {data,error}=await client.from('fitness_notification_preferences').select('*').eq('user_id',user.id).maybeSingle();
    if(error){console.warn('Preferências push não carregadas:',error);return;}
    if(data){
      const local=JSON.parse(localStorage.getItem('fitness-extras-v1')||'{}');
      local.dailyMotivation=data.motivation_enabled;
      local.mealReminder=data.meal_reminders;
      local.workoutReminder=data.workout_reminders;
      local.workoutTime=String(data.workout_time||'18:00').slice(0,5);
      localStorage.setItem('fitness-extras-v1',JSON.stringify({...local}));
    }
  }
  window.enableFitnessPush=async()=>{
    try{
      if(!client||!user)throw new Error('Entre na sua conta antes de ativar.');
      if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Este navegador não oferece suporte a notificações push.');
      const registration=await navigator.serviceWorker.ready;
      let subscription=await registration.pushManager.getSubscription();
      if(!subscription){
        subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(VAPID_PUBLIC_KEY)});
      }
      const json=subscription.toJSON();
      const {error}=await client.from('fitness_push_subscriptions').upsert({
        user_id:user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth,
        user_agent:navigator.userAgent,updated_at:new Date().toISOString()
      },{onConflict:'endpoint'});
      if(error)throw error;
      const pref=await client.from('fitness_notification_preferences').upsert({
        user_id:user.id,enabled:true,timezone:'America/Campo_Grande',updated_at:new Date().toISOString()
      },{onConflict:'user_id'});
      if(pref.error)throw pref.error;
      return {ok:true};
    }catch(error){console.error('Erro ao ativar Web Push:',error);return {ok:false,message:error.message||'erro desconhecido'};}
  };
  window.saveFitnessPushPreferences=async(settings)=>{
    try{
      if(!client||!user)throw new Error('Usuário não autenticado.');
      const {error}=await client.from('fitness_notification_preferences').upsert({
        user_id:user.id,
        enabled:Notification.permission==='granted',
        motivation_enabled:settings.dailyMotivation,
        meal_reminders:settings.mealReminder,
        workout_reminders:settings.workoutReminder,
        workout_time:settings.workoutTime,
        timezone:'America/Campo_Grande',
        updated_at:new Date().toISOString()
      },{onConflict:'user_id'});
      if(error)throw error;
      return {ok:true};
    }catch(error){console.error('Erro ao salvar preferências push:',error);return {ok:false,message:error.message||'erro desconhecido'};}
  };
})();