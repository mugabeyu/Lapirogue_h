-- Fix log_audit_event trigger to handle profiles table with auth_id primary key
-- The profiles table uses auth_id instead of id, causing the audit trigger to fail

create or replace function log_audit_event()
returns trigger as $$
declare
  actor_id uuid;
  row_id uuid;
begin
  actor_id := coalesce(auth.uid(), new.updated_by, new.created_by, old.updated_by, old.created_by);
  if tg_table_name = 'profiles' then
    row_id := coalesce(new.auth_id, old.auth_id);
  else
    row_id := coalesce(new.id, old.id);
  end if;
  if tg_op = 'DELETE' then
    insert into audit_logs(table_name, record_id, action, actor_id, previous_data, new_data)
    values (tg_table_name, row_id, tg_op, actor_id, to_jsonb(old), null);
    return old;
  end if;
  insert into audit_logs(table_name, record_id, action, actor_id, previous_data, new_data)
  values (tg_table_name, row_id, tg_op, actor_id, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end;
$$ language plpgsql;