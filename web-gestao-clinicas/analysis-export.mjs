import http from "node:http";

const port=Number(process.env.PORT||10000);
const expected=process.env.ANALYSIS_TOKEN||"";
const supabaseUrl=process.env.SUPABASE_URL||"";
const publishable=process.env.SUPABASE_PUBLISHABLE_KEY||"";
const centralKey=process.env.CENTRAL_ACCESS_KEY||"";

function json(res,status,body){
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
  res.end(JSON.stringify(body));
}
function decodeDataUri(s=""){
  const m=/^data:([^;]+);base64,(.+)$/.exec(s);
  if(!m) return null;
  return {mime:m[1],buf:Buffer.from(m[2],"base64")};
}
async function queryRows(select){
  const url=supabaseUrl+"/rest/v1/central_return_screenshots?select="+encodeURIComponent(select)+"&capture_date=eq.2026-09-20&return_type=eq.2&order=clinic_id.asc,id.asc";
  const r=await fetch(url,{headers:{apikey:publishable,"x-central-key":centralKey}});
  if(!r.ok) throw new Error("Supabase "+r.status+" "+await r.text());
  return await r.json();
}
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||"/","http://localhost");
    if(u.searchParams.get("token")!==expected) return json(res,403,{error:"forbidden"});
    if(u.pathname==="/health") return json(res,200,{ok:true});
    if(u.pathname==="/bundle"){
      const rows=await queryRows("id,clinic_id,file_name,mime_type,image_data");
      return json(res,200,rows);
    }
    if(u.pathname.startsWith("/image/")){
      const id=Number(u.pathname.split("/").pop());
      const url=supabaseUrl+"/rest/v1/central_return_screenshots?select=id,mime_type,image_data&id=eq."+id+"&capture_date=eq.2026-09-20&limit=1";
      const r=await fetch(url,{headers:{apikey:publishable,"x-central-key":centralKey}});
      if(!r.ok) throw new Error("Supabase "+r.status+" "+await r.text());
      const rows=await r.json(); const row=rows[0]; if(!row) return json(res,404,{error:"not found"});
      const d=decodeDataUri(row.image_data); if(!d) return json(res,500,{error:"invalid image"});
      res.writeHead(200,{"content-type":row.mime_type||d.mime,"cache-control":"no-store"});return res.end(d.buf);
    }
    json(res,404,{error:"not found"});
  }catch(e){json(res,500,{error:String(e?.message||e)})}
});
server.listen(port,"0.0.0.0",()=>console.log("analysis export ready"));
