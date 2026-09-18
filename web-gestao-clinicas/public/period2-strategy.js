(()=>{'use strict';
const KEY='g12_period2_history_v1';
const CLINICS=[
['DIAMANTINA - MG[1031]','Diamantina','MG'],['DOM PEDRITO - RS[915]','Dom Pedrito','RS'],['GARCA - SP[470]','Garça','SP'],['GUAIRA - SP[1214]','Guaíra','SP'],['ILHOTA - SC[550]','Ilhota','SC'],['JARDIM - MS[368]','Jardim','MS'],['PONTA GROSSA - PR - UVARANAS[51]','Ponta Grossa - Uvaranas','PR'],['REGISTRO I - SP[1609]','Registro I','SP'],['RIO DO SUL - SC[27]','Rio do Sul','SC'],["SANTA BARBARA D\`OESTE - JARDIM EUROPA - SP[1658]","Santa Bárbara d'Oeste - Jardim Europa",'SP'],['SIDROLANDIA - MS[307]','Sidrolândia','MS'],['TAQUARITINGA - SP[1655]','Taquaritinga','SP']
].map((x,i)=>({id:i+1,name:x[0],city:x[1],state:x[2]}));
const q=(s,e=document)=>e.querySelector(s), qa=(s,e=document)=>[...e.querySelectorAll(s)];
let busy=false,last=null,lib={tess:false,pdf:false};
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\r/g,'').trim()}
function pt(v){if(v==null||v==='')return null;let s=String(v).replace(/R\$|\s/g,'').replace(/[^0-9,.-]/g,'');if(!s)return null;if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null}
function n(text,regs){for(const r of regs){const m=text.match(r);if(m){const v=pt(m[1]);if(v!=null)return v}}return null}
function p(text,regs){const v=n(text,regs);return v==null?null:v/100}
function money(v){return v==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function pct(v){return v==null?'—':(Number(v)*100).toFixed(0).replace('.',',')+'%'}
function num(v){return v==null?'—':Number(v).toLocaleString('pt-BR')}
function toast(m){const t=q('#toast');if(t){t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}}
function copy(t){navigator.clipboard?.writeText(t).then(()=>toast('Mensagem copiada')).catch(()=>toast('Não foi possível copiar automaticamente'))}
function appData(){try{return JSON.parse(localStorage.getItem('g12_data')||'{}')}catch{return {}}}
function history(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}}
function saveHistory(v){localStorage.setItem(KEY,JSON.stringify(v))}
const SESSION_KEY='g12_period2_session_v2';
function sessionStore(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'{}')}catch{return {}}}
function sessionKey(clinicId){return String(clinicId)+'|'+new Date().toISOString().slice(0,10)}
function loadSession(clinicId){const all=sessionStore();return all[sessionKey(clinicId)]||{clinicId:Number(clinicId),items:[],createdAt:new Date().toISOString()}}
function saveSession(sess){const all=sessionStore();all[sessionKey(sess.clinicId)]=sess;localStorage.setItem(SESSION_KEY,JSON.stringify(all))}
function clearSession(clinicId){const all=sessionStore();delete all[sessionKey(clinicId)];localStorage.setItem(SESSION_KEY,JSON.stringify(all))}
function upsertReportHistory(cl,item,ins){
 const h=history(),day=new Date().toISOString().slice(0,10);
 const rec={id:item.reportId,day,month:day.slice(0,7),clinicId:cl.id,clinicName:cl.name,createdAt:item.createdAt||new Date().toISOString(),report:{name:item.name,type:item.type,period:item.period,clinic:item.clinic,confidence:item.confidence},insight:ins||null,message:item.message||ins?.message||'',updatedAt:new Date().toISOString()};
 const ix=h.findIndex(x=>x.id===rec.id);if(ix>=0)h[ix]=rec;else h.unshift(rec);saveHistory(h)
}
function clinicById(id){return CLINICS.find(x=>x.id===Number(id))||CLINICS[0]}
function settings(){const s=appData().settings||{};return {acceptanceHealthy:Number(s.acceptanceHealthy??.8),ticketReference:Number(s.ticketReference??3419.85),conversionHealthy:Number(s.conversionHealthy??.3),orthoHealthy:.7}}
function period(text){const x=norm(text);const m=x.match(/Periodo\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*(?:-|a|ate)\s*(\d{2}\/\d{2}\/\d{4})/i);return m?m[1]+' a '+m[2]:''}
function clinicInText(text){const x=norm(text).toUpperCase();return CLINICS.find(c=>x.includes(norm(c.city).toUpperCase()))?.city||''}
function classify(text){
 const x=norm(text).toUpperCase();
 if(/QUANTIDADE DE COBRANCAS X QUANTIDADE COBRADAS|COBRANCAS:\s*\d+|COBRADO\(S\)/.test(x))return'collection_volume';
 if(/APROVEITAMENTO DO AGENTE DE COBRANCA|COBRANCAS EFETUADAS|PAGAMENTOS REALIZADOS/.test(x))return'collection_agent';
 if(/EFETIVADOS X INICIADOS|TRATAMENTOS EFETIVADOS|TRATAMENTOS INICIADOS/.test(x))return'started';
 if(/INDICACOES TRATAMENTO CLINICO|INDICACOES SOLICITADAS|INDICACOES ENVIADAS PELA RECEPCAO/.test(x))return'indications';
 if(/TICKET MEDIO - CLINICO GERAL|PRODUTIVIDADE PROFISSIONAL|PROCEDIMENTOS VENDIDOS/.test(x))return'ticket';
 if(/ORTODONTIA:|META DE PASTAS PAGAS|TOTAL DE AVALIACOES.*EFETIVADAS/.test(x))return'ortho';
 if(/INDICE DE ACEITACAO|META PACIENTES CADEIRAS/.test(x))return'acceptance';
 return'unknown';
}
function parse(text,name,confidence){
 const x=norm(text),type=classify(x),base={name,type,period:period(x),clinic:clinicInText(x),confidence,text:x};
 if(type==='acceptance')return{...base,acceptance:p(x,[/Indice de aceitacao[^\d]*(\d+[\d.,]*)%/i,/^(\d+[\d.,]*)%/m]),evaluations:n(x,[/Total de avaliacoes[^\d]*(\d+)/i]),effectivations:n(x,[/Efetivadas[^\d]*(\d+)/i]),goalMonthly:n(x,[/mensal[^\d]*(\d+)/i]),goalProp:n(x,[/proporcional[^\d]*(\d+)/i]),goalReached:p(x,[/Meta alcan[cç]ada[^\d]*(\d+[\d.,]*)%/i,/efetivados[^\d]*(\d+)\s*\((\d+[\d.,]*)%\)/i])};
 if(type==='ortho')return{...base,financial:n(x,[/Financeira[^\d]*([\d.]+,\d{2})/i]),proportionalFinancial:n(x,[/Proporcional[^\d]*([\d.]+,\d{2})/i]),received:n(x,[/Total recebido[^\d]*([\d.]+,\d{2})/i]),performance:p(x,[/Ortodontia[^\d]*(\d+[\d.,]*)%/i]),evaluations:n(x,[/Total de avaliacoes[^\d]*(\d+)/i]),effectivations:n(x,[/Efetivadas[^\d]*(\d+)/i]),acceptance:p(x,[/Aceitacao[^\d]*(\d+[\d.,]*)%/i]),folderGoal:n(x,[/Meta de pastas pagas[^\d]*(\d+)/i]),folderProp:n(x,[/Proporcional[^\d]*(\d+)\s*-\s*Pagas/i]),foldersPaid:n(x,[/Pagas[^\d]*(\d+)/i])};
 if(type==='started')return{...base,effectiveValue:n(x,[/Valor efetivado[^\d]*([\d.]+,\d{2})/i]),startedValue:n(x,[/Valor iniciado[^\d]*([\d.]+,\d{2})/i]),rate:p(x,[/(\d+[\d.,]*)%/i]),effectiveTreatments:n(x,[/Tratamentos efetivados[^\d]*(\d+)/i]),startedTreatments:n(x,[/Tratamentos iniciados[^\d]*(\d+)/i])};
 if(type==='indications')return{...base,requested:n(x,[/Indicacoes solicitadas[^\d]*(\d+)/i]),professional:n(x,[/Indicacoes realizadas pelo profissional[^\d]*(\d+)/i]),reception:n(x,[/Indicacoes enviadas pela recepcao[^\d]*(\d+)/i]),refused:n(x,[/Indicacoes recusadas[^\d]*(\d+)/i])};
 if(type==='collection_agent')return{...base,minimum:p(x,[/Indice minimo[^\d]*(\d+[\d.,]*)%/i]),rate:p(x,[/(\d+[\d.,]*)%/i]),charges:n(x,[/Cobrancas efetuadas[^\d]*(\d+)/i]),payments:n(x,[/Pagamentos realizados[^\d]*(\d+)/i])};
 if(type==='collection_volume')return{...base,minimum:p(x,[/Indice minimo[^\d]*(\d+[\d.,]*)%/i]),rate:p(x,[/(\d+[\d.,]*)%/i]),charges:n(x,[/Cobrancas[^\d]*(\d+)/i]),collected:n(x,[/Cobrado\(s\)[^\d]*(\d+)/i])};
 if(type==='ticket')return{...base,patients:n(x,[/Pacientes efetivados[^\d]*(\d+)/i]),procedures:n(x,[/Procedimentos vendidos[^\d]*(\d+)/i]),soldValue:n(x,[/Valor vendido[^\d]*([\d.]+,\d{2})/i])};
 return base;
}
function insight(item,cl){
 const s=settings(),m=appData().metrics?.[cl.id]||{},city=cl.city;
 if(item.type==='acceptance'){
   const a=item.acceptance??m.acceptance; if(a==null)return null;
   const gap=s.acceptanceHealthy-a;
   if(gap>0)return{level:'attention',title:'Aceitação · Clínico Geral',facts:[`Aceitação ${pct(a)}`,item.evaluations!=null?`${item.evaluations} avaliações`:null,item.effectivations!=null?`${item.effectivations} efetivações`:null,item.goalReached!=null?`meta proporcional em ${pct(item.goalReached)}`:null].filter(Boolean),message:`${city}: a aceitação está em ${pct(a)}, abaixo do saudável de ${pct(s.acceptanceHealthy)}. ${item.evaluations!=null&&item.effectivations!=null?`Foram ${item.evaluations} avaliações e ${item.effectivations} efetivações. `:''}O foco agora é aumentar o aproveitamento das avaliações e a efetivação, atuando nos pacientes ainda não convertidos.`};
   return{level:'good',title:'Aceitação · Clínico Geral',facts:[`Aceitação ${pct(a)}`],message:`${city}: aceitação em ${pct(a)}, dentro do saudável. O ponto é manter o padrão e sustentar o volume de avaliações para não perder ritmo de efetivação.`};
 }
 if(item.type==='ortho'){
   const a=item.acceptance,paid=item.foldersPaid,goal=item.folderGoal;
   let msg=`${city}: na Ortodontia`;
   if(paid!=null&&goal!=null)msg+=`, estamos com ${paid} pastas pagas de uma meta de ${goal} — faltam ${Math.max(0,goal-paid)}`;
   if(a!=null){msg+=`. A aceitação está em ${pct(a)}`;msg+=a<s.orthoHealthy?`, abaixo da referência de ${pct(s.orthoHealthy)}. Precisamos transformar melhor as avaliações em efetivações e reforçar indicação para Orto`:`, em nível saudável. Precisamos manter o aproveitamento`}
   return{level:a!=null&&a<s.orthoHealthy?'attention':'good',title:'Ortodontia',facts:[paid!=null?`${paid} pastas pagas`:null,goal!=null?`meta ${goal}`:null,a!=null?`aceitação ${pct(a)}`:null,item.performance!=null?`financeiro ${pct(item.performance)}`:null].filter(Boolean),message:msg+'.'};
 }
 if(item.type==='started'){
   if(item.effectiveTreatments==null||item.startedTreatments==null)return null;
   const pending=Math.max(0,item.effectiveTreatments-item.startedTreatments);
   const rate=item.rate??(item.effectiveTreatments?item.startedTreatments/item.effectiveTreatments:null);
   return{level:pending?'attention':'good',title:'Efetivados x iniciados',facts:[`${item.effectiveTreatments} efetivados`,`${item.startedTreatments} iniciados`,rate!=null?`${pct(rate)} iniciados`:null].filter(Boolean),message:pending?`${city}: tivemos ${item.effectiveTreatments} tratamentos efetivados e ${item.startedTreatments} iniciados. Ainda temos ${pending} sem início. Precisamos contatar esses pacientes e garantir o primeiro agendamento o quanto antes, priorizando início no mesmo dia ou em até 2 dias.`:`${city}: os tratamentos efetivados estão sendo iniciados sem pendência no período. Vamos manter esse fluxo para evitar perda entre venda e início clínico.`};
 }
 if(item.type==='indications'){
   const req=item.requested,rec=item.reception??0,pro=item.professional??0;
   if(req==null)return null;
   return{level:rec===0?'attention':'neutral',title:'Indicações',facts:[`${req} solicitadas`,`${pro} pelo profissional`,`${rec} pela recepção`],message:rec===0?`${city}: o relatório mostra ${req} indicações solicitadas e nenhuma enviada pela recepção. Precisamos reforçar a indicação de avaliações para Clínico Geral e Ortodontia no contato com o paciente, porque esse ponto alimenta novas avaliações e oportunidades de efetivação.`:`${city}: tivemos ${req} indicações solicitadas, sendo ${rec} trabalhadas pela recepção. Vamos aumentar esse aproveitamento e acompanhar quantas indicações viram avaliações agendadas.`};
 }
 if(item.type==='collection_agent'||item.type==='collection_volume'){
   const rate=item.rate,min=item.minimum;
   if(rate==null)return null;
   const ok=min==null?rate>=.65:rate>=min;
   const done=item.payments??item.collected,all=item.charges;
   return{level:ok?'good':'attention',title:'Cobrança',facts:[`índice ${pct(rate)}`,min!=null?`mínimo ${pct(min)}`:null,all!=null?`${all} cobranças`:null,done!=null?`${done} concluídas`:null].filter(Boolean),message:ok?`${city}: cobrança em ${pct(rate)}${min!=null?`, dentro do mínimo de ${pct(min)}`:''}. O resultado está saudável, mas precisamos manter o acompanhamento para não perder recebimentos e proteger o caixa.`:`${city}: cobrança em ${pct(rate)}${min!=null?`, abaixo do mínimo de ${pct(min)}`:''}. Precisamos aumentar o acompanhamento das pendências e a efetividade da cobrança para evitar impacto no caixa.`};
 }
 if(item.type==='ticket'){
   if(item.patients==null||item.procedures==null)return null;
   const procPer=item.patients?item.procedures/item.patients:null;
   const ticket=item.patients&&item.soldValue?item.soldValue/item.patients:(m.ticket_avg||null);
   const good=ticket!=null?ticket>=s.ticketReference:(procPer!=null&&procPer>=4);
   return{level:good?'good':'attention',title:'Ticket e produtividade',facts:[`${item.patients} pacientes efetivados`,`${item.procedures} procedimentos`,procPer!=null?`${procPer.toFixed(1).replace('.',',')} proc./paciente`:null,ticket!=null?`ticket estimado ${money(ticket)}`:null].filter(Boolean),message:good?`${city}: o ticket/produtividade está saudável. Foram ${item.procedures} procedimentos para ${item.patients} pacientes${procPer!=null?`, média de ${procPer.toFixed(1).replace('.',',')} por paciente`:''}. Vamos manter qualidade de plano e evitar procedimentos abaixo do valor para preservar o resultado.`:`${city}: precisamos atenção ao ticket. Foram ${item.procedures} procedimentos para ${item.patients} pacientes${procPer!=null?`, média de ${procPer.toFixed(1).replace('.',',')} por paciente`:''}. Vamos revisar composição dos planos e valores praticados para proteger o ticket médio.`};
 }
 return null;
}
async function loadScript(src,key){if(lib[key])return;await new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=j;document.head.appendChild(s)});lib[key]=true}
async function bitmap(file){if('createImageBitmap'in window)return createImageBitmap(file);return new Promise((r,j)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(u);r(img)};img.onerror=j;img.src=u})}
async function preprocess(file){const img=await bitmap(file),maxW=2400,scale=Math.min(2.2,Math.max(1,maxW/img.width)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,w,h);const im=x.getImageData(0,0,w,h),d=im.data;for(let i=0;i<d.length;i+=4){const y=.299*d[i]+.587*d[i+1]+.114*d[i+2],v=y<155?0:y>238?255:Math.max(0,Math.min(255,(y-126)*1.65+126));d[i]=d[i+1]=d[i+2]=v}x.putImageData(im,0,0);return new Promise(r=>c.toBlob(r,'image/png',.96))}
async function ocr(file){await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js','tess');const prepared=await preprocess(file);const st=q('#p2Status');const a=await Tesseract.recognize(prepared,'por',{logger:m=>{if(st&&m.status==='recognizing text')st.textContent=`Lendo ${file.name}… ${Math.round((m.progress||0)*100)}%`}});let best=a;if((a.data.confidence||0)<70){const b=await Tesseract.recognize(file,'por');if((b.data.confidence||0)>(a.data.confidence||0))best=b}return{text:best.data.text||'',confidence:Number(best.data.confidence||0)}}
async function captureScreenFile(){if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Este navegador não permite captura direta da tela. Use Colar tela copiada ou Upload.');const stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:false});try{const track=stream.getVideoTracks()[0],v=document.createElement('video');v.srcObject=stream;v.muted=true;await v.play();await new Promise(r=>setTimeout(r,250));const c=document.createElement('canvas');c.width=v.videoWidth||1920;c.height=v.videoHeight||1080;c.getContext('2d').drawImage(v,0,0,c.width,c.height);const b=await new Promise(r=>c.toBlob(r,'image/png',.96));return new File([b],`tela-relatorio-${Date.now()}.png`,{type:'image/png'})}finally{stream.getTracks().forEach(t=>t.stop())}}
async function clipboardImageFile(){if(!navigator.clipboard?.read)throw new Error('Leitura direta da área de transferência não é suportada aqui. Use Colar tela copiada + Ctrl+V.');const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(t=>t.startsWith('image/'));if(type){const blob=await item.getType(type);return new File([blob],`tela-copiada-${Date.now()}.png`,{type})}}throw new Error('Não encontrei imagem copiada na área de transferência.')}
async function read(file){if(file.type.startsWith('image/'))return[await ocr(file)];if(file.type==='application/pdf'){await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs').then(m=>window.__p2pdf=m);window.__p2pdf.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';const pdf=await window.__p2pdf.getDocument({data:await file.arrayBuffer()}).promise,out=[];for(let i=1;i<=Math.min(pdf.numPages,10);i++){const pg=await pdf.getPage(i),tc=await pg.getTextContent(),txt=tc.items.map(x=>x.str).join(' ');if(txt.length>120)out.push({text:txt,confidence:100});else{const vp=pg.getViewport({scale:2.2}),c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const b=await new Promise(r=>c.toBlob(r,'image/png'));out.push(await ocr(new File([b],file.name+'-'+i+'.png',{type:'image/png'})))}}return out}if(file.type.startsWith('text/')||/\.(txt|csv)$/i.test(file.name))return[{text:await file.text(),confidence:100}];throw new Error('Formato não suportado')}
function summary(items,cl){const insights=items.map(x=>insight(x,cl)).filter(Boolean);const seen=new Set();const unique=insights.filter(x=>{if(seen.has(x.title))return false;seen.add(x.title);return true});const attention=unique.filter(x=>x.level==='attention');const good=unique.filter(x=>x.level==='good');return{insights:unique,headline:attention.length?`Pontos prioritários: ${attention.map(x=>x.title).join(' · ')}`:(good.length?`Resultados saudáveis: ${good.map(x=>x.title).join(' · ')}`:'Não há dados suficientes para estratégia segura.')}}
function renderAnalysis(){
 const box=q('#p2Result');if(!box)return;if(!last)last=loadSession(Number(q('#p2Clinic')?.value||1));
 const cl=clinicById(last.clinicId),items=last.items||[];
 box.innerHTML=`<div class="p2-summary"><div><strong>${items.length?items.length+' relatório(s) analisado(s) hoje':'Nenhum relatório analisado ainda'}</strong><span>Envie um relatório por vez. Cada leitura gera sua própria análise e mensagem abaixo.</span></div>${items.length?'<button id="p2ClearSession" class="ghost danger">Limpar análise de hoje</button>':''}</div><div class="p2-insights">${items.map((item,i)=>{
   const ins=insight(item,cl);
   const msg=item.message??ins?.message??'';
   const title=ins?.title||'Relatório não classificado';
   const level=ins?.level||'neutral';
   const facts=ins?.facts||[];
   return `<div class="p2-insight ${level}" data-report-id="${esc(item.reportId)}"><div class="p2-insight-head"><div><span class="p2-tag">Relatório ${i+1} · ${esc(title)}</span><div class="p2-facts">${facts.map(f=>`<b>${esc(f)}</b>`).join('')}<b>${Math.round(item.confidence||0)}% leitura</b>${item.period?`<b>${esc(item.period)}</b>`:''}</div><small class="clinic-meta">${esc(item.name||'Imagem/relatório')}</small></div><div class="inline-actions"><button class="ghost" data-p2copy="${esc(item.reportId)}">Copiar texto</button><button class="ghost danger" data-p2remove="${esc(item.reportId)}">Excluir</button></div></div>${msg?`<textarea class="p2-message-edit" data-p2msg="${esc(item.reportId)}">${esc(msg)}</textarea><div class="p2-edit-actions"><span class="hint">Você pode editar antes de copiar. As alterações ficam no histórico.</span><button class="btn secondary" data-p2save="${esc(item.reportId)}">Salvar edição</button></div>`:'<div class="empty">Não foi possível criar uma mensagem segura para este relatório. Confira a leitura e tente uma imagem mais nítida ou cole os dados.</div>'}<details class="p2-audit"><summary>Dados reconhecidos deste relatório</summary><div class="p2-file"><strong>${esc(item.name)}</strong><span>${esc(item.type)}</span><em>${Math.round(item.confidence||0)}%</em><small>${esc(item.period||'período não lido')} · ${esc(item.clinic||'clínica não lida')}</small></div></details></div>`
 }).join('')||'<div class="empty">Adicione o primeiro relatório. Assim que terminar a leitura, a análise e a mensagem aparecem aqui embaixo.</div>'}</div>`;
 qa('[data-p2copy]').forEach(b=>b.onclick=()=>{const item=last.items.find(x=>x.reportId===b.dataset.p2copy);if(!item)return;const ta=q(`[data-p2msg="${b.dataset.p2copy}"]`);if(ta){item.message=ta.value.trim();item.updatedAt=new Date().toISOString();saveSession(last);upsertReportHistory(cl,item,insight(item,cl))}copy(item.message||insight(item,cl)?.message||'')});
 qa('[data-p2save]').forEach(b=>b.onclick=()=>{const item=last.items.find(x=>x.reportId===b.dataset.p2save);const ta=q(`[data-p2msg="${b.dataset.p2save}"]`);if(item&&ta){item.message=ta.value.trim();item.updatedAt=new Date().toISOString();saveSession(last);upsertReportHistory(cl,item,insight(item,cl));toast('Edição salva no histórico')}});
 qa('[data-p2remove]').forEach(b=>b.onclick=()=>{if(!confirm('Excluir este relatório da análise de hoje e do histórico?'))return;const id=b.dataset.p2remove;last.items=last.items.filter(x=>x.reportId!==id);saveSession(last);saveHistory(history().filter(x=>x.id!==id));renderAnalysis();renderHistory();toast('Relatório excluído')});
 q('#p2ClearSession')?.addEventListener('click',()=>{if(!confirm('Limpar todos os relatórios analisados hoje desta clínica? O histórico dos dias anteriores será mantido.'))return;const ids=new Set((last.items||[]).map(x=>x.reportId));saveHistory(history().filter(x=>!ids.has(x.id)));clearSession(cl.id);last=loadSession(cl.id);renderAnalysis();renderHistory();toast('Análise de hoje limpa')});
}
function renderHistory(){
 const box=q('#p2History');if(!box)return;const clId=Number(q('#p2Clinic')?.value||1),h=history().filter(x=>x.clinicId===clId).slice(0,60);
 const groups=h.reduce((acc,x)=>{(acc[x.day]??=[]).push(x);return acc},{});
 box.innerHTML=`<div class="section-head"><div><h3>Histórico do segundo retorno</h3><span class="clinic-meta">Cada relatório e cada mensagem ficam registrados por dia.</span></div></div>${Object.entries(groups).map(([day,recs])=>`<div class="card p2-history-row"><div class="section-head"><strong>${new Date(day+'T12:00:00').toLocaleDateString('pt-BR')}</strong><span class="clinic-meta">${recs.length} relatório(s)</span></div>${recs.map(x=>`<div class="p2-mini"><div class="section-head"><b>${esc(x.insight?.title||x.report?.type||'Relatório')}</b><button class="ghost danger" data-p2del="${esc(x.id)}">Excluir</button></div><span>${esc(x.message||'Sem mensagem registrada')}</span><small class="clinic-meta">${esc(x.report?.name||'')} ${x.report?.period?'· '+esc(x.report.period):''}</small></div>`).join('')}</div>`).join('')||'<div class="empty">Nenhum segundo retorno salvo para esta clínica.</div>'}`;
 qa('[data-p2del]').forEach(b=>b.onclick=()=>{if(confirm('Excluir este relatório do histórico?')){saveHistory(history().filter(x=>x.id!==b.dataset.p2del));if(last?.items){last.items=last.items.filter(x=>x.reportId!==b.dataset.p2del);saveSession(last)}renderAnalysis();renderHistory();toast('Registro excluído')}})
}
function htmlText(html){const d=document.createElement('div');d.innerHTML=html||'';return d.innerText||d.textContent||''}
async function readClipboardToPeriod2(){
 if(!navigator.clipboard?.read){toast('Seu navegador não permite leitura direta da área de transferência. Use Ctrl+V na caixa.');return}
 try{
  const items=await navigator.clipboard.read(),files=[],texts=[];
  for(const item of items){
   for(const type of item.types){
    const blob=await item.getType(type);
    if(type.startsWith('image/'))files.push(new File([blob],'tela-copiada.'+(type.split('/')[1]||'png'),{type}));
    else if(type==='text/html')texts.push(htmlText(await blob.text()));
    else if(type==='text/plain')texts.push(await blob.text());
   }
  }
  if(texts.join(' ').trim().length>40){processText(texts.join('\n'));q('#p2Status').textContent='Tela copiada lida como conteúdo estruturado da área de transferência.';return}
  if(files.length){processFiles(files);return}
  toast('Nenhum conteúdo utilizável encontrado na área de transferência.')
 }catch(e){toast('Permissão da área de transferência bloqueada. Clique na caixa e use Ctrl+V.')}
}
function pasteScreenData(e,preferStructured=false){
 e.preventDefault();
 const cd=e.clipboardData,html=cd.getData('text/html'),plain=cd.getData('text/plain');
 const fs=[...cd.items].filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);
 if(preferStructured){
  const structured=html?htmlText(html):plain;
  if(structured&&structured.trim().length>40){processText(structured);q('#p2Status').textContent='Tela copiada recebida e convertida em dados para análise.';return}
 }
 if(fs.length){processFiles(fs);return}
 const t=html?htmlText(html):plain;if(t)processText(t);
}
function render(){
 const c=q('#content');if(!c)return;const current=Number(localStorage.getItem('g12_p2_clinic')||1),cl=clinicById(current);last=loadSession(current);
 q('#pageTitle').textContent='Segundo retorno';q('#pageHelp').textContent='Relatório por relatório, com análise individual, mensagem editável e histórico.';
 c.innerHTML=`<div class="p2-head"><div><span class="period-pill active">PERÍODO 2 · FRANQUEADOS</span><h3>Segundo retorno estratégico</h3><p>Adicione <strong>um relatório por vez</strong>. Assim que ele for lido, a análise e a mensagem aparecem abaixo. Depois adicione o próximo e o sistema vai montando o retorno da clínica.</p></div><select id="p2Clinic">${CLINICS.map(x=>`<option value="${x.id}" ${x.id===cl.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
 <div class="card p2-uploader"><div class="p2-uploader-head"><div><h3>Adicionar próximo relatório</h3><p>Aceitação · Ortodontia · Efetivados x iniciados · Indicações · Cobrança · Ticket/produtividade</p></div><span class="badge blue">${(last.items||[]).length} analisado(s) hoje</span></div>
 <div class="p2-drop"><label><strong>Escolher 1 arquivo</strong><span>Imagem, print, PDF, TXT ou CSV</span><input id="p2Files" type="file" accept="image/*,.pdf,.txt,.csv"></label><div id="p2Paste" tabindex="0"><strong>Colar print/tela</strong><span>Copie o relatório e use Ctrl+V. A leitura começa na hora.</span></div><div class="p2-capture"><strong>Capturar tela aberta</strong><span>Escolha a aba ou janela do relatório. O sistema captura somente esse momento.</span><button id="p2Capture" class="btn secondary" type="button">Capturar tela</button></div><div id="p2ScreenPaste" tabindex="0"><strong>Colar conteúdo da tela</strong><span>Prioriza texto/HTML quando o relatório permitir copiar os dados.</span><button id="p2ClipboardRead" class="ghost" type="button">Ler área de transferência</button></div></div>
 <div id="p2Status" class="hint">Aguardando o próximo relatório de ${esc(cl.city)}.</div><div id="p2FileList" class="p2-file-list"></div></div><div id="p2Result"></div><div id="p2History"></div>`;
 q('#p2Clinic').onchange=e=>{localStorage.setItem('g12_p2_clinic',e.target.value);last=loadSession(Number(e.target.value));render()};
 q('#p2Files').onchange=e=>{const f=e.target.files?.[0];if(f)processFiles([f]);e.target.value=''};
 q('#p2Paste').addEventListener('paste',e=>pasteScreenData(e,false));q('#p2ScreenPaste').addEventListener('paste',e=>pasteScreenData(e,true));q('#p2ClipboardRead').onclick=readClipboardToPeriod2;q('#p2Capture').onclick=async()=>{try{q('#p2Status').textContent='Escolha a tela/aba do relatório…';await processFiles([await captureScreenFile()])}catch(e){toast(e.message);q('#p2Status').textContent=e.message}};
 renderAnalysis();renderHistory();
}
async function processFiles(files){
 if(busy||!files.length)return;busy=true;const cl=clinicById(Number(q('#p2Clinic').value)),st=q('#p2Status'),list=q('#p2FileList');
 try{
  const f=files[0];st.textContent='Lendo '+f.name+'…';list.innerHTML='';
  const rs=await read(f);
  for(const rr of rs){
   const item=parse(rr.text,f.name,rr.confidence);item.reportId='p2r-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);item.createdAt=new Date().toISOString();
   const mismatch=item.clinic&&norm(item.clinic)!==norm(cl.city);
   const ins=insight(item,cl);item.message=ins?.message||'';
   last=loadSession(cl.id);last.items.push(item);saveSession(last);upsertReportHistory(cl,item,ins);
   list.insertAdjacentHTML('beforeend',`<div class="p2-file"><strong>${esc(f.name)}</strong><span>${esc(item.type)}</span><em>${Math.round(rr.confidence||0)}%</em></div>`);
   st.textContent=mismatch?'Relatório lido, mas a clínica reconhecida parece diferente. Revise antes de enviar.':'Relatório analisado e adicionado abaixo. Você já pode incluir o próximo.';
  }
  renderAnalysis();renderHistory();
 }catch(e){st.textContent='Falha: '+e.message;toast('Não foi possível concluir a leitura deste relatório')}finally{busy=false}
}
function processText(text){const cl=clinicById(Number(q('#p2Clinic').value)),item=parse(text,'Conteúdo colado',100);item.reportId='p2r-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);item.createdAt=new Date().toISOString();const ins=insight(item,cl);item.message=ins?.message||'';last=loadSession(cl.id);last.items.push(item);saveSession(last);upsertReportHistory(cl,item,ins);q('#p2FileList').innerHTML=`<div class="p2-file"><strong>Conteúdo colado</strong><span>${esc(item.type)}</span><em>100%</em></div>`;q('#p2Status').textContent='Conteúdo analisado e adicionado abaixo. Você já pode incluir o próximo relatório.';renderAnalysis();renderHistory()}
function ensureNav(){const nav=q('#nav');if(!nav||q('[data-p2-nav]'))return;const btn=document.createElement('button');btn.className='nav-btn';btn.dataset.p2Nav='1';btn.innerHTML='<span>②</span>Segundo retorno';const p1=[...nav.children].find(x=>x.textContent.includes('Período 1'));p1?.after(btn)||nav.appendChild(btn);btn.onclick=()=>{qa('.nav-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');render();q('.sidebar')?.classList.remove('open')}}
const obs=new MutationObserver(ensureNav);obs.observe(document.body,{childList:true,subtree:true});setInterval(ensureNav,1200);document.addEventListener('DOMContentLoaded',ensureNav);setTimeout(ensureNav,500);
})();