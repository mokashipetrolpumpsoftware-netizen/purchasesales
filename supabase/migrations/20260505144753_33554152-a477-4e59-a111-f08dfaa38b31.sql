
revoke execute on function public.current_shop_id() from anon, authenticated;
revoke execute on function public.has_role(uuid, uuid, public.app_role) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
