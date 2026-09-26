const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
const CLINICS=[
['DIAMANTINA - MG[1031]','Diamantina','MG','1031'],['DOM PEDRITO - RS[915]','Dom Pedrito','RS','915'],['GARCA - SP[470]','Garça','SP','470'],['GUAIRA - SP[1214]','Guaíra','SP','1214'],['ILHOTA - SC[550]','Ilhota','SC','550'],['JARDIM - MS[368]','Jardim','MS','368'],['PONTA GROSSA - PR - UVARANAS[51]','Ponta Grossa - Uvaranas','PR','51'],['REGISTRO I - SP[1609]','Registro I','SP','1609'],['RIO DO SUL - SC[27]','Rio do Sul','SC','27'],["SANTA BARBARA D`OESTE - JARDIM EUROPA - SP[1658]","Santa Bárbara d'Oeste - Jardim Europa",'SP','1658'],['SIDROLANDIA - MS[307]','Sidrolândia','MS','307'],['TAQUARITINGA - SP[1655]','Taquaritinga','SP','1655']
].map((x,i)=>({id:i+1,name:x[0],city:x[1],state:x[2],code:x[3]}));
// ROAD Admin > Campanha Efetivação Cadeiras > ranking Brasil, setembro/2026.
// Consulta em 24/09/2026. Apuração em tempo real; este retrato não se atualiza sozinho.
const ROAD_SEPTEMBER={
 '1031':{rank:324,chairs:3,effective:50,goal:120,perChair:17},
 '915':{rank:439,chairs:3,effective:39,goal:120,perChair:13},
 '470':{rank:272,chairs:3,effective:55,goal:120,perChair:19},
 '1214':{rank:585,chairs:2,effective:17,goal:80,perChair:9},
 '550':{rank:256,chairs:2,effective:38,goal:80,perChair:19},
 '368':{rank:42,chairs:2,effective:67,goal:80,perChair:34},
 '51':{rank:576,chairs:3,effective:27,goal:120,perChair:9},
 '1609':{rank:216,chairs:3,effective:63,goal:120,perChair:21},
 '27':{rank:410,chairs:3,effective:41,goal:120,perChair:14},
 '1658':{rank:392,chairs:2,effective:29,goal:80,perChair:15},
 '307':{rank:321,chairs:2,effective:34,goal:80,perChair:17},
 '1655':{rank:497,chairs:2,effective:23,goal:80,perChair:12}
};
// Mapa de Trabalho > Cobrança / Cobrados - Franquia; data consultada 23/09/2026.
// Quantidades operacionais, não valores recebidos. Acima de 100% requer conferir definição do denominador.
const COLLECTION_YESTERDAY={'1031':[170,0],'915':[113,0],'470':[214,211],'1214':[8,20],'550':[45,45],'368':[134,185],'51':[174,169],'1609':[396,388],'27':[170,173],'1658':[137,136],'307':[129,135],'1655':[81,83]};
function roadTier(perChair){return perChair>40?'Ouro':perChair>=30?'Prata':perChair>=20?'Bronze':perChair>=10?'Em desenvolvimento':'Sem classificação'}
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
function isoDay(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function monthKey(d=isoDay()){return d.slice(0,7)}
function brDate(s){if(!s)return '—';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}
function todayBR(){return new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}
function statusBadge(s='Não iniciado'){let c='red';if(['Finalizado','Retorno recebido'].includes(s))c='green';else if(['Aguardando retorno','Franqueado informado'].includes(s))c='yellow';else if(['Análise','Equipe direcionada'].includes(s))c='blue';return `<span class="badge ${c}">${esc(s)}</span>`}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
async function copyText(t){try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(t);else{const x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();document.execCommand('copy');x.remove()}toast('Mensagem copiada')}catch{toast('Não foi possível copiar automaticamente')}}
function bindTopActions(){const m=$('#quickMorning'),t=$('#quickTreatment');if(m)m.onclick=()=>go('morning');if(t)t.onclick=()=>go('centralReturns')}
function renderNav(){const n=$('#nav');n.innerHTML=nav.map(([id,ico,label])=>`<button class="nav-btn ${state.page===id?'active':''}" data-page="${id}"><span>${ico}</span>${label}</button>`).join('');$$('.nav-btn').forEach(b=>b.onclick=()=>go(b.dataset.page))}
function go(page){if(!nav.some(x=>x[0]===page))page='morning';state.page=page;bindTopActions();localStorage.setItem('g12_last_page',page);renderNav();$('#pageTitle').textContent=nav.find(x=>x[0]===page)?.[2]||'Sistema';$('#pageHelp').textContent=help[page]||'';$('#today').textContent=todayBR();renderPage();$('.sidebar').classList.remove('open')}
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
 return `Bom dia, pessoal! Na ${cl.city}, hoje vamos atacar ${pri.slice(0,3).join(', ').toLowerCase()}. Aceitação em ${a} e ticket em ${t}. O direcionamento para a recepção é trabalhar avaliações, pacientes que ainda não agendaram, pacientes sem agenda e indicações; com os profissionais, reforçar abordagem, indicação e composição dos planos. O que não avançar, me sinalizem com o nome do paciente e o que já foi feito para conseguirmos solucionar rápido.`;
}
async function latestReportForClinic(id){try{const r=await mgmtFetch('central_report_texts?select=report_text,capture_date&capture_date=lte.'+isoDay()+'&clinic_id=eq.'+id+'&return_type=eq.2&order=capture_date.desc,updated_at.desc&limit=1');return r[0]||null}catch{return null}}
async function reportTextForClinic(id){return (await latestReportForClinic(id))?.report_text||''}

