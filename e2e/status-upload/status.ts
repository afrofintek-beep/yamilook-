export const useStatus=()=>({createStatus:async(_type:string,options:{caption?:string})=>options.caption==='Falhar'?null:{id:'synthetic-status'}});
