import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'alterar-em-producao';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const clinics = [
  ['DIAMANTINA - MG[1031]','Diamantina','MG','1031'],
  ['DOM PEDRITO - RS[915]','Dom Pedrito','RS','915'],
  ['GARCA - SP[470]','Garça','SP','470'],
  ['GUAIRA - SP[1214]','Guaíra','SP','1214'],
  ['ILHOTA - SC[550]','Ilhota','SC','550'],
  ['JARDIM - MS[368]','Jardim','MS','368'],
  ['PONTA GROSSA - PR - UVARANAS[51]','Ponta Grossa - Uvaranas','PR','51'],
  ['REGISTRO I - SP[1609]','Registro I','SP','1609'],
  ['RIO DO SUL - SC[27]','Rio do Sul','SC','27'],
  ["SANTA BARBARA D`OESTE - JARDIM EUROPA - SP[1658]","Santa Bárbara d'Oeste - Jardim Europa",'SP','1658'],
  ['SIDROLANDIA - MS[307]','Sidrolândia','MS','307'],
  ['TAQUARITINGA - SP[1655]','Taquaritinga','SP','1655']
];

const defaults = {
  minEvaluations: 15,
  maxEvaluations: 20,
  cgEffective: 7,
  orthoFolders: 4,
  acceptanceHealthy: 0.8,
  conversionHealthy: 0.3,
  appHealthy: 0.95,
  satisfactionHealthy: 0.9,
  orthoAcceptanceHealthy: 0.7,
  cancellationAttention: 0.21,
  ticketReference: 3488.25,
  theme: 'red',
  focusMode: true
};

async function initDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  await pool.query(`
    create table if not exists clinics (
      id serial primary key, name text unique not null, city text, state text, code text,
      active boolean not null default true, created_at timestamptz default now()
    );
    create table if not exists settings (
      id integer primary key default 1, data jsonb not null default '{}'::jsonb, updated_at timestamptz default now()
    );
    create table if not exists metrics (
      id bigserial primary key, clinic_id integer references clinics(id) on delete cascade,
      ref_date date not null default current_date,
      monthly_goal numeric, proportional_goal numeric, effective_value numeric,
      evaluations integer, effectivations integer, acceptance numeric, conversion numeric,
      ticket_avg numeric, cancellation numeric, app numeric, satisfaction numeric,
      no_first_appointment integer default 0, absentees integer default 0,
      evaluations_today integer default 0, effectivations_today integer default 0,
      notes text, unique(clinic_id, ref_date)
    );
    create table if not exists daily_plans (
      id bigserial primary key, plan_date date not null default current_date,
      clinic_id integer references clinics(id) on delete cascade,
      collaborator_count integer default 2, status text default 'Não iniciado',
      priority1 text, priority2 text, priority3 text, observation text,
      unique(plan_date, clinic_id)
    );
    create table if not exists assignments (
      id bigserial primary key, plan_id bigint references daily_plans(id) on delete cascade,
      collaborator text not null, responsibility text, tool text, system_path text,
      target text, deadline text default 'hoje', message text, completed boolean default false
    );
    create table if not exists daily_returns (
      id bigserial primary key, return_date date not null default current_date,
      clinic_id integer references clinics(id) on delete cascade,
      collaborator text, new_evaluations integer default 0, new_effectivations integer default 0,
      ortho_folders integer default 0, appointments integer default 0,
      completed_status text, pending text, status text, collection_message text, franchise_message text,
      created_at timestamptz default now()
    );
    create table if not exists central_return_screenshots (
      id bigserial primary key,
      capture_date date not null default current_date,
      clinic_id integer references clinics(id) on delete cascade,
      return_type integer not null check(return_type in (1,2)),
      file_name text, mime_type text not null default 'image/png',
      image_data bytea not null,
      message text,
      message_status text not null default 'pending',
      created_at timestamptz default now(),
      analyzed_at timestamptz
    );
    create index if not exists idx_central_returns_day on central_return_screenshots(capture_date,clinic_id,return_type,created_at);
    create table if not exists history (
      id bigserial primary key, event_date date not null default current_date,
      clinic_id integer references clinics(id) on delete set null,
      collaborator text, initial_indicator text, target text, direction text,
      response text, final_result text, completed_status text, next_pending text,
      created_at timestamptz default now()
    );
  `);
  for (const c of clinics) {
    await pool.query('insert into clinics(name,city,state,code) values($1,$2,$3,$4) on conflict(name) do nothing', c);
  }
  await pool.query('insert into settings(id,data) values(1,$1::jsonb) on conflict(id) do nothing', [JSON.stringify(defaults)]);
}

