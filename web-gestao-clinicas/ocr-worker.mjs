import http from "node:http";
import { createWorker } from "tesseract.js";

const port=Number(process.env.PORT||10000);
const base=(process.env.SUPABASE_URL||"")+"/rest/v1/central_return_screenshots";
const headers={apikey:process.env.SUPABASE_PUBLISHABLE_KEY||"","x-central-key":process.env.CENTRAL_ACCESS_KEY||"","content-type":"application/json"};
let state={running:false,done:0,total:0,lastId:null,error:null,finished:false};

async function listRows(){
  const url=base+"?select=id,clinic_id,file_name,image_data,ocr_text&capture_date=eq.2026-09-20&return_type=eq.2&order=clinic_id.asc,id.asc";
  const r=await fetch(url,{headers});if(!r.ok)throw new Error("list "+r.status+" "+await r.text());return r.json();
}
async function saveText(id,text){
  const r=await fetch(base+"?id=eq."+id,{method:"PATCH",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({ocr_text:text})});
  if(!r.ok)throw new Error("update "+id+" "+r.status+" "+await r.text());
}
async function run(){
  if(state.running||state.finished)return;
  state.running=true;
  let worker;
  try{
    const rows=await listRows();state.total=rows.length;
    worker=await createWorker("por");
    for(const row of rows){
      if(row.ocr_text&&row.ocr_text.trim().length>30){state.done++;continue}
      state.lastId=row.id;
      const r=await worker.recognize(row.image_data);
      await saveText(row.id,r.data?.text||"");
      state.done++;
      console.log("OCR",row.id,row.clinic_id,state.done+"/"+state.total);
    }
    state.finished=true;
  }catch(e){state.error=String(e?.stack||e);console.error(state.error)}
  finally{state.running=false;if(worker)try{await worker.terminate()}catch{}}
}
http.createServer((req,res)=>{
  res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
  res.end(JSON.stringify(state));
}).listen(port,"0.0.0.0",()=>{console.log("ocr worker ready");setTimeout(run,500)});
