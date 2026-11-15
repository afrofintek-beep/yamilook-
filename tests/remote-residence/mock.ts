const initial={id:'remote-test',display_name:'Morador de teste',username:'morador',avatar_url:null,phone_number:null,email:null,country_code:'AO',city:'Luanda',neighborhood:'Ingombota',afroloc_code:null,afroloc_certification_status:'none'};
const profile=()=>JSON.parse(sessionStorage.getItem('remote-profile')||JSON.stringify(initial));
const admin={province:'AO-LDA',municipality:'AO-LDA-INGOMBOTA',commune:'',complement:'Casa 12'};
export const useAuth=()=>({user:{id:'remote-test'},profile:profile(),refreshProfile:async()=>{}});
export const useAfrolocCertification=()=>({isCertified:false});
export const supabase={
 rpc:async(name:string,args:any)=>{
  if(name==='my_residence_administrative')return {data:admin,error:null};
  if(name==='submit_residence_administrative'){
   sessionStorage.setItem('remote-payload',JSON.stringify(args));
   const code='AO-LDA-ING-000-DIG-G10-35Q1-N23WC';
   sessionStorage.setItem('remote-profile',JSON.stringify({...profile(),afroloc_code:code,afroloc_certification_status:'pending'}));
   return {data:{address_code:code,status:'pending'},error:null};
  }
  throw new Error('Unexpected RPC '+name);
 },
 from:()=>({select:()=>({eq:()=>({single:async()=>({data:profile(),error:null})})})}),
 functions:{invoke:async()=>({data:{addresses:[]},error:null})},
};