function auth(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');
  try{ req.user=jwt.verify(token,JWT_SECRET); next(); }catch{ res.status(401).json({error:'Sessão inválida'}); }
}

app.post('/api/login',(req,res)=>{
  if(req.body?.password!==ADMIN_PASSWORD) return res.status(401).json({error:'Senha inválida'});
  const token=jwt.sign({role:'admin'},JWT_SECRET,{expiresIn:'12h'});
  res.json({token});
});

app.get('/api/bootstrap',auth,async(req,res)=>{
  const [cs,st,mt,pl,rt]=await Promise.all([
    pool.query('select * from clinics where active=true order by name'),
    pool.query('select data from settings where id=1'),
    pool.query('select m.*,c.name clinic_name from metrics m join clinics c on c.id=m.clinic_id where ref_date=current_date order by c.name'),
    pool.query('select p.*,c.name clinic_name from daily_plans p join clinics c on c.id=p.clinic_id where plan_date=current_date order by p.id'),
    pool.query('select r.*,c.name clinic_name from daily_returns r join clinics c on c.id=r.clinic_id where return_date=current_date order by r.id desc')
  ]);
  res.json({clinics:cs.rows,settings:st.rows[0]?.data||defaults,metrics:mt.rows,plans:pl.rows,returns:rt.rows});
});

app.put('/api/settings',auth,async(req,res)=>{
  await pool.query('update settings set data=$1::jsonb,updated_at=now() where id=1',[JSON.stringify(req.body)]);
  res.json({ok:true});
});

app.put('/api/metrics/:clinicId',auth,async(req,res)=>{
  const b=req.body||{};
  const q=`insert into metrics(clinic_id,ref_date,monthly_goal,proportional_goal,effective_value,evaluations,effectivations,acceptance,conversion,ticket_avg,cancellation,app,satisfaction,no_first_appointment,absentees,evaluations_today,effectivations_today,notes)
  values($1,current_date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
  on conflict(clinic_id,ref_date) do update set monthly_goal=excluded.monthly_goal,proportional_goal=excluded.proportional_goal,effective_value=excluded.effective_value,evaluations=excluded.evaluations,effectivations=excluded.effectivations,acceptance=excluded.acceptance,conversion=excluded.conversion,ticket_avg=excluded.ticket_avg,cancellation=excluded.cancellation,app=excluded.app,satisfaction=excluded.satisfaction,no_first_appointment=excluded.no_first_appointment,absentees=excluded.absentees,evaluations_today=excluded.evaluations_today,effectivations_today=excluded.effectivations_today,notes=excluded.notes returning *`;
  const vals=[req.params.clinicId,b.monthly_goal,b.proportional_goal,b.effective_value,b.evaluations,b.effectivations,b.acceptance,b.conversion,b.ticket_avg,b.cancellation,b.app,b.satisfaction,b.no_first_appointment||0,b.absentees||0,b.evaluations_today||0,b.effectivations_today||0,b.notes||''];
  const out=await pool.query(q,vals); res.json(out.rows[0]);
});

app.post('/api/plans',auth,async(req,res)=>{
  const {clinic_id,collaborator_count=2,status='Não iniciado',priority1='',priority2='',priority3='',observation=''}=req.body;
  const out=await pool.query(`insert into daily_plans(plan_date,clinic_id,collaborator_count,status,priority1,priority2,priority3,observation)
    values(current_date,$1,$2,$3,$4,$5,$6,$7)
    on conflict(plan_date,clinic_id) do update set collaborator_count=excluded.collaborator_count,status=excluded.status,priority1=excluded.priority1,priority2=excluded.priority2,priority3=excluded.priority3,observation=excluded.observation returning *`,[clinic_id,collaborator_count,status,priority1,priority2,priority3,observation]);
  res.json(out.rows[0]);
});

