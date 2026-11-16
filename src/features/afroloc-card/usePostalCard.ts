import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {readPostalCard,type PostalCard} from './postal';
const endpoint='https://ljcxqwjvjgobhisqkujr.supabase.co/functions/v1/afroloc-postal-card';
export function usePostalCard(source:string|undefined,code:string|undefined,revision:number){
 const key=JSON.stringify([source,code,revision]);
 const [state,setState]=useState<{key:string;value:PostalCard|null;error:boolean}|null>(null);
 useEffect(()=>{
  if(!source||!code)return;
  let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  void(async()=>{try{
   const {data,error}=await supabase.auth.getSession();
   if(error||!data.session?.access_token)throw new Error('session');
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({source,code}),signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw new Error('postal');
   const value=readPostalCard(await response.json());if(!value)throw new Error('format');
   if(active)setState({key,value,error:false});
  }catch{if(active)setState({key,value:null,error:true})}finally{clearTimeout(timeout)}})();
  return()=>{active=false;clearTimeout(timeout);controller.abort()};
 },[source,code,key]);
 return state?.key===key?{value:state.value,error:state.error,busy:false}:{value:null,error:false,busy:!!source};
}
