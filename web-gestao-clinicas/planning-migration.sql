create or replace function public.save_planning_messages(p_rows jsonb)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare r record; previous public.daily_clinic_guides%rowtype; saved_count integer:=0;
begin
 if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)>2000 then raise exception 'Invalid planning batch'; end if;
 for r in select * from jsonb_to_recordset(p_rows) as x(guide_date date,clinic_id integer,section text,recipient text,title text,message text,action_plan text)
 loop
  if r.section is distinct from 'planning_message' or r.clinic_id not between 1 and 12 or r.guide_date is null or nullif(r.recipient,'') is null or nullif(r.message,'') is null then raise exception 'Invalid planning message'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.clinic_id::text||r.guide_date::text||r.recipient,0));
  select * into previous from public.daily_clinic_guides where clinic_id=r.clinic_id and guide_date=r.guide_date and section='planning_message' and recipient=r.recipient for update;
  if found then
   if previous.manual_override is true then continue; end if;
   if previous.message=r.message and previous.action_plan=r.action_plan then continue; end if;
   insert into public.daily_clinic_guides(guide_date,clinic_id,section,recipient,title,message,action_plan)
   values(previous.guide_date,previous.clinic_id,'planning_history',previous.recipient,'Geração '||gen_random_uuid()::text,previous.message,to_jsonb(previous)::text);
   update public.daily_clinic_guides set message=r.message,action_plan=r.action_plan,title=r.title,updated_at=now() where id=previous.id;
  else
   insert into public.daily_clinic_guides(guide_date,clinic_id,section,recipient,title,message,action_plan,manual_override)
   values(r.guide_date,r.clinic_id,r.section,r.recipient,r.title,r.message,r.action_plan,false);
  end if;
  saved_count:=saved_count+1;
 end loop;
 return saved_count;
end; $$;
revoke all on function public.save_planning_messages(jsonb) from public;
grant execute on function public.save_planning_messages(jsonb) to anon,authenticated,service_role;