function reportSections(raw){
 const text=String(raw||'').replace(/\r/g,''),starts=[],re=/^\s*(\d{1,2})(?:\.0)?\.\s+/gm;let m;
 while((m=re.exec(text)))starts.push({n:Number(m[1]),i:m.index});
 const out={};for(let i=0;i<starts.length;i++){const a=starts[i],b=starts[i+1];if(out[a.n]==null)out[a.n]=text.slice(a.i,b?b.i:text.length)}
 return out;
}
function reportAudit21(raw){
 const sections=reportSections(raw),expected=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21],found=expected.filter(n=>sections[n]);
 return {sections,found,missing:expected.filter(n=>!sections[n]),count:found.length,total:21};
}
function assertMapForClinic(raw,id){
 const a=reportAudit21(raw),x=reportCore(raw),cl=clinic(id);
 if(a.count<20||a.missing.some(n=>n!==15))throw new Error('Mapa incompleto: '+a.count+'/21 itens; faltam '+a.missing.join(', ')+'.');
 if(x.clinicCode!==cl.code)throw new Error('O relatório é da franquia '+(x.clinicCode||'não identificada')+', mas a clínica selecionada é '+cl.code+'.');
 if(!x.periodEnd||x.periodEnd.slice(0,7)!==isoDay().slice(0,7)||x.periodEnd>isoDay())throw new Error('Confira o período do Mapa: ele deve corresponder ao mês corrente e não pode terminar no futuro.');
 return x;
}
function rNum(text,regs){
 for(const re of regs){const m=String(text||'').match(re);if(!m)continue;let v=String(m[1]).trim().replace(/\s/g,'').replace(/R\$/ig,'').replace(/BRL/ig,'');
   if(v.includes(',')&&v.includes('.'))v=v.replace(/\./g,'').replace(',','.');
   else if(v.includes(','))v=v.replace(',','.');
   const n=Number(v.replace(/[^0-9.-]/g,''));if(Number.isFinite(n))return n}
 return null;
}
function rPct(text,regs){return rNum(text,regs)}
function rInt(text,regs){const n=rNum(text,regs);return n==null?null:Math.round(n)}
function reportMapCollaborators(raw){
 const sec=reportSections(raw)[20]||'',lines=sec.split('\n').map(x=>x.trim()).filter(Boolean),rows=[];
 for(const line of lines){
   if(!line.includes('\t'))continue;
   const cols=line.split('\t').map(x=>x.trim()),name=cols[0];
   if(!/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ .'-]{2,}$/i.test(name))continue;
   if(/COLABORADOR|EFETIVAÇÃO|MARKETING|PERÍODO|DADOS QUE/i.test(name))continue;
   const upper=name.toUpperCase();if(rows.some(x=>x.name===upper))continue;
   rows.push({name:upper,cells:cols.slice(1)});
 }
 return rows;
}
function monthBusinessDaysRemaining(reportEnd){
 const current=isoDay(),source=reportEnd||current,month=source.slice(0,7);
 const next=new Date(source+'T12:00:00');next.setDate(next.getDate()+1);
 const today=new Date(current+'T12:00:00');
 const first=next>today?next:today;
 const y=Number(month.slice(0,4)),m=Number(month.slice(5,7))-1;
 let d=first,count=0;
 if(d.getFullYear()!==y||d.getMonth()!==m)return 1;
 const last=new Date(y,m+1,0,12);
 for(;d<=last;d.setDate(d.getDate()+1)){const w=d.getDay();if(w!==0&&w!==6)count++}
 return Math.max(1,count);
}
function reportPeriodEnd(raw){
 const m=String(raw||'').match(/Cl[ií]nico Geral\s*-\s*Per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4})\s*(?:a|-)\s*(\d{2}\/\d{2}\/\d{4})/i);
 if(!m)return '';
 const p=m[2].split('/');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:'';
}
function reportCore(raw){
 const audit=reportAudit21(raw),s=audit.sections,i1=s[1]||'',i2=s[2]||'',i3=s[3]||'',i4=s[4]||'',i5=s[5]||'',i6=s[6]||'',i7=s[7]||'',i8=s[8]||'',i9=s[9]||'',i10=s[10]||'',i11=s[11]||'',i12=s[12]||'',i13=s[13]||'',i14=s[14]||'',i16=s[16]||'',i17=s[17]||'',i18=s[18]||'',i19=s[19]||'',i21=s[21]||'';
 const clinicMatch=String(raw||'').match(/Franquia:\s*(\d+)\s*-\s*Odonto Excellence\s*-\s*([^\n]+)/i);
 const generalBlock=(i2.match(/Cl[ií]nico Geral:[\s\S]*?(?=Efetividade p[oó]s|Ortodontia:)/i)||[''])[0];
 const orthoBlock=(i2.match(/Ortodontia:[\s\S]*?(?=Implantodontia:|Orofacial:|Hist[oó]rico)/i)||[''])[0];
 const core={
   audit,clinicCode:clinicMatch?.[1]||'',clinicLabel:clinicMatch?.[2]?.trim()||'',chairs:rInt(raw,[/Cadeiras:\s*(\d+)/i]),
   periodEnd:reportPeriodEnd(raw),
   accept:rPct(i1,[/Cl[ií]nico Geral[\s\S]{0,140}?índice mínimo:\s*80%\s*([\d.,]+)%/i,/Aceita[cç][aã]o\s+([\d.,]+)\s*%/i]),
   evals:rInt(i1,[/Total de avalia[cç][oõ]es:\s*(\d+)\s*-\s*Efetivadas:/i]),
   eff:rInt(i1,[/Total de avalia[cç][oõ]es:\s*\d+\s*-\s*Efetivadas:\s*(\d+)/i]),
   chairMonthly:rInt(i1,[/Meta pacientes cadeiras\s*-\s*mensal:\s*(\d+)/i]),
   chairProp:rInt(i1,[/Meta pacientes cadeiras\s*-\s*proporcional:\s*(\d+)/i]),
   chairEff:rInt(i1,[/Meta pacientes cadeiras\s*-\s*efetivados:\s*(\d+)/i]),
   cadastros:rInt(i1,[/Total de cadastros:\s*(\d+)/i]),
   indications:rInt(i1,[/Total de indica[cç][oõ]es:\s*(\d+)/i]),
   viral:rInt(i1,[/Indica[cç][oõ]es MKT Viral:\s*(\d+)/i]),
   indicationConversion:rInt(i1,[/Indica[cç][oõ]es por convers[aã]o:\s*(\d+)/i]),
   amigoPct:rPct(i1,[/campanha amigo do peito[\s\S]{0,120}?índice mínimo:\s*50%\s*([\d.,]+)%/i]),
   amigoPoss:rInt(i1,[/Possibilidades de indica[cç][oõ]es reais:\s*(\d+)/i]),
   amigoInd:rInt(i1,[/Quantidade convers[oõ]es:\s*\d+\s+Quantidade indica[cç][oõ]es:\s*(\d+)/i]),
   cgGoalMoney:rNum(generalBlock,[/Vendas:\s*([\d.]+,\d{2})/i]),
   cgPropMoney:rNum(generalBlock,[/Proporcional:\s*([\d.]+,\d{2})/i]),
   cgEffectiveMoney:rNum(generalBlock,[/Efetivadas:\s*([\d.]+,\d{2})/i]),
   ticket:rNum(generalBlock,[/Ticket m[eé]dio:\s*([\d.]+,\d{2})/i]),
   ticketHealthy:rNum(i17,[/Ticket m[eé]dio\s*\(\s*([\d.]+,\d{2})\s*\)/i]),
   orthoFinancialPct:rPct(orthoBlock,[/Ortodontia:\s*([\d.,]+)%/i]),
   orthoEvals:rInt(orthoBlock,[/Total de avalia[cç][oõ]es:\s*(\d+)\s*-\s*Efetivadas:/i]),
   orthoEvalEff:rInt(orthoBlock,[/Total de avalia[cç][oõ]es:\s*\d+\s*-\s*Efetivadas:\s*(\d+)/i]),
   orthoAccept:rPct(orthoBlock,[/Aceita[cç][aã]o\s+([\d.,]+)\s*%/i]),
   orthoGoal:rInt(orthoBlock,[/Meta de efetiva[cç][oõ]es:\s*(\d+)/i]),
   orthoProp:rInt(orthoBlock,[/Meta de efetiva[cç][oõ]es:\s*\d+\s*-\s*Proporcional:\s*(\d+)/i]),
   orthoEff:rInt(orthoBlock,[/Meta de efetiva[cç][oõ]es:[\s\S]{0,70}?Efetivadas:\s*(\d+)/i]),
   orthoPaidGoal:rInt(orthoBlock,[/Meta de pastas pagas:\s*(\d+)/i]),
   orthoPaidProp:rInt(orthoBlock,[/Meta de pastas pagas:\s*\d+\s*-\s*Proporcional:\s*(\d+)/i]),
   orthoPaid:rInt(orthoBlock,[/Meta de pastas pagas:[\s\S]{0,70}?Pagas:\s*(\d+)/i]),
   startedPct:rPct(i2,[/Valor efetivado:[\s\S]{0,160}?([\d.,]+)%\s*Tratamentos efetivados:/i]),
   treatmentsEff:rInt(i2,[/Tratamentos efetivados:\s*(\d+)/i]),
   treatmentsStarted:rInt(i2,[/Tratamentos iniciados:\s*(\d+)/i]),
   requestedIndications:rInt(i2,[/Indica[cç][oõ]es solicitadas:\s*(\d+)/i]),
   professionalIndications:rInt(i2,[/Indica[cç][oõ]es realizadas pelo profissional:\s*(\d+)/i]),
   receptionIndications:rInt(i2,[/Indica[cç][oõ]es enviadas pela recep[cç][aã]o:\s*(\d+)/i]),
   absenteesPct:rPct(i3,[/Porcentagem de faltosos:\s*([\d.,]+)\s*%/i]),
   scheduledYesterday:rInt(i3,[/Pacientes agendados:\s*(\d+)/i]),todayEvaluations:rInt(raw,[/avalia[cç][oõ]es\s+(?:na\s+)?agenda(?:\s+de\s+hoje)?[^0-9]{0,30}(\d+)/i,/agenda\s+(?:de\s+)?avalia[cç][oõ]es[^0-9]{0,30}(\d+)/i]),
   missedYesterday:rInt(i3,[/Pacientes faltosos:\s*(\d+)/i]),
   noAgendaCG:rPct(i4,[/Propor[cç][aã]o sem agendamento\s*-\s*Cl[ií]nico geral[\s\S]{0,30}?([\d.,]+)\s*%/i]),
   noAgendaOrtho:rPct(i4,[/Propor[cç][aã]o sem agendamento\s*-\s*Ortodontia[\s\S]{0,30}?([\d.,]+)\s*%/i]),
   rebooking:rPct(i5,[/Cl[ií]nico Geral[\s\S]{0,120}?índice mínimo:\s*90%\s*([\d.,]+)%/i,/Reagendamento geral\s+([\d.,]+)\s*%/i]),
   rebookingOrtho:rPct(i5,[/Reagendamento orto\s+([\d.,]+)\s*%/i]),
   collectionExecution:rPct(i6,[/índice mínimo:\s*80%\s*([\d.,]+)%/i,/Cobran[cç]a\s+([\d.,]+)\s*%/i]),
   charges:rInt(i6,[/Cobran[cç]as:\s*(\d+)/i]),charged:rInt(i6,[/Cobrado\(s\):\s*(\d+)/i]),
   cancelRequest:rPct(i7,[/Alta a pedido:\s*([\d.,]+)%/i]),cancelAuto:rPct(i7,[/Autom[aá]tico:\s*([\d.,]+)%/i]),cancelNotStarted:rPct(i7,[/Total n[aã]o iniciado:\s*([\d.,]+)%/i]),
   collectionAgent:rPct(i8,[/índice mínimo:\s*65%\s*([\d.,]+)%/i,/Aproveitamento\s+([\d.,]+)\s*%/i]),
   satisfaction:rPct(i9,[/índice mínimo:\s*90%\s*([\d.,]+)\s*%/i,/Pesquisa\s+([\d.,]+)\s*%/i]),
   revenuePrev:rNum(i10,[/M[eê]s anterior:[\s\S]{0,60}?([\d.]+,\d{2})/i]),revenueCurrent:rNum(i10,[/M[eê]s atual:[\s\S]{0,60}?([\d.]+,\d{2})/i]),
   agendaCG:rPct(i11,[/Cl[ií]nico geral[\s\S]{0,120}?índice mínimo:\s*80%\s*([\d.,]+)%/i]),agendaOrtho:rPct(i11,[/Ortodontia[\s\S]{0,120}?índice mínimo:\s*80%\s*([\d.,]+)%/i]),
   app:rPct(i12,[/EFETIVA[CÇ][OÕ]ES\/INSTALA[CÇ][OÕ]ES[\s\S]{0,120}?(\d+[,\.]\d+)%/i]),
   negativados:rInt(i13,[/Negativados:\s*(\d+)/i]),desnegativados:rInt(i13,[/Desnegativados:\s*(\d+)/i]),
   occlusionTotal:rInt(i14,[/Total\s*%[\s\S]{0,250}?\n\s*(\d+)\s*\n\s*100%/i]),
   appIndications:rInt(i19,[/Indica[cç][oõ]es:\s*(\d+)/i]),appPending:rInt(i19,[/Contato pendente:\s*(\d+)/i]),appNoSuccess:rInt(i19,[/Contato sem sucesso:\s*(\d+)/i]),appEvalPending:rInt(i19,[/Avalia[cç][aã]o pendente\s*:?\s*(\d+)/i]),appEffective:rInt(i19,[/Efetivadas:\s*(\d+)/i]),
   contractsSent:rInt(i21,[/Contratos enviados:\s*(\d+)/i]),contractsPending:rInt(i21,[/Contratos pendentes de envio:\s*(\d+)/i]),
   collaborators:reportMapCollaborators(raw)
 };
 if(core.cadastros&&core.indications!=null)core.capturePct=core.indications/core.cadastros*100;
 if(core.revenuePrev!=null&&core.revenueCurrent!=null&&core.revenuePrev!==0)core.revenueDeltaPct=(core.revenueCurrent-core.revenuePrev)/core.revenuePrev*100;
 return core;
}
function reportComparison(current,previous){
 if(!previous)return null;
 const fields=['accept','eff','chairEff','ticket','orthoEff','orthoPaid','absenteesPct','rebooking','collectionAgent','satisfaction','revenueCurrent','agendaCG','app'];
 const delta={};for(const k of fields)if(current[k]!=null&&previous[k]!=null)delta[k]=current[k]-previous[k];
 return delta;
}
function reportHistorySummary(current,previous,previousMonth){
 const p=reportComparison(current,previous),m=reportComparison(current,previousMonth),parts=[];
 if(p?.eff!=null)parts.push('efetivações '+(p.eff>=0?'+':'')+p.eff+' vs. leitura anterior');
 if(p?.accept!=null)parts.push('aceitação '+(p.accept>=0?'+':'')+Math.round(p.accept)+' p.p.');
 if(p?.ticket!=null)parts.push('ticket '+(p.ticket>=0?'+':'')+centralMoney(p.ticket));
 if(m?.revenueCurrent!=null)parts.push('receita '+(m.revenueCurrent>=0?'+':'')+centralMoney(m.revenueCurrent)+' vs. referência anterior');
 return parts.slice(0,3).join(' · ');
}