app.post('/api/assignments',auth,async(req,res)=>{
  const b=req.body;
  const out=await pool.query(`insert into assignments(plan_id,collaborator,responsibility,tool,system_path,target,deadline,message) values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,[b.plan_id,b.collaborator,b.responsibility,b.tool,b.system_path,b.target,b.deadline||'hoje',b.message]);
  res.json(out.rows[0]);
});

app.get('/api/assignments/:planId',auth,async(req,res)=>{
  const out=await pool.query('select * from assignments where plan_id=$1 order by id',[req.params.planId]); res.json(out.rows);
});

app.post('/api/returns',auth,async(req,res)=>{
  const b=req.body;
  const out=await pool.query(`insert into daily_returns(return_date,clinic_id,collaborator,new_evaluations,new_effectivations,ortho_folders,appointments,completed_status,pending,status,collection_message,franchise_message)
    values(current_date,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,[b.clinic_id,b.collaborator||'',b.new_evaluations||0,b.new_effectivations||0,b.ortho_folders||0,b.appointments||0,b.completed_status||'',b.pending||'',b.status||'',b.collection_message||'',b.franchise_message||'']);
  await pool.query(`insert into history(event_date,clinic_id,collaborator,target,direction,response,final_result,completed_status,next_pending) values(current_date,$1,$2,$3,$4,$5,$6,$7,$8)`,[b.clinic_id,b.collaborator||'',b.target||'',b.direction||'',b.collection_message||'',b.franchise_message||'',b.completed_status||'',b.pending||'']);
  res.json(out.rows[0]);
});

app.get('/api/history',auth,async(req,res)=>{
  const out=await pool.query(`select h.*,c.name clinic_name from history h left join clinics c on c.id=h.clinic_id order by h.created_at desc limit 500`); res.json(out.rows);
});

app.get('/api/export',auth,async(req,res)=>{
  const out={};
  for(const t of ['clinics','settings','metrics','daily_plans','assignments','daily_returns','history']) out[t]=(await pool.query(`select * from ${t}`)).rows;
  res.json(out);
});


function centralAuth(req,res,next){
  const supplied=String(req.headers['x-central-password']||req.query.p||'');
  if(!supplied || supplied!==ADMIN_PASSWORD) return res.status(401).json({error:'Senha administrativa do servidor não confere'});
  next();
}
app.get('/central-returns/today',centralAuth,async(req,res)=>{
  const clinicId=Number(req.query.clinic_id),type=Number(req.query.return_type);
  const out=await pool.query("select id,clinic_id,return_type,file_name,mime_type,message,message_status,created_at,analyzed_at from central_return_screenshots where capture_date=current_date and clinic_id=$1 and return_type=$2 order by created_at,id",[clinicId,type]);
  res.json({screenshots:out.rows});
});
app.post('/central-returns/screenshots',centralAuth,async(req,res)=>{
  const b=req.body||{}; const m=String(b.data_url||'').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if(!m)return res.status(400).json({error:'Imagem inválida'});
  const buf=Buffer.from(m[2],'base64'); if(buf.length>8*1024*1024)return res.status(413).json({error:'Imagem acima de 8 MB'});
  const out=await pool.query("insert into central_return_screenshots(clinic_id,return_type,file_name,mime_type,image_data) values($1,$2,$3,$4,$5) returning id,created_at",[Number(b.clinic_id),Number(b.return_type),String(b.file_name||'print.png').slice(0,180),m[1],buf]);
  res.json(out.rows[0]);
});
app.get('/central-returns/image/:id',centralAuth,async(req,res)=>{
  const out=await pool.query("select mime_type,image_data from central_return_screenshots where id=$1",[req.params.id]);
  if(!out.rows[0])return res.sendStatus(404); res.type(out.rows[0].mime_type);res.set('Cache-Control','private, max-age=300');res.send(out.rows[0].image_data);
});
app.delete('/central-returns/screenshots/:id',centralAuth,async(req,res)=>{
  await pool.query("delete from central_return_screenshots where id=$1",[req.params.id]);res.json({ok:true});
});

app.get('/health',(req,res)=>res.json({ok:true,time:new Date().toISOString()}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

initDb().then(()=>app.listen(PORT,()=>console.log(`Gestão 12 Clínicas on :${PORT}`))).catch(err=>{console.error(err);process.exit(1)});
