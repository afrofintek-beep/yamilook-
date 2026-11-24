export type AccessPoint={lat:number;lon:number};
export type AccessVisitResult={
 status:'ready'|'proximity'|'denied';point?:AccessPoint;area?:AccessPoint;expiresAt?:string;radius?:number;
 offlineContinuation?:unknown;owner?:boolean;hasExternalRoute?:boolean;
};
export type VisitLease={point:AccessPoint;precision:'exact'|'area';expiresAt:number;offlineContinuation:'permitted'|'forbidden'};

/** Only the issuer can allow offline use. Older approximate responses remain online-only. */
export function readVisitLease(result:AccessVisitResult,now=Date.now()):VisitLease|null{
 const point=result?.status==='ready'?result.point:result?.status==='proximity'?result.area:null;
 if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)return null;
 const serverExpiry=typeof result.expiresAt==='string';
 if(result.offlineContinuation==='permitted'&&!serverExpiry)return null;
 const expiry=result.status==='proximity'&&!serverExpiry?now+15000:Date.parse(result.expiresAt||'');
 if(!Number.isFinite(expiry)||expiry<=now||expiry>now+25000)return null;
 return {point:{lat:point.lat,lon:point.lon},precision:result.status==='ready'?'exact':'area',expiresAt:expiry,
  offlineContinuation:serverExpiry&&result.offlineContinuation==='permitted'?'permitted':'forbidden'};
}

/** Elapsed request time counts against the existing 20-second bound, even if the clock moves. */
export function visitDeadline(lease:VisitLease,requestStartedAt:number,requestStartedWall:number,previous?:{expiresAt:number;deadline:number}):number{
 return Math.min(requestStartedAt+20000,requestStartedAt+lease.expiresAt-requestStartedWall,performance.now()+lease.expiresAt-Date.now(),
  previous?.expiresAt===lease.expiresAt?previous.deadline:Infinity);
}
