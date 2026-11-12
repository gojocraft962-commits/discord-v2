const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const messagesEl=$("#messages"),input=$("#messageInput");
let apiBase=localStorage.getItem("apex-api-url")||"";
let token=localStorage.getItem("apex-token")||"";
let username=localStorage.getItem("apex-user")||"Gojo";
let socket=null,activeChannel="geral",connected=false;
let localMessages=JSON.parse(localStorage.getItem("apex-messages")||"[]");
let typingUsers=new Map();
let typingTimer=null;

const channelTopics={geral:"Um lugar para conversar e jogar.",anuncios:"Avisos importantes da comunidade.",memes:"Só memes e zoeira.",ajuda:"Tire dúvidas e peça ajuda.",lobby:"Sala de voz geral.",minecraft:"Jogando juntos no Minecraft."};

function toast(t){const e=$("#toast");if(!e)return;e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2800)}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&","<":"<",">":">",'"':""","'":"&#39;"}[c]))}

function setConnectionStatus(state){
  connected=state==="online";
  const el=$("#connStatus");
  if(!el)return;
  el.className="conn-status "+state;
  el.textContent=state==="online"?"● Online":state==="connecting"?"● Conectando…":"● Offline (local)";
}

function drawMessage(m){
  const welcome=messagesEl.querySelector(".welcome");
  if(welcome)welcome.remove();
  const a=document.createElement("article");
  a.className="message";
  const av=document.createElement("div");
  const isBot=m.username==="Apex Hub";
  av.className="avatar "+(isBot?"bot":"me");
  av.textContent=(m.username||"?").slice(0,1).toUpperCase();
  const body=document.createElement("div"),meta=document.createElement("div");
  meta.className="meta";
  const name=document.createElement("b");
  name.textContent=m.username||"Usuário";
  if(isBot){const tag=document.createElement("span");tag.className="tag";tag.textContent="BOT";meta.append(name,tag)}else meta.append(name);
  const time=document.createElement("time");
  const d=m.createdAt?new Date(m.createdAt):new Date(m.at||Date.now());
  time.textContent=d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  meta.append(time);
  const p=document.createElement("p");
  p.textContent=m.body||m.text||"";
  body.append(meta,p);
  a.append(av,body);
  messagesEl.append(a);
  messagesEl.scrollTop=messagesEl.scrollHeight;
}

function setUser(name){
  username=name;
  localStorage.setItem("apex-user",name);
  const initial=name.slice(0,1).toUpperCase();
  ["#userName","#memberMeName"].forEach(sel=>{const el=$(sel);if(el)el.textContent=name});
  ["#userAvatar","#memberMeAvatar"].forEach(sel=>{const el=$(sel);if(el)el.textContent=initial});
}

function joinChannel(name){
  activeChannel=name;
  $("#channelName").textContent=name;
  const w=$("#welcomeChannel");if(w)w.textContent=name;
  $("#messageInput").placeholder="Conversar em #"+name;
  const topic=channelTopics[name]||"Canal da comunidade.";
  const topicEl=$("#channelTopic");if(topicEl)topicEl.textContent=topic;
  typingUsers.clear();
  updateTypingUI();
  if(socket?.connected)socket.emit("channel:join",name);
}

function renderLocal(){
  messagesEl.innerHTML="";
  const welcome=document.createElement("div");
  welcome.className="welcome";
  welcome.innerHTML=`<div class="welcome-icon">#</div><h2>Bem-vindo a #<span id="welcomeChannel">${safe(activeChannel)}</span>!</h2><p>Este é o começo do canal. Manda a primeira mensagem!</p>`;
  messagesEl.append(welcome);
  localMessages.filter(m=>(m.channel||"geral")===activeChannel).forEach(drawMessage);
}

function updatePresence(users){
  const list=users||[];
  const onlineCount=list.length;
  const countEl=$("#onlineCount");
  const membersCountEl=$("#onlineMembersCount");
  if(countEl)countEl.textContent=String(Math.max(onlineCount,1));
  if(membersCountEl)membersCountEl.textContent=String(Math.max(onlineCount,1));
}