function treatmentItems(cl,x,days,healthyTicket){
 const items=[],where='No Mapa de Trabalho até '+brDate(x.periodEnd)+', ',add=(score,itemNo,title,fact,action,question)=>{
  const itemLabel='Item '+itemNo+' · '+title;
  items.push({score,itemNo,title:itemLabel,message:'Bom dia, Drs. Tudo bem? Sobre o item '+itemNo+' do relatório, '+title.toLowerCase()+': '+where+fact+' '+action+' '+question+' Quero acompanhar esse ponto com vocês porque ele interfere diretamente no resultado da clínica. Combinado?'});
 };
 if(x.accept!=null&&x.accept<80)add(100+(80-x.accept),1,'Índice de aceitação','a aceitação de Clínico Geral está em '+Math.round(x.accept)+'% ('+(x.eff??'—')+' efetivadas em '+(x.evals??'—')+' avaliações), abaixo dos 80% saudáveis.','Precisamos entender por que as avaliações não estão virando tratamento e revisar as oportunidades que ainda podemos recuperar.','O que vocês estão percebendo como principal motivo para não fechar?');
 const gap=x.chairMonthly!=null&&x.chairEff!=null?Math.max(0,x.chairMonthly-x.chairEff):null,daily=gap!=null?Math.ceil(gap/days):null;
 if(gap>0)add(95+Math.min(25,gap/5),1,'Meta por cadeira','temos '+x.chairEff+' efetivações para uma meta mensal de '+x.chairMonthly+'; ainda faltam '+gap+'.','Para buscar a meta, o ritmo necessário é de aproximadamente '+daily+' efetivações de CG por dia útil.','A agenda de avaliações de hoje sustenta esse ritmo ou precisamos abrir mais oportunidades?');
 const og=x.orthoPaidGoal!=null&&x.orthoPaid!=null?Math.max(0,x.orthoPaidGoal-x.orthoPaid):null;
 if(og>0)add(92+Math.min(20,og),2,'Ortodontia e pastas pagas','temos '+x.orthoPaid+' pastas pagas de '+x.orthoPaidGoal+' previstas, então ainda faltam '+og+'.','A aceitação pode estar boa, mas precisamos acompanhar se a efetivação realmente está virando pasta paga e entrada para a clínica.','Onde essas pastas estão parando hoje?');
 if(x.treatmentsEff!=null&&x.treatmentsStarted!=null&&x.treatmentsStarted<x.treatmentsEff)add(90,2.1,'Efetivados x iniciados','temos '+x.treatmentsEff+' tratamentos efetivados e somente '+x.treatmentsStarted+' iniciados.','Esse paciente já disse sim; agora precisamos garantir o primeiro agendamento e o início do tratamento o quanto antes.','Quantos desses pacientes conseguimos deixar com primeiro horário marcado?');
 if(x.missedYesterday!=null||x.absenteesPct!=null)add(84,3,'Faltosos do dia anterior',(x.absenteesPct!=null?'o percentual de faltosos está em '+Math.round(x.absenteesPct)+'%. ':'')+(x.missedYesterday!=null?'Foram '+x.missedYesterday+' faltosos no último dia analisado.':''),'Precisamos recuperar esses pacientes e aproveitar os horários que ficaram vazios.','Quantos já foram contatados e reagendados?');
 if(x.noAgendaCG!=null&&x.noAgendaCG>15)add(88+x.noAgendaCG/4,4,'Pacientes sem agendamento','a proporção de pacientes de Clínico Geral sem próximo agendamento está em '+Math.round(x.noAgendaCG)+'%'+(x.noAgendaOrtho!=null?' e em Ortodontia está em '+Math.round(x.noAgendaOrtho)+'%':'')+'.','É paciente que já está dentro da clínica e não pode ficar sem continuidade. Precisamos revisar os sem primeiro/próximo horário e preencher a agenda.','Qual volume conseguimos recuperar ainda hoje?');
 if(x.rebooking!=null&&x.rebooking<90)add(82+(90-x.rebooking)/2,5,'Reagendamento','o reagendamento de Clínico Geral está em '+Math.round(x.rebooking)+'%, abaixo dos 90% saudáveis.','Vamos trabalhar faltas e cancelamentos antes de encerrar o dia para não perder esses pacientes.','Quantos ficaram reagendados de verdade?');
 if(x.collectionExecution!=null)add(78+(80-(x.collectionExecution||0))/3,6,'Quantidade de cobranças x quantidade cobradas','a execução da cobrança está em '+Math.round(x.collectionExecution)+'%'+(x.charges!=null?' com '+x.charges+' cobranças realizadas':'')+(x.charged!=null?' e '+x.charged+' pacientes cobrados':'')+'.','O contato precisa virar negociação e, sempre que possível, pagamento; não basta apenas registrar tentativa.','Como está a conversão dessas cobranças em acordo ou recebimento?');
 if(x.cancelRequest!=null||x.cancelAuto!=null)add(79,7,'Cancelamentos',(x.cancelRequest!=null?'a alta a pedido está em '+Math.round(x.cancelRequest)+'%. ':'')+(x.cancelAuto!=null?'O cancelamento automático está em '+Math.round(x.cancelAuto)+'%.':''),'Precisamos entender os motivos e agir antes que o paciente se perca, principalmente nos tratamentos que ainda não iniciaram.','Quais motivos mais aparecem e o que conseguimos recuperar?');
 if(x.collectionAgent!=null)add(77+(65-(x.collectionAgent||0))/3,8,'Aproveitamento do agente de cobrança','o aproveitamento do agente de cobrança está em '+Math.round(x.collectionAgent)+'% diante da referência mínima de 65%.','Quero olhar não só quantos pacientes foram cobrados, mas quanto realmente virou recebimento e renegociação.','O que está dificultando transformar contato em pagamento?');
 if(x.satisfaction!=null&&x.satisfaction<90)add(68+(90-x.satisfaction)/5,9,'Pesquisa de satisfação','a pesquisa de satisfação está em '+Math.round(x.satisfaction)+'% diante da referência de 90%.','Precisamos pedir a pesquisa de forma simples depois do atendimento e acompanhar se ela foi respondida.','Como podemos aumentar essa participação ainda hoje?');
 if(x.agendaCG!=null&&x.agendaCG<80)add(83+(80-x.agendaCG)/3,11,'Aproveitamento de agendamento','o aproveitamento de agendamento em Clínico Geral está em '+Math.round(x.agendaCG)+'% diante dos 80% saudáveis.','Agendar é importante, mas precisamos confirmar e fazer o paciente comparecer.','O que está fazendo os pacientes agendarem e não comparecerem?');
 if(x.app!=null&&x.app<95)add(67+(95-x.app)/4,12,'Aplicativo','o indicador do aplicativo está em '+Math.round(x.app)+'% diante dos 95% saudáveis.','Vamos orientar a instalação e conferir com o paciente antes de ele sair da clínica.','Quantas instalações conseguimos concluir hoje?');
 if(x.ticket!=null)add(86,17,'Ticket médio','o ticket médio de Clínico Geral está em '+centralMoney(x.ticket)+(healthyTicket?' e nossa referência saudável é '+centralMoney(healthyTicket):'')+'.','Esse número mexe diretamente com o caixa. Precisamos entender o plano de tratamento apresentado e a composição dos procedimentos, sem perder qualidade na indicação clínica.','O que podemos alinhar com os profissionais para melhorar esse resultado?');
 if(x.appIndications!=null||x.appNoSuccess!=null)add(72,19,'Indicações pelo aplicativo',(x.appIndications!=null?'há '+x.appIndications+' indicações registradas. ':'')+(x.appNoSuccess!=null?'Também existem '+x.appNoSuccess+' contatos sem sucesso.':''),'Precisamos voltar nas oportunidades que ainda fazem sentido e registrar o resultado real de cada contato.','Quantas oportunidades conseguimos recuperar?');
 return items.sort((a,b)=>b.score-a.score).slice(0,10).map(v=>({recipient:'item_'+String(v.itemNo).replace('.','_').padStart(2,'0'),title:v.title,message:v.message}));
}

