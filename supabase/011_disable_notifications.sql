-- Opcional: execute apenas se a migração 010 já tiver sido aplicada.
-- Interrompe geração de avisos, preservando listas e eventos já gravados.
begin;
drop trigger if exists notify_restock_list on public.restock_lists;
drop function if exists public.notify_restock_list();
commit;
