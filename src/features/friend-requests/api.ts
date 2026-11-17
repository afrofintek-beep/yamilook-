import { supabase } from '@/integrations/supabase/client';
export async function respondFriendRequest(requestId: string, accept: boolean) {
 const result=await supabase.rpc('respond_friend_request',{p_request_id:requestId,p_accept:accept});
 if(!result.error)window.dispatchEvent(new Event('friend-requests-changed'));
 return result;
}