function dailyGuideMessages(cl,raw,people=[],history={},sourceDate=isoDay()){
 const x=reportCore(raw),prev=history.previous?reportCore(history.previous):null;
 const days=monthBusinessDaysRemaining(x.periodEnd),healthy=x.ticketHealthy||3488.25;
 const chairGoal=x.chairMonthly??(x.chairs?x.chairs*40:null);
 const gap=chairGoal!=null&&x.chairEff!=null?Math.max(0,chairGoal-x.chairEff):null;
 const cgDay=gap!=null?Math.ceil(gap/days):null;
 const orthoGap=x.orthoPaidGoal!=null&&x.orthoPaid!=null?Math.max(0,x.orthoPaidGoal-x.orthoPaid):null;
 const orthoDay=orthoGap!=null?Math.ceil(orthoGap/days):null;
 const reception=people.filter(p=>p.role_type==='receptionist'&&p.name).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const collectors=people.filter(p=>p.role_type==='collection_agent'&&p.name).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const unique=[...new Map(reception.map(p=>[p.name.trim().toLocaleUpperCase('pt-BR'),p])).values()];
 const hasCollector=name=>collectors.some(p=>p.name.trim().toLocaleUpperCase('pt-BR')===name.trim().toLocaleUpperCase('pt-BR'));
 const first=name=>{const f=name.trim().split(/\s+/)[0];return f[0].toLocaleUpperCase('pt-BR')+f.slice(1).toLocaleLowerCase('pt-BR')};
 const sameYesterday=prev?.periodEnd&&x.periodEnd&&new Date(x.periodEnd+'T12:00:00Z')-new Date(prev.periodEnd+'T12:00:00Z')===86400000;
 const delta=sameYesterday&&x.eff!=null&&prev.eff!=null&&x.eff>=prev.eff?x.eff-prev.eff:null;
 const yesterday=delta!=null?'Ontem tivemos '+delta+' '+(delta===1?'efetivação':'efetivações')+' de Clínico Geral. '+(delta===0?'O que dificultou os fechamentos? ':'Quero entender o que ajudou e o que ainda travou os demais fechamentos. '):'';
 const goal=gap!=null?'Faltam '+gap+' efetivações para a meta mensal de cadeiras, '+chairGoal+' pacientes; em '+days+' dias úteis, precisamos de '+cgDay+' por dia. ':'';
 // Uma pessoa, uma frente. A primeira cuida da efetivação; a última cuida da cobrança.
 // Quando há agente de cobrança cadastrado também na recepção, ele ocupa a última posição.
 const available=[...unique];
 // Em Diamantina, a rotina enviada pelo Daniel coloca Taliane na efetivação e Helen na recuperação da agenda.
 if(cl.code==='1031')available.sort((a,b)=>['TALIANE','HELEN','SILVANIA','CARLA'].indexOf(a.name.split(' ')[0])-['TALIANE','HELEN','SILVANIA','CARLA'].indexOf(b.name.split(' ')[0]));
 if(cl.code==='27')available.sort((a,b)=>['ADA','LAARA','EDUARDA','RAFAELA'].indexOf(a.name.split(' ')[0])-['ADA','LAARA','EDUARDA','RAFAELA'].indexOf(b.name.split(' ')[0]));
 if(available.length>1){const collectorIndex=available.findIndex((p,i)=>i>0&&hasCollector(p.name));if(collectorIndex>=0)available.push(...available.splice(collectorIndex,1))}
 const monthLabels=Array.from({length:3},(_,i)=>{const d=new Date(Number((sourceDate||isoDay()).slice(0,4)),Number((sourceDate||isoDay()).slice(5,7))-3+i,1);return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})});
 const months=monthLabels.join(', ');
 const exclusiveCollectors=collectors.filter(p=>!available.some(r=>r.name.trim().toLocaleUpperCase('pt-BR')===p.name.trim().toLocaleUpperCase('pt-BR')));
 const middleCount=Math.max(0,available.length-(exclusiveCollectors.length?1:2));
 const agendaRoles=middleCount===1?['agenda_geral']:['agenda_cg','agenda_orto','faltosos'];
 const roles=new Map(),individual=available.map((p,i)=>{
   const name=p.name.trim(),role=i===0?'efetivacao':i===available.length-1&&!exclusiveCollectors.length?'cobranca':agendaRoles[(i-1)%agendaRoles.length];
   roles.set(name,role);
   let detail='';
   if(role==='efetivacao'){
     detail=yesterday+'No Mapa até '+brDate(x.periodEnd)+', foram '+(x.evals??'—')+' avaliações e '+(x.eff??'—')+' efetivações de Clínico Geral'+(x.accept!=null?', com aceitação de '+Math.round(x.accept)+'% (referência saudável: 80%)':'')+'. '+goal+(cgDay!=null?'Sua meta de hoje é '+cgDay+' '+(cgDay===1?'paciente efetivado':'pacientes efetivados')+' em CG, equivalentes a '+centralMoney(cgDay*healthy)+' pelo ticket saudável de '+centralMoney(healthy)+'. ':'')+'Acompanhe cada avaliação, revise propostas ainda sem fechamento e registre a objeção antes de retomar a negociação. '+(x.accept!=null&&x.accept>=80?'Parabéns pela aceitação; vamos manter esse nível. ':'')+'Na parcial, me traga avaliações comparecidas, propostas retomadas e fechamentos confirmados. O que está travando os demais?';
   }else if(role==='agenda_geral'){
     detail='A sua prioridade é preencher a agenda de Clínico Geral e Ortodontia e recuperar faltosos, sem assumir a meta de efetivação. '+(x.missedYesterday!=null?'O Mapa registrou '+x.missedYesterday+' faltosos no último dia medido. ':'')+(x.noAgendaCG!=null?'Em CG, '+Math.round(x.noAgendaCG)+'% estão sem próximo agendamento. ':'')+(x.noAgendaOrtho!=null?'Em Orto, '+Math.round(x.noAgendaOrtho)+'% estão sem próximo agendamento. ':'')+'Trabalhe a ferramenta de conversão dos últimos 45 dias, confirme horários reais para hoje e amanhã e reagende cada falta. Na parcial, separe agendamentos CG, agendamentos Orto, faltosos recuperados e comparecimentos.';
   }else if(role==='agenda_cg'){
     detail='Sua frente é agendar avaliações de Clínico Geral'+(middleCount===2?' e recuperar os faltosos de CG':'')+'. '+(x.noAgendaCG!=null?'O Mapa mostra '+Math.round(x.noAgendaCG)+'% sem próximo horário em CG. ':'')+'Trabalhe as oportunidades de conversão dos últimos 45 dias e confira vagas disponíveis de hoje e amanhã antes de oferecer horários. '+(middleCount===2&&x.missedYesterday!=null?'Foram '+x.missedYesterday+' faltosos no último dia medido; retome as faltas de CG e confirme o reagendamento. ':'')+(x.amigoPoss!=null&&x.amigoInd!=null?'A campanha registra '+x.amigoInd+' indicações em '+x.amigoPoss+' possibilidades; peça indicações com autorização do paciente. ':'')+'Me retorne contatos feitos, avaliações CG agendadas, faltosos recuperados e comparecimentos; quais horários ainda ficaram vagos?';
   }else if(role==='agenda_orto'){
     detail='Sua frente é agendar avaliações de Ortodontia'+(middleCount===2?' e recuperar as faltas de Orto':'')+'. '+(x.noAgendaOrtho!=null?'O Mapa aponta '+Math.round(x.noAgendaOrtho)+'% dos pacientes de Orto sem próximo horário. ':'')+(orthoGap!=null?'Faltam '+orthoGap+' pastas pagas na meta do mês; para sustentar o ritmo precisamos acompanhar as avaliações e os retornos de Orto. ':'')+'Retome interessados sem avaliação marcada, confirme a documentação necessária e registre cada horário combinado. Na parcial, me diga quantas avaliações Orto marcou, quantas compareceram e quais faltosos de Orto reagendou.';
   }else if(role==='faltosos'){
     detail='Sua frente é recuperar faltosos e reagendamentos, sem repetir a captação de novos pacientes. '+(x.missedYesterday!=null?'O Mapa registra '+x.missedYesterday+' faltosos no último dia medido. ':'')+(x.rebooking!=null?'O reagendamento de CG está em '+Math.round(x.rebooking)+'%. ':'')+'Ligue para as faltas e cancelamentos, identifique o motivo, ofereça um horário real e confirme o comparecimento. Na parcial, separe contatos, reagendamentos de CG, de Orto e comparecimentos recuperados.';
   }else{
     detail='Sua frente é a cobrança das pastas pagas nos últimos três meses ('+months+') que ainda têm parcelas em aberto. O Mapa até '+brDate(x.periodEnd)+' mostra '+(x.charges??'—')+' cobranças e '+(x.charged??'—')+' registros de cobrados'+(x.collectionAgent!=null?', com aproveitamento de '+Math.round(x.collectionAgent)+'% do agente':'')+'. Consulte a carteira financeira para identificar quais parcelas estão realmente vencidas ou a vencer; o Mapa não traz o valor individual dessas pendências. Priorize as vencidas, negocie os casos viáveis e acompanhe até o recebimento confirmado. Me retorne número de pastas verificadas, contatos, acordos e pagamentos recebidos, sem contar tentativa como pagamento. Qual pendência precisa do apoio do franqueado?';
   }
   return {recipient:name,title:'Mensageiro · '+name,message:'Bom dia, '+first(name)+', tudo bem? '+detail};
 });
 // Agentes exclusivos recebem a frente de cobrança sem uma segunda mensagem para quem já está na recepção.
 for(const p of collectors){const name=p.name.trim();if(individual.some(m=>m.recipient.toLocaleUpperCase('pt-BR')===name.toLocaleUpperCase('pt-BR')))continue;
   individual.push({recipient:name,title:'Mensageiro · cobrança · '+name,message:'Bom dia, '+first(name)+', tudo bem? Sua frente é conferir as pastas pagas de '+months+' com parcelas em aberto. Consulte a carteira financeira, priorize vencimentos, negocie e acompanhe até o pagamento confirmado. O Mapa até '+brDate(x.periodEnd)+' registra '+(x.charges??'—')+' cobranças e '+(x.charged??'—')+' cobrados; ele não informa o saldo individual dessa carteira. Na parcial, separe pastas verificadas, contatos, acordos e pagamentos recebidos. Onde precisa de apoio?'});
 }
 // Linguagem observada nos mensageiros enviados: número concreto, prioridade pessoal, prazo e incentivo.
 const cgTarget=cgDay;
 const chairReality=gap!=null&&cgDay>cgTarget?'Faltam '+gap+' pacientes efetivados para a meta mensal de '+chairGoal+' em Clínico Geral. Dividindo pelos '+days+' dias úteis restantes, o ritmo seria '+cgDay+' por dia; é um número muito alto e precisamos acelerar o que está ao nosso alcance hoje. ':'';
 const orthoReality=orthoGap!=null&&orthoGap>0?'Ainda faltam '+orthoGap+' pastas pagas de Ortodontia no mês. ':'';
 const teamAgenda=10;
 for(const m of individual){
   const role=roles.get(m.recipient)||'cobranca',name=first(m.recipient),open='Bom dia, '+name+', tudo bem? ';
   if(role==='efetivacao'){
     const status=delta!=null?'Ontem tivemos '+delta+' '+(delta===1?'efetivação':'efetivações')+' em Clínico Geral. '+(delta===0?'O que dificultou os fechamentos? ':'O que ajudou a fechar e onde ainda perdemos oportunidades? '):'';
     const month='Pelo Mapa até '+brDate(x.periodEnd)+', foram '+(x.evals??'—')+' avaliações e '+(x.eff??'—')+' efetivações de CG; a aceitação está em '+(x.accept!=null?Math.round(x.accept)+'%':'apuração pendente')+' frente aos 80% saudáveis. ';
     const target=cgTarget!=null?'Para alcançar a meta mensal, o ritmo necessário hoje é '+cgTarget+' '+(cgTarget===1?'paciente efetivado':'pacientes efetivados')+' de CG, equivalentes a '+centralMoney(cgTarget*healthy)+' pelo ticket saudável de '+centralMoney(healthy)+'. ':'';
     const orthoTarget=orthoDay>0?'Em Orto, o ritmo necessário é '+orthoDay+' '+(orthoDay===1?'pasta paga':'pastas pagas')+' por dia útil restante. ':'';
     const good=x.accept!=null&&x.accept>=80?'Parabéns pela aceitação, esse resultado mostra que as avaliações estão virando tratamento. ':'A aceitação precisa melhorar: pergunte a objeção de cada paciente, ajuste a proposta com a equipe e acompanhe o retorno até a decisão. ';
     m.message=open+status+month+chairReality+target+orthoReality+orthoTarget+good+'Quantas avaliações estão confirmadas hoje? Envie a avaliação de Orto a todos os pacientes novos, acompanhe cada comparecimento e me passe os nomes dos pacientes que saíram sem efetivar, a objeção e quando voltam. '+(middleCount===0?'Trabalhe também a Ferramenta de Conversão dos últimos 45 dias e agende 10 avaliações em horários reais de hoje ou amanhã. ':'')+'Na parcial, me traga comparecimentos, propostas retomadas e fechamentos confirmados. Consegue me dar esse retorno, combinado?';
   }else if(role==='agenda_cg'){
     const recovery=middleCount===2?(x.missedYesterday!=null?'O Mapa registra '+x.missedYesterday+' '+(x.missedYesterday===1?'faltoso':'faltosos')+' no último dia; ':'')+'comece pelos pacientes sem primeiro agendamento e pelas faltas de CG para evitar cancelamentos. ':'';
     m.message=open+'Preciso da sua ajuda para preencher a agenda de Clínico Geral de hoje e amanhã. '+(x.noAgendaCG!=null?'O Mapa aponta '+Math.round(x.noAgendaCG)+'% dos pacientes de CG sem próximo horário. ':'')+recovery+'Na Ferramenta de Conversão dos últimos 45 dias, comece por novo contato, solicitou retorno e não atende; ofereça horários reais, inclusive após as 18h se houver vaga. Busque '+teamAgenda+' avaliações CG agendadas até o fim do dia. Quantos contatos fez, quantos horários confirmou e quem ainda precisa de retorno? Conto com você, combinado?';
   }else if(role==='agenda_orto'){
     m.message=open+'Hoje preciso que você cuide da agenda de Ortodontia. '+(x.noAgendaOrtho!=null?'O Mapa mostra '+Math.round(x.noAgendaOrtho)+'% sem próximo horário de Orto. ':'')+orthoReality+'Confira se a avaliação de Orto foi oferecida a todos os pacientes novos, retome os interessados sem avaliação e reagende as faltas de Orto em horário real. Busque '+(middleCount===2?7:8)+' avaliações de Orto agendadas até o fim do dia. Na parcial me traga agendamentos, comparecimentos e faltas recuperadas. Vamos fortalecer essa agenda, combinado?';
   }else if(role==='agenda_geral'){
     m.message=open+'Preciso muito da sua ajuda com a agenda hoje. '+(x.noAgendaCG!=null?Math.round(x.noAgendaCG)+'% de CG estão sem próximo horário; ':'')+(x.noAgendaOrtho!=null?Math.round(x.noAgendaOrtho)+'% de Orto também estão sem agenda. ':'')+(x.missedYesterday!=null?'Houve '+x.missedYesterday+' faltosos no último dia medido. ':'')+'Comece pelos pacientes sem primeiro agendamento, recupere as faltas e depois trabalhe a Ferramenta de Conversão dos últimos 45 dias. Vamos buscar 10 avaliações agendadas para hoje e amanhã até o fim do expediente. Me envie os números separados de CG, Orto e faltosos recuperados. Conto com você, combinado?';
   }else if(role==='faltosos'){
     m.message=open+'Sua ajuda hoje é zerar as listas de pacientes sem primeiro agendamento e de faltosos. '+(x.missedYesterday!=null?'Tivemos '+x.missedYesterday+' faltas no último dia medido. ':'')+'Ligue, entenda o motivo, ofereça um horário concreto e confirme a volta ao tratamento para evitarmos cancelamentos. Depois que terminar, me ajude a fortalecer a agenda de amanhã. Na parcial me traga quantos pacientes recuperou e o que ficou pendente. Vamos concluir isso hoje, combinado?';
   }else{
     m.message=open+'Preciso da sua ajuda na cobrança das pastas pagas de '+months+' com parcelas ainda em aberto. '+(x.collectionExecution!=null?'A execução de cobrança no Mapa está em '+Math.round(x.collectionExecution)+'%. ':'')+'Confira a carteira e priorize os vencimentos que realmente podem virar recebimento hoje. Faça o contato, negocie quando necessário e acompanhe até o pagamento confirmado; tentativa e acordo não são dinheiro recebido. Me traga na parcial quantas pastas revisou, quantos contatos e acordos fez e quanto entrou no caixa. Quais casos precisam do apoio do franqueado? Conto com você.';
   }
 }
 const roleLabels={efetivacao:'efetivação e aceitação CG',agenda_geral:'agenda CG, Orto e faltosos',agenda_cg:'agenda e faltosos CG',agenda_orto:'agenda e faltosos Orto',faltosos:'recuperação de faltosos',cobranca:'cobrança das pastas dos últimos três meses'};
 // O primeiro retorno é uma cobrança separada sobre indicação e aplicativo,
 // sem redistribuir a meta de efetivação nem repetir a tarefa da agenda.
 const firstReturn=individual.length?{recipient:individual[0].recipient,title:'Primeiro retorno · '+individual[0].recipient,message:'Bom dia, '+first(individual[0].recipient)+'. Volto ao ponto das indicações e do aplicativo: '+(x.amigoPct!=null?'o Amigo do Peito está em '+Math.round(x.amigoPct)+'%; ':'')+(x.amigoInd!=null&&x.amigoPoss!=null?'foram '+x.amigoInd+' indicações em '+x.amigoPoss+' possibilidades. ':'')+(x.app!=null?'A instalação do aplicativo está em '+Math.round(x.app)+'%. ':'')+'Retome os pacientes efetivados que ainda podem indicar e confira, com a recepção, quem ainda não instalou o app. Me envie os nomes e a data do próximo contato, sem expor dados clínicos no grupo. Os pacientes não atendidos ontem ou sem primeiro agendamento receberam contato? O que dificultou avançar e como posso ajudar?'}:null;
 const group='Bom dia, franqueados de '+cl.city+', tudo bem? Pelo Mapa até '+brDate(x.periodEnd)+', foram '+(x.chairEff??'—')+' efetivações para a meta mensal de '+(chairGoal??'—')+' pacientes por cadeira'+(gap!=null?'; faltam '+gap+' e o ritmo necessário é '+cgDay+' por dia útil restante':'')+'. '+(orthoGap!=null?'Em Orto, faltam '+orthoGap+' pastas pagas. ':'')+'O direcionamento para a recepção hoje é: '+individual.map(m=>m.recipient.split(/\s+/)[0]+' — '+roleLabels[roles.get(m.recipient)||'cobranca']).join('; ')+'. '+(x.accept!=null&&x.accept<80?'A aceitação de '+Math.round(x.accept)+'% pede uma conversa de vocês com os dentistas com menor conversão: revisem a abordagem, as objeções e o retorno dos pacientes que saíram sem efetivar. ':'')+(x.ticket!=null?'O ticket médio de CG é '+centralMoney(x.ticket)+'; a referência saudável do item 17 é '+centralMoney(healthy)+'. Peço que alinhem com os profissionais a apresentação completa do plano e dos procedimentos clinicamente indicados, observando necessidade, reparação, prevenção e desejo do paciente. ':'')+'O que já foi feito pela equipe? Onde a recepção ainda não conseguiu avançar e em qual ponto vocês podem apoiar os profissionais hoje? Na parcial, me tragam os números e a solução combinada, por favor.';
 const retIndividuals=individual.map(a=>({recipient:a.recipient,title:'Retorno · '+a.recipient,message:'Boa tarde, '+first(a.recipient)+'. Sobre a sua frente combinada hoje, o que realizou, o que ficou pendente e por quê? Me traga os números e o próximo horário de ação para fecharmos o dia.'}));
 const ret='Boa tarde, equipe de '+cl.city+'. Me tragam a parcial por frente: avaliações marcadas e comparecidas, propostas de CG retomadas e efetivadas, reagendamentos, pastas pagas e pagamentos confirmados. O que ainda podemos resolver hoje?';
 const treatment='Diagnóstico · '+cl.city+' (Mapa até '+brDate(x.periodEnd)+', captura '+brDate(sourceDate)+'). Auditoria '+x.audit.count+'/21 itens; item 15 ausente na página. '+goal+'Orto: '+(x.orthoPaid??'—')+'/'+(x.orthoPaidGoal??'—')+' pastas pagas. '+(x.accept!=null?'Aceitação CG '+Math.round(x.accept)+'%. ':'')+'Frentes: '+available.map(p=>p.name+' — '+roles.get(p.name)).join('; ')+'. Cadeira é contagem de pacientes, enquanto a meta financeira de CG é apurada separadamente. Confira capacidade e agenda real de hoje antes do envio.';
 return {individual,firstReturn,retIndividuals,group,ret,treatment,treatmentItems:treatmentItems(cl,x,days,healthy),audit:x.audit,metrics:x};
}

