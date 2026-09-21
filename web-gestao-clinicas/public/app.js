const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
const CLINICS=[
['DIAMANTINA - MG[1031]','Diamantina','MG','1031'],['DOM PEDRITO - RS[915]','Dom Pedrito','RS','915'],['GARCA - SP[470]','Garça','SP','470'],['GUAIRA - SP[1214]','Guaíra','SP','1214'],['ILHOTA - SC[550]','Ilhota','SC','550'],['JARDIM - MS[368]','Jardim','MS','368'],['PONTA GROSSA - PR - UVARANAS[51]','Ponta Grossa - Uvaranas','PR','51'],['REGISTRO I - SP[1609]','Registro I','SP','1609'],['RIO DO SUL - SC[27]','Rio do Sul','SC','27'],["SANTA BARBARA D`OESTE - JARDIM EUROPA - SP[1658]","Santa Bárbara d'Oeste - Jardim Europa",'SP','1658'],['SIDROLANDIA - MS[307]','Sidrolândia','MS','307'],['TAQUARITINGA - SP[1655]','Taquaritinga','SP','1655']
].map((x,i)=>({id:i+1,name:x[0],city:x[1],state:x[2],code:x[3]}));
const defaults={minEvaluations:15,maxEvaluations:20,cgEffective:7,orthoFolders:4,acceptanceHealthy:.8,conversionHealthy:.3,appHealthy:.95,satisfactionHealthy:.9,ticketReference:3419.85};
const paths={'Avaliações':'Admin > Indicações > Ferramenta de Conversão','Efetivações':'Rel. Administrativos > Gerentes > Avaliações','Conversão':'Admin > Indicações > Ferramenta de Conversão','Faltosos':'Agenda > Relatórios > Pacientes Faltosos','Trat. sem 1º agendamento':'Relatório de Avaliações > Tratamentos sem 1º agendamento','App':'Admin > Indicações / App','Pesquisa satisfação':'Admin > Indicações / App','Indicações/Amigo do Peito':'Admin > Indicações / App','Ortodontia':'Relatórios / Ortodontia'};
const tools={'Avaliações':'Ferramenta de Conversão','Efetivações':'Relatório de Avaliações','Conversão':'Ferramenta de Conversão','Faltosos':'Pacientes Faltosos','Trat. sem 1º agendamento':'Relatório de Avaliações','App':'Indicações / App','Pesquisa satisfação':'Indicações / App','Indicações/Amigo do Peito':'Indicações / App','Ortodontia':'Ortodontia'};
const state={page:'dashboard',selectedClinic:1,period:1};
const nav=[['dashboard','⌂','Visão geral'],['prepare','✓','Planejamento'],['clinics','▤','Dados das clínicas'],['period1','1','Retorno 1'],['centralReturns','▣','Central de prints'],['team','♙','Pessoas & gestão'],['messages','✉','Mensagens salvas'],['returns','2','Retornos'],['history','◷','Histórico'],['paths','↗','Caminhos'],['admin','⚙','Configurações']];
const help={dashboard:'Acompanhe as 12 unidades e vá direto ao que precisa de ação.',prepare:'Defina rapidamente as clínicas e responsáveis do dia.',clinics:'Concentre os dados e relatórios de cada unidade em um único lugar.',period1:'Mensagem breve das metas do dia, pronta para o grupo.',returns:'Registre os resultados recebidos sem perder tempo.',centralReturns:'Cole os prints por unidade; o ChatGPT devolve as mensagens prontas aqui.',team:'Cadastre recepcionistas, cobrança e franqueados com funções e metas individuais.',messages:'Prepare mensagens por clínica e data para copiar, editar ou enviar depois.',history:'Consulte retornos e mensagens anteriores por período.',paths:'Atalhos para encontrar cada indicador no sistema.',admin:'Metas, referências, segurança e backup.'};
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
function go(page){state.page=page;localStorage.setItem('g12_last_page',page);renderNav();$('#pageTitle').textContent=nav.find(x=>x[0]===page)?.[2]||'Sistema';$('#pageHelp').textContent=help[page]||'';$('#today').textContent=todayBR();renderPage();$('.sidebar').classList.remove('open')}
function renderPage(){const c=$('#content');c.classList.add('page-enter');setTimeout(()=>c.classList.remove('page-enter'),180);try{const out=({dashboard:renderDashboard,prepare:renderPrepare,clinics:renderClinics,period1:renderPeriod1,returns:renderReturns,centralReturns:renderCentralReturns,team:renderTeam,messages:renderSavedMessages,history:renderHistory,paths:renderPaths,admin:renderAdmin}[state.page]||renderDashboard)(c);if(out?.catch)out.catch(e=>renderFailure(c,e))}catch(e){renderFailure(c,e)}}
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
function renderPeriod1(c){const id=state.selectedClinic||1,cl=clinic(id),m=metric(id),p=plan(id)||{collaborator_count:2},pri=priorities(m),staff=data.staff[id]||[];const n=Math.min(5,Math.max(2,p.collaborator_count||2));c.innerHTML=`<div class="period-head"><div><span class="period-pill active">PERÍODO 1</span><h3>${esc(cl.name)}</h3><p>Primeiro contato do dia: secretárias + franqueados. Mensagens curtas, diretas e variáveis.</p></div><select id="p1Clinic">${CLINICS.map(x=>`<option value="${x.id}" ${x.id===id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="split"><div class="card"><h3>Base do relatório</h3><div class="clinic-meta">${brDate(m.report_start)} a ${brDate(m.report_end)}</div><div class="grid cols-2" style="margin-top:12px"><div class="metric"><div class="label">Avaliações</div><div class="value">${num(m.evaluations)}</div></div><div class="metric"><div class="label">Efetivações</div><div class="value">${num(m.effectivations)}</div></div><div class="metric"><div class="label">Ticket</div><div class="value">${money(m.ticket_avg)}</div></div><div class="metric"><div class="label">Aceitação</div><div class="value">${pct(m.acceptance)}</div></div></div><div class="hint" style="margin-top:12px">Focos: ${pri.join(' · ')}</div><button id="editReport" class="btn secondary block">Editar relatório</button></div><div class="card"><h3>Mensagem breve · franqueados</h3><div id="p1Franchise" class="message-box">${esc(franchiseP1(cl,m,pri))}</div><div class="toolbar"><button id="copyP1Franchise" class="ghost">Copiar</button></div><div class="hint" style="margin-top:14px">Envie junto com o print do relatório do dia/período.</div></div></div><div class="card"><div class="section-head"><div><h3>Secretárias · metas do primeiro período</h3><span class="clinic-meta">O início muda automaticamente a cada dia.</span></div><button id="saveP1" class="btn primary">Salvar no histórico de hoje</button></div><div id="p1Staff"></div></div><div class="card muted-card"><h3>Período 2</h3><p>Reservado para o acompanhamento mais detalhado. Vamos estruturar depois sem misturar com o primeiro contato.</p></div>`;$('#p1Clinic').onchange=e=>{state.selectedClinic=Number(e.target.value);renderPeriod1(c)};$('#editReport').onclick=()=>go('clinics');$('#copyP1Franchise').onclick=()=>copyText($('#p1Franchise').textContent);const wrap=$('#p1Staff');for(let i=0;i<n;i++){const st=staff[i]||{},resp=st.resp||defaultResponsibility(i,pri),target=st.target||defaultTarget(resp);const row=document.createElement('div');row.className='assignment p1-row';row.innerHTML=`<div><label>Nome</label><input class="p1-name" value="${esc(st.name||'')}" placeholder="Secretária ${i+1}"></div><div><label>Foco</label><select class="p1-resp">${['Avaliações','Efetivações','Conversão','Faltosos','Trat. sem 1º agendamento','App','Pesquisa satisfação','Ortodontia'].map(x=>`<option ${x===resp?'selected':''}>${x}</option>`).join('')}</select></div><div><label>Meta</label><input class="p1-target" value="${esc(target)}"></div><div class="p1-message"><label>Mensagem</label><div class="message-box"></div></div><button class="ghost p1-copy">Copiar</button>`;wrap.appendChild(row);const update=()=>{const name=$('.p1-name',row).value,r=$('.p1-resp',row).value,t=$('.p1-target',row).value;$('.message-box',row).textContent=secretaryText(cl,id,i,name,r,t)};$$('input,select',row).forEach(x=>x.oninput=update);$('.p1-copy',row).onclick=()=>copyText($('.message-box',row).textContent);update()}$('#saveP1').onclick=()=>savePeriod1(id)}
function savePeriod1(id){const cl=clinic(id),m=metric(id),pri=priorities(m),rows=$$('.p1-row');const staff=rows.map((row,i)=>({name:$('.p1-name',row).value.trim(),resp:$('.p1-resp',row).value,target:$('.p1-target',row).value,message:$('.message-box',row).textContent}));data.staff[id]=staff.map(({name,resp,target})=>({name,resp,target}));const day=isoDay(),existing=data.period1History.findIndex(x=>x.day===day&&x.clinic_id===id);const rec={id:existing>=0?data.period1History[existing].id:`p1-${Date.now()}-${id}`,day,month:monthKey(day),createdAt:new Date().toISOString(),clinic_id:id,clinic_name:cl.name,report_start:m.report_start||'',report_end:m.report_end||'',metrics:{...m},priorities:[...pri],staff,franchise_message:franchiseP1(cl,m,pri)};if(existing>=0)data.period1History[existing]=rec;else data.period1History.unshift(rec);save();toast(existing>=0?'Histórico de hoje atualizado':'Período 1 salvo no histórico')}
function renderReturns(c){c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">ACOMPANHAMENTO</span><h3>Registrar retorno</h3><p>Registre somente o que mudou desde a última tratativa.</p></div></div><div class="hint">Período de retorno: registre números objetivos do que foi executado.</div><div class="split"><div class="card"><div class="form-grid"><div class="span-2"><label>Clínica</label><select id="r_clinic">${CLINICS.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div><label>Colaboradora</label><input id="r_collab"></div><div><label>Cumpriu?</label><select id="r_done"><option>Sim</option><option>Parcial</option><option>Não</option></select></div><div><label>Avaliações novas</label><input id="r_eval" type="number" value="0"></div><div><label>Efetivações novas</label><input id="r_eff" type="number" value="0"></div><div><label>Pastas Orto</label><input id="r_ortho" type="number" value="0"></div><div><label>Agendamentos</label><input id="r_apps" type="number" value="0"></div><div class="span-2"><label>Pendência</label><textarea id="r_pending"></textarea></div></div><button id="saveReturn" class="btn primary block">Registrar retorno</button></div><div class="card"><h3>Resumo</h3><div id="rSummary" class="message-box"></div></div></div>`;const gen=()=>{const cl=clinic(Number($('#r_clinic').value));$('#rSummary').textContent=`${cl.city}: ${$('#r_eval').value} avaliações novas, ${$('#r_eff').value} efetivações, ${$('#r_ortho').value} pastas Orto e ${$('#r_apps').value} agendamentos. Pendência: ${$('#r_pending').value||'nenhuma informada'}.`};$$('#content input,#content select,#content textarea').forEach(x=>x.oninput=gen);$('#saveReturn').onclick=()=>{gen();data.returns.unshift({id:`r-${Date.now()}`,day:isoDay(),month:monthKey(),clinic_id:Number($('#r_clinic').value),collaborator:$('#r_collab').value,completed_status:$('#r_done').value,new_evaluations:Number($('#r_eval').value||0),new_effectivations:Number($('#r_eff').value||0),ortho_folders:Number($('#r_ortho').value||0),appointments:Number($('#r_apps').value||0),pending:$('#r_pending').value,summary:$('#rSummary').textContent});save();toast('Retorno registrado')};gen()}
function renderHistory(c){const months=[...new Set(data.period1History.map(x=>x.month))].sort().reverse();if(!months.includes(monthKey()))months.unshift(monthKey());const selected=state.historyMonth&&months.includes(state.historyMonth)?state.historyMonth:months[0];state.historyMonth=selected;const rows=data.period1History.filter(x=>x.month===selected).sort((a,b)=>b.day.localeCompare(a.day)||b.createdAt.localeCompare(a.createdAt));c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">RASTREABILIDADE</span><h3>Histórico</h3><p>Encontre rapidamente o que foi enviado e registrado em cada dia.</p></div></div><div class="section-head"><div><h3>Histórico mensal · Período 1</h3><div class="clinic-meta">Cada dia de cada clínica pode ser excluído individualmente.</div></div><select id="historyMonth" style="max-width:220px">${months.map(m=>`<option value="${m}" ${m===selected?'selected':''}>${new Date(m+'-02T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</option>`).join('')}</select></div><div class="history-list">${rows.map(x=>`<div class="card history-day"><div class="section-head"><div><strong>${brDate(x.day)} · ${esc(clinic(x.clinic_id)?.city||x.clinic_name)}</strong><div class="clinic-meta">Relatório ${brDate(x.report_start)} a ${brDate(x.report_end)}</div></div><button class="ghost danger" data-delete-p1="${x.id}">Excluir dia</button></div><div class="grid cols-4"><div class="metric"><div class="label">Avaliações</div><div class="value">${num(x.metrics?.evaluations)}</div></div><div class="metric"><div class="label">Efetivações</div><div class="value">${num(x.metrics?.effectivations)}</div></div><div class="metric"><div class="label">Ticket</div><div class="value small-value">${money(x.metrics?.ticket_avg)}</div></div><div class="metric"><div class="label">Aceitação</div><div class="value">${pct(x.metrics?.acceptance)}</div></div></div><details><summary>Ver mensagens do dia</summary><h4>Franqueados</h4><div class="message-box">${esc(x.franchise_message)}</div>${(x.staff||[]).map(s=>`<h4>${esc(s.name||'Secretária')}</h4><div class="message-box">${esc(s.message)}</div>`).join('')}</details></div>`).join('')||'<div class="empty">Nenhum Período 1 salvo neste mês.</div>'}</div>`;$('#historyMonth').onchange=e=>{state.historyMonth=e.target.value;renderHistory(c)};$$('[data-delete-p1]').forEach(b=>b.onclick=()=>{if(confirm('Excluir este dia do histórico?')){data.period1History=data.period1History.filter(x=>x.id!==b.dataset.deleteP1);save();renderHistory(c);toast('Dia excluído')}})}
function renderPaths(c){c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">ATALHOS</span><h3>Caminhos dos indicadores</h3><p>Consulte onde encontrar cada dado sem interromper o fluxo.</p></div></div><div class="grid cols-2"><div class="card"><h3>Caminhos do sistema</h3>${Object.keys(paths).map(k=>`<div class="path-item"><strong>${k}</strong><span>${tools[k]} · ${paths[k]}</span></div>`).join('')}</div><div class="card"><h3>Regra do Período 1</h3><div class="hint">Secretárias: mensagem curta com <strong>meta + ferramenta + caminho + retorno</strong>.<br><br>Franqueados: print do relatório + resumo breve dos números + foco do dia.</div></div></div>`}
function renderAdmin(c){const s=data.settings;c.innerHTML=`<div class="page-intro"><div><span class="eyebrow">ADMINISTRAÇÃO</span><h3>Configurações</h3><p>Referências, segurança e manutenção da Central.</p></div></div><div class="grid cols-2"><div class="card"><h3>Metas e referências</h3><div class="form-grid">${setting('minEvaluations','Avaliações mínimas',s)}${setting('maxEvaluations','Avaliações máximas',s)}${setting('cgEffective','Efetivações CG/dia',s)}${setting('orthoFolders','Pastas Orto/dia',s)}${setting('acceptanceHealthy','Aceitação saudável',s,'.01')}${setting('conversionHealthy','Conversão saudável',s,'.01')}${setting('ticketReference','Ticket referência',s,'.01')}</div><button id="saveSettings" class="btn primary block">Salvar configurações</button></div><div class="card"><h3>Backup</h3><div class="hint">Os dados estão salvos neste navegador. Exporte backup regularmente.</div><div class="actions" style="margin-top:14px"><button id="backup" class="btn secondary">Exportar JSON</button><label class="btn secondary">Importar JSON<input id="importBackup" type="file" accept="application/json" class="hidden"></label></div><div style="height:18px"></div><button id="changePass" class="ghost">Trocar senha</button></div></div>`;$('#saveSettings').onclick=()=>{['minEvaluations','maxEvaluations','cgEffective','orthoFolders','acceptanceHealthy','conversionHealthy','ticketReference'].forEach(k=>data.settings[k]=Number($(`#set_${k}`).value));save();toast('Configurações salvas')};$('#backup').onclick=exportBackup;$('#importBackup').onchange=importBackup;$('#changePass').onclick=()=>{const p=prompt('Nova senha (mínimo 6 caracteres)');if(p&&p.length>=6){data.passwordHash=hash(p);save();toast('Senha alterada')}}}
function setting(k,l,s,step='1'){return `<div><label>${l}</label><input id="set_${k}" type="number" step="${step}" value="${s[k]}"></div>`}
function exportBackup(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`gestao-12-clinicas-${isoDay()}.json`;a.click();URL.revokeObjectURL(a.href)}
function importBackup(e){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{data={...baseData(),...JSON.parse(rd.result)};save();toast('Backup importado');go('dashboard')}catch{toast('Backup inválido')}};rd.readAsText(f)}
function showLogin(){if(data.passwordHash){$('.login-card p').textContent='Digite sua senha administrativa.'}else{$('.login-card p').textContent='Primeiro acesso: crie uma senha administrativa neste navegador.'}}
$('#loginForm').onsubmit=e=>{e.preventDefault();const p=$('#password').value;sessionStorage.setItem('g12_central_pass',p);if(p.length<6){$('#loginError').textContent='Use pelo menos 6 caracteres.';return}if(!data.passwordHash){data.passwordHash=hash(p);save()}else if(hash(p)!==data.passwordHash){$('#loginError').textContent='Senha inválida.';return}$('#loginError').textContent='';$('#login').classList.add('hidden');$('#app').classList.remove('hidden');renderNav();go(localStorage.getItem('g12_last_page')||'dashboard')};
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
  const t=String(raw||'').replace(/\s+/g,' ').trim(),u=t.toUpperCase();
  const pct=(label)=>centralPct(t,label);
  const acceptance=pct('aceita.{0,10}o'),conversion=pct('convers.{0,10}o'),app=pct('aplicativo'),collection=pct('aproveitamento');
  const evals=centralNum(t,[/total de avalia[cç][oõ]es[^0-9]{0,20}(\d+)/i,/avalia[cç][oõ]es[^0-9]{0,15}(\d+)/i]);
  const eff=centralNum(t,[/efetivadas?[^0-9]{0,15}(\d+)/i,/efetiva[cç][oõ]es[^0-9]{0,15}(\d+)/i]);
  const treatments=centralNum(t,[/tratamentos efetivados[^0-9]{0,15}(\d+)/i]);
  const started=centralNum(t,[/tratamentos iniciados[^0-9]{0,15}(\d+)/i]);
  const paid=centralNum(t,[/pastas pagas[^0-9]{0,15}(\d+)/i]),paidGoal=centralNum(t,[/meta de pastas pagas[^0-9]{0,15}(\d+)/i]);
  const charges=centralNum(t,[/cobran[cç]as efetuadas[^0-9]{0,15}(\d+)/i]),payments=centralNum(t,[/pagamentos realizados[^0-9]{0,15}(\d+)/i]);
  const procedures=centralNum(t,[/procedimentos vendidos[^0-9]{0,15}(\d+)/i]),patients=centralNum(t,[/pacientes efetivados[^0-9]{0,15}(\d+)/i]);
  const sold=centralNum(t,[/valor vendido[^0-9]{0,15}([\d.]+,\d{2})/i]);
  const h=new Date().getHours(),greeting=h<12?'Bom dia':(h<18?'Boa tarde':'Boa noite');
  let msg='';
  if(/EFETIVAD[OA]S?\s*[Xx×]\s*INICIAD[OA]S?|EFETIVADOS?.{0,20}INICIADOS?/.test(u)){
    const gap=treatments!=null&&started!=null?Math.max(0,treatments-started):null;
    msg=(index===0?greeting+' Drs. Tudo bem?? ':'')+'Vejam que nas efetivações '+(gap===0&&treatments!=null?'todos os '+treatments+' tratamentos já foram iniciados. Excelente resultado! ':'temos um ponto importante nos tratamentos iniciados. ');
    if(gap>0)msg+='Foram '+treatments+' tratamentos efetivados e '+started+' iniciados, então ainda temos '+gap+' paciente'+(gap===1?'':'s')+' que precisa'+(gap===1?'':'m')+' iniciar. Precisamos entrar em contato e garantir esse agendamento o quanto antes. ';
    msg+='A orientação é que o paciente inicie o tratamento no mesmo dia da efetivação ou, no máximo, em até 2 dias.';
  }else if(/ORTODONT/.test(u)||paid!=null){
    msg=(index===0?greeting+' Drs. Tudo bem?? ':'')+'Vejam que na Ortodontia, ';
    if(paid!=null&&paidGoal!=null){const gap=Math.max(0,paidGoal-paid);msg+=gap===0?'parabéns, já atingimos a meta de pastas pagas. ':('estamos com '+paid+' pastas pagas e faltam apenas '+gap+' para a meta. É um número totalmente alcançável e que podemos buscar juntos. ')}
    if(acceptance!=null)msg+='Por outro lado, nossa aceitação está em '+Math.round(acceptance)+'%'+(acceptance<80?', abaixo do saudável. Precisamos melhorar a indicação e aproveitar melhor cada avaliação, tanto para Clínico Geral quanto para Ortodontia. ':'. ');
  }else if(/INDICA[CÇ][OÕ]ES|INDICA[CÇ][AÃ]O/.test(u)){
    msg=(index===0?greeting+' Drs. Tudo bem?? ':'')+'Observei também que a recepção ainda tem oportunidade nas indicações. Precisamos reforçar com a equipe a necessidade de oferecer e indicar as avaliações de Clínico Geral e Ortodontia aos pacientes, porque é daí que vamos gerar novas oportunidades e aumentar nossas efetivações.';
  }else if(/COBRAN[CÇ]A|APROVEITAMENTO DO AGENTE/.test(u)){
    msg=(index===0?greeting+' Drs. Tudo bem?? ':'')+'Na cobrança, outro ponto que observei foi que ';
    if(charges!=null&&payments!=null)msg+='foram '+charges+' cobranças efetuadas e '+payments+' pagamentos realizados. ';
    if(collection!=null)msg+='Nosso aproveitamento está em '+Math.round(collection)+'%'+(collection>=65?', dentro do saudável. Parabéns pelo resultado! ':', abaixo do saudável, então precisamos trabalhar mais esse processo para transformar as cobranças em pagamentos. ');
    msg+='Mesmo quando o número está bom, precisamos continuar acompanhando para melhorar ainda mais o resultado.';
  }else if(/TICKET M[EÉ]DIO|PROCEDIMENTOS VENDIDOS|PRODUTIVIDADE PROFISSIONAL/.test(u)){
    msg=(index===0?greeting+' Drs. Tudo bem?? ':'')+'Sobre o ticket médio, quero chamar a atenção para esse número porque ele impacta diretamente a saúde da clínica. ';
    if(procedures!=null&&patients!=null&&patients>0)msg+='Temos '+procedures+' procedimentos para '+patients+' pacientes efetivados, uma média de '+(procedures/patients).toFixed(1).replace('.',',')+' procedimentos por paciente. ';
    if(sold!=null)msg+='O valor vendido foi de '+centralMoney(sold)+'. ';
    msg+='Precisamos manter atenção nos planos apresentados e não realizar procedimentos abaixo do valor, porque isso impacta diretamente o ticket médio e o resultado da clínica.';
  }else if(/[ÍI]NDICE DE ACEITA[CÇ][AÃ]O|ACEITA[CÇ][AÃ]O/.test(u)||acceptance!=null){
    msg=index===0?greeting+' Drs. Tudo bem?? Estava olhando os relatórios da unidade e quero começar pelo nosso índice de aceitação. ':'Olhando agora nosso índice de aceitação, ';
    if(evals!=null&&eff!=null)msg+='tivemos '+evals+' avaliações e '+eff+' efetivações. ';
    if(acceptance!=null)msg+='Estamos com '+Math.round(acceptance)+'% de aceitação'+(acceptance<80?', abaixo do saudável de 80%. Precisamos aumentar o aproveitamento das avaliações e usar as ferramentas disponíveis para gerar novas avaliações e efetivações. ':', dentro do saudável. Vamos manter esse resultado e buscar evoluir ainda mais. ');
  }else{
    const title=(t.match(/(?:^|\s)(\d+(?:\.\d+)?\.?\s+[^%]{4,55}?)(?=\s{2,}|\d{1,3}%|Per[ií]odo|$)/i)||[])[1];
    msg=(index===0?greeting+' Drs. Tudo bem?? ':'')+(title?'Olhando '+title.replace(/[+•]/g,'').trim()+', ':'Nesse próximo indicador, ')+'o que me chamou atenção foram os números apresentados em relação à meta. Vamos atacar especificamente o que ficou abaixo e manter o que já está saudável.';
  }
  if(index===total-1)msg+=' Para finalizar, peço que leiam os pontos que trouxe nos relatórios. Vamos olhar esses dados juntos e trabalhar nas ações necessárias para melhorar ainda mais nossos resultados!';
  return msg.trim();
}
function centralNormalize(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function centralContext(raw,cl){
  const t=String(raw||'').replace(/\s+/g,' ').trim(),n=centralNormalize(t);
  const dates=[...t.matchAll(/\b(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/g)].map(m=>m[1]);
  const times=[...t.matchAll(/\b([01]?\d|2[0-3]):[0-5]\d\b/g)].map(m=>m[0]);
  const expected=[cl?.city,cl?.name,cl?.code].filter(Boolean).map(centralNormalize);
  const expectedHit=expected.some(x=>x&&n.includes(x));
  const other=CLINICS.filter(x=>x.id!==cl?.id).find(x=>[x.city,x.name,x.code].filter(Boolean).map(centralNormalize).some(v=>v.length>=3&&n.includes(v)));
  return {text:t,n,dates:[...new Set(dates)],times:[...new Set(times)],expectedHit,other};
}
function centralValidateClinic(raw,cl){
  const c=centralContext(raw,cl);
  if(c.other&&!c.expectedHit)throw new Error('O relatório parece ser da clínica '+c.other.city+', mas está salvo em '+cl.city+'. Mova/confira o print antes de gerar a mensagem.');
  return c;
}
function centralReturn1Message(raw,cl){
  const c=centralValidateClinic(raw,cl),t=c.text;
  const eff=centralNum(t,[/efetiv(?:a[cç][oõ]es|ados?|adas?)[^0-9]{0,30}(\d+)/i,/realizadas?[^0-9]{0,25}(\d+)/i]);
  const goal=centralNum(t,[/meta(?:\s+(?:do|de|para|efetiva[cç][oõ]es))?[^0-9]{0,30}(\d+)/i,/objetivo[^0-9]{0,30}(\d+)/i]);
  const h=new Date().getHours(),g=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  const period=c.dates.length>=2?' de '+c.dates[0]+' a '+c.dates[c.dates.length-1]:(c.dates.length===1?' em '+c.dates[0]:'');
  if(eff==null||goal==null)throw new Error('Não consegui confirmar com segurança efetivações + meta no Retorno 1. A mensagem não foi criada para evitar número errado.');
  const gap=Math.max(0,goal-eff),remaining=gap;
  const team=gap>0
    ?g+' meninas! Conferi o retorno'+period+': tivemos '+eff+' efetivações e nossa meta era '+goal+'. Ficaram '+gap+' para recuperar. Vamos trabalhar '+remaining+' efetivaç'+(remaining===1?'ão':'ões')+' como meta do próximo acompanhamento, puxando avaliações pendentes, reativações e confirmações. Me atualizem durante o período para a gente ir acompanhando juntas.'
    :g+' meninas! Conferi o retorno'+period+': tivemos '+eff+' efetivações para meta de '+goal+' e batemos o combinado. Parabéns! Vamos manter o ritmo e não deixar as avaliações pendentes esfriarem.';
  const docs=g+' Drs. Tudo bem?? No retorno'+period+', tivemos '+eff+' efetivações para meta de '+goal+'. '+(gap>0?'Ficamos '+gap+' abaixo. Já passei essa recuperação para as colaboradoras e vou acompanhar com elas durante o próximo período.':'Meta atingida. Vamos manter esse ritmo no próximo período.');
  return 'COLABORADORAS · MENSAGEIRO\n'+team+'\n\nFRANQUEADOS · GRUPO\n'+docs;
}
async function centralGenerateOne(row,index,cl){
  await ensureCentralOcr();
  const status=$('#crStatus');
  const stages=['Preparando imagem','Lendo cabeçalho, clínica e período','Extraindo indicadores e metas','Conferindo datas, horários e cálculos','Montando mensagem humana'];
  if(status)status.textContent=stages[0]+' · print '+(index+1);
  const r=await Promise.race([
    Tesseract.recognize(row.image_data,'eng',{logger:m=>{if(m.status==='recognizing text'&&status){const p=Math.round((m.progress||0)*100),stage=p<25?stages[1]:p<60?stages[2]:p<85?stages[3]:stages[4];status.textContent=stage+' · print '+(index+1)+' · '+p+'%'}}),
    new Promise((_,no)=>setTimeout(()=>no(new Error('A leitura passou de 2 minutos. Tente novamente.')),120000))
  ]);
  const text=r.data?.text||'',confidence=Number(r.data?.confidence||0);
  if(text.trim().length<20||confidence<18)throw new Error('A leitura do print '+(index+1)+' ficou com baixa confiança ('+Math.round(confidence)+'%). A mensagem não foi salva para evitar erro.');
  const ctx=centralValidateClinic(text,cl);
  row._ocrText=text;row._ocrConfidence=confidence;row._ocrContext=ctx;
  if(status)status.textContent='Conferência final · print '+(index+1)+' · '+(ctx.dates.length?('datas '+ctx.dates.join(' → ')):'período sendo validado');
  return centralHumanMessage(text,cl,index,centralRows.length);
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
  c.innerHTML='<div class="section-head"><div><h3>Central de Retornos</h3><div class="clinic-meta">Cole todos os relatórios da unidade. No Retorno 2, cada print fica organizado com sua mensagem pronta para WhatsApp.</div></div></div>'+
  '<div class="card central-controls"><div class="form-grid"><div><label>Clínica</label><select id="crClinic">'+CLINICS.map(x=>'<option value="'+x.id+'" '+(x.id===cl.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div><div><label>Tipo</label><select id="crType"><option value="1">Retorno 1 · breve e direto</option><option value="2" selected>Retorno 2 · análise completa por print</option></select></div></div></div>'+
  '<div id="crPaste" class="paste-zone" tabindex="0"><strong>Ctrl+V para colar os prints da clínica</strong><span>Pode colar até 8 ou mais, um após o outro. Eles ficam salvos e ordenados.</span><label class="btn secondary">Selecionar imagens<input id="crFiles" class="hidden" type="file" accept="image/*" multiple></label></div>'+
  '<div class="central-progress analysis-status-panel"><div class="analysis-spinner" id="crSpinner"></div><div><strong id="crStatusTitle">Central de análise</strong><span id="crStatus" class="hint">Carregando registros de hoje…</span><div class="analysis-live-bar"><i id="crLiveBar"></i></div></div><div class="actions"><button id="crGenerateAll" class="btn primary">Gerar mensagens dos prints</button><button id="crReload" class="ghost">Atualizar</button></div></div><div id="crAnalysis"></div><div id="crGrid" class="central-grid return2-grid"></div>';
  $('#crClinic').onchange=e=>{state.selectedClinic=Number(e.target.value);renderCentralReturns(c)};
  $('#crType').onchange=()=>loadCentralReturns();
  $('#crPaste').onpaste=async e=>{const files=[...e.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();await uploadCentralFiles(files)}};
  $('#crFiles').onchange=async e=>{await uploadCentralFiles([...e.target.files]);e.target.value=''};
  $('#crReload').onclick=()=>loadCentralReturns();
  $('#crGenerateAll').onclick=()=>generateCentralMessages();
  $('#crPaste').ondragover=e=>{e.preventDefault();e.currentTarget.classList.add('drag-over')}; $('#crPaste').ondragleave=e=>e.currentTarget.classList.remove('drag-over'); $('#crPaste').ondrop=async e=>{e.preventDefault();e.currentTarget.classList.remove('drag-over');await uploadCentralFiles([...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')))};
  $('#crPaste').focus();
  await loadCentralReturns();
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
  const cl=clinic(Number($('#crClinic').value)),returnType=Number($('#crType').value),btn=$('#crGenerateAll'),status=$('#crStatus'),title=$('#crStatusTitle'),spin=$('#crSpinner'),bar=$('#crLiveBar');btn.disabled=true;btn.textContent='Analisando…';spin?.classList.add('active');if(title)title.textContent=returnType===1?'Leitura do Retorno 1 em andamento':'Análise estratégica em andamento';if(bar)bar.style.width='2%';
  try{
    for(let i=0;i<centralRows.length;i++){
      const row=centralRows[i];
      if(status)status.textContent='Print '+(i+1)+' de '+centralRows.length+' · identificando título, números, metas e oportunidades…';if(bar)bar.style.width=Math.round((i/centralRows.length)*100)+'%';
      let msg=await centralGenerateOne(row,i,cl);if(returnType===1)msg=centralReturn1Message(row._ocrText||'',cl);if(!msg||msg.trim().length<35)throw new Error('A leitura do print '+(i+1)+' não ficou confiável. A mensagem não foi salva; use Gerar novamente.');await centralSaveMessage(row.id,msg);row.message=msg;row.message_status='ready';
    }
    if(status)status.textContent='Análise concluída · '+centralRows.length+' de '+centralRows.length+' prints lidos e com mensagem.';if(title)title.textContent='Análise concluída';if(bar)bar.style.width='100%';toast(returnType===1?'Retorno 1 preparado.':'Mensagens do Retorno 2 geradas e salvas.');await loadCentralReturns();
  }catch(e){console.error(e);if(status)status.textContent='Erro na leitura: '+e.message;toast('Não foi possível concluir a leitura: '+e.message)}finally{btn.disabled=false;btn.textContent='Gerar mensagens dos prints';spin?.classList.remove('active')}
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
    status.textContent=d.screenshots.length+' print(s) salvo(s) '+when+' · '+(return_type===1?'Retorno 1: breve e direto.':readyCount===d.screenshots.length&&d.screenshots.length?'Análise concluída · '+readyCount+' mensagem(ns) prontas para copiar.':'Retorno 2: foto por foto, com texto humano pronto para copiar.');
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
