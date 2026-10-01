import test from 'node:test';
import assert from 'node:assert/strict';
import {directionMath,splitTotal,allocate,datesFor,targetsFor,messagesFor,parseEvaluations} from './public/planning.js';
const config={clinicId:1,clinicName:'Clínica teste',month:'2026-10',cg:120,ortho:25,paid:18,acceptance:.8,attendance:.75,orthoAcceptance:.5,weekdays:[1,2,3,4,5,6],closed:['2026-10-12'],team:[{name:'Pessoa Fechamento',front:'closing'},{name:'Pessoa Agenda',front:'agenda'}],status:'proposed'};
test('leitura de Avaliações usa campos reais e preserva o período de origem',()=>{
 const p=parseEvaluations('RELATÓRIOS ADMINISTRATIVOS - AVALIAÇÕES\n01/09/2026 ~ 30/09/2026\nAvaliações\n84 (0)\nEfetivações\n55 (0)\nTicket médio\n3.289,50\nTratamentos sem 1º agendamento\n4\nValor efetivado:\n180.922,35');
 assert.deepEqual(p.fields,{evaluations:84,effective:55,withoutFirst:4,value:180922.35,ticket:3289.5});
 assert.equal(p.sourcePeriod,'01/09/2026 a 30/09/2026');assert(p.summary.includes('não recebimento'));
 assert.equal(parseEvaluations('Texto sem totais').summary,'');
});
test('direcionamento mantém saldos negativos, arredonda para cima e trata campos vazios',()=>{
 assert.deepEqual(directionMath({yesterdayCG:368019.49,yesterdayValue:108726.94,yesterdayOrtho:75,yesterdayFolders:10,todayCG:627312,ticket:3488.25,evaluations:28}),{cgBalance:-259292.55,orthoBalance:-65,needed:180,missing:152});
 assert.equal(directionMath({todayCG:10,ticket:3,evaluations:9}).missing,0);
 assert.equal(directionMath({todayCG:10,ticket:0}).needed,null);
 assert.equal(directionMath({todayCG:null,ticket:3}).needed,null);
});
test('metas inteiras fecham no calendário específico e no rateio',()=>{
 assert.equal(datesFor(config).length,26);
 assert(!datesFor(config).includes('2026-10-12'));
 for(const key of ['cg','ortho','paid'])assert.equal(targetsFor(config).reduce((s,t)=>s+t[key],0),config[key]);
 assert.deepEqual(allocate(180,[120,120,80]),[68,67,45]);
 assert.equal(splitTotal(25,26).reduce((s,n)=>s+n,0),25);
 assert.equal(datesFor({...config,closed:[...config.closed,'2026-10-30']}).length,25);
 assert.throws(()=>splitTotal(-1,26));
});
test('mensagens têm funções separadas, variação de ação e atualização restrita ao dia',()=>{
 const a=messagesFor(config,'2026-10-01'),b=messagesFor(config,'2026-10-02');
 assert.equal(a.length,3);assert.equal(a.find(r=>r.recipient==='group').section,'planning_message');
 assert.equal(messagesFor(config,'2026-10-12').length,0);
 assert(a[0].message.includes('efetivações CG'));assert(a[1].message.includes('Sua parte da agenda'));
 assert(!a[0].message.includes('Sua parte da agenda'));
 assert.notEqual(a[0].message.replace(/01\/10/g,'dia'),b[0].message.replace(/02\/10/g,'dia'));
 const updated=messagesFor(config,'2026-10-01',{context:'Cinco avaliações confirmadas'});
 assert(updated[0].message.includes('Cinco avaliações confirmadas'));assert(!b[0].message.includes('Cinco avaliações confirmadas'));
 const solo=messagesFor({...config,team:[config.team[0]]},'2026-10-01')[0];
 assert(solo.message.includes('Sua parte da agenda'));assert(solo.message.includes('efetivações CG'));
});