async function reportHistoryForClinic(id){
 try{
   const rows=await mgmtFetch('central_report_texts?select=capture_date,report_text,updated_at&clinic_id=eq.'+id+'&return_type=eq.2&order=capture_date.desc,updated_at.desc&limit=60');
   const today=isoDay(),currentMonth=today.slice(0,7);
   const previousRow=rows.find(x=>x.capture_date<today);
   const previous=previousRow?.report_text||'';
   const previousMonth=rows.find(x=>String(x.capture_date||'').slice(0,7)<currentMonth)?.report_text||'';
   return {previous,previousDate:previousRow?.capture_date||'',previousMonth};
 }catch{return {previous:'',previousMonth:''}}
}
async function saveDailyGuides(id){
 const cl=clinic(id),latest=await latestReportForClinic(id),raw=latest?.report_text;if(!raw)throw new Error('Sem Mapa de Trabalho salvo para '+cl.city+'.');
 const audit=reportAudit21(raw);
 if(audit.count<20||audit.missing.some(n=>n!==15))throw new Error('Relatório com '+audit.count+'/21 itens: faltam '+audit.missing.join(', ')+'. Confira o Mapa antes de gerar.');
 const parsed=reportCore(raw);
 if(parsed.clinicCode!==cl.code)throw new Error('Código da franquia no relatório ('+(parsed.clinicCode||'ausente')+') difere de '+cl.code+'. Revise a clínica selecionada.');
 if(latest.capture_date!==isoDay())throw new Error('O Mapa foi capturado em '+brDate(latest.capture_date)+'. Copie a página atual no Sisodonto e salve uma nova captura antes de gerar mensagens de hoje.');
 if(!parsed.periodEnd||parsed.periodEnd.slice(0,7)!==isoDay().slice(0,7)||parsed.periodEnd>isoDay())throw new Error('O relatório não corresponde ao período corrente. Atualize a fonte antes de gerar.');
 let people=[];try{people=await mgmtFetch('management_people?select=role_type,name,functions&clinic_id=eq.'+id+'&active=eq.true')}catch{}
 const history=await reportHistoryForClinic(id),g=dailyGuideMessages(cl,raw,people,history,latest.capture_date);
 const rows=[...g.individual.map(x=>({section:'morning_messenger',...x})),...(g.firstReturn?[{section:'morning_followup',...g.firstReturn}]:[]),...g.retIndividuals.map(x=>({section:'afternoon_return',...x})),{section:'morning_group',recipient:'group',title:'Grupo · manhã',message:g.group},{section:'afternoon_return',recipient:'group',title:'Retorno da tarde',message:g.ret},...g.treatmentItems.map(x=>({section:'treatment_items',...x}))];
 for(const r of rows){const body={guide_date:isoDay(),clinic_id:id,section:r.section,recipient:r.recipient,title:r.title,message:r.message,action_plan:r.section==='treatment_items'?r.message:''};const old=await mgmtFetch('daily_clinic_guides?select=id,message,manual_override&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=eq.'+encodeURIComponent(r.section)+'&recipient=eq.'+encodeURIComponent(r.recipient)+'&order=id.desc&limit=20');if(old[0]){if(old[0].manual_override&&r.section==='morning_messenger')continue;if(r.section==='treatment_items'&&old[0].message!==r.message)body.image_data='';await mgmtFetch('daily_clinic_guides?id=eq.'+old[0].id,{method:'PATCH',body:JSON.stringify(body)});for(const stale of old.slice(1))await mgmtFetch('daily_clinic_guides?id=eq.'+stale.id,{method:'DELETE'})}else await mgmtFetch('daily_clinic_guides',{method:'POST',body:JSON.stringify(body)})}
 const valid=new Set(rows.map(r=>r.section+'|'+r.recipient)),sections=['morning_messenger','morning_followup','morning_group','afternoon_return','treatment_items'];
 const existing=await mgmtFetch('daily_clinic_guides?select=id,section,recipient&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=in.('+sections.join(',')+')');
 for(const stale of existing)if(!valid.has(stale.section+'|'+stale.recipient))await mgmtFetch('daily_clinic_guides?id=eq.'+stale.id,{method:'PATCH',body:JSON.stringify({section:'legacy_'+isoDay().replace(/-/g,'')+'_'+stale.section+'_'+stale.id,updated_at:new Date().toISOString()})});
 toast('Mapa '+brDate(latest.capture_date)+' ('+audit.count+'/21; item 15 ausente na exportação) e mensagens recalculadas para '+cl.city+'.');
}
async function guideCards(id,section){
 const rows=await mgmtFetch('daily_clinic_guides?select=*&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=eq.'+section+'&order=id.desc');
 const seen=new Set(),latest=[];for(const r of rows){const k=String(r.recipient||'group').toLowerCase();if(seen.has(k))continue;seen.add(k);latest.push(r)}
 latest.reverse();
 return latest.map(r=>'<div class="card guide-output" data-paste-guide="'+r.id+'" tabindex="0"><div class="section-head"><div><strong>'+esc(r.title)+'</strong><div class="clinic-meta">'+esc(r.recipient)+'</div></div><div class="actions"><button class="ghost" data-save-guide="'+r.id+'">Salvar edição</button><button class="ghost" data-copy-guide="'+r.id+'">Copiar mensagem</button>'+(r.image_data?'<button class="btn primary" data-copy-guide-pack="'+r.id+'">Copiar print + mensagem</button>':'')+'</div></div><textarea class="message-box" rows="8" data-guide-text="'+r.id+'">'+esc(r.message)+'</textarea>'+(r.section==='treatment_items'?'<div class="hint">Clique neste cartão e use Ctrl+V, ou toque no campo abaixo e escolha Colar no celular. O print fica somente nesta mensagem.</div><div contenteditable="true" role="textbox" aria-label="Cole o print nesta tratativa" style="min-height:44px;padding:10px;border:1px dashed #8ba8c6;border-radius:8px;margin:8px 0">Toque aqui e cole o print</div>':'')+'<label class="btn secondary">Adicionar imagem<input class="hidden guide-image" data-guide-image="'+r.id+'" type="file" accept="image/*"></label>'+(r.image_data?'<img class="guide-preview" src="'+r.image_data+'">':'')+'</div>').join('')}
