const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
const CLINICS=[
['DIAMANTINA - MG[1031]','Diamantina','MG','1031'],['DOM PEDRITO - RS[915]','Dom Pedrito','RS','915'],['GARCA - SP[470]','Garça','SP','470'],['GUAIRA - SP[1214]','Guaíra','SP','1214'],['ILHOTA - SC[550]','Ilhota','SC','550'],['JARDIM - MS[368]','Jardim','MS','368'],['PONTA GROSSA - PR - UVARANAS[51]','Ponta Grossa - Uvaranas','PR','51'],['REGISTRO I - SP[1609]','Registro I','SP','1609'],['RIO DO SUL - SC[27]','Rio do Sul','SC','27'],["SANTA BARBARA D`OESTE - JARDIM EUROPA - SP[1658]","Santa Bárbara d'Oeste - Jardim Europa",'SP','1658'],['SIDROLANDIA - MS[307]','Sidrolândia','MS','307'],['TAQUARITINGA - SP[1655]','Taquaritinga','SP','1655']
].map((x,i)=>({id:i+1,name:x[0],city:x[1],state:x[2],code:x[3]}));
const defaults={minEvaluations:15,maxEvaluations:20,cgEffective:7,orthoFolders:4,acceptanceHealthy:.8,conversionHealthy:.3,appHealthy:.95,satisfactionHealthy:.9,ticketReference:3488.25};
const paths={'Avaliações':'Admin > Indicações > Ferramenta de Conversão','Efetivações':'Rel. Administrativos > Gerentes > Avaliações','Conversão':'Admin > Indicações > Ferramenta de Conversão','Faltosos':'Agenda > Relatórios > Pacientes Faltosos','Trat. sem 1º agendamento':'Relatório de Avaliações > Tratamentos sem 1º agendamento','App':'Admin > Indicações / App','Pesquisa satisfação':'Admin > Indicações / App','Indicações/Amigo do Peito':'Admin > Indicações / App','Ortodontia':'Relatórios / Ortodontia'};
const tools={'Avaliações':'Ferramenta de Conversão','Efetivações':'Relatório de Avaliações','Conversão':'Ferramenta de Conversão','Faltosos':'Pacientes Faltosos','Trat. sem 1º agendamento':'Relatório de Avaliações','App':'Indicações / App','Pesquisa satisfação':'Indicações / App','Indicações/Amigo do Peito':'Indicações / App','Ortodontia':'Ortodontia'};
const state={page:'morning',selectedClinic:1,period:1};
const nav=[['morning','☀','Rotina da manhã'],['returns','↻','Retorno da tarde'],['centralReturns','▣','Tratativa'],['team','♙','Pessoas & gestão'],['messages','✉','Mensagens salvas'],['history','◷','Histórico'],['admin','⚙','Configurações']];
const help={morning:'Mensageiro, grupo e franqueado: metas e direcionamentos da manhã.',returns:'Confira à tarde o que foi entregue e o que ainda precisa virar resultado.',centralReturns:'Tratativa completa dos relatórios: leitura, solução, plano de ataque e mensagens.',team:'Cadastre recepção, cobrança e franqueados com funções e metas individuais.',messages:'Prepare mensagens por clínica e data para copiar, editar ou enviar depois.',history:'Consulte mensagens e retornos anteriores por período.',admin:'Metas, referências, segurança e backup.'};
function baseData(){return {settings:{...defaults},metrics:{},plans:{},returns:[],history:[],period1History:[],staff:{},passwordHash:'',createdAt:new Date().toISOString()}}
function load(){try{const x=JSON.parse(localStorage.getItem('g12_data')||'{}');return {...baseData(),...x,settings:{...defaults,...(x.settings||{})},period1History:x.period1History||[],staff:x.staff||{}}}catch{return baseData()}}
let data=load();
function save(){localStorage.setItem('g12_data',JSON.stringify(data))}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v){return Number(v||0).toLocaleString('pt-BR')}
function money(v){return v===''||v==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function pct(v){return v===''||v==null?'—':`${(Number(v)*100).toFixed(1).replace('.',',')}%`}
function metric(id){return data.metrics[id]||{}}
function plan(id){return data.plans[id]||null}
function clinic(id){return CLINICS.find(x=>x.id==id)}
function isoDay(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function monthKey(d=isoDay()){return d.slice(0,7)}
function brDate(s){if(!s)return '—';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}
function todayBR(){return new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}
function statusBadge(s='Não iniciado'){let c='red';if(['Finalizado','Retorno recebido'].includes(s))c='green';else if(['Aguardando retorno','Franqueado informado'].includes(s))c='yellow';else if(['Análise','Equipe direcionada'].includes(s))c='blue';return `<span class="badge ${c}">${esc(s)}</span>`}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
async function copyText(t){try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(t);else{const x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();document.execCommand('copy');x.remove()}toast('Mensagem copiada')}catch{toast('Não foi possível copiar automaticamente')}}
function renderNav(){const n=$('#nav');n.innerHTML=nav.map(([id,ico,label])=>`<button class="nav-btn ${state.page===id?'active':''}" data-page="${id}"><span>${ico}</span>${label}</button>`).join('');$$('.nav-btn').forEach(b=>b.onclick=()=>go(b.dataset.page))}
function go(page){if(!nav.some(x=>x[0]===page))page='morning';state.page=page;localStorage.setItem('g12_last_page',page);renderNav();$('#pageTitle').textContent=nav.find(x=>x[0]===page)?.[2]||'Sistema';$('#pageHelp').textContent=help[page]||'';$('#today').textContent=todayBR();renderPage();$('.sidebar').classList.remove('open')}
let renderEpoch=0; function renderPage(){const c=$('#content'),epoch=++renderEpoch;c.classList.add('page-enter');setTimeout(()=>{if(epoch===renderEpoch)c.classList.remove('page-enter')},180);try{const out=({morning:renderPeriod1,dashboard:renderPeriod1,prepare:renderPrepare,clinics:renderClinics,period1:renderPeriod1,returns:renderReturns,centralReturns:renderCentralReturns,team:renderTeam,messages:renderSavedMessages,history:renderHistory,paths:renderPaths,admin:renderAdmin}[state.page]||renderPeriod1)(c);if(out?.catch)out.catch(e=>renderFailure(c,e))}catch(e){renderFailure(c,e)}}
window.addEventListener('unhandledrejection',e=>{console.error('Falha assíncrona não tratada',e.reason);const t=document.querySelector('#toast');if(t){t.textContent='Uma operação falhou sem perder a tela. Tente novamente.';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200)}});
window.addEventListener('error',e=>console.error('Erro global da interface',e.error||e.message));
function renderFailure(c,e){console.error(e);c.innerHTML='<div class="error-state"><strong>Não foi possível carregar esta área.</strong><span>'+esc(e?.message||'Erro inesperado')+'</span><button class="btn primary" id="retryPage">Tentar novamente</button></div>';$('#retryPage').onclick=()=>renderPage()}
function priorities(m){const s=data.settings,a=[];if(m.acceptance!==''&&m.acceptance!=null&&Number(m.acceptance)<s.acceptanceHealthy)a.push('Efetivação');if(m.conversion!==''&&m.conversion!=null&&Number(m.conversion)<s.conversionHealthy)a.push('Conversão');if(Number(m.ticket_avg||0)>0&&Number(m.ticket_avg)<s.ticketReference)a.push('Ticket médio');if(Number(m.no_first_appointment||0)>0)a.push('Trat. sem 1º agendamento');if(Number(m.absentees||0)>0)a.push('Faltosos');if(Number(m.app||0)>0&&Number(m.app)<s.appHealthy)a.push('App');if(Number(m.satisfaction||0)>0&&Number(m.satisfaction)<s.satisfactionHealthy)a.push('Satisfação');if(!a.length)a.push('Avaliações');return a.slice(0,3)}
function renderDashboard(c){const active=Object.values(data.plans).filter(Boolean).length,pending=CLINICS.filter(cl=>!metric(cl.id).updatedAt).length;c.innerHTML=`<div class="workspace-hero"><div><span class="eyebrow">CENTRAL OPERACIONAL</span><h1>Visão geral</h1><p>O que precisa da sua atenção hoje, sem ruído.</p></div><div class="hero-actions"><button id="heroSearch" class="ghost">Localizar clínica</button><button id="heroPrepare" class="btn primary">Planejar o dia</button><button id="heroPrints" class="btn secondary">Adicionar prints</button></div></div><div class="quick-strip"><button data-quick="clinics"><strong>${pending}</strong><span>unidades sem atualização</span></button><button data-quick="prepare"><strong>${active}/6</strong><span>no planejamento</span></button><button data-quick="period1"><strong>${data.period1History.filter(x=>x.day===isoDay()).length}</strong><span>retornos 1 hoje</span></button><button data-quick="centralReturns"><strong>${data.returns.length}</strong><span>retornos registrados</span></button></div><div id="dashboardBody"></div>`;const root=$('#dashboardBody');const cards=CLINICS.map(cl=>{const m=metric(cl.id),p=plan(cl.id);return `<div class="card clinic-card"><div class="clinic-name">${esc(cl.name)}</div><div class="clinic-meta">${statusBadge(p?.status)}<span>${cl.city}/${cl.state}</span></div><div class="grid cols-2"><div class="metric"><div class="label">Avaliações período</div><div class="value">${num(m.evaluations)}</div></div><div class="metric"><div class="label">Efetivações período</div><div class="value">${num(m.effectivations)}</div></div></div><div class="clinic-meta"><span>Ticket ${money(m.ticket_avg)}</span><span>${brDate(m.report_start)}–${brDate(m.report_end)}</span></div><div class="actions"><button class="btn secondary" data-clinic="${cl.id}">Abrir clínica</button><button class="ghost" data-p1="${cl.id}">Gerar Período 1</button></div></div>`}).join('');const p1Today=data.period1History.filter(x=>x.day===isoDay()).length;root.innerHTML=`<div class="grid cols-4"><div class="metric"><div class="label">Clínicas planejadas</div><div class="value">${Object.keys(data.plans).length}/6</div></div><div class="metric"><div class="label">Período 1 gerado hoje</div><div class="value">${p1Today}</div></div><div class="metric"><div class="label">Histórico no mês</div><div class="value">${data.period1History.filter(x=>x.month===monthKey()).length}</div></div><div class="metric"><div class="label">Retornos</div><div class="value">${data.returns.length}</div></div></div><div class="section-head"><h3>12 clínicas</h3><button id="quickPrepare" class="btn primary">Preparar hoje</button></div><div class="grid cols-3">${cards}</div>`;$('#heroSearch').onclick=()=>{const q=prompt('Digite o nome da clínica');if(!q)return;const cl=CLINICS.find(x=>x.name.toLowerCase().includes(q.toLowerCase())||x.city.toLowerCase().includes(q.toLowerCase()));if(cl){state.selectedClinic=cl.id;go('clinics')}else toast('Clínica não encontrada')};$('#heroPrepare').onclick=()=>go('prepare');$('#heroPrints').onclick=()=>go('centralReturns');$$('[data-quick]').forEach(b=>b.onclick=()=>go(b.dataset.quick));$('#quickPrepare').onclick=()=>go('prepare');$$('[data-clinic]').forEach(b=>b.onclick=()=>{state.selectedClinic=Number(b.dataset.clinic);go('clinics')});$$('[data-p1]').forEach(b=>b.onclick=()=>{state.selectedClinic=Number(b.dataset.p1);go('period1')})}
function renderPrepare(c){c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">FLUXO DO DIA</span><h3>Planejamento</h3><p>Selecione as unidades que entram na sua rotina de hoje e defina o status de cada uma.</p></div></div><div class="hint">Selecione as 6 clínicas do dia. O Período 1 será gerado depois de preencher os dados do relatório em <strong>Clínicas</strong>.</div><div class="section-head"><h3>Plano do dia</h3><button id="savePlans" class="btn primary">Salvar planejamento</button></div><div class="grid cols-2">${CLINICS.map(cl=>{const p=plan(cl.id);return `<div class="card"><label class="clinic-name"><input class="clinic-check" data-id="${cl.id}" type="checkbox" ${p?'checked':''} style="width:auto;margin-right:8px">${esc(cl.name)}</label><div class="form-grid" style="margin-top:12px"><div><label>Secretárias na tratativa</label><select data-f="count" data-id="${cl.id}">${[2,3,4,5].map(x=>`<option ${Number(p?.collaborator_count||2)===x?'selected':''}>${x}</option>`).join('')}</select></div><div><label>Status</label><select data-f="status" data-id="${cl.id}">${['Não iniciado','Análise','Equipe direcionada','Franqueado informado','Aguardando retorno','Retorno recebido','Finalizado'].map(x=>`<option ${p?.status===x?'selected':''}>${x}</option>`).join('')}</select></div></div></div>`}).join('')}</div>`;$('#savePlans').onclick=()=>{const sel=$$('.clinic-check:checked');if(sel.length!==6&&!confirm(`Você selecionou ${sel.length}. O padrão é 6. Continuar?`))return;const keep={};sel.forEach(ch=>{const id=Number(ch.dataset.id),f=n=>$(`[data-f="${n}"][data-id="${id}"]`).value;keep[id]={clinic_id:id,collaborator_count:Number(f('count')),status:f('status')};});data.plans=keep;save();toast('Planejamento salvo');renderPage()}}
function renderClinics(c){const tabs=CLINICS.map(cl=>`<button class="clinic-tab ${state.selectedClinic===cl.id?'active':''}" data-tab-clinic="${cl.id}">${esc(cl.city)} <small>${cl.state}</small></button>`).join('');c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">BASE OPERACIONAL</span><h3>Dados das clínicas</h3><p>Uma unidade por vez. Cole o relatório ou preencha apenas o necessário.</p></div></div><div class="hint">Digite os dados exatamente como aparecem no relatório do período. Depois clique em <strong>Salvar e gerar Período 1</strong>.</div><div class="clinic-tabs">${tabs}</div><div id="clinicDetail"></div>`;$$('[data-tab-clinic]').forEach(b=>b.onclick=()=>{state.selectedClinic=Number(b.dataset.tabClinic);renderClinics(c)});renderClinicDetail($('#clinicDetail'),state.selectedClinic)}
function field(k,label,m,step='1'){return `<div><label>${label}</label><input data-metric="${k}" type="number" step="${step}" value="${m[k]??''}"></div>`}
function renderClinicDetail(el,id){const cl=clinic(id),m=metric(id),pri=priorities(m);el.innerHTML=`<div class="section-head clinic-detail-head"><div><h3>${esc(cl.name)}</h3><div class="clinic-meta">Código ${cl.code} · ${cl.city}/${cl.state}</div></div><div class="actions"><button id="saveClinic" class="btn secondary">Salvar</button><button id="startP1" class="btn primary">Salvar e gerar Período 1</button></div></div><div class="card period-card"><div class="form-grid"><div><label>Início do relatório</label><input data-metric="report_start" type="date" value="${esc(m.report_start||isoDay().slice(0,8)+'01')}"></div><div><label>Fim do relatório</label><input data-metric="report_end" type="date" value="${esc(m.report_end||isoDay())}"></div><div class="span-2"><label>Observação do período</label><input data-metric="notes" value="${esc(m.notes||'')}"></div></div></div><div class="split"><div class="card"><h3>Relatório de avaliações · período</h3><div class="form-grid">${field('monthly_goal','Meta mensal R$',m,'.01')}${field('proportional_goal','Meta proporcional R$',m,'.01')}${field('effective_value','Valor efetivado R$',m,'.01')}${field('ticket_avg','Ticket médio',m,'.01')}${field('evaluations','Avaliações no período',m)}${field('effectivations','Efetivações no período',m)}${field('acceptance','Aceitação (0 a 1)',m,'.01')}${field('conversion','Conversão (0 a 1)',m,'.01')}${field('cancellation','Cancelamento (0 a 1)',m,'.01')}${field('app','App (0 a 1)',m,'.01')}${field('satisfaction','Satisfação (0 a 1)',m,'.01')}${field('no_first_appointment','Sem 1º agendamento',m)}${field('absentees','Faltosos',m)}</div></div><div class="card"><h3>Leitura rápida</h3><div class="hint">${pri.map(x=>`• ${esc(x)}`).join('<br>')}</div><div class="grid cols-2" style="margin-top:14px"><div class="metric"><div class="label">Avaliações</div><div class="value">${num(m.evaluations)}</div></div><div class="metric"><div class="label">Efetivações</div><div class="value">${num(m.effectivations)}</div></div><div class="metric"><div class="label">Ticket</div><div class="value">${money(m.ticket_avg)}</div></div><div class="metric"><div class="label">Aceitação</div><div class="value">${pct(m.acceptance)}</div></div></div></div></div>`;$('#saveClinic').onclick=()=>{saveClinicForm(id);toast('Dados salvos')};$('#startP1').onclick=()=>{saveClinicForm(id);state.selectedClinic=id;go('period1')}}
function saveClinicForm(id){const m={...metric(id)};$$('[data-metric]').forEach(i=>{const k=i.dataset.metric;if(i.type==='number')m[k]=i.value===''?'':Number(i.value);else m[k]=i.value});m.updatedAt=new Date().toISOString();data.metrics[id]=m;save()}
const openings=['Bom dia','Oi','Vamos de foco hoje','Foco de hoje','Para hoje','Começando o dia','Meta de hoje','Hoje vamos em cima de'];
function openingFor(clinicId,index){const d=new Date(),seed=d.getFullYear()*372+(d.getMonth()+1)*31+d.getDate()+clinicId*7+index*3;return openings[seed%openings.length]}
function secretaryText(cl,id,i,name,resp,target){const op=openingFor(id,i),tool=tools[resp]||'Relatório de Avaliações',path=paths[resp]||'';const who=name?`${name}, `:'';if(op==='Bom dia'||op==='Oi')return `${op}, ${who}hoje: ${target}. ${tool}. ${path}. Me retorna o resultado.`;return `${who}${op}: ${target}. ${tool} — ${path}. Me retorna o resultado.`}
function defaultResponsibility(i,pri){if(i===0)return pri.includes('Conversão')?'Conversão':'Avaliações';if(i===1)return pri.includes('Efetivação')?'Efetivações':(pri[1]||'Efetivações');return pri[i]||'Faltosos'}
function defaultTarget(resp){if(['Avaliações','Conversão'].includes(resp))return '8 a 10 agendamentos';if(resp==='Efetivações')return `${data.settings.cgEffective} efetivações CG`;if(resp==='Ortodontia')return `${data.settings.orthoFolders} pastas Orto`;if(resp==='Faltosos')return 'recuperar os faltosos de hoje';if(resp==='Trat. sem 1º agendamento')return 'zerar os sem 1º agendamento';return 'trabalhar a meta do indicador'}
function franchiseP1(cl,m,pri){const period=m.report_start&&m.report_end?`${brDate(m.report_start)} a ${brDate(m.report_end)}`:'período informado';let msg=`Bom dia! ${cl.city}: relatório ${period} — ${num(m.evaluations)} avaliações, ${num(m.effectivations)} efetivações`;if(m.acceptance!==''&&m.acceptance!=null)msg+=`, aceitação ${pct(m.acceptance)}`;if(m.ticket_avg)msg+=` e ticket ${money(m.ticket_avg)}`;msg+=`. Hoje alinhamos foco em ${pri.slice(0,2).join(' e ')}. No fim do dia retorno com a evolução.`;return msg}
function morningGroupText(cl,m,pri){
 const a=m.acceptance!==''&&m.acceptance!=null?pct(m.acceptance):'sem atualização';
 const t=Number(m.ticket_avg||0)>0?money(m.ticket_avg):'sem atualização';
 return `Bom dia, pessoal! Na ${cl.city}, hoje vamos atacar ${pri.slice(0,3).join(', ').toLowerCase()}. Aceitação em ${a} e ticket em ${t}. O direcionamento para a recepção é trabalhar avaliações, reativação, pacientes sem agenda e indicações; com os profissionais, reforçar abordagem, indicação e composição dos planos. O que ficar travado, me sinalizem com o nome do paciente e o que já foi feito para conseguirmos solucionar rápido.`;
}
async function reportTextForClinic(id){try{const r=await mgmtFetch('central_report_texts?select=report_text&capture_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&return_type=eq.2&limit=1');return r[0]?.report_text||''}catch{return ''}}
function reportCore(raw){
 const t=String(raw||''),num=(re)=>{const m=t.match(re);return m?Number(String(m[1]).replace(/\./g,'').replace(',','.')):null},int=(re)=>{const m=t.match(re);return m?Number(m[1]):null};
 return {chairs:int(/Cadeiras:\s*(\d+)/i),accept:int(/índice mínimo:\s*80%\s*(\d+)%/i),evals:int(/Total de avaliações:\s*(\d+)\s*-\s*Efetivadas:/i),eff:int(/Total de avaliações:\s*\d+\s*-\s*Efetivadas:\s*(\d+)/i),chairProp:int(/Meta pacientes cadeiras - proporcional:\s*(\d+)/i),chairEff:int(/Meta pacientes cadeiras - efetivados:\s*(\d+)/i),ticket:num(/Ticket médio:\s*([\d.]+,\d{2})/i),orthoEff:int(/Meta de efetivações:\s*25\s*-\s*Proporcional:\s*18\s*-\s*Efetivadas:\s*(\d+)/i),orthoPaid:int(/Meta de pastas pagas:\s*18\s*-\s*Proporcional:\s*13\s*-\s*Pagas:\s*(\d+)/i),faltosos:int(/Porcentagem de faltosos:\s*(\d+)/i),semAgenda:int(/Proporção sem agendamento - Clínico geral[\s\S]{0,40}?(\d+)\s*%/i),rebooking:int(/índice mínimo:\s*90%\s*(\d+)\s*%/i),collectionAgent:int(/índice mínimo:\s*65%\s*(\d+)%/i),agenda:int(/Aproveitamento de Agendamento[\s\S]{0,160}?índice mínimo:\s*80%\s*(\d+)%/i),app:num(/EFETIVAÇÕES\/INSTALAÇÕES[\s\S]{0,100}?(\d+[,]\d+)%/i)};
}
function dailyGuideMessages(cl,raw,people=[]){
 const x=reportCore(raw),ticketRef=Number(data.settings.ticketReference||3488.25),gap=Math.max(0,(x.chairProp||0)-(x.chairEff||0)),daily=Math.max(1,Math.ceil(gap/6)),rec=people.filter(p=>p.role_type==='receptionist'),fr=people.filter(p=>p.role_type==='franchisee'),names=Array.from({length:3},(_,i)=>rec[i]?.name||('Colaboradora '+(i+1)+' · editar nome')),split=centralSplitTarget(daily,3),evalGoal=Math.max(3,Math.ceil(daily/0.30)),evalSplit=centralSplitTarget(evalGoal,3);
 const individual=names.map((n,i)=>({recipient:n,title:'Meta individual · '+n,message:'Bom dia, '+n+', tudo bem? Ótimo diaaa! 😄 Hoje quero sua ajuda bem focada pra gente avançar nas metas. Sua meta de hoje é agendar pelo menos '+Math.max(1,evalSplit[i]||1)+' avaliação(ões) e contribuir com '+Math.max(1,split[i]||1)+' efetivação(ões) no clínico. Para isso, trabalhe confirmações, reativação e retome contato com quem avaliou e não fechou. '+(x.accept!=null?(x.accept>=80?'Nossa aceitação está bonita em '+x.accept+'% 💙, então vamos aproveitar essa abordagem e colocar mais gente na cadeira.':'Nossa aceitação está em '+x.accept+'% e aqui precisamos de atenção: acompanhe quem avaliou e não fechou, entenda a trava e retorne com cada caso.'):'')+' Na Orto, precisamos caminhar para 25 efetivações e 18 pastas pagas; hoje estamos em '+(x.orthoEff??'—')+' efetivadas e '+(x.orthoPaid??'—')+' pagas. Me chama se travar em algum paciente, combinado? Bora buscar esse resultado 🙌'}));

 const group='Bom dia Drs. Tudo bem?? Analisei o relatório de '+cl.city+'. '+(x.accept>=80?'Aceitação em '+x.accept+'%, muito bom! 💙 Parabéns pela abordagem. ':'Aceitação em '+(x.accept??'—')+'%, aqui já temos um ponto de atenção. ')+(gap>0?'Na meta por cadeira estamos com '+(x.chairEff??'—')+' para proporcional de '+(x.chairProp??'—')+', faltando '+gap+'. Já dividi com a recepção uma meta de recuperação para hoje. ':'A meta proporcional por cadeira está entregue; agora é proteger o resultado. ')+(x.ticket!=null?(x.ticket>=ticketRef?'Ticket em '+centralMoney(x.ticket)+', acima do saudável de '+centralMoney(ticketRef)+' 💙. ':'Ticket em '+centralMoney(x.ticket)+', abaixo do saudável de '+centralMoney(ticketRef)+' e isso impacta diretamente o caixa. Vou trabalhar com a equipe/profissionais composição do plano pelas 4 odontologias e valor de tabela. '):'')+'Na Orto a referência mensal é 25 efetivações e 18 pastas pagas; estamos em '+(x.orthoEff??'—')+' e '+(x.orthoPaid??'—')+'. Plano de hoje: a recepção tem meta total de '+evalGoal+' novos agendamentos de avaliação, divididos entre as 3 colaboradoras; além disso, recuperar faltosos/reativações, confirmar avaliações e retomar contato com os não efetivados. À tarde eu volto com a parcial do que realmente virou resultado. Combinado?';
 const retIndividuals=names.map(n=>({recipient:n,title:'Retorno individual · '+n,message:'Boa tarde, '+n+'! Tudo bem? 😄 Passando pra nossa parcial do que combinamos de manhã. Me conta: quantas avaliações você conseguiu colocar, quantas efetivações avançaram e o que ficou travado? '+(x.semAgenda>20?'Temos '+x.semAgenda+'% sem agenda, então pega sua lista e vamos sair com reagendamento real hoje. ':'')+(x.rebooking<90?'O reagendamento está em '+x.rebooking+'%, então atenção para ninguém atendido sair sem próximo horário. ':'')+'Se tiver paciente que não avançou, me manda o nome + o que já tentou que eu te ajudo na próxima ação. Bora fechar bem o dia 🙌'}));
 const ret='Boa tarde! Passando para nosso retorno 😄 De manhã combinamos atacar cadeira, avaliações, conversão e Orto. Para a meta proporcional, o relatório mostra '+(x.chairEff??'—')+'/'+(x.chairProp??'—')+' no clínico'+(gap>0?', então ainda temos '+gap+' para recuperar no acumulado.':' e a meta está protegida.')+' Me atualizem: quantas avaliações entraram, quantas efetivações fizemos, quantas pastas de Orto avançaram e o que ainda está travado? O que faltar hoje, vamos direcionar agora — nada de levar pendência silenciosa para amanhã 😅.';
 const treatment='Drs., olhando os 21 pontos do relatório, eu priorizaria o que mexe direto na cadeira e no caixa. '+(gap>0?'Cadeira: '+(x.chairEff??'—')+'/'+(x.chairProp??'—')+', gap de '+gap+'. ':'Cadeira proporcional entregue. ')+(x.ticket!=null?'Ticket: '+centralMoney(x.ticket)+' vs saudável '+centralMoney(ticketRef)+'. ':'')+'Orto: '+(x.orthoEff??'—')+'/25 efetivações e '+(x.orthoPaid??'—')+'/18 pastas pagas. Aceitação: '+(x.accept??'—')+'%. Plano de ação: 1) recepção transforma o gap em lista nominal de avaliações, faltosos e reativações; 2) cada avaliação sem fechamento recebe retomada de contato com motivo e próximo passo; 3) profissionais trabalham plano completo pelas 4 odontologias para proteger ticket, sem empurrar tratamento; 4) Orto recebe meta diária de avaliações, fechamento e pasta paga; 5) parcial à tarde com realizado x meta e redistribuição do que não andou. Ponto negativo sem responsável e próxima ação não entra como tratativa.';
 const ops=[];
 if(x.faltosos!=null&&x.faltosos>20)ops.push('Faltosos em '+x.faltosos+'%: confirmar agenda em duas etapas e ligar imediatamente para ausência, já oferecendo novo horário.');
 if(x.semAgenda!=null&&x.semAgenda>20)ops.push('Sem agenda em '+x.semAgenda+'%: puxar lista nominal dos pacientes ativos sem próximo horário e sair do dia com reagendamento real.');
 if(x.rebooking!=null&&x.rebooking<90)ops.push('Reagendamento em '+x.rebooking+'%: todo paciente atendido precisa sair com próximo horário definido; pendências entram em lista de ligação no mesmo dia.');
 if(x.agenda!=null&&x.agenda<80)ops.push('Aproveitamento de agenda em '+x.agenda+'%: revisar confirmações, encaixes e horários de maior conversão; não basta encher agenda, precisamos trazer paciente para cadeira.');
 if(x.app!=null&&x.app<95)ops.push('Aplicativo em '+Math.round(x.app)+'%: instalação e baixa entram no fechamento da efetivação, antes de encerrar o atendimento.');
 if(x.collectionAgent!=null&&x.collectionAgent<65)ops.push('Cobrança em '+x.collectionAgent+'%: priorizar carteira com maior chance de recuperação, registrar retorno e fazer segunda tentativa dos não atendidos.');
 if(ops.length)treatment+='\n\nAções complementares do relatório:\n• '+ops.join('\n• ');
 return {individual,retIndividuals,group,ret,treatment};
}
async function saveDailyGuides(id){
 const cl=clinic(id),raw=await reportTextForClinic(id);if(!raw)return toast('Salve primeiro o texto completo do relatório desta clínica.');
 let people=[];try{people=await mgmtFetch('management_people?select=role_type,name,functions&clinic_id=eq.'+id+'&active=eq.true')}catch{}
 const g=dailyGuideMessages(cl,raw,people),rows=[...g.individual.map(x=>({section:'morning_messenger',...x})),...g.retIndividuals.map(x=>({section:'afternoon_return',...x})),{section:'morning_group',recipient:'group',title:'Grupo · manhã',message:g.group},{section:'afternoon_return',recipient:'group',title:'Retorno da tarde',message:g.ret},{section:'treatment',recipient:'group',title:'Tratativa estratégica',message:g.treatment}];
 for(const r of rows){const body={guide_date:isoDay(),clinic_id:id,section:r.section,recipient:r.recipient,title:r.title,message:r.message,action_plan:r.section==='treatment'?r.message:''};const old=await mgmtFetch('daily_clinic_guides?select=id&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=eq.'+encodeURIComponent(r.section)+'&recipient=eq.'+encodeURIComponent(r.recipient)+'&title=eq.'+encodeURIComponent(r.title)+'&limit=1');if(old[0])await mgmtFetch('daily_clinic_guides?id=eq.'+old[0].id,{method:'PATCH',body:JSON.stringify(body)});else await mgmtFetch('daily_clinic_guides',{method:'POST',body:JSON.stringify(body)})}
 toast('Mensageiro, grupo, retorno e tratativa preparados para '+cl.city+'.');
}
async function guideCards(id,section){
 const rows=await mgmtFetch('daily_clinic_guides?select=*&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=eq.'+section+'&order=id.asc');return rows.map(r=>'<div class="card guide-output"><div class="section-head"><div><strong>'+esc(r.title)+'</strong><div class="clinic-meta">'+esc(r.recipient)+'</div></div><button class="ghost" data-copy-guide="'+r.id+'">Copiar</button></div><div class="message-box">'+esc(r.message)+'</div><label class="btn secondary">Adicionar imagem<input class="hidden guide-image" data-guide-image="'+r.id+'" type="file" accept="image/*"></label>'+(r.image_data?'<img class="guide-preview" src="'+r.image_data+'">':'')+'</div>').join('')}
async function bindGuideCards(){$('[data-merge-guides]').forEach(b=>b.onclick=async()=>{const id=Number(b.dataset.mergeGuides),section=b.dataset.section,rows=await mgmtFetch('daily_clinic_guides?select=*&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=eq.'+section+'&order=id.asc'),ind=rows.filter(x=>x.recipient!=='group');if(!ind.length)return toast('Nenhuma mensagem individual para unir.');const merged=ind.map((x,i)=>'Tarefa '+(i+1)+' · '+x.recipient+'\n'+x.message).join('\n\n');const body={guide_date:isoDay(),clinic_id:id,section,recipient:'Equipe unificada',title:'Tarefas unificadas · 3 colaboradoras',message:merged,action_plan:'Executar as três frentes em conjunto e redistribuir internamente.',updated_at:new Date().toISOString()};const old=await mgmtFetch('daily_clinic_guides?select=id&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=eq.'+section+'&recipient=eq.'+encodeURIComponent('Equipe unificada')+'&limit=1');if(old[0])await mgmtFetch('daily_clinic_guides?id=eq.'+old[0].id,{method:'PATCH',body:JSON.stringify(body)});else await mgmtFetch('daily_clinic_guides',{method:'POST',body:JSON.stringify(body)});toast('As três tarefas foram unidas em uma mensagem.');renderPage()});$('[data-copy-guide]').forEach(b=>b.onclick=()=>copyText(b.closest('.guide-output').querySelector('.message-box').textContent));$$('[data-guide-image]').forEach(inp=>inp.onchange=async()=>{const f=inp.files?.[0];if(!f)return;const d=await fileToDataUrl(f);await mgmtFetch('daily_clinic_guides?id=eq.'+inp.dataset.guideImage,{method:'PATCH',body:JSON.stringify({image_data:d,updated_at:new Date().toISOString()})});toast('Imagem anexada à mensagem.');renderPage()})}
function reportTextGeneratorPanel(id,section){return '<div class="card report-text-card inline-generator"><div class="section-head"><div><h3>Leitura pelo texto do relatório</h3><div class="clinic-meta">Cole o relatório completo, salve e gere a mensagem desta etapa.</div></div></div><textarea id="quickReportText" rows="7" placeholder="Cole aqui o relatório completo da clínica…"></textarea><div class="actions"><button id="quickSaveReport" class="btn secondary">Salvar texto</button><button id="quickGenerateReport" class="btn primary">Salvar + gerar '+(section==='morning'?'mensageiro e grupo':section==='return'?'retorno da tarde':'tratativa')+'</button></div><span id="quickReportState" class="hint"></span></div>'}
async function bindReportTextGenerator(id,section){
 const box=$('#quickReportText'),st=$('#quickReportState');if(!box)return;
 try{const rows=await mgmtFetch('central_report_texts?select=id,report_text,updated_at&capture_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&return_type=eq.2&limit=1');box.value=rows[0]?.report_text||'';box.dataset.rowId=rows[0]?.id||'';st.textContent=rows[0]?'Texto salvo hoje':'Cole o relatório completo';}catch(e){st.textContent='Não foi possível carregar o texto';}
 async function persist(){const text=box.value.trim();if(!text)throw new Error('Cole o relatório primeiro.');const body={capture_date:isoDay(),clinic_id:id,return_type:2,report_text:text,updated_at:new Date().toISOString()};if(box.dataset.rowId)await mgmtFetch('central_report_texts?id=eq.'+box.dataset.rowId,{method:'PATCH',body:JSON.stringify(body)});else{const r=await mgmtFetch('central_report_texts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});box.dataset.rowId=r[0]?.id||''}st.textContent='Texto salvo';}
 $('#quickSaveReport').onclick=async()=>{try{await persist();toast('Texto salvo nesta clínica.')}catch(e){toast(e.message)}};
 $('#quickGenerateReport').onclick=async()=>{const b=$('#quickGenerateReport');b.disabled=true;try{await persist();await saveDailyGuides(id);toast('Leitura concluída e mensagens atualizadas.');renderPage()}catch(e){toast('Falha na leitura: '+e.message)}finally{b.disabled=false}};
}

async function renderPeriod1(c){
 const id=state.selectedClinic||1,cl=clinic(id);c.innerHTML='<div class="page-intro"><div><span class="eyebrow">MANHÃ</span><h3>Primeiro mensageiro + grupo</h3><p>Metas individuais para cada colaboradora e direção estratégica para o grupo.</p></div><select id="p1Clinic">'+CLINICS.map(x=>'<option value="'+x.id+'" '+(x.id===id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div><div class="actions"><button id="generateDaily" class="btn primary">Gerar/atualizar guia desta clínica</button></div><div id="morningGuides"></div>';
 $('#p1Clinic').onchange=e=>{state.selectedClinic=Number(e.target.value);renderPeriod1(c)};$('#generateDaily').onclick=async()=>{await saveDailyGuides(id);renderPeriod1(c)};await bindReportTextGenerator(id,'morning');
 const a=await guideCards(id,'morning_messenger'),b=await guideCards(id,'morning_group');$('#morningGuides').innerHTML='<div class="actions"><button class="btn secondary" data-merge-guides="'+id+'" data-section="morning_messenger">Unir tarefas das 3 colaboradoras</button></div><div class="guide-strip"><div><strong>Mensageiro individual</strong><span>Meta própria, vínculo e plano do dia.</span></div><div><strong>Grupo</strong><span>Leitura estratégica + solução + acompanhamento.</span></div></div><h3>Mensageiros</h3>'+a+'<h3>Grupo</h3>'+b;await bindGuideCards();
}
function savePeriod1(id){const cl=clinic(id),m=metric(id),pri=priorities(m),rows=$$('.p1-row');const staff=rows.map((row,i)=>({name:$('.p1-name',row).value.trim(),resp:$('.p1-resp',row).value,target:$('.p1-target',row).value,message:$('.message-box',row).textContent}));data.staff[id]=staff.map(({name,resp,target})=>({name,resp,target}));const day=isoDay(),existing=data.period1History.findIndex(x=>x.day===day&&x.clinic_id===id);const rec={id:existing>=0?data.period1History[existing].id:`p1-${Date.now()}-${id}`,day,month:monthKey(day),createdAt:new Date().toISOString(),clinic_id:id,clinic_name:cl.name,report_start:m.report_start||'',report_end:m.report_end||'',metrics:{...m},priorities:[...pri],staff,franchise_message:franchiseP1(cl,m,pri)};if(existing>=0)data.period1History[existing]=rec;else data.period1History.unshift(rec);save();toast(existing>=0?'Histórico de hoje atualizado':'Período 1 salvo no histórico')}
function returnGuideText(cl,raw){
 const t=String(raw||'').replace(/\s+/g,' ').trim(),P=(x)=>centralPct(t,x),a=P('aceita.{0,12}o'),conv=P('convers.{0,12}o'),app=P('aplicativo'),chair=P('meta.{0,18}cadeira');
 const ticket=centralNum(t,[/ticket\\s*m[eé]dio[^0-9]{0,20}([\\d.]+,\\d{2})/i]),evals=centralNum(t,[/total de avalia[cç][oõ]es[^0-9]{0,20}(\\d+)/i]),eff=centralNum(t,[/efetivadas?[^0-9]{0,15}(\\d+)/i]);
 const wins=[],alerts=[];if(a!=null)(a>=80?wins:alerts).push('aceitação '+Math.round(a)+'%');if(conv!=null)(conv>=30?wins:alerts).push('conversão '+Math.round(conv)+'%');if(app!=null)(app>=95?wins:alerts).push('app '+Math.round(app)+'%');if(chair!=null)(chair>=100?wins:alerts).push('meta por cadeira '+Math.round(chair)+'%');if(ticket!=null)(ticket>=3488.25?wins:alerts).push('ticket '+centralMoney(ticket));
 let s='Drs. Tudo bem?? Analisei o relatório de '+cl.city+'. ';
 if(wins.length)s+='Tem coisa bonita aqui 💙: '+wins.join(', ')+'. Obrigado pelo trabalho de vocês! ';
 if(alerts.length)s+='Mas confesso que '+(alerts.length>1?'esses pontos me preocupam':'esse ponto me preocupa')+' 😕: '+alerts.join(', ')+'. ';
 if(evals!=null&&eff!=null)s+='Foram '+evals+' avaliações e '+eff+' efetivações. ';
 s+='Plano para hoje: atacar primeiro o que está abaixo, dividir responsáveis entre recepção/profissionais, trabalhar agenda, reativação e follow-up dos pacientes pendentes e fazer uma parcial no meio do período. No fim do dia quero comparar o que combinamos com o que realmente virou avaliação, efetivação e início.';
 if(alerts.length)s+=' Bora virar esse jogo juntos? 🙌';else s+=' Bora manter essa pegada sem deixar o indicador cair? 😄';
 return s;
}
async function renderReturns(c){
 const id=state.selectedClinic||1;c.innerHTML='<div class="page-intro"><div><span class="eyebrow">TARDE</span><h3>Retorno · mensageiros + grupo</h3><p>Cobrança humana do que foi combinado pela manhã e reação para fechar o dia.</p></div><select id="rClinic">'+CLINICS.map(x=>'<option value="'+x.id+'" '+(x.id===id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div><div class="actions"><button id="rGenerate" class="btn primary">Gerar/atualizar retorno</button></div><div id="returnGuides">'+await guideCards(id,'afternoon_return')+'</div>';
 $('#rClinic').onchange=e=>{state.selectedClinic=Number(e.target.value);renderReturns(c)};$('#rGenerate').onclick=async()=>{await saveDailyGuides(id);renderReturns(c)};await bindReportTextGenerator(id,'return');await bindGuideCards();
}
async function renderHistory(c){
 const months=[...new Set(data.period1History.map(x=>x.month))].sort().reverse();if(!months.includes(monthKey()))months.unshift(monthKey());const selected=state.historyMonth&&months.includes(state.historyMonth)?state.historyMonth:months[0];state.historyMonth=selected;
 const rows=data.period1History.filter(x=>x.month===selected).sort((a,b)=>b.day.localeCompare(a.day)||b.createdAt.localeCompare(a.createdAt));
 let archived=[];try{archived=await mgmtFetch('central_reset_history?select=*&order=reset_at.desc&limit=120')}catch(e){console.warn('Histórico de tratativas indisponível',e)}
 c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">RASTREABILIDADE</span><h3>Histórico</h3><p>Mensageiros, retornos e tratativas arquivadas antes da limpeza dos prints.</p></div></div>
 <div class="card"><div class="section-head"><div><h3>Tratativas arquivadas</h3><div class="clinic-meta">Ao zerar as fotos, o resumo e as mensagens ficam preservados aqui por clínica.</div></div></div><div class="history-list">${archived.map(x=>`<details class="history-day"><summary><strong>${brDate(String(x.source_date||x.reset_at).slice(0,10))} · ${esc(clinic(Number(x.clinic_id))?.name||('Clínica '+x.clinic_id))}</strong> · ${x.print_count} print(s) arquivados</summary><div class="analysis-grid"><div><label>Leitura</label><div class="analysis-copy">${esc(x.summary||'Sem resumo registrado.')}</div></div><div><label>Plano de ação</label><div class="analysis-copy preline">${esc(x.attack_plan||'')}</div></div><div class="span-2"><label>Mensagens preservadas</label><div class="analysis-copy preline">${esc(x.whatsapp_bundle||'')}</div></div></div></details>`).join('')||'<div class="empty">Nenhuma tratativa arquivada por limpeza ainda.</div>'}</div></div>
 <div class="section-head" style="margin-top:18px"><div><h3>Histórico mensal · rotina da manhã</h3></div><select id="historyMonth" style="max-width:220px">${months.map(m=>`<option value="${m}" ${m===selected?'selected':''}>${new Date(m+'-02T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</option>`).join('')}</select></div>
 <div class="history-list">${rows.map(x=>`<div class="card history-day"><div class="section-head"><div><strong>${brDate(x.day)} · ${esc(clinic(x.clinic_id)?.city||x.clinic_name)}</strong></div><button class="ghost danger" data-delete-p1="${x.id}">Excluir dia</button></div><details><summary>Ver mensagens do dia</summary><h4>Franqueados</h4><div class="message-box">${esc(x.franchise_message)}</div>${(x.staff||[]).map(s=>`<h4>${esc(s.name||'Secretária')}</h4><div class="message-box">${esc(s.message)}</div>`).join('')}</details></div>`).join('')||'<div class="empty">Nenhuma rotina salva neste mês.</div>'}</div>`;
 $('#historyMonth').onchange=e=>{state.historyMonth=e.target.value;renderHistory(c)};$$('[data-delete-p1]').forEach(b=>b.onclick=()=>{if(confirm('Excluir este dia do histórico?')){data.period1History=data.period1History.filter(x=>x.id!==b.dataset.deleteP1);save();renderHistory(c);toast('Dia excluído')}})
}
function renderPaths(c){c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">ATALHOS</span><h3>Caminhos dos indicadores</h3><p>Consulte onde encontrar cada dado sem interromper o fluxo.</p></div></div><div class="grid cols-2"><div class="card"><h3>Caminhos do sistema</h3>${Object.keys(paths).map(k=>`<div class="path-item"><strong>${k}</strong><span>${tools[k]} · ${paths[k]}</span></div>`).join('')}</div><div class="card"><h3>Regra do Período 1</h3><div class="hint">Secretárias: mensagem curta com <strong>meta + ferramenta + caminho + retorno</strong>.<br><br>Franqueados: print do relatório + resumo breve dos números + foco do dia.</div></div></div>`}
function renderAdmin(c){const s=data.settings;c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">ADMINISTRAÇÃO</span><h3>Configurações</h3><p>Referências, segurança e manutenção da Central.</p></div></div><div class="grid cols-2"><div class="card"><h3>Metas e referências</h3><div class="form-grid">${setting('minEvaluations','Avaliações mínimas',s)}${setting('maxEvaluations','Avaliações máximas',s)}${setting('cgEffective','Efetivações CG/dia',s)}${setting('orthoFolders','Pastas Orto/dia',s)}${setting('acceptanceHealthy','Aceitação saudável',s,'.01')}${setting('conversionHealthy','Conversão saudável',s,'.01')}${setting('ticketReference','Ticket referência',s,'.01')}</div><button id="saveSettings" class="btn primary block">Salvar configurações</button></div><div class="card"><h3>Backup</h3><div class="hint">Exporte os dados operacionais quando precisar.</div><div class="actions" style="margin-top:14px"><button id="backup" class="btn secondary">Exportar JSON</button><label class="btn secondary">Importar JSON<input id="importBackup" type="file" accept="application/json" class="hidden"></label></div><div style="height:18px"></div><button id="changePass" class="ghost">Trocar senha</button></div></div><div class="card danger-zone"><div class="section-head"><div><span class="eyebrow">MANUTENÇÃO</span><h3>Zerar fotos de todas as clínicas</h3><p>Antes de apagar, o sistema gera um relatório por clínica e preserva leitura, plano de ação e mensagens no Histórico.</p></div><button id="resetAllPhotos" class="btn danger">Arquivar e zerar fotos</button></div><div id="resetStatus" class="hint">As mensagens e análises serão arquivadas; somente depois as imagens serão removidas do banco.</div></div>`;
 $('#saveSettings').onclick=()=>{['minEvaluations','maxEvaluations','cgEffective','orthoFolders','acceptanceHealthy','conversionHealthy','ticketReference'].forEach(k=>data.settings[k]=Number($('#set_'+k).value));save();toast('Configurações salvas')};$('#backup').onclick=exportBackup;$('#importBackup').onchange=importBackup;$('#changePass').onclick=()=>{const p=prompt('Nova senha (mínimo 6 caracteres)');if(p&&p.length>=6){data.passwordHash=hash(p);save();toast('Senha alterada')}};$('#resetAllPhotos').onclick=resetAllCentralPhotos}
async function resetAllCentralPhotos(){
 const btn=$('#resetAllPhotos'),status=$('#resetStatus');if(!confirm('Zerar TODAS as fotos? O sistema vai arquivar um relatório por clínica no Histórico antes de apagar as imagens.'))return;
 btn.disabled=true;btn.textContent='Arquivando…';status.textContent='Lendo prints e análises antes da limpeza…';
 try{
  const shots=await mgmtFetch('central_return_screenshots?select=id,capture_date,clinic_id,return_type,message,message_status,created_at&order=capture_date.asc,clinic_id.asc,id.asc');
  if(!shots.length){status.textContent='Não há fotos no banco para zerar.';toast('Nenhuma foto para apagar.');return}
  const analyses=await mgmtFetch('central_clinic_analysis?select=*&order=capture_date.asc,clinic_id.asc');
  const groups=new Map();
  shots.forEach(x=>{const k=x.capture_date+'|'+x.clinic_id+'|'+x.return_type;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)});
  const archives=[...groups.entries()].map(([k,rows])=>{const [source_date,clinic_id,return_type]=k.split('|'),a=analyses.find(z=>String(z.capture_date)===source_date&&Number(z.clinic_id)===Number(clinic_id)&&Number(z.return_type)===Number(return_type));return{source_date,clinic_id:Number(clinic_id),return_type:Number(return_type),print_count:rows.length,ready_count:rows.filter(x=>x.message_status==='ready'&&x.message).length,summary:a?.summary||'Relatório arquivado antes da limpeza dos prints.',attack_plan:a?.attack_plan||'',team_tasks:a?.team_tasks||'',whatsapp_bundle:a?.whatsapp_bundle||rows.filter(x=>x.message).map(x=>x.message).join('\n\n'),messages_snapshot:rows.map(x=>({id:x.id,message:x.message||'',status:x.message_status,created_at:x.created_at}))}});
  status.textContent='Salvando '+archives.length+' relatório(s) no Histórico…';await mgmtFetch('central_reset_history',{method:'POST',body:JSON.stringify(archives),headers:{Prefer:'return=representation'}});
  status.textContent='Relatórios preservados. Removendo '+shots.length+' foto(s)…';await mgmtFetch('central_return_screenshots?id=gt.0',{method:'DELETE',headers:{Prefer:'return=minimal'}});
  const verify=await mgmtFetch('central_return_screenshots?select=id&limit=1');if(verify.length)throw new Error('A conferência final encontrou fotos restantes; a limpeza não foi concluída.');
  status.textContent='Concluído: '+shots.length+' fotos apagadas e '+archives.length+' relatórios preservados no Histórico.';toast('Fotos zeradas com histórico preservado.');
 }catch(e){console.error(e);status.textContent='Limpeza interrompida: '+e.message;toast('Não foi possível concluir a limpeza.')}finally{btn.disabled=false;btn.textContent='Arquivar e zerar fotos'}
}
function setting(k,l,s,step='1'){return `<div><label>${l}</label><input id="set_${k}" type="number" step="${step}" value="${s[k]}"></div>`}
function exportBackup(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`gestao-12-clinicas-${isoDay()}.json`;a.click();URL.revokeObjectURL(a.href)}
function importBackup(e){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{data={...baseData(),...JSON.parse(rd.result)};save();toast('Backup importado');go('morning')}catch{toast('Backup inválido')}};rd.readAsText(f)}
const CENTRAL_ADMIN_HASH='75e2a2e7';
function showLogin(){$('.login-card p').textContent='Digite sua senha administrativa.'}
$('#loginForm').onsubmit=e=>{e.preventDefault();const p=$('#password').value;if(p.length<6){$('#loginError').textContent='Use pelo menos 6 caracteres.';return}const legacyOk=data.passwordHash&&hash(p)===data.passwordHash,adminOk=hash(p)===CENTRAL_ADMIN_HASH;if(!legacyOk&&!adminOk){$('#loginError').textContent='Senha inválida.';return}if(adminOk&&data.passwordHash!==CENTRAL_ADMIN_HASH){data.passwordHash=CENTRAL_ADMIN_HASH;save()}sessionStorage.setItem('g12_central_pass',p);$('#loginError').textContent='';$('#login').classList.add('hidden');$('#app').classList.remove('hidden');renderNav();go(['morning','returns','centralReturns','team','messages','history','admin'].includes(localStorage.getItem('g12_last_page'))?localStorage.getItem('g12_last_page'):'morning')};
$('#logoutBtn').onclick=()=>{$('#app').classList.add('hidden');$('#login').classList.remove('hidden');$('#password').value=''};$('#exportBtn').onclick=exportBackup;$('#menuToggle').onclick=()=>$('.sidebar').classList.toggle('open');showLogin();

const CENTRAL_DB_ROOT='https://ruzixytmhkduqxoslebu.supabase.co/rest/v1';
const CENTRAL_DB_URL=CENTRAL_DB_ROOT+'/central_return_screenshots';
const CENTRAL_DB_KEY='sb_publishable_yBOiTyDqHdx02M2VYHnMRg_xEC7yGxI';
const CENTRAL_ACCESS_KEY='-xXDgd_wWyzmxEH0cvto_K6stLN3Ho93VmQTswFaFf4';
async function centralFetch(path,opts={}){
  const headers={...(opts.headers||{}),apikey:CENTRAL_DB_KEY,'x-central-key':CENTRAL_ACCESS_KEY,Prefer:'return=representation'};
  let url=CENTRAL_DB_URL;
  if(path.startsWith('/rest/v1/')){url=CENTRAL_DB_ROOT+'/'+path.slice('/rest/v1/'.length);
  }else if(path.startsWith('/today')){
    const q=new URLSearchParams(path.split('?')[1]||''); const cid=q.get('clinic_id'),rt=q.get('return_type');
    url+='?select=id,capture_date,clinic_id,return_type,file_name,mime_type,image_data,message,message_status,created_at,analyzed_at&capture_date=eq.'+isoDay()+'&clinic_id=eq.'+cid+'&return_type=eq.'+rt+'&order=created_at.asc,id.asc';
  }else if(path==='/screenshots'&&opts.method==='POST'){
    url=CENTRAL_DB_URL;
  }else if(path.startsWith('/screenshots/')&&(opts.method==='DELETE'||opts.method==='PATCH')){
    url+='?id=eq.'+path.split('/').pop();
  }
  if(opts.body)headers['Content-Type']='application/json';
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),20000);
  const requestOpts={...opts,headers,signal:controller.signal}; delete requestOpts.fetch;
  let r; try{r=await window.fetch(url,requestOpts)}catch(e){clearTimeout(timer);throw new Error(e.name==='AbortError'?'Tempo limite ao acessar o banco. Tente novamente.':'Falha de conexão com o banco.')} clearTimeout(timer);
  if(!r.ok){let e={};try{e=await r.json()}catch{};throw new Error(e.message||e.error||('Erro '+r.status))}
  if(opts.method==='DELETE')return {ok:true};
  const rows=await r.json();
  if(path.startsWith('/today'))return {screenshots:rows};
  if(path.startsWith('/rest/v1/'))return rows;
  return Array.isArray(rows)?rows[0]:rows;
}
async function compressCentralImage(file){
  const src=await fileToDataUrl(file); const img=new Image();
  await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=src});
  if(!img.width||!img.height)throw new Error('Não foi possível ler esta imagem.');
  const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height));
  const cv=document.createElement('canvas');cv.width=Math.round(img.width*scale);cv.height=Math.round(img.height*scale);
  cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
  return cv.toDataURL('image/jpeg',.76);
}
async function ensureCentralOcr(){
  if(window.Tesseract)return;
  const sources=['https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js','https://unpkg.com/tesseract.js@5/dist/tesseract.min.js'];
  let last=null;
  for(const src of sources){
    try{await new Promise((ok,no)=>{const sc=document.createElement('script');sc.src=src;sc.onload=ok;sc.onerror=()=>no(new Error('CDN indisponível'));document.head.appendChild(sc)});if(window.Tesseract)return}catch(e){last=e}
  }
  throw last||new Error('Não foi possível carregar o leitor de relatórios.');
}
function centralPct(text,label){
  const n=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,' ');
  const r=new RegExp(label+'[^%\\n]{0,80}?([0-9]{1,3}(?:[,.][0-9]+)?)\\s*%','i'),m=n.match(r);
  return m?Number(m[1].replace(',','.')):null;
}
function centralNum(text,regs){
  for(const r of regs){const m=String(text||'').match(r);if(m){const n=Number(String(m[1]).replace(/\./g,'').replace(',','.'));if(Number.isFinite(n))return n}}
  return null;
}
function centralMoney(v){return v==null?'':v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function centralHumanMessage(raw,cl,index,total=1){
 const t=String(raw||'').replace(/\s+/g,' ').trim(),u=t.toUpperCase(),P=(label)=>centralPct(t,label);
 const acceptance=P('aceita.{0,12}o'),conversion=P('convers.{0,12}o'),app=P('aplicativo'),collection=P('aproveitamento'),chair=P('meta.{0,18}cadeira');
 const evals=centralNum(t,[/total de avalia[cç][oõ]es[^0-9]{0,20}(\d+)/i,/avalia[cç][oõ]es[^0-9]{0,15}(\d+)/i]),eff=centralNum(t,[/efetivadas?[^0-9]{0,15}(\d+)/i,/efetiva[cç][oõ]es[^0-9]{0,15}(\d+)/i]);
 const treatments=centralNum(t,[/tratamentos efetivados[^0-9]{0,15}(\d+)/i]),started=centralNum(t,[/tratamentos iniciados[^0-9]{0,15}(\d+)/i]);
 const paid=centralNum(t,[/pastas pagas[^0-9]{0,15}(\d+)/i]),paidGoal=centralNum(t,[/meta de pastas pagas[^0-9]{0,15}(\d+)/i]);
 const charges=centralNum(t,[/cobran[cç]as efetuadas[^0-9]{0,15}(\d+)/i]),payments=centralNum(t,[/pagamentos realizados[^0-9]{0,15}(\d+)/i]);
 const procedures=centralNum(t,[/procedimentos vendidos[^0-9]{0,15}(\d+)/i]),patients=centralNum(t,[/pacientes efetivados[^0-9]{0,15}(\d+)/i]);
 const ticket=centralNum(t,[/ticket\s*m[eé]dio[^0-9]{0,20}([\d.]+,\d{2})/i]),sold=centralNum(t,[/valor vendido[^0-9]{0,15}([\d.]+,\d{2})/i]);
 const h=new Date().getHours(),g=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite',open=index===0?g+' Drs. Tudo bem?? ':'';
 const healthyAcceptance=80,healthyConversion=30,healthyCollection=65,healthyApp=95,healthyTicket=3488.25;
 let msg='',good=false;
 if(/EFETIVAD[OA]S?\s*[Xx×]\s*INICIAD[OA]S?|EFETIVADOS?.{0,20}INICIADOS?/.test(u)){
   const gap=treatments!=null&&started!=null?Math.max(0,treatments-started):null;good=gap===0&&treatments!=null;
   msg=open+(good?'Aqui está bonito de ver 😄: os '+treatments+' tratamentos efetivados já foram iniciados. Obrigado pelo cuidado com esse processo! ':'Aqui acendeu um alerta pra mim 😕. ');
   if(gap>0)msg+='Temos '+treatments+' efetivados e '+started+' iniciados, então '+gap+' paciente'+(gap===1?' ainda precisa':'s ainda precisam')+' começar. ';
   msg+=good?'Plano: manter início no mesmo dia ou em até 2 dias e conferir no fim do expediente se ninguém ficou para trás.':'Plano de ação: a recepção lista agora os efetivados sem início, entra em contato, agenda para hoje ou no máximo em 2 dias e me retorna no fim do período com quem foi agendado e quem ainda ficou pendente.';
 }else if(/ORTODONT/.test(u)||paid!=null){
   const gap=paid!=null&&paidGoal!=null?Math.max(0,paidGoal-paid):null;good=gap===0&&paidGoal!=null;
   msg=open+(good?'Orto em azul, muito bom! 💙 Obrigado pelo trabalho de vocês. ':'Na Orto ainda temos espaço para buscar resultado e não dá para deixar oportunidade passar. ');
   if(paid!=null&&paidGoal!=null)msg+='Estamos com '+paid+' pastas pagas para meta de '+paidGoal+(gap>0?', faltando '+gap+'. ':'. ');
   if(acceptance!=null)msg+='Aceitação em '+Math.round(acceptance)+'%. ';
   msg+='Plano de ação: revisar pacientes avaliados que não fecharam, reforçar indicação de Orto em todo novo paciente, recepção acompanhar até o agendamento e trabalhar as pendências de pasta ainda hoje. Quero retorno do que virou avaliação, pasta e início.';
 }else if(/INDICA[CÇ][OÕ]ES|INDICA[CÇ][AÃ]O/.test(u)){
   good=collection!=null&&collection>=healthyCollection;
   msg=open+'Indicação é uma ferramenta que não podemos deixar parada'+(good?' — aqui o movimento está bom, obrigada equipe! 💙. ':', e aqui fiquei preocupado porque estamos deixando oportunidade na mesa 😕. ')+'Plano de ação: profissional faz a indicação, recepção reforça a abordagem, registra os nomes e acompanha até o agendamento. No fim do período quero o retorno de quantas indicações foram pedidas, quantas viraram contato e quantas viraram avaliação.';
 }else if(/COBRAN[CÇ]A|APROVEITAMENTO DO AGENTE/.test(u)){
   good=collection!=null&&collection>=healthyCollection;msg=open+(good?'Cobrança em resultado saudável 💙. Obrigado pelo trabalho, vamos manter essa pegada! ':'Cobrança me preocupa nesse momento 😕, porque contato sem pagamento não resolve o caixa. ');
   if(charges!=null&&payments!=null)msg+='Foram '+charges+' cobranças e '+payments+' pagamentos. ';
   if(collection!=null)msg+='Aproveitamento em '+Math.round(collection)+'%'+(good?', acima/igual aos '+healthyCollection+'% que usamos como referência. ':', abaixo dos '+healthyCollection+'% de referência. ');
   msg+='Plano de ação: separar a carteira por prioridade, fazer nova rodada nos sem retorno, retomar negociações abertas e registrar o motivo de quem não pagou. Quero parcial durante o dia e fechamento com quantidade de contatos, acordos e pagamentos.';
 }else if(/TICKET M[EÉ]DIO|PROCEDIMENTOS VENDIDOS|PRODUTIVIDADE PROFISSIONAL/.test(u)){
   good=ticket!=null&&ticket>=healthyTicket;msg=open+(good?'Ticket saudável 💙! Obrigado, Drs., esse resultado ajuda diretamente o caixa da clínica. ':'Aqui precisamos de atenção com o ticket 😕, porque ele bate direto no caixa. ');
   if(ticket!=null)msg+='Estamos em '+centralMoney(ticket)+' para referência saudável de '+centralMoney(healthyTicket)+'. ';
   if(procedures!=null&&patients>0)msg+='São '+procedures+' procedimentos para '+patients+' pacientes, média de '+(procedures/patients).toFixed(1).replace('.',',')+' por paciente. ';
   if(sold!=null)msg+='Valor vendido: '+centralMoney(sold)+'. ';
   msg+='Plano de ação: revisar profissional por profissional, trabalhar procedimentos dentro da tabela e montar o plano pelas 4 odontologias — necessidade, reparadora, prevenção e desejo. A referência é buscar média de 11 procedimentos por avaliação, sem empurrar tratamento e sem deixar necessidade clínica fora do plano.';
 }else if(/[ÍI]NDICE DE ACEITA[CÇ][AÃ]O|ACEITA[CÇ][AÃ]O/.test(u)||acceptance!=null){
   good=acceptance!=null&&acceptance>=healthyAcceptance;msg=open+(good?'Aceitação em azul 💙, muito bom! Obrigado pelo trabalho e pela abordagem com os pacientes. ':'Nossa aceitação pede atenção 😕. ');
   if(evals!=null&&eff!=null)msg+='Tivemos '+evals+' avaliações e '+eff+' efetivações. ';
   if(acceptance!=null)msg+='Estamos em '+Math.round(acceptance)+'%'+(good?', dentro dos '+healthyAcceptance+'% saudáveis. ':', abaixo dos '+healthyAcceptance+'% saudáveis. ');
   msg+='Plano de ação: levantar os nomes de quem avaliou e não efetivou, revisar a abordagem, fazer follow-up e pedir retorno de quando cada paciente volta. No grupo, alinhar com recepção e profissionais onde está o menor aproveitamento e o franqueado reforça a execução.';
 }else if(chair!=null){
   good=chair>=100;msg=open+(good?'Meta por cadeira em azul 💙! Obrigado equipe, agora é proteger esse resultado. ':'Meta por cadeira abaixo do esperado e aqui precisamos reagir 😕. ')+'Estamos em '+Math.round(chair)+'%. Plano de ação: calcular o gap de pacientes por cadeira, abrir agenda para avaliações, puxar reativação/faltosos e dividir uma meta objetiva entre as recepcionistas. Fazer parcial à tarde e redistribuir a busca se alguma frente não avançar.';
 }else if(conversion!=null){
   good=conversion>=healthyConversion;msg=open+(good?'Conversão saudável 💙, parabéns pelo aproveitamento! ':'Conversão abaixo do saudável e isso merece atenção 😕. ')+'Estamos em '+Math.round(conversion)+'% para referência de '+healthyConversion+'%. Plano de ação: listar avaliações sem fechamento, separar motivo por paciente, fazer follow-up personalizado e acompanhar retorno até efetivação. Nada de contato genérico: precisamos atacar a dor que travou cada fechamento.';
 }else if(app!=null){
   good=app>=healthyApp;msg=open+(good?'Aplicativo em '+Math.round(app)+'% 💙. Obrigado, equipe, estamos no saudável! ':'Aplicativo em '+Math.round(app)+'% e precisamos recuperar esse indicador 😕. ')+'Plano de ação: conferir paciente por paciente sem instalação, orientar ainda na recepção e validar antes de ele sair da clínica. Meta é chegar aos '+healthyApp+'% e manter.';
 }else{
   msg=open+'Nesse indicador, quero atenção ao que ficou fora do saudável. Não vamos mandar só o problema para o grupo. Plano de ação: identificar os pacientes/processos que formam esse número, definir um responsável, executar a correção ainda no período e retornar com o que foi feito e o resultado. Se já estiver azul, obrigado pelo resultado 💙 — a ação é manter o processo e não deixar regredir.';
 }
 if(index===total-1)msg+=' Para fechar: me atualizem com o que foi feito e o que ainda precisa da minha ajuda. Bora virar o que estiver abaixo e manter o que já está azul! 🙌';
 return msg.trim();
}
function centralClinicActionSummary(rows,cl){
 const texts=rows.map(r=>r._ocrText||'').filter(Boolean),joined=texts.join(' ');
 const P=(label)=>centralPct(joined,label),acceptance=P('aceita.{0,12}o'),conversion=P('convers.{0,12}o'),app=P('aplicativo'),chair=P('meta.{0,18}cadeira');
 const ticket=centralNum(joined,[/ticket\s*m[eé]dio[^0-9]{0,20}([\d.]+,\d{2})/i]);
 const issues=[],wins=[];
 const check=(label,val,target,high=true)=>{if(val==null)return;(high?val>=target:val<=target?true:false)?wins.push(label+' '+Math.round(val)+'%'):issues.push(label+' '+Math.round(val)+'%')};
 check('aceitação',acceptance,80);check('conversão',conversion,30);check('aplicativo',app,95);if(chair!=null)(chair>=100?wins:issues).push('meta por cadeira '+Math.round(chair)+'%');if(ticket!=null)(ticket>=3419.85?wins:issues).push('ticket '+centralMoney(ticket));
 const people=(data.staff?.[cl.id]||[]).filter(x=>x.name);
 const owners=people.slice(0,3).map(x=>x.name).join(', ');
 return {summary:(wins.length?'Pontos saudáveis: '+wins.join(', ')+'. ':'')+(issues.length?'Prioridades de reação: '+issues.join(', ')+'.':'Sem indicador crítico identificado com segurança nos prints lidos.'),attack:['1. Trabalhar primeiro os indicadores abaixo do saudável e transformar cada gap em lista de pacientes/processos.','2. Recepção: agenda, reativação, faltosos, indicações e avaliações sem fechamento.','3. Cobrança: carteira priorizada, follow-up e retorno de acordos/pagamentos.','4. Profissionais/franqueado: abordagem, ticket, indicações e reforço da execução.','5. Fazer parcial à tarde e fechar o dia com realizado, pendência e próximo passo.'].join('\n'),tasks:(owners?'Responsáveis cadastrados para direcionamento: '+owners+'.\n':'')+'Cada ação deve sair com responsável, meta e retorno do que foi feito; problema sem solução não entra como tratativa final.'};
}
async function centralSaveClinicAnalysis(rows,cl){
 const a=centralClinicActionSummary(rows,cl),bundle=rows.filter(x=>x.message).map((x,i)=>'PRINT '+(i+1)+'\n'+x.message).join('\n\n');
 const body={capture_date:rows[0]?.capture_date||isoDay(),clinic_id:cl.id,return_type:2,summary:a.summary,attack_plan:a.attack,team_tasks:a.tasks,whatsapp_bundle:bundle,updated_at:new Date().toISOString()};
 const existing=await mgmtFetch('central_clinic_analysis?select=id&capture_date=eq.'+body.capture_date+'&clinic_id=eq.'+cl.id+'&return_type=eq.2&limit=1');
 if(existing[0])await mgmtFetch('central_clinic_analysis?id=eq.'+existing[0].id,{method:'PATCH',body:JSON.stringify(body)});
 else await mgmtFetch('central_clinic_analysis',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
}
function centralNormalize(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function centralContext(raw,cl){
  const t=String(raw||'').replace(/\s+/g,' ').trim(),n=centralNormalize(t);
  const dates=[...t.matchAll(/\b(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/g)].map(m=>m[1]);
  const times=[...t.matchAll(/\b([01]?\d|2[0-3]):[0-5]\d\b/g)].map(m=>m[0]);
  const names=[cl?.city,cl?.name].filter(Boolean).map(centralNormalize).filter(x=>x.length>=4);
  const expectedHit=names.some(x=>n.includes(x));
  const other=CLINICS.filter(x=>x.id!==cl?.id).find(x=>[x.city,x.name].filter(Boolean).map(centralNormalize).filter(v=>v.length>=5).some(v=>n.includes(v)));
  return {text:t,n,dates:[...new Set(dates)],times:[...new Set(times)],expectedHit,other};
}
function centralValidateClinic(raw,cl){
  const c=centralContext(raw,cl);
  if(c.other&&!c.expectedHit)throw new Error('Este print parece ser da clínica '+c.other.city+', mas está selecionada '+cl.city+'. Confira a unidade antes de gerar.');
  return c;
}
function centralReturn1Extract(raw,cl){
  const c=centralValidateClinic(raw,cl),t=c.text;
  const eff=centralNum(t,[
    /(?:qtd|quantidade|total)?\s*(?:de\s*)?efetiva[cç][oõ]es?[^0-9]{0,35}(\d{1,3})/i,
    /tratamentos?\s+efetivados?[^0-9]{0,30}(\d{1,3})/i,
    /efetivados?[^0-9]{0,30}(\d{1,3})/i,
    /realizadas?[^0-9]{0,25}(\d{1,3})/i
  ]);
  const goal=centralNum(t,[
    /meta\s*(?:di[aá]ria|de\s+efetiva[cç][oõ]es|efetiva[cç][oõ]es|do\s+per[ií]odo)?[^0-9]{0,35}(\d{1,3})/i,
    /objetivo[^0-9]{0,30}(\d{1,3})/i,
    /proporcional[^0-9]{0,30}(\d{1,3})/i
  ]);
  return {...c,eff,goal};
}
function centralSplitTarget(total,count){
  if(!Number.isFinite(total)||total<=0||count<=0)return Array(count).fill(0);
  const base=Math.floor(total/count),rest=total%count;
  return Array.from({length:count},(_,i)=>base+(i<rest?1:0));
}
function centralReturn1Message(raw,cl,people=[]){
  const c=centralReturn1Extract(raw,cl),h=new Date().getHours(),g=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  const period=c.dates.length>=2?' de '+c.dates[0]+' a '+c.dates[c.dates.length-1]:(c.dates.length===1?' em '+c.dates[0]:'');
  const staff=(people||[]).filter(x=>x&&x.name).slice(0,5);
  const names=staff.length?staff.map(x=>x.name):['Colaboradora 1','Colaboradora 2','Colaboradora 3'];
  const gap=c.eff!=null&&c.goal!=null?Math.max(0,c.goal-c.eff):null;
  const split=centralSplitTarget(gap||0,names.length);
  const jobs=[
    'agenda e reagendamento: puxar faltosos, pacientes sem próximo horário e encaixes; confirmar a agenda e ocupar horários vagos com avaliação',
    'avaliações e captação: trabalhar indicações, reativações e contatos pendentes para colocar novas avaliações na cadeira e acompanhar quem ainda não confirmou',
    'conversão e início: revisar avaliações que não fecharam, fazer follow-up, apoiar a negociação e garantir que quem efetivar já saia com o início do tratamento organizado',
    'Ortodontia e indicações internas: aproveitar pacientes em atendimento para gerar avaliação de Orto/Clínico Geral e acompanhar até o agendamento',
    'confirmação e recuperação: reforçar confirmações do dia, recuperar cancelamentos/faltas e manter a agenda produtiva'
  ];
  const assignments=names.map((name,i)=>{
    const target=gap>0&&split[i]>0?' Meta de contribuição: buscar '+split[i]+' efetivaç'+(split[i]===1?'ão':'ões')+' para a recuperação.':'';
    return '• '+name+': '+jobs[i%jobs.length]+'.'+target;
  }).join('\n');
  let resultLine='';
  if(c.eff!=null&&c.goal!=null)resultLine='Tivemos '+c.eff+' efetivações para uma meta de '+c.goal+'. '+(gap>0?'Ficaram '+gap+' para recuperar.':'Meta atingida. Agora é manter o ritmo e proteger a agenda.');
  else if(c.eff!=null)resultLine='Tivemos '+c.eff+' efetivações'+period+'. A meta numérica não ficou legível com segurança no print, então não vou inventar esse número.';
  else resultLine='O print foi lido, mas o total de efetivações/meta não ficou seguro o suficiente para eu afirmar um número. A divisão operacional abaixo pode ser usada enquanto o dado é conferido.';
  const team=g+' meninas! Conferi o Retorno 1'+period+'. '+resultLine+'\n\nPra gente buscar cadeira cheia e resultado, vamos dividir assim:\n'+assignments+'\n\nQuero acompanhamento durante o período, sem deixar avaliação, faltoso ou paciente sem agenda parado. O foco é transformar agenda em avaliação, avaliação em efetivação e efetivação em início.';
  const docs=g+' Drs. Tudo bem?? Conferi o Retorno 1'+period+'. '+(c.eff!=null&&c.goal!=null?(gap>0?'Tivemos '+c.eff+' efetivações para meta de '+c.goal+', ficando '+gap+' abaixo. Já dividi a recuperação entre as colaboradoras com foco em agenda/reagendamento, novas avaliações, follow-up e conversão.':'Tivemos '+c.eff+' efetivações para meta de '+c.goal+' e atingimos o combinado. Vou manter a equipe trabalhando agenda, avaliações e conversão para sustentar o resultado.'):'Já direcionei a equipe para atacar agenda, reagendamento, avaliações, follow-up e conversão enquanto confirmamos o número final do relatório.');
  return 'COLABORADORAS · MENSAGEIRO\n'+team+'\n\nFRANQUEADOS · GRUPO\n'+docs;
}
async function centralReadReturn1(row,cl){
  await ensureCentralOcr();
  const status=$('#crStatus');
  if(status)status.textContent='Retorno 1 · lendo clínica, período, efetivações e meta…';
  const result=await Promise.race([
    Tesseract.recognize(row.image_data,'eng',{logger:m=>{
      if(m.status==='recognizing text'&&status){
        const p=Math.round((m.progress||0)*100);
        status.textContent=(p<35?'Retorno 1 · lendo cabeçalho e período':p<75?'Retorno 1 · conferindo efetivações e meta':'Retorno 1 · preparando divisão das atividades')+' · '+p+'%';
      }
    }}),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('A leitura do retorno passou de 4 minutos. Confira a conexão e tente novamente.')),240000))
  ]);
  const text=String(result.data?.text||'').trim();
  const confidence=Number(result.data?.confidence||0);
  if(text.length<12)throw new Error('Não consegui ler texto suficiente do Retorno 1. Confira se o print está nítido e tente novamente.');
  row._ocrText=text;row._ocrConfidence=confidence;
  if(status)status.textContent='Retorno 1 · leitura concluída · montando mensagens e atividades…';
  return text;
}
async function centralGenerateOne(row,index,cl,reportText=''){
  await ensureCentralOcr();
  const status=$('#crStatus');
  const stages=['Preparando imagem','Lendo cabeçalho, clínica e período','Extraindo indicadores e metas','Conferindo números e metas','Definindo problema e prioridade','Montando plano de ação','Revisando tom humano e mensagem final'];
  if(status)status.textContent=stages[0]+' · print '+(index+1);
  const r=await Promise.race([
    Tesseract.recognize(row.image_data,'eng',{logger:m=>{if(m.status==='recognizing text'&&status){const p=Math.round((m.progress||0)*100),stage=p<20?stages[1]:p<45?stages[2]:p<65?stages[3]:p<78?stages[4]:p<90?stages[5]:stages[6];status.textContent=stage+' · print '+(index+1)+' · '+p+'%'}}}),
    new Promise((_,no)=>setTimeout(()=>no(new Error('A leitura passou de 4 minutos. Confira a conexão e tente novamente.')),240000))
  ]);
  const text=r.data?.text||'',confidence=Number(r.data?.confidence||0);
  if(text.trim().length<20||confidence<18)throw new Error('A leitura do print '+(index+1)+' ficou com baixa confiança ('+Math.round(confidence)+'%). Nada foi sobrescrito: melhore a nitidez do print e tente novamente.');
  const ctx=centralValidateClinic(text,cl);
  row._ocrText=text;row._ocrConfidence=confidence;row._ocrContext=ctx;
  if(status)status.textContent='Conferência final · print '+(index+1)+' · '+(ctx.dates.length?('datas '+ctx.dates.join(' → ')):'período sendo validado');
  return centralHumanMessage(reportText?reportText+'\n\nLEITURA DO PRINT ATUAL:\n'+text:text,cl,index,centralRows.length);
}
async function centralSaveMessage(id,message){
  await centralFetch('/screenshots/'+id,{method:'PATCH',body:JSON.stringify({message,message_status:'ready',analyzed_at:new Date().toISOString()})});
}
async function copyPrintAndMessage(row){
  try{
    const res=await fetch(row.image_data),jpg=await res.blob();
    const cv=document.createElement('canvas'),img=new Image();img.src=URL.createObjectURL(jpg);await new Promise((ok,no)=>{img.onload=ok;img.onerror=no});
    cv.width=img.naturalWidth;cv.height=img.naturalHeight;cv.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(img.src);
    const png=await new Promise(ok=>cv.toBlob(ok,'image/png'));
    if(navigator.clipboard?.write&&window.ClipboardItem){
      // Clipboard/WhatsApp normally pastes either the image or the text flavor, not both as image + caption.
      // Copy the image first, then show a tiny guided step for the matching caption.
      await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
      const guide=document.createElement('div');guide.className='copy-guide';guide.innerHTML='<strong>Print copiado ✓</strong><span>1. Cole a imagem no WhatsApp.<br>2. Volte aqui e clique abaixo para copiar a mensagem deste mesmo print.</span><button class="btn primary">Copiar mensagem agora</button>';
      document.body.appendChild(guide);guide.querySelector('button').onclick=async()=>{await copyText(row.message||'');guide.remove();toast('Mensagem copiada. Volte ao WhatsApp e cole como legenda/mensagem.')};
      setTimeout(()=>guide.remove(),30000);toast('Imagem copiada. Cole no WhatsApp e depois copie a mensagem.');
    }else{await copyText(row.message||'');toast('O navegador não permite copiar imagem pela área de transferência; mensagem copiada.')}
  }catch(e){console.error(e);await copyText(row.message||'');toast('Mensagem copiada; o navegador bloqueou a cópia conjunta da imagem.')}
}
async function copyAllForWhatsApp(rows){
  const btn=$('#crCopyAll'),box=$('#crCopyProgress'),bar=box?.querySelector('i'),label=box?.querySelector('span');
  if(!rows.length)return toast('Nenhum print para copiar.');
  btn.disabled=true;if(box)box.classList.remove('hidden');
  try{
    const parts=[];
    for(let i=0;i<rows.length;i++){
      if(label)label.textContent='Preparando '+(i+1)+' de '+rows.length+'…';
      if(bar)bar.style.width=Math.round(((i+1)/rows.length)*100)+'%';
      parts.push('PRINT '+(i+1)+'\n'+(rows[i].message||''));
      await new Promise(r=>setTimeout(r,40));
    }
    await copyText(parts.join('\n\n'));
    if(label)label.textContent='Mensagens copiadas. As imagens serão abertas em sequência para envio.';
    // Browsers/WhatsApp do not reliably accept multiple images + independent captions in one clipboard write.
    // Open a safe send tray so the user can copy each image in order without losing the matching text.
    const tray=document.createElement('div');tray.className='whatsapp-copy-tray';
    tray.innerHTML='<div class="copy-tray-head"><strong>Envio para WhatsApp · '+rows.length+' prints</strong><button class="ghost" data-close-tray>Fechar</button></div><p>As mensagens já estão copiadas. Envie os cards abaixo na ordem; cada botão copia a imagem correspondente e mantém a mensagem visível.</p><div class="copy-tray-list">'+rows.map((r,i)=>'<div class="copy-tray-item"><img src="'+r.image_data+'"><div><strong>Print '+(i+1)+'</strong><p>'+esc(r.message||'')+'</p><button class="btn primary" data-copy-image="'+i+'">Copiar imagem '+(i+1)+'</button></div></div>').join('')+'</div>';
    document.body.appendChild(tray);tray.querySelector('[data-close-tray]').onclick=()=>tray.remove();
    tray.querySelectorAll('[data-copy-image]').forEach(b=>b.onclick=async()=>{const r=rows[Number(b.dataset.copyImage)];try{const res=await fetch(r.image_data),blob=await res.blob(),cv=document.createElement('canvas'),img=new Image();img.src=URL.createObjectURL(blob);await new Promise((ok,no)=>{img.onload=ok;img.onerror=no});cv.width=img.naturalWidth;cv.height=img.naturalHeight;cv.getContext('2d').drawImage(img,0,0);const png=await new Promise(ok=>cv.toBlob(ok,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);toast('Imagem '+(Number(b.dataset.copyImage)+1)+' copiada.')}catch(e){toast('O navegador bloqueou a cópia desta imagem.')}});
  }finally{btn.disabled=false}
}

async function renderCentralReturns(c){
  const cl=clinic(state.selectedClinic||1);
  c.innerHTML='<div class="section-head"><div><h3>Tratativa</h3><div class="clinic-meta">Análise pesada dos relatórios da tarde: problema, solução, direcionamento e mensagem pronta para WhatsApp.</div></div></div>'+
  '<div class="card central-controls"><div class="form-grid"><div><label>Clínica</label><select id="crClinic">'+CLINICS.map(x=>'<option value="'+x.id+'" '+(x.id===cl.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div><div><label>Tipo</label><select id="crType"><option value="1">Retorno da tarde · acompanhamento</option><option value="2" selected>Tratativa · análise completa por print</option></select></div></div></div>'+
  '<div class="treatment-quality card"><strong>Leitura completa · modo produção</strong><span>O sistema pode levar alguns minutos: valida clínica, números, meta, tom da mensagem e exige plano de ação antes de salvar.</span></div><div class="card report-text-card"><div class="section-head"><div><h3>Texto completo do relatório</h3><div class="clinic-meta">Cole aqui o relatório em texto desta clínica. Ele fica salvo por clínica e data e entra junto com os prints na leitura estratégica.</div></div><span id="crTextState" class="hint">Carregando…</span></div><textarea id="crReportText" rows="10" placeholder="Cole aqui todo o texto do relatório da clínica…"></textarea><div class="actions"><button id="crSaveText" class="btn primary">Salvar texto desta clínica</button><button id="crClearText" class="ghost danger">Limpar texto</button></div></div><div id="crPaste" class="paste-zone" tabindex="0"><strong>Ctrl+V para colar os prints da clínica</strong><span>Pode colar 8 ou mais. O original fica salvo até você decidir arquivar e zerar.</span><label class="btn secondary">Selecionar imagens<input id="crFiles" class="hidden" type="file" accept="image/*" multiple></label></div>'+
  '<div class="actions"><button id="crGenerateFromText" class="btn primary">Gerar tratativa pelo texto</button></div><div id="crSavedTreatment"></div><div class="central-progress analysis-status-panel"><div class="analysis-spinner" id="crSpinner"></div><div><strong id="crStatusTitle">Central de análise</strong><span id="crStatus" class="hint">Carregando registros de hoje…</span><div class="analysis-live-bar"><i id="crLiveBar"></i></div></div><div class="actions"><button id="crGenerateAll" class="btn primary">Gerar mensagens desta clínica</button><button id="crGenerateAllClinics" class="btn secondary">Ler todas as clínicas</button><button id="crReload" class="ghost">Atualizar</button></div></div><div id="crAnalysis"></div><div id="crGrid" class="central-grid return2-grid"></div>';
  $('#crClinic').onchange=e=>{state.selectedClinic=Number(e.target.value);renderCentralReturns(c)};
  $('#crSaveText').onclick=()=>saveCentralReportText();
  $('#crClearText').onclick=()=>clearCentralReportText();
  $('#crType').onchange=()=>Promise.all([loadCentralReturns(),loadCentralReportText()]);
  $('#crPaste').onpaste=async e=>{const files=[...e.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();await uploadCentralFiles(files)}};
  $('#crFiles').onchange=async e=>{await uploadCentralFiles([...e.target.files]);e.target.value=''};
  $('#crReload').onclick=()=>loadCentralReturns();
  $('#crGenerateAll').onclick=()=>generateCentralMessages(); $('#crGenerateFromText').onclick=async()=>{const b=$('#crGenerateFromText');b.disabled=true;try{await saveCentralReportText();await saveDailyGuides(Number($('#crClinic').value));toast('Tratativa pelo texto atualizada.');renderCentralReturns(c)}catch(e){toast('Falha: '+e.message)}finally{b.disabled=false}};
  $('#crGenerateAllClinics').onclick=()=>generateAllClinics();
  $('#crPaste').ondragover=e=>{e.preventDefault();e.currentTarget.classList.add('drag-over')}; $('#crPaste').ondragleave=e=>e.currentTarget.classList.remove('drag-over'); $('#crPaste').ondrop=async e=>{e.preventDefault();e.currentTarget.classList.remove('drag-over');await uploadCentralFiles([...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')))};
  $('#crPaste').focus();
  await Promise.all([loadCentralReturns(),loadCentralReportText()]); try{$('#crSavedTreatment').innerHTML=await guideCards(Number($('#crClinic').value),'treatment');await bindGuideCards()}catch{}
}
async function loadCentralReportText(){
 const cid=Number($('#crClinic')?.value||state.selectedClinic||1),rt=Number($('#crType')?.value||2),box=$('#crReportText'),st=$('#crTextState');if(!box)return;
 try{const rows=await mgmtFetch('central_report_texts?select=id,report_text,updated_at&capture_date=eq.'+isoDay()+'&clinic_id=eq.'+cid+'&return_type=eq.'+rt+'&limit=1');box.value=rows[0]?.report_text||'';box.dataset.rowId=rows[0]?.id||'';if(st)st.textContent=rows[0]?'Salvo · '+new Date(rows[0].updated_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Ainda não salvo';}catch(e){if(st)st.textContent='Falha ao carregar';console.error(e)}
}
async function saveCentralReportText(){
 const box=$('#crReportText'),st=$('#crTextState'),text=(box?.value||'').trim(),cid=Number($('#crClinic').value),rt=Number($('#crType').value);if(!text)return toast('Cole o texto do relatório primeiro.');
 try{if(st)st.textContent='Salvando…';const body={capture_date:isoDay(),clinic_id:cid,return_type:rt,report_text:text,updated_at:new Date().toISOString()};const id=box.dataset.rowId;if(id)await mgmtFetch('central_report_texts?id=eq.'+id,{method:'PATCH',body:JSON.stringify(body)});else await mgmtFetch('central_report_texts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});await loadCentralReportText();toast('Texto do relatório salvo nesta clínica.');}catch(e){if(st)st.textContent='Falha ao salvar';toast('Não foi possível salvar o texto: '+e.message)}
}
async function clearCentralReportText(){
 const box=$('#crReportText'),id=box?.dataset.rowId;if(!box)return;if(!confirm('Limpar o texto do relatório desta clínica hoje?'))return;
 try{if(id)await mgmtFetch('central_report_texts?id=eq.'+id,{method:'DELETE'});box.value='';box.dataset.rowId='';$('#crTextState').textContent='Ainda não salvo';toast('Texto removido desta clínica.');}catch(e){toast('Não foi possível limpar: '+e.message)}
}
async function currentCentralReportText(){
 const box=$('#crReportText');if(box&&box.value.trim())return box.value.trim();const cid=Number($('#crClinic')?.value||state.selectedClinic||1),rt=Number($('#crType')?.value||2);try{const rows=await mgmtFetch('central_report_texts?select=report_text&capture_date=eq.'+isoDay()+'&clinic_id=eq.'+cid+'&return_type=eq.'+rt+'&limit=1');return rows[0]?.report_text||''}catch{return ''}
}
async function fileToDataUrl(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)})}
async function uploadCentralFiles(files){
  if(!files.length)return;
  const status=$('#crStatus'),zone=$('#crPaste'); status.textContent='Preparando '+files.length+' print(s)…'; if(zone)zone.classList.add('is-uploading');
  try{
    for(const f of files){
      if(!f.type.startsWith('image/'))throw new Error('O arquivo selecionado não é uma imagem.');
      if(f.size>12*1024*1024)throw new Error('Cada imagem deve ter no máximo 12 MB.');
      const data_url=await compressCentralImage(f);
      await centralFetch('/screenshots',{method:'POST',body:JSON.stringify({clinic_id:Number($('#crClinic').value),return_type:Number($('#crType').value),file_name:f.name||'print.png',mime_type:'image/jpeg',image_data:data_url,message_status:'pending',capture_date:isoDay()})});
    }
    toast(files.length+' print(s) salvo(s) no banco');await loadCentralReturns();
  }catch(e){console.error('Falha no upload de print',e);status.textContent='Falha ao salvar o print: '+e.message;toast('Falha ao salvar: '+e.message)}finally{if(zone)zone.classList.remove('is-uploading')}
}
let centralRows=[];
async function generateCentralMessages(){
  if(!centralRows.length)return toast('Adicione os prints primeiro.');
  const cl=clinic(Number($('#crClinic').value)),returnType=Number($('#crType').value),btn=$('#crGenerateAll'),status=$('#crStatus'),title=$('#crStatusTitle'),spin=$('#crSpinner'),bar=$('#crLiveBar');
  btn.disabled=true;btn.textContent=returnType===1?'Lendo retorno…':'Analisando…';spin?.classList.add('active');
  if(title)title.textContent=returnType===1?'Leitura do retorno da tarde em andamento':'Análise estratégica em andamento';
  if(bar)bar.style.width='2%';
  try{
    if(returnType===1){
      const row=centralRows[centralRows.length-1];
      const text=await centralReadReturn1(row,cl),reportText=await currentCentralReportText(),strategicText=reportText?reportText+'\n\nLEITURA DO PRINT:\n'+text:text;
      const localPeople=(data.staff?.[cl.id]||[]).map(x=>({name:x.name,functions:x.resp||'',individual_goal:x.target||''})).filter(x=>x.name);
      const msg=centralReturn1Message(strategicText,cl,localPeople);
      if(!msg||msg.trim().length<80)throw new Error('A mensagem do Retorno 1 não ficou confiável o suficiente para salvar.');
      await centralSaveMessage(row.id,msg);
      row.message=msg;row.message_status='ready';
      if(status)status.textContent='Retorno 1 concluído · leitura, divisão das atividades e mensagens prontas.';
      if(title)title.textContent='Retorno 1 concluído';
      if(bar)bar.style.width='100%';
      toast('Retorno 1 preparado.');
    }else{
      for(let i=0;i<centralRows.length;i++){
        const row=centralRows[i];
        if(status)status.textContent='Print '+(i+1)+' de '+centralRows.length+' · identificando título, números, metas e oportunidades…';
        if(bar)bar.style.width=Math.round((i/centralRows.length)*100)+'%';
        const msg=await centralGenerateOne(row,i,cl,await currentCentralReportText());
        if(!msg||msg.trim().length<90||!/Plano de ação|Plano:/.test(msg))throw new Error('O print '+(i+1)+' não passou na validação final de mensagem + plano de ação. Nada foi sobrescrito; use Gerar novamente.');
        await centralSaveMessage(row.id,msg);row.message=msg;row.message_status='ready';
      }
      if(status)status.textContent='Análise concluída · '+centralRows.length+' de '+centralRows.length+' prints lidos e com mensagem.';
      if(title)title.textContent='Análise concluída';
      if(bar)bar.style.width='100%';
      await centralSaveClinicAnalysis(centralRows,cl); toast('Tratativa concluída: mensagens, plano de ataque e distribuição validados e salvos.');
    }
    await loadCentralReturns();
  }catch(e){
    console.error('Falha na geração central',e);
    if(status)status.textContent='Erro na leitura: '+e.message;
    toast('Não foi possível concluir: '+e.message);
  }finally{
    btn.disabled=false;btn.textContent=returnType===1?'Gerar retorno da tarde':'Gerar tratativa completa';spin?.classList.remove('active');
  }
}
async function generateAllClinics(){
  const btn=$('#crGenerateAllClinics'),status=$('#crStatus'),type=Number($('#crType').value),original=Number($('#crClinic').value);
  btn.disabled=true;btn.textContent='Lendo 12 clínicas…';
  let ok=0,fail=[];
  try{
    for(let pos=0;pos<CLINICS.length;pos++){
      const cl=CLINICS[pos];$('#crClinic').value=cl.id;
      if(status)status.textContent='Clínica '+(pos+1)+' de 12 · '+cl.city+' · carregando prints…';
      await loadCentralReturns();
      if(!centralRows.length){fail.push(cl.city+': sem print');continue}
      try{await generateCentralMessages();ok++}catch(e){fail.push(cl.city+': '+e.message)}
    }
    toast(ok+' clínica(s) processada(s).');
    if(status)status.textContent='Leitura geral concluída · '+ok+'/12 processadas'+(fail.length?' · '+fail.length+' pendência(s)':'');
  }finally{$('#crClinic').value=original;state.selectedClinic=original;await loadCentralReturns();btn.disabled=false;btn.textContent='Ler todas as clínicas'}
}
async function loadCentralReturns(){
  const status=$('#crStatus'),grid=$('#crGrid'); if(!status||!grid)return;
  try{
    const clinic_id=Number($('#crClinic').value),return_type=Number($('#crType').value);
    let d=await centralFetch('/today?clinic_id='+clinic_id+'&return_type='+return_type);
    let analysisDate=isoDay(),showingLatest=false;
    if(!d.screenshots.length){
      const latest=await mgmtFetch('central_return_screenshots?select=id,capture_date,clinic_id,return_type,file_name,mime_type,image_data,message,message_status,created_at,analyzed_at&clinic_id=eq.'+clinic_id+'&return_type=eq.'+return_type+'&order=capture_date.desc,created_at.asc,id.asc&limit=100');
      if(latest.length){
        analysisDate=latest[0].capture_date;
        d={screenshots:latest.filter(x=>x.capture_date===analysisDate)};
        showingLatest=analysisDate!==isoDay();
      }
    }else analysisDate=d.screenshots[0]?.capture_date||isoDay();
    centralRows=d.screenshots;
    const readyCount=d.screenshots.filter(x=>x.message&&x.message_status==='ready').length;
    const when=showingLatest?'última análise de '+brDate(analysisDate):'hoje';
    status.textContent=d.screenshots.length+' print(s) salvo(s) '+when+' · '+(return_type===1?'Retorno da tarde: acompanhamento objetivo.':readyCount===d.screenshots.length&&d.screenshots.length?'Análise concluída · '+readyCount+' mensagem(ns) prontas para copiar.':'Tratativa: relatório por relatório, com solução e texto pronto para copiar.');
    const genBtn=$('#crGenerateAll');
    genBtn.style.display='';
    genBtn.disabled=false;
    genBtn.textContent=readyCount===d.screenshots.length&&d.screenshots.length?'Gerar novamente':(return_type===1?'Gerar Retorno 1':'Gerar mensagens dos prints');
    const analysisBox=$('#crAnalysis');
    if(return_type===2){
      const rows=await mgmtFetch('central_clinic_analysis?select=*&capture_date=eq.'+analysisDate+'&clinic_id=eq.'+clinic_id+'&return_type=eq.2&limit=1');
      const a=rows[0]||null;
      const fallbackBundle=d.screenshots.filter(x=>x.message).map(x=>x.message).join('\n\n');
      if(a){
        analysisBox.innerHTML='<section class="analysis-hub card"><div class="section-head"><div><span class="badge green">ANÁLISE CONCLUÍDA</span><h3>Leitura da clínica + plano de ataque</h3><p>'+esc(clinic(clinic_id)?.name||'')+'</p></div><div class="actions"><button id="crCopyAll" class="btn primary">Copiar todos · WhatsApp</button><button id="crCopyPlan" class="ghost">Copiar plano de ataque</button></div><div id="crCopyProgress" class="copy-progress hidden"><div class="copy-progress-bar"><i></i></div><span></span></div></div><div class="analysis-grid"><div><label>Leitura objetiva</label><div class="analysis-copy">'+esc(a.summary||'')+'</div></div><div><label>Plano de ataque</label><div class="analysis-copy preline">'+esc(a.attack_plan||'')+'</div></div><div class="span-2"><label>Distribuição de tarefas</label><div class="analysis-copy preline">'+esc(a.team_tasks||'')+'</div></div></div></section>';
        $('#crCopyAll').onclick=()=>copyAllForWhatsApp(d.screenshots);
        $('#crCopyPlan').onclick=()=>copyText((a.attack_plan||'')+'\n\n'+(a.team_tasks||''));
      }else analysisBox.innerHTML='<div class="hint analysis-wait">Os prints estão salvos. A leitura estratégica desta clínica ainda não foi registrada.</div>';
    }else analysisBox.innerHTML='';
    if(!d.screenshots.length){grid.innerHTML='<div class="empty">Nenhum print salvo para esta clínica/tipo hoje.</div>';return}
    grid.innerHTML=d.screenshots.map((x,i)=>'<article class="card print-card return2-card"><div class="print-head"><div><strong>Print '+(i+1)+'</strong><span class="clinic-meta">'+esc(clinic(clinic_id)?.city||'')+'</span></div><button class="ghost danger" data-cr-del="'+x.id+'">Excluir</button></div><button class="report-preview-btn" data-cr-preview="'+i+'" title="Abrir relatório em tamanho grande"><img src="'+x.image_data+'" loading="lazy" alt="Print '+(i+1)+'"><span>🔎 Clique para ampliar e conferir o relatório</span></button><label class="return-message-label">Mensagem pronta para o grupo</label><textarea class="return-message-editor '+(x.message?'':'pending-message')+'" data-cr-msg="'+x.id+'" rows="7" placeholder="Clique em Gerar mensagens dos prints…">'+esc(x.message||'')+'</textarea><div class="return-actions"><button class="ghost" data-cr-save="'+x.id+'">Salvar texto</button><button class="ghost" data-cr-copy="'+i+'">Copiar mensagem</button><button class="btn primary" data-cr-pack="'+i+'" '+(x.message?'':'disabled')+'>Copiar print + mensagem</button></div></article>').join('');
    $$('[data-cr-preview]').forEach(b=>b.onclick=()=>{const r=d.screenshots[Number(b.dataset.crPreview)];const modal=document.createElement('div');modal.className='report-preview-modal';modal.innerHTML='<div class="report-preview-toolbar"><strong>Print '+(Number(b.dataset.crPreview)+1)+' · '+esc(clinic(clinic_id)?.name||'')+'</strong><span>Use a rolagem para conferir todos os números</span><button class="btn secondary" data-close-preview>Fechar</button></div><div class="report-preview-stage"><img src="'+r.image_data+'" alt="Relatório ampliado"></div>';document.body.appendChild(modal);modal.querySelector('[data-close-preview]').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove()};});
    $$('[data-cr-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este print?'))return;await centralFetch('/screenshots/'+b.dataset.crDel,{method:'DELETE'});await loadCentralReturns()});
    $$('[data-cr-save]').forEach(b=>b.onclick=async()=>{const msg=$('[data-cr-msg="'+b.dataset.crSave+'"]').value.trim();await centralSaveMessage(b.dataset.crSave,msg);toast('Mensagem salva');await loadCentralReturns()});
    $$('[data-cr-copy]').forEach(b=>b.onclick=()=>copyText(d.screenshots[Number(b.dataset.crCopy)].message||''));
    $$('[data-cr-pack]').forEach(b=>b.onclick=()=>copyPrintAndMessage(d.screenshots[Number(b.dataset.crPack)]));
  }catch(e){console.error('Central de prints',e);status.textContent='Erro ao carregar os prints: '+e.message;grid.innerHTML='<div class="empty">Os prints não foram apagados. Clique em Atualizar para tentar carregar novamente.</div>'}
}

// Productivity shortcuts
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const q=prompt('Ir para clínica');if(!q)return;const cl=CLINICS.find(x=>x.name.toLowerCase().includes(q.toLowerCase())||x.city.toLowerCase().includes(q.toLowerCase()));if(cl){state.selectedClinic=cl.id;go('clinics')}else toast('Clínica não encontrada')}if(e.key==='Escape')$('.sidebar')?.classList.remove('open')});

async function mgmtFetch(table,opts={}){return centralFetch('/rest/v1/'+table,opts)}
function clinicOptions(sel=''){return CLINICS.map(c=>'<option value="'+c.id+'" '+(String(sel)===String(c.id)?'selected':'')+'>'+esc(c.name)+'</option>').join('')}
async function renderTeam(c){
 c.innerHTML='<div class="page-intro"><span class="eyebrow">EQUIPE DAS CLÍNICAS</span><h1>Pessoas & gestão</h1><p>Recepção, cobrança e franqueados organizados por unidade.</p></div><div class="team-tabs"><button class="btn primary" data-role="receptionist">Recepcionistas</button><button class="ghost" data-role="collection_agent">Agentes de cobrança</button><button class="ghost" data-role="franchisee">Franqueados</button></div><div id="teamBody"></div>';
 let role='receptionist'; const labels={receptionist:'Recepcionista',collection_agent:'Agente de cobrança',franchisee:'Franqueado'};
 async function draw(){
  const rows=await mgmtFetch('management_people?role_type=eq.'+role+'&active=eq.true&select=*&order=clinic_id.asc,name.asc');
  $('#teamBody').innerHTML='<div class="card"><div class="section-head"><div><h3>Cadastrar '+labels[role]+'</h3><p>Vincule a pessoa à clínica e registre responsabilidades e meta individual.</p></div></div><form id="personForm" class="form-grid cols-2"><label>Clínica<select name="clinic_id">'+clinicOptions()+'</select></label><label>Nome<input name="name" required placeholder="Nome completo"></label><label>Funções<textarea name="functions" placeholder="Responsabilidades principais"></textarea></label><label>Meta individual<textarea name="individual_goal" placeholder="Meta e indicador individual"></textarea></label><label>Telefone<input name="phone" placeholder="Opcional"></label><label>E-mail<input name="email" type="email" placeholder="Opcional"></label><label class="span-2">Observações<textarea name="notes" placeholder="Informações úteis para acompanhamento"></textarea></label><div class="span-2 actions"><button class="btn primary">Salvar cadastro</button></div></form></div><div class="section-head"><div><h3>'+labels[role]+'s cadastrados</h3><p>'+rows.length+' registro(s) ativo(s).</p></div></div><div class="people-grid">'+(rows.length?rows.map(p=>'<article class="card person-card"><span class="badge blue">'+esc(clinic(p.clinic_id)?.city||'Clínica')+'</span><h3>'+esc(p.name)+'</h3><p><strong>Funções</strong><br>'+esc(p.functions||'Não informado')+'</p><p><strong>Meta individual</strong><br>'+esc(p.individual_goal||'Não definida')+'</p><div class="actions"><button class="ghost edit-person" data-id="'+p.id+'">Editar</button><button class="ghost remove-person" data-id="'+p.id+'">Desativar</button></div></article>').join(''):'<div class="empty-state">Nenhum cadastro nesta categoria.</div>')+'</div>';
  $('#personForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button[type="submit"],button:not([type])');btn.disabled=true;const o=Object.fromEntries(new FormData(form));o.clinic_id=Number(o.clinic_id);o.role_type=role;try{if(form.dataset.editId){o.updated_at=new Date().toISOString();await mgmtFetch('management_people?id=eq.'+form.dataset.editId,{method:'PATCH',body:JSON.stringify(o)});toast('Cadastro atualizado')}else{await mgmtFetch('management_people',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(o)});toast('Cadastro salvo')}await draw()}catch(err){toast('Não foi possível salvar: '+err.message);btn.disabled=false}};
  $$('.remove-person').forEach(b=>b.onclick=async()=>{await mgmtFetch('management_people?id=eq.'+b.dataset.id,{method:'PATCH',body:JSON.stringify({active:false,updated_at:new Date().toISOString()})});toast('Cadastro desativado');draw()});
  $$('.edit-person').forEach(b=>b.onclick=()=>{const p=rows.find(x=>String(x.id)===String(b.dataset.id));if(!p)return;const form=$('#personForm');form.dataset.editId=p.id;for(const k of ['clinic_id','name','functions','individual_goal','phone','email','notes']){const el=form.elements[k];if(el)el.value=p[k]??''}form.querySelector('button[type="submit"],button:not([type])').textContent='Salvar alterações';form.scrollIntoView({behavior:'smooth',block:'start'})});
 }
 $$('.team-tabs button').forEach(b=>b.onclick=()=>{role=b.dataset.role;$$('.team-tabs button').forEach(x=>x.className='ghost');b.className='btn primary';draw()}); await draw();
}
async function renderSavedMessages(c){
 c.innerHTML='<div class="page-intro"><span class="eyebrow">CAIXA DE RASCUNHOS</span><h1>Mensagens salvas</h1><p>Deixe comunicações prontas por clínica e pelo dia em que serão utilizadas.</p></div><div class="card"><form id="savedMsgForm" class="form-grid cols-2"><label>Clínica<select name="clinic_id">'+clinicOptions()+'</select></label><label>Dia para enviar<input name="scheduled_date" type="date" required value="'+isoDay()+'"></label><label>Destinatário<select name="recipient_type"><option value="general">Geral / grupo da clínica</option><option value="receptionist">Recepção</option><option value="collection_agent">Agente de cobrança</option><option value="franchisee">Franqueado</option></select></label><label>Status<select name="status"><option value="draft">Rascunho</option><option value="ready">Pronta para enviar</option></select></label><label class="span-2">Título<input name="title" placeholder="Ex.: Retorno da manhã"></label><label class="span-2">Mensagem<textarea name="body" rows="7" required placeholder="Escreva ou deixe a mensagem parcialmente pronta…"></textarea></label><div class="span-2 actions"><button class="btn primary">Salvar mensagem</button></div></form></div><div id="savedMsgList"></div>';
 async function list(){const rows=await mgmtFetch('saved_messages?select=*&order=scheduled_date.asc,created_at.desc');const today=isoDay(),due=rows.filter(x=>x.status!=='sent'&&x.scheduled_date===today).length,late=rows.filter(x=>x.status!=='sent'&&x.scheduled_date<today).length,ready=rows.filter(x=>x.status==='ready').length;$('#savedMsgList').innerHTML='<div class="quick-strip msg-summary"><button><strong>'+due+'</strong><span>para hoje</span></button><button><strong>'+late+'</strong><span>atrasadas</span></button><button><strong>'+ready+'</strong><span>prontas</span></button><button><strong>'+rows.length+'</strong><span>total</span></button></div>'+'<div class="section-head"><div><h3>Programadas e rascunhos</h3><p>'+rows.length+' mensagem(ns).</p></div></div><div class="saved-message-grid">'+(rows.length?rows.map(m=>'<article class="card saved-message '+(m.status==='sent'?'is-sent':'')+'"><div class="section-head"><div><span class="badge '+(m.status==='ready'?'green':m.status==='sent'?'blue':'yellow')+'">'+(m.status==='ready'?'Pronta':m.status==='sent'?'Enviada':'Rascunho')+'</span><h3>'+esc(m.title||'Mensagem')+'</h3><p>'+esc(clinic(m.clinic_id)?.name||'Clínica')+' · '+brDate(m.scheduled_date)+'</p></div></div><textarea class="saved-body" data-id="'+m.id+'">'+esc(m.body)+'</textarea><div class="actions"><button class="btn primary copy-saved" data-id="'+m.id+'">Copiar</button><button class="ghost save-edit" data-id="'+m.id+'">Salvar edição</button><button class="ghost sent-saved" data-id="'+m.id+'">Marcar enviada</button><button class="ghost delete-saved" data-id="'+m.id+'">Excluir</button></div></article>').join(''):'<div class="empty-state">Nenhuma mensagem salva ainda.</div>')+'</div>';
  $$('.copy-saved').forEach(b=>b.onclick=()=>copyText($('.saved-body[data-id="'+b.dataset.id+'"]').value));
  $$('.save-edit').forEach(b=>b.onclick=async()=>{await mgmtFetch('saved_messages?id=eq.'+b.dataset.id,{method:'PATCH',body:JSON.stringify({body:$('.saved-body[data-id="'+b.dataset.id+'"]').value,updated_at:new Date().toISOString()})});toast('Edição salva')});
  $$('.sent-saved').forEach(b=>b.onclick=async()=>{await mgmtFetch('saved_messages?id=eq.'+b.dataset.id,{method:'PATCH',body:JSON.stringify({status:'sent',updated_at:new Date().toISOString()})});toast('Marcada como enviada');list()});
  $$('.delete-saved').forEach(b=>b.onclick=async()=>{await mgmtFetch('saved_messages?id=eq.'+b.dataset.id,{method:'DELETE'});toast('Mensagem excluída');list()});
 }
 $('#savedMsgForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button');btn.disabled=true;const o=Object.fromEntries(new FormData(form));o.clinic_id=Number(o.clinic_id);try{await mgmtFetch('saved_messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(o)});toast('Mensagem salva para '+brDate(o.scheduled_date));form.querySelector('[name=body]').value='';await list()}catch(err){toast('Não foi possível salvar: '+err.message)}finally{btn.disabled=false}};await list();
}

// Public bootstrap used by the login shell.
window.renderNav=renderNav;window.go=go;window.renderPage=renderPage;
