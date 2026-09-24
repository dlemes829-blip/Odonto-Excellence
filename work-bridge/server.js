const http=require('http');
const {URL}=require('url');
const PORT=process.env.PORT||10000;
const SUPA='https://ruzixytmhkduqxoslebu.supabase.co/rest/v1/rpc/';
const APIKEY=process.env.SUPABASE_ANON_KEY;
const ROOM_KEY=process.env.ROOM_KEY;
const BRIDGE_TOKEN=process.env.BRIDGE_TOKEN;
const SLUG='daniel-chatgpt-work';

async function rpc(fn,payload){
  const r=await fetch(SUPA+fn,{method:'POST',headers:{apikey:APIKEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const txt=await r.text();
  if(!r.ok)throw new Error(txt||('Supabase '+r.status));
  try{return JSON.parse(txt)}catch{return txt}
}
function json(res,status,data){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});
  res.end(JSON.stringify(data));
}
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/health')return json(res,200,{ok:true,service:'odonto-work-bridge'});
    if(u.searchParams.get('token')!==BRIDGE_TOKEN)return json(res,401,{ok:false,error:'unauthorized'});
    if(u.pathname==='/messages'){
      const after=Number(u.searchParams.get('after')||0);
      const rows=await rpc('collab_get_messages',{p_slug:SLUG,p_key:ROOM_KEY,p_after:Number.isFinite(after)?after:0});
      return json(res,200,{ok:true,messages:rows});
    }
    if(u.pathname==='/presence'){
      const rows=await rpc('collab_get_presence',{p_slug:SLUG,p_key:ROOM_KEY});
      return json(res,200,{ok:true,presence:rows});
    }
    if(u.pathname==='/post'){
      const author=u.searchParams.get('author')||'ChatGPT';
      const kind=u.searchParams.get('kind')||'message';
      const body=(u.searchParams.get('body')||'').trim();
      if(!body)return json(res,400,{ok:false,error:'empty body'});
      const id=await rpc('collab_post_message',{p_slug:SLUG,p_key:ROOM_KEY,p_author:author,p_body:body,p_kind:kind});
      return json(res,200,{ok:true,id});
    }
    if(u.pathname==='/ping'){
      const author=u.searchParams.get('author')||'ChatGPT';
      const ok=await rpc('collab_ping',{p_slug:SLUG,p_key:ROOM_KEY,p_author:author});
      return json(res,200,{ok:true,result:ok});
    }
    return json(res,404,{ok:false,error:'not found'});
  }catch(e){return json(res,500,{ok:false,error:String(e.message||e)})}
});
server.listen(PORT,()=>console.log('bridge listening',PORT));