async function bindTreatmentPaste(container){
 container.querySelectorAll('[data-paste-guide]').forEach(card=>card.onpaste=async e=>{
  const file=[...e.clipboardData.items].find(x=>x.type.startsWith('image/'))?.getAsFile();if(!file)return;
  e.preventDefault();const id=card.dataset.pasteGuide;await mgmtFetch('daily_clinic_guides?id=eq.'+id,{method:'PATCH',body:JSON.stringify({image_data:await fileToDataUrl(file),updated_at:new Date().toISOString()})});toast('Print colado nesta mensagem.');renderPage();
 });
 container.querySelectorAll('[data-copy-guide-pack]').forEach(b=>b.onclick=async()=>{const id=b.dataset.copyGuidePack,rows=await mgmtFetch('daily_clinic_guides?select=image_data,message&id=eq.'+id+'&limit=1');if(rows[0]?.image_data)await copyPrintAndMessage({...rows[0],message:container.querySelector('[data-guide-text="'+id+'"]').value});});
}
async function bindGuideCards(){$$('[data-merge-guides]').forEach(b=>b.onclick=async()=>{const id=Number(b.dataset.mergeGuides),section=b.dataset.section,rows=await mgmtFetch('daily_clinic_guides?select=*&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=eq.'+section+'&order=id.asc'),ind=rows.filter(x=>x.recipient!=='group');if(!ind.length)return toast('Nenhuma mensagem individual para unir.');const merged=ind.map((x,i)=>'Tarefa '+(i+1)+' · '+x.recipient+'\n'+x.message).join('\n\n');const body={guide_date:isoDay(),clinic_id:id,section,recipient:'Equipe unificada',title:'Tarefas unificadas · equipe',message:merged,action_plan:'Redistribuir as frentes conforme a equipe disponível.',updated_at:new Date().toISOString()};const old=await mgmtFetch('daily_clinic_guides?select=id&guide_date=eq.'+isoDay()+'&clinic_id=eq.'+id+'&section=eq.'+section+'&recipient=eq.'+encodeURIComponent('Equipe unificada')+'&limit=1');if(old[0])await mgmtFetch('daily_clinic_guides?id=eq.'+old[0].id,{method:'PATCH',body:JSON.stringify(body)});else await mgmtFetch('daily_clinic_guides',{method:'POST',body:JSON.stringify(body)});toast('Tarefas reunidas em uma mensagem.');renderPage()});$$('[data-copy-guide]').forEach(b=>b.onclick=()=>copyText(b.closest('.guide-output').querySelector('.message-box').value));$$('[data-save-guide]').forEach(b=>b.onclick=async()=>{const box=b.closest('.guide-output').querySelector('.message-box');await mgmtFetch('daily_clinic_guides?id=eq.'+b.dataset.saveGuide,{method:'PATCH',body:JSON.stringify({message:box.value,manual_override:true,updated_at:new Date().toISOString()})});toast('Edição salva')});$$('[data-guide-image]').forEach(inp=>inp.onchange=async()=>{const f=inp.files?.[0];if(!f)return;const d=await fileToDataUrl(f);await mgmtFetch('daily_clinic_guides?id=eq.'+inp.dataset.guideImage,{method:'PATCH',body:JSON.stringify({image_data:d,updated_at:new Date().toISOString()})});toast('Imagem anexada à mensagem.');renderPage()})}
function reportTextGeneratorPanel(id,section){return '<details class="card report-text-card inline-generator report-source"><summary><div><strong>Fonte do relatório · Mapa de Trabalho</strong><span>Abra somente para atualizar ou conferir o texto-fonte</span></div><span id="quickAuditBadge" class="badge blue">carregando</span></summary><div class="report-source-body"><textarea id="quickReportText" rows="8" placeholder="Cole aqui o Mapa de Trabalho completo da clínica, do item 1 ao 21…"></textarea><div id="quickAuditDetails" class="hint" style="margin:8px 0"></div><div class="actions"><button id="quickSaveReport" class="btn secondary">Salvar relatório</button><button id="quickGenerateReport" class="btn primary">Auditar + gerar '+(section==='morning'?'mensageiro e grupo':section==='return'?'retorno da tarde':'tratativa')+'</button></div><span id="quickReportState" class="hint"></span></div></details>'}
async function bindReportTextGenerator(id,section){
 const box=$('#quickReportText'),st=$('#quickReportState'),badge=$('#quickAuditBadge'),details=$('#quickAuditDetails');if(!box)return;
 const refreshAudit=()=>{const text=box.value.trim();if(!text){if(badge)badge.textContent='aguardando relatório';if(details)details.textContent='';return}const a=reportAudit21(text),core=reportCore(text);if(badge)badge.textContent=a.count+'/21 itens detectados';if(details){const misses=a.missing.length?' · ausentes: '+a.missing.join(', '):'';details.textContent='Clínica: '+(core.clinicLabel||'não identificada')+' · cadeiras: '+(core.chairs??'—')+' · aceitação: '+(core.accept??'—')+'% · meta proporcional: '+(core.chairProp??'—')+' · efetivados: '+(core.chairEff??core.eff??'—')+misses;}};
 box.addEventListener('input',refreshAudit);
 try{const rows=await mgmtFetch('central_report_texts?select=id,report_text,capture_date,updated_at&capture_date=lte.'+isoDay()+'&clinic_id=eq.'+id+'&return_type=eq.2&order=capture_date.desc,updated_at.desc&limit=1');box.value=rows[0]?.report_text||'';box.dataset.rowId=rows[0]?.capture_date===isoDay()?rows[0].id:'';st.textContent=rows[0]?'Fonte disponível: '+brDate(rows[0].capture_date)+(rows[0].capture_date===isoDay()?' · salva hoje':' · copie e salve para atualizar a captura'):'Cole o relatório completo';refreshAudit();}catch(e){st.textContent='Não foi possível carregar o relatório';}
 async function persist(){const text=box.value.trim();if(!text)throw new Error('Cole o relatório primeiro.');assertMapForClinic(text,id);const body={capture_date:isoDay(),clinic_id:id,return_type:2,report_text:text,updated_at:new Date().toISOString()};if(box.dataset.rowId)await mgmtFetch('central_report_texts?id=eq.'+box.dataset.rowId,{method:'PATCH',body:JSON.stringify(body)});else{const r=await mgmtFetch('central_report_texts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});box.dataset.rowId=r[0]?.id||''}st.textContent='Texto salvo';}
 $('#quickSaveReport').onclick=async()=>{try{await persist();toast('Texto salvo nesta clínica.')}catch(e){toast(e.message)}};
 $('#quickGenerateReport').onclick=async()=>{const b=$('#quickGenerateReport');b.disabled=true;try{await persist();await saveDailyGuides(id);toast('Leitura concluída e mensagens atualizadas.');renderPage()}catch(e){toast('Falha na leitura: '+e.message)}finally{b.disabled=false}};
}
function roadPanel(){
 if(isoDay().slice(0,7)!=='2026-09')return '';
 const rows=CLINICS.map(cl=>({cl,...ROAD_SEPTEMBER[cl.code]})).sort((a,b)=>(a.goal-a.effective)-(b.goal-b.effective));
 return '<details class="card" open><summary><strong>ROAD · Brasil · setembro/2026 · 12 clínicas</strong></summary><p class="hint">Retrato consultado em 24/09; ranking ao vivo pode mudar. Meta de 40 efetivações por cadeira no mês. Faixas: abaixo de 10 sem classificação; 10–20 em desenvolvimento; 20–30 bronze; 30–40 prata; acima de 40 ouro. O Mapa de Trabalho usa outra apuração. Priorize Jardim para fechar a meta; nas demais, recupere agenda e propostas com base na capacidade real.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Clínica</th><th>Posição/801</th><th>ROAD</th><th>Por cadeira</th><th>Faixa</th><th>Faltam para meta</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.cl.city)+'</td><td>'+r.rank+'</td><td>'+r.effective+'/'+r.goal+'</td><td>'+r.perChair+'</td><td>'+roadTier(r.perChair)+'</td><td>'+Math.max(0,r.goal-r.effective)+'</td></tr>').join('')+'</tbody></table></div></details>';
}

async function renderPeriod1(c){
 const id=state.selectedClinic||1,cl=clinic(id);c.innerHTML='<div class="page-intro"><div><span class="eyebrow">MANHÃ</span><h3>Primeiro mensageiro + grupo</h3><p>Mapa de Trabalho com 21 itens, metas distintas de cadeiras e faturamento e equipe cadastrada.</p></div><select id="p1Clinic">'+CLINICS.map(x=>'<option value="'+x.id+'" '+(x.id===id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div>'+roadPanel()+reportTextGeneratorPanel(id,'morning')+'<div class="actions"><button id="generateDaily" class="btn primary">Gerar/atualizar guia desta clínica</button><button id="generateAllMorning" class="btn secondary">Gerar manhã das 12 clínicas</button></div><div id="morningGuides"></div>';
 $('#p1Clinic').onchange=e=>{state.selectedClinic=Number(e.target.value);renderPeriod1(c)};$('#generateDaily').onclick=async()=>{try{await saveDailyGuides(id);renderPeriod1(c)}catch(e){toast(e.message)}};$('#generateAllMorning').onclick=async()=>{const b=$('#generateAllMorning');b.disabled=true;b.textContent='Gerando 12 clínicas…';let ok=0,missing=[];try{for(const clx of CLINICS){try{await saveDailyGuides(clx.id);ok++}catch(e){missing.push(clx.city+': '+e.message)}}toast(ok+' clínica(s) atualizada(s)'+(missing.length?' · '+missing.length+' pendência(s)':''));if(missing.length)$('#morningGuides').insertAdjacentHTML('afterbegin','<div class="hint">Pendências: '+esc(missing.join(' | '))+'</div>');else await renderPeriod1(c)}finally{b.disabled=false;b.textContent='Gerar manhã das 12 clínicas'}};await bindReportTextGenerator(id,'morning');
 const a=await guideCards(id,'morning_messenger'),f=await guideCards(id,'morning_followup'),b=await guideCards(id,'morning_group');$('#morningGuides').innerHTML='<div class="guide-strip"><div><strong>Mensageiro individual</strong><span>Uma frente por pessoa, meta e plano do dia.</span></div><div><strong>Grupo</strong><span>Leitura estratégica + solução + acompanhamento.</span></div></div><h3>Primeiros mensageiros</h3>'+a+'<h3>Primeiro retorno · indicações e aplicativo</h3>'+f+'<h3>Grupo</h3>'+b;await bindGuideCards();
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
 s+='Plano para hoje: atacar primeiro o que está abaixo, dividir responsáveis entre recepção/profissionais, trabalhar agenda, pacientes que ainda não agendaram e novo contato com quem ficou pendente e fazer uma parcial no meio do período. No fim do dia quero comparar o que combinamos com o que realmente virou avaliação, efetivação e início.';
 if(alerts.length)s+=' Bora virar esse jogo juntos? 🙌';else s+=' Bora manter essa pegada sem deixar o indicador cair? 😄';
 return s;
}
async function renderReturns(c){
 const id=state.selectedClinic||1;c.innerHTML='<div class="page-intro"><div><span class="eyebrow">TARDE</span><h3>Retorno · mensageiros + grupo</h3><p>Cobrança humana do que foi combinado pela manhã e reação para fechar o dia.</p></div><select id="rClinic">'+CLINICS.map(x=>'<option value="'+x.id+'" '+(x.id===id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div>'+reportTextGeneratorPanel(id,'return')+'<div class="actions"><button id="rGenerate" class="btn primary">Gerar/atualizar retorno</button></div><div id="returnGuides">'+await guideCards(id,'afternoon_return')+'</div>';
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
function renderPaths(c){c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">ATALHOS</span><h3>Caminhos dos indicadores</h3><p>Consulte onde encontrar cada dado sem interromper o fluxo.</p></div></div><div class="grid cols-2"><div class="card"><h3>Caminhos do sistema</h3>${Object.keys(paths).map(k=>`<div class="path-item"><strong>${k}</strong><span>${tools[k]} · ${paths[k]}</span></div>`).join('')}</div><div class="card"><h3>Regra do Período 1</h3><div class="hint">Colaboradoras: mensageiro detalhado com leitura do Mapa, meta individual de CG × ticket saudável, Orto, ferramenta, responsável e parcial.<br><br>Franqueados: print do relatório + resumo breve dos números + foco do dia.</div></div></div>`}
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
   msg=open+(good?'Resultado positivo: os '+treatments+' tratamentos efetivados já foram iniciados. Esse processo deve ser mantido. ':'Este ponto precisa de atenção. ');
   if(gap>0)msg+='Temos '+treatments+' efetivados e '+started+' iniciados, então '+gap+' paciente'+(gap===1?' ainda precisa':'s ainda precisam')+' começar. ';
   msg+=good?'Plano: manter início no mesmo dia ou em até 2 dias e conferir no fim do expediente se ninguém ficou para trás.':'Plano de ação: a recepção lista agora os efetivados sem início, entra em contato, agenda para hoje ou no máximo em 2 dias e me retorna no fim do período com quem foi agendado e quem ainda ficou pendente.';
 }else if(/ORTODONT/.test(u)||paid!=null){
   const gap=paid!=null&&paidGoal!=null?Math.max(0,paidGoal-paid):null;good=gap===0&&paidGoal!=null;
   msg=open+(good?'A Ortodontia apresenta um bom resultado. ':'Na Ortodontia ainda há resultado a buscar e as oportunidades precisam ser trabalhadas. ');
   if(paid!=null&&paidGoal!=null)msg+='Estamos com '+paid+' pastas pagas para meta de '+paidGoal+(gap>0?', faltando '+gap+'. ':'. ');
   if(acceptance!=null)msg+='Aceitação em '+Math.round(acceptance)+'%. ';
   msg+='Plano de ação: revisar pacientes avaliados que não fecharam, reforçar indicação de Orto em todo novo paciente, recepção acompanhar até o agendamento e trabalhar as pendências de pasta ainda hoje. Quero retorno do que virou avaliação, pasta e início.';
 }else if(/INDICA[CÇ][OÕ]ES|INDICA[CÇ][AÃ]O/.test(u)){
   good=collection!=null&&collection>=healthyCollection;
   msg=open+'Indicação é uma ferramenta que não podemos deixar parada'+(good?' — aqui o movimento está bom, obrigada equipe! 💙. ':', e aqui fiquei preocupado porque estamos deixando oportunidade na mesa 😕. ')+'Plano de ação: profissional faz a indicação, recepção reforça a abordagem, registra os nomes e acompanha até o agendamento. No fim do período quero o retorno de quantas indicações foram pedidas, quantas viraram contato e quantas viraram avaliação.';
 }else if(/COBRAN[CÇ]A|APROVEITAMENTO DO AGENTE/.test(u)){
   good=collection!=null&&collection>=healthyCollection;msg=open+(good?'A cobrança está em nível saudável. Vamos manter o processo. ':'A cobrança está abaixo do esperado e precisamos transformar contato em pagamento. ');
   if(charges!=null&&payments!=null)msg+='Foram '+charges+' cobranças e '+payments+' pagamentos. ';
   if(collection!=null)msg+='Aproveitamento em '+Math.round(collection)+'%'+(good?', acima/igual aos '+healthyCollection+'% que usamos como referência. ':', abaixo dos '+healthyCollection+'% de referência. ');
   msg+='Plano de ação: separar a carteira por prioridade, fazer nova rodada nos sem retorno, retomar negociações abertas e registrar o motivo de quem não pagou. Quero parcial durante o dia e fechamento com quantidade de contatos, acordos e pagamentos.';
 }else if(/TICKET M[EÉ]DIO|PROCEDIMENTOS VENDIDOS|PRODUTIVIDADE PROFISSIONAL/.test(u)){
   good=ticket!=null&&ticket>=healthyTicket;msg=open+(good?'O ticket médio está em nível saudável e contribui diretamente para o caixa da clínica. ':'O ticket médio precisa de atenção porque impacta diretamente o caixa. ');
   if(ticket!=null)msg+='Estamos em '+centralMoney(ticket)+' para referência saudável de '+centralMoney(healthyTicket)+'. ';
   if(procedures!=null&&patients>0)msg+='São '+procedures+' procedimentos para '+patients+' pacientes, média de '+(procedures/patients).toFixed(1).replace('.',',')+' por paciente. ';
   if(sold!=null)msg+='Valor vendido: '+centralMoney(sold)+'. ';
   msg+='Plano de ação: revisar profissional por profissional, trabalhar procedimentos dentro da tabela e montar o plano pelas 4 odontologias — necessidade, reparadora, prevenção e desejo. A referência é buscar média de 11 procedimentos por avaliação, sem empurrar tratamento e sem deixar necessidade clínica fora do plano.';
 }else if(/[ÍI]NDICE DE ACEITA[CÇ][AÃ]O|ACEITA[CÇ][AÃ]O/.test(u)||acceptance!=null){
   good=acceptance!=null&&acceptance>=healthyAcceptance;msg=open+(good?'A aceitação está em nível saudável. Vamos manter a qualidade da abordagem com os pacientes. ':'A aceitação está abaixo do saudável e precisa de correção. ');
   if(evals!=null&&eff!=null)msg+='Tivemos '+evals+' avaliações e '+eff+' efetivações. ';
   if(acceptance!=null)msg+='Estamos em '+Math.round(acceptance)+'%'+(good?', dentro dos '+healthyAcceptance+'% saudáveis. ':', abaixo dos '+healthyAcceptance+'% saudáveis. ');
   msg+='Plano de ação: levantar os nomes de quem avaliou e não efetivou, revisar a abordagem, entrar em contato novamente e registrar quando cada paciente vai retornar. No grupo, alinhar com recepção e profissionais onde está o menor aproveitamento e o franqueado reforça a execução.';
 }else if(chair!=null){
   good=chair>=100;msg=open+(good?'A meta por cadeira está em bom nível. Agora precisamos manter o resultado. ':'A meta por cadeira está abaixo do esperado e precisa de reação imediata. ')+'Estamos em '+Math.round(chair)+'%. Plano de ação: calcular quantos pacientes faltam para a meta por cadeira, abrir agenda para avaliações, chamar pacientes que ainda não agendaram e faltosos e dividir uma meta objetiva entre as recepcionistas. Fazer parcial à tarde e redistribuir a busca se alguma frente não avançar.';
 }else if(conversion!=null){
   good=conversion>=healthyConversion;msg=open+(good?'A conversão está em nível saudável. ':'A conversão está abaixo do saudável e precisa de ação. ')+'Estamos em '+Math.round(conversion)+'% para referência de '+healthyConversion+'%. Plano de ação: listar avaliações sem fechamento, separar motivo por paciente, fazer contato novamente de forma individual e acompanhar até o paciente agendar ou fechar. Nada de contato genérico: precisamos atacar a dor que travou cada fechamento.';
 }else if(app!=null){
   good=app>=healthyApp;msg=open+(good?'Aplicativo em '+Math.round(app)+'%, dentro do saudável. ':'Aplicativo em '+Math.round(app)+'%, abaixo do saudável e precisa de correção. ')+'Plano de ação: conferir paciente por paciente sem instalação, orientar ainda na recepção e validar antes de ele sair da clínica. Meta é chegar aos '+healthyApp+'% e manter.';
 }else{
   msg=open+'Nesse indicador, quero atenção ao que ficou fora do saudável. Não vamos mandar só o problema para o grupo. Plano de ação: identificar os pacientes/processos que formam esse número, definir um responsável, executar a correção ainda no período e retornar com o que foi feito e o resultado. Se o indicador estiver saudável, a ação é manter o processo e não deixar o resultado cair.';
 }
 if(index===total-1)msg+=' Para fechar, me atualizem com o que foi executado, o que melhorou e o que ainda precisa de ação.';
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
 return {summary:(wins.length?'Pontos saudáveis: '+wins.join(', ')+'. ':'')+(issues.length?'Prioridades de reação: '+issues.join(', ')+'.':'Sem indicador crítico identificado com segurança nos prints lidos.'),attack:['1. Trabalhar primeiro os indicadores abaixo do saudável e transformar cada diferença para a meta em uma lista objetiva de pacientes e ações.','2. Recepção: agenda, pacientes que ainda não agendaram, faltosos, indicações e avaliações que não fecharam.','3. Cobrança: priorizar os pacientes, entrar em contato novamente e acompanhar acordos e pagamentos.','4. Profissionais/franqueado: abordagem, ticket, indicações e reforço da execução.','5. Fazer parcial à tarde e fechar o dia com realizado, pendência e próximo passo.'].join('\n'),tasks:(owners?'Responsáveis cadastrados para direcionamento: '+owners+'.\n':'')+'Cada ação deve sair com responsável, meta e retorno do que foi feito; todo problema precisa sair com uma ação definida final.'};
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
    'avaliações e captação: trabalhar indicações, pacientes que ainda não agendaram e contatos pendentes para colocar novas avaliações na cadeira e acompanhar quem ainda não confirmou',
    'conversão e início: revisar avaliações que não fecharam, entrar em contato novamente e apoiar a negociação e garantir que quem efetivar já saia com o início do tratamento organizado',
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
  const docs=g+' Drs. Tudo bem?? Conferi o Retorno 1'+period+'. '+(c.eff!=null&&c.goal!=null?(gap>0?'Tivemos '+c.eff+' efetivações para meta de '+c.goal+', ficando '+gap+' abaixo. Já dividi a recuperação entre as colaboradoras com foco em agenda/reagendamento, novas avaliações, novo contato com pacientes pendentes e conversão.':'Tivemos '+c.eff+' efetivações para meta de '+c.goal+' e atingimos o combinado. Vou manter a equipe trabalhando agenda, avaliações e conversão para sustentar o resultado.'):'Já direcionei a equipe para atacar agenda, reagendamento, avaliações, novo contato com pacientes pendentes e conversão enquanto confirmamos o número final do relatório.');
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
  '<div class="card central-controls"><div class="form-grid"><div><label>Clínica</label><select id="crClinic">'+CLINICS.map(x=>'<option value="'+x.id+'" '+(x.id===cl.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div><div><label>Área</label><div class="hint"><strong>Tratativa completa</strong> · relatório por relatório, com leitura, explicação e ação objetiva.</div><input id="crType" type="hidden" value="2"></div></div></div>'+
  '<div class="treatment-quality card"><strong>Leitura completa · modo produção</strong><span>O sistema valida os 21 itens, a clínica e o período, calcula as metas e prioriza até 8 pontos para os franqueados.</span></div><div class="card report-text-card"><div class="section-head"><div><h3>Texto completo do relatório</h3><div class="clinic-meta">Cole a aba inteira de Gestão > Mapa de Trabalho. O relatório alimenta até 8 mensagens detalhadas; depois cole um print diretamente em cada cartão, se desejar.</div></div><span id="crTextState" class="hint">Carregando…</span></div><textarea id="crReportText" rows="10" placeholder="Cole aqui todo o texto do relatório da clínica…"></textarea><div class="actions"><button id="crSaveText" class="btn primary">Salvar texto desta clínica</button><button id="crClearText" class="ghost danger">Limpar texto</button></div></div>'+
  '<div class="actions"><button id="crGenerateFromText" class="btn primary">Gerar tratativa pelo texto</button></div><div id="crSavedTreatment"></div><details><summary>Arquivo anterior de prints e mensagens</summary><div class="central-progress analysis-status-panel"><div class="analysis-spinner" id="crSpinner"></div><div><strong id="crStatusTitle">Central de análise</strong><span id="crStatus" class="hint">Carregando registros de hoje…</span><div class="analysis-live-bar"><i id="crLiveBar"></i></div></div><div class="actions"><button id="crGenerateAll" class="btn primary">Gerar mensagens desta clínica</button><button id="crGenerateAllClinics" class="btn secondary">Ler todas as clínicas</button><button id="crReload" class="ghost">Atualizar</button></div></div><div id="crAnalysis"></div><div id="crGrid" class="central-grid return2-grid"></div></details>';
  $('#crClinic').onchange=e=>{state.selectedClinic=Number(e.target.value);renderCentralReturns(c)};
  $('#crSaveText').onclick=()=>saveCentralReportText();
  $('#crClearText').onclick=()=>clearCentralReportText();
  $('#crReload').onclick=()=>loadCentralReturns();
  $('#crGenerateAll').onclick=()=>generateCentralMessages(); $('#crGenerateFromText').onclick=async()=>{const b=$('#crGenerateFromText');b.disabled=true;try{await saveCentralReportText();await saveDailyGuides(Number($('#crClinic').value));toast('Tratativa pelo texto atualizada.');renderCentralReturns(c)}catch(e){toast('Falha: '+e.message)}finally{b.disabled=false}};
  $('#crGenerateAllClinics').onclick=()=>generateAllClinics();
  await Promise.all([loadCentralReturns(),loadCentralReportText()]); try{$('#crSavedTreatment').innerHTML='<h3>Tratativas · até 8 pontos prioritários</h3>'+await guideCards(Number($('#crClinic').value),'treatment_items');await bindGuideCards();await bindTreatmentPaste($('#crSavedTreatment'))}catch{}
}
async function loadCentralReportText(){
 const cid=Number($('#crClinic')?.value||state.selectedClinic||1),rt=Number($('#crType')?.value||2),box=$('#crReportText'),st=$('#crTextState');if(!box)return;
 try{const rows=await mgmtFetch('central_report_texts?select=id,report_text,capture_date,updated_at&capture_date=lte.'+isoDay()+'&clinic_id=eq.'+cid+'&return_type=eq.'+rt+'&order=capture_date.desc,updated_at.desc&limit=1');box.value=rows[0]?.report_text||'';box.dataset.rowId=rows[0]?.capture_date===isoDay()?rows[0].id:'';if(st)st.textContent=rows[0]?'Fonte: '+brDate(rows[0].capture_date)+(rows[0].capture_date===isoDay()?' · salva hoje':' · leitura anterior; confirme antes de atualizar'):'Ainda não salvo';}catch(e){if(st)st.textContent='Falha ao carregar';console.error(e)}
}
async function saveCentralReportText(){
 const box=$('#crReportText'),st=$('#crTextState'),text=(box?.value||'').trim(),cid=Number($('#crClinic').value),rt=Number($('#crType').value);if(!text)return toast('Cole o texto do relatório primeiro.');
 try{assertMapForClinic(text,cid);if(st)st.textContent='Salvando…';const body={capture_date:isoDay(),clinic_id:cid,return_type:rt,report_text:text,updated_at:new Date().toISOString()};const id=box.dataset.rowId;if(id)await mgmtFetch('central_report_texts?id=eq.'+id,{method:'PATCH',body:JSON.stringify(body)});else await mgmtFetch('central_report_texts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});await loadCentralReportText();toast('Texto do relatório salvo nesta clínica.');return true;}catch(e){if(st)st.textContent='Falha ao salvar';toast('Não foi possível salvar o texto: '+e.message);throw e}
}
async function clearCentralReportText(){
 const box=$('#crReportText'),id=box?.dataset.rowId;if(!box)return;if(!confirm('Limpar o texto do relatório desta clínica hoje?'))return;
 try{if(id)await mgmtFetch('central_report_texts?id=eq.'+id,{method:'DELETE'});box.value='';box.dataset.rowId='';$('#crTextState').textContent='Ainda não salvo';toast('Texto removido desta clínica.');}catch(e){toast('Não foi possível limpar: '+e.message)}
}
async function currentCentralReportText(){
 const box=$('#crReportText');if(box&&box.value.trim())return box.value.trim();const cid=Number($('#crClinic')?.value||state.selectedClinic||1),rt=Number($('#crType')?.value||2);try{const rows=await mgmtFetch('central_report_texts?select=report_text&capture_date=lte.'+isoDay()+'&clinic_id=eq.'+cid+'&return_type=eq.'+rt+'&order=capture_date.desc,updated_at.desc&limit=1');return rows[0]?.report_text||''}catch{return ''}
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
    return true;
  }catch(e){
    console.error('Falha na geração central',e);
    if(status)status.textContent='Erro na leitura: '+e.message;
    toast('Não foi possível concluir: '+e.message);
    return false;
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
      try{if(await generateCentralMessages())ok++;else fail.push(cl.city+': falha na análise')}catch(e){fail.push(cl.city+': '+e.message)}
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
        analysisBox.innerHTML='<section class="analysis-hub card"><div class="section-head"><div><span class="badge green">TRATATIVA CONCLUÍDA</span><h3>Leitura consolidada + plano de ação</h3><p>'+esc(clinic(clinic_id)?.name||'')+'</p></div><div class="actions"><button id="crCopyAll" class="btn primary">Copiar todos · WhatsApp</button><button id="crCopyPlan" class="ghost">Copiar plano de ataque</button></div><div id="crCopyProgress" class="copy-progress hidden"><div class="copy-progress-bar"><i></i></div><span></span></div></div><div class="analysis-grid"><div><label>Leitura objetiva</label><div class="analysis-copy">'+esc(a.summary||'')+'</div></div><div><label>Plano de ação</label><div class="analysis-copy preline">'+esc(a.attack_plan||'')+'</div></div><div class="span-2"><label>Responsáveis e ações</label><div class="analysis-copy preline">'+esc(a.team_tasks||'')+'</div></div></div></section>';
        $('#crCopyAll').onclick=()=>copyAllForWhatsApp(d.screenshots);
        $('#crCopyPlan').onclick=()=>copyText((a.attack_plan||'')+'\n\n'+(a.team_tasks||''));
      }else analysisBox.innerHTML='<div class="hint analysis-wait">Os prints estão salvos. A leitura estratégica desta clínica ainda não foi registrada.</div>';
    }else analysisBox.innerHTML='';
    if(!d.screenshots.length){grid.innerHTML='<div class="empty">Nenhum print salvo para esta clínica/tipo hoje.</div>';return}
    grid.innerHTML=d.screenshots.map((x,i)=>{const derived=(x.file_name||'').startsWith('extrato-mapa-'),label=derived?'Extrato visual gerado do Mapa':'Print do sistema';return '<article class="card print-card return2-card"><div class="print-head"><div><strong>'+label+' '+(i+1)+'</strong><span class="clinic-meta">'+esc(clinic(clinic_id)?.city||'')+' · fonte '+brDate(x.capture_date)+'</span></div><button class="ghost danger" data-cr-del="'+x.id+'">Excluir</button></div><button class="report-preview-btn" data-cr-preview="'+i+'" title="Abrir relatório em tamanho grande"><img src="'+x.image_data+'" loading="lazy" alt="'+label+' '+(i+1)+'"><span>🔎 Clique para ampliar e conferir os números</span></button><label class="return-message-label">Mensagem pronta para o grupo</label><textarea class="return-message-editor '+(x.message?'':'pending-message')+'" data-cr-msg="'+x.id+'" rows="7" placeholder="Clique em Gerar mensagens dos prints…">'+esc(x.message||'')+'</textarea><div class="return-actions"><button class="ghost" data-cr-save="'+x.id+'">Salvar texto</button><button class="ghost" data-cr-copy="'+i+'">Copiar mensagem</button><button class="btn primary" data-cr-pack="'+i+'" '+(x.message?'':'disabled')+'>Copiar imagem + mensagem</button></div></article>'}).join('');
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
 c.innerHTML='<div class="page-intro"><span class="eyebrow">EQUIPE DAS CLÍNICAS</span><h1>Pessoas & gestão</h1><p>Recepção, cobrança e franqueados organizados por unidade.</p></div><div class="team-tabs"><button class="btn primary" data-role="receptionist">Recepcionistas</button><button class="ghost" data-role="collection_agent">Agentes de cobrança</button><button class="ghost" data-role="franchisee">Franqueados</button><button class="ghost" data-role="manager">Gerente interno</button></div><div id="teamBody"></div>';
 let role='receptionist'; const labels={receptionist:'Recepcionista',collection_agent:'Agente de cobrança',franchisee:'Franqueado',manager:'Gerente interno'};
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
