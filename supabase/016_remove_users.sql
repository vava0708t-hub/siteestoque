begin;
-- Remoção de usuários pelo administrador.
-- Usuários sem histórico são excluídos de vez pela API (conta + perfil).
-- Usuários com listas ou pedidos no histórico são arquivados: perdem o acesso,
-- liberam o login e somem da tela de equipe, mas o histórico continua com o nome deles.
alter table public.profiles add column if not exists removed_at timestamptz;
create or replace function public.admin_set_access(target_id uuid,new_role text,new_active boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.has_role(array['admin']) then raise exception 'Acesso não autorizado.'; end if;
 if target_id = auth.uid() then raise exception 'Não é permitido alterar seu próprio acesso.'; end if;
 if new_role is null or new_role not in ('admin','estoquista','repositor','vendedor') or new_active is null then raise exception 'Perfil inválido.'; end if;
 update public.profiles set role=new_role,active=new_active where id=target_id and removed_at is null;
 if not found then raise exception 'Usuário não encontrado.'; end if;
end; $$;
commit;