function updateTypingUI(){
  let bar=$("#typingBar");
  if(!bar){
    bar=document.createElement("div");
    bar.id="typingBar";
    bar.className="typing-bar";
    const form=$("#messageForm");
    if(form)form.parentNode.insertBefore(bar,form);
  }
  const names=[...typingUsers.values()].map(u=>u.username);
  if(!names.length){bar.textContent="";bar.style.display="none";return}
  bar.style.display="block";
  if(names.length===1)bar.textContent=names[0]+" está digitando…";
  else if(names.length===2)bar.textContent=names[0]+" e "+names[1]+" estão digitando…";
  else bar.textContent=names.length+" pessoas estão digitando…";
}

function emitTyping(){
  if(!socket?.connected)return;
  socket.emit("typing:start",{channel:activeChannel});
  clearTimeout(typingTimer);
  typingTimer=setTimeout(()=>{
    if(socket?.connected)socket.emit("typing:stop",{channel:activeChannel});
  },1500);
}

function connectSocket(){
  if(!apiBase){toast("Configure o endereço HTTPS do servidor para sincronizar.");setConnectionStatus("offline");return}
  setConnectionStatus("connecting");
  if(!window.io){
    const s=document.createElement("script");
    s.src=apiBase.replace(/\/$/,"")+"/socket.io/socket.io.js";
    s.onload=()=>startSocket();
    s.onerror=()=>{toast("Não foi possível carregar Socket.IO do servidor.");setConnectionStatus("offline")};
    document.head.append(s);
  }else startSocket();
}

function startSocket(){
  if(socket){try{socket.disconnect()}catch{}}
  socket=io(apiBase,{
    auth:{token},
    transports:["websocket","polling"],
    reconnection:true,
    reconnectionAttempts:10,
    reconnectionDelay:1000
  });

  socket.on("connect",()=>{
    setConnectionStatus("online");
    toast("Chat em tempo real conectado");
    socket.emit("channel:join",activeChannel);
  });
  socket.on("disconnect",()=>{
    setConnectionStatus("offline");
    toast("Desconectado — mensagens locais");
  });
  socket.on("connect_error",()=>{
    setConnectionStatus("offline");
    toast("Falha na conexão com o servidor");
  });
  socket.on("reconnect",()=>{
    setConnectionStatus("online");
    socket.emit("channel:join",activeChannel);
  });
  socket.on("connection:ready",()=>{});
  socket.on("channel:history",list=>{
    messagesEl.innerHTML="";
    if(!list?.length){renderLocal();return}
    list.forEach(drawMessage);
  });
  socket.on("message:new",m=>{
    if(m.channel===activeChannel)drawMessage(m);
  });
  socket.on("presence:update",payload=>{
    if(payload.channel===activeChannel)updatePresence(payload.users);
  });
  socket.on("typing:start",payload=>{
    if(payload.channel!==activeChannel)return;
    if(payload.username===username)return;
    clearTimeout(typingUsers.get(payload.userId)?.timeout);
    const timeout=setTimeout(()=>{
      typingUsers.delete(payload.userId);
      updateTypingUI();
    },3000);
    typingUsers.set(payload.userId,{username:payload.username,timeout});
    updateTypingUI();
  });
  socket.on("typing:stop",payload=>{
    if(payload.channel!==activeChannel)return;
    const t=typingUsers.get(payload.userId);
    if(t)clearTimeout(t.timeout);
    typingUsers.delete(payload.userId);
    updateTypingUI();
  });
}

function authModal(){
  if($(".auth-overlay"))return;
  const wrap=document.createElement("div");
  wrap.className="auth-overlay";
  wrap.innerHTML=`<div class="auth-modal"><h2>Bem-vindo de volta!</h2><p class="subtitle">Conecte-se para chat em tempo real</p><label>URL da API</label><input id="apiUrl" value="${safe(apiBase)}" placeholder="https://seu-servidor.com"><label>Nome de usuário</label><input id="authUser" value="${safe(username)}" placeholder="seu_nome" maxlength="20"><label>Senha</label><input id="authPass" type="password" placeholder="••••••••" maxlength="128"><div class="actions"><button class="btn-primary" id="loginBtn">Entrar</button><button class="btn-secondary" id="registerBtn">Criar conta</button></div><p class="hint">Sem servidor, as mensagens ficam só neste dispositivo. Com servidor HTTPS, o chat sincroniza em tempo real.</p></div>`;
  document.body.append(wrap);
  wrap.addEventListener("click",e=>{if(e.target===wrap)wrap.remove()});
  async function auth(mode){
    const url=$("#apiUrl").value.trim().replace(/\/$/,"");
    const user=$("#authUser").value.trim();
    const pass=$("#authPass").value;
    if(!url||!user||pass.length<8){toast("Preencha URL, usuário e senha (mín. 8 caracteres).");return}
    try{
      const res=await fetch(url+"/auth/"+mode,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:user,password:pass})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Erro");
      apiBase=url;token=data.token;
      localStorage.setItem("apex-api-url",apiBase);
      localStorage.setItem("apex-token",token);
      setUser(data.user.username);
      wrap.remove();
      connectSocket();
      toast(mode==="login"?"Login realizado!":"Conta criada!");
    }catch(e){toast(e.message||"Não foi possível conectar.")}
  }
  $("#loginBtn").onclick=()=>auth("login");
  $("#registerBtn").onclick=()=>auth("register");
}

function selectChannel(btn){
  $$(".channel").forEach(c=>c.classList.remove("active"));
  btn.classList.add("active");
  const name=btn.dataset.channel;
  joinChannel(name);
  if(!socket?.connected)renderLocal();
}
$$(".channel").forEach(el=>{el.onclick=()=>selectChannel(el)});
$$(".category-toggle").forEach(btn=>{btn.onclick=()=>btn.closest(".category").classList.toggle("collapsed")});

$("#messageForm").onsubmit=e=>{
  e.preventDefault();
  const body=input.value.trim();
  if(!body)return;
  if(socket?.connected){
    socket.emit("message:send",{channel:activeChannel,body});
    socket.emit("typing:stop",{channel:activeChannel});
  }else{
    const m={username,body,at:Date.now(),channel:activeChannel};
    localMessages.push(m);
    localStorage.setItem("apex-messages",JSON.stringify(localMessages.slice(-300)));
    drawMessage(m);
    toast("Salvo apenas neste dispositivo — entre para sincronizar em tempo real.");
  }
  input.value="";
};

input.addEventListener("input",()=>{if(input.value.trim())emitTyping()});

$("#emojiBtn").onclick=()=>{input.value+=" 😊";input.focus();emitTyping()};
$("#attachBtn").onclick=()=>toast("Envio de arquivos será adicionado em breve.");
$("#accountBtn").onclick=authModal;
$("#guildMenu").onclick=authModal;
$("#settingsBtn").onclick=authModal;
$("#addServer").onclick=()=>toast("Criação de servidores em breve.");
$("#muteBtn").onclick=()=>toast("Entre em uma chamada para usar o microfone.");
$("#deafenBtn").onclick=()=>toast("Entre em uma chamada para ensurdecer.");
$("#voiceBtn").onclick=async()=>{
  if(!navigator.mediaDevices?.getUserMedia){toast("Voz requer navegador compatível e HTTPS.");return}
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());$("#voiceStatus").textContent="Microfone autorizado; chamada ainda não implementada";toast("Microfone autorizado neste dispositivo.")}
  catch{toast("Permita o acesso ao microfone.")}
};
$("#toggleMembers").onclick=()=>$("#membersPanel").classList.toggle("show-mobile");
$("#search").oninput=e=>{const q=e.target.value.toLowerCase();$$(".channel").forEach(c=>{c.style.display=c.textContent.toLowerCase().includes(q)?"":"none"})};

(function(){
  const actions=$(".header-actions");
  if(actions && !$("#connStatus")){
    const pill=document.createElement("div");
    pill.id="connStatus";
    pill.className="conn-status offline";
    pill.textContent="● Offline (local)";
    actions.prepend(pill);
  }
})();

setUser(username);
renderLocal();
setConnectionStatus(token&&apiBase?"connecting":"offline");
if(token&&apiBase)connectSocket();
