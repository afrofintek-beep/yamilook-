import { test,expect,devices,type Page } from '@playwright/test';
const uuid=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const teacherId=uuid(1),learnerId=uuid(2),peerId=uuid(3),cohortId=uuid(10),workId=uuid(20);
const community={slug:'criacao-digital',title:'Criação digital e comunicação',description:'Fotografia, vídeo e design.',position:1,starter_title:'Criar uma apresentação digital',starter_instructions:'Apresenta um cartaz para um negócio.',starter_skill:'Comunicação digital'};
const profile=(id:string)=>({id,display_name:id===teacherId?'Maria':id===learnerId?'António':'Paula',username:'pessoa'+id.slice(-2),onboarding_completed:true,app_tour_completed:true,avatar_url:null});
test('mentor opens a cohort, learner opts into a public proof, a peer joins from it and withdrawal hides it',async({browser})=>{
 test.setTimeout(120000);
 type Row=Record<string,any>;
 let cohort:Row|null=null,work:Row|null=null,workOwner:string|null=null,workTask:string|null=null;
 const goals:Row[]=[],tasks:Row[]=[],submissions:Row[]=[],members:Row[]=[];
 async function setup(page:Page,user:string|null){
  await page.route('**/127.0.0.1:54321/**',async route=>{
   const url=new URL(route.request().url()),name=url.pathname.split('/').pop();let data:unknown=[];
   const ownGoals=goals.filter(g=>g.learner_id===user||g.mentor_id===user);
   if(name==='user')data=user?{id:user,email:'test@example.invalid'}:null;
   if(name==='profiles')data=user?profile(user):null;
   if(name==='get_public_profiles_by_ids')data=[teacherId,learnerId,peerId].map(profile);
   if(name==='mentor_profiles')data=url.searchParams.has('user_id')?(user===teacherId?{user_id:teacherId}:null):[{user_id:teacherId,specialty:'Design',is_verified_mentor:true}];
   if(name==='academia_communities')data=[community];
   if(name==='academia_cohorts')data=url.searchParams.has('id')?cohort:cohort?[cohort]:[];
   if(name==='academia_goals')data=url.searchParams.has('id')?ownGoals.find(g=>'eq.'+g.id===url.searchParams.get('id'))||null:ownGoals;
   if(name==='academia_challenges')data=tasks.filter(c=>ownGoals.some(g=>g.id===c.goal_id));
   if(name==='academia_submissions')data=submissions.filter(s=>tasks.some(c=>c.id===s.challenge_id&&ownGoals.some(g=>g.id===c.goal_id))).slice().reverse();
   if(name==='academia_learning_progress')data=ownGoals.map(g=>({goal_id:g.id,total:tasks.filter(c=>c.goal_id===g.id).length,approved:tasks.filter(c=>c.goal_id===g.id&&c.status==='approved').length}));
   if(name==='academia_cohort_members'){
    const rows=members.filter(m=>user===teacherId||m.learner_id===user);
    data=url.searchParams.has('goal_id')?rows.find(m=>'eq.'+m.goal_id===url.searchParams.get('goal_id'))||null:rows;
   }
   if(name==='academia_work_sources')data=work&&workOwner===user?{work_id:workId,challenge_id:workTask,owner_id:workOwner}:null;
   if(name==='academia_public_works'){
    const row=work&&(work.published||(workOwner===user&&!url.searchParams.has('published')))?work:null;
    data=url.searchParams.has('id')?row:row?[row]:[];
   }
   if(name==='academia-learning'){
    const input=route.request().postDataJSON(),p=input.payload||{},now=new Date().toISOString();let id=cohortId;
    if(input.action==='cohort_create')cohort={...p,id:cohortId,mentor_id:teacherId,mentor_name:'Maria',seats_taken:0,status:'open',created_at:now};
    if(input.action==='cohort_join'){
     let member=members.find(m=>m.learner_id===user);
     if(!member){
      const goalId=uuid(100+goals.length),taskId=uuid(200+tasks.length);
      goals.push({id:goalId,learner_id:user,mentor_id:teacherId,title:cohort!.title,context:'Turma de desafios',plan:cohort!.plan,closure_reason:'',status:'active',created_at:now,updated_at:now});
      tasks.push({id:taskId,goal_id:goalId,position:1,title:cohort!.challenge_title,instructions:cohort!.instructions,skill:cohort!.skill,status:'open',created_at:now});
      member={id:uuid(300+members.length),cohort_id:cohortId,learner_id:user,goal_id:goalId,source_work_id:p.source_work_id||null,created_at:now};members.push(member);cohort!.seats_taken++;
     }id=member.goal_id;
    }
    if(input.action==='submit'){const task=tasks.find(c=>c.id===p.challenge_id)!;id=uuid(400+submissions.length);submissions.push({id,challenge_id:task.id,content:p.content,evidence_url:p.evidence_url||null,status:'pending',feedback:'',created_at:now,reviewed_at:null});task.status='submitted';}
    if(input.action==='review'){const s=submissions.find(s=>s.id===p.submission_id)!;s.status=p.decision;s.feedback=p.feedback;s.reviewed_at=now;tasks.find(c=>c.id===s.challenge_id)!.status=p.decision;id=s.id;}
    if(input.action==='work_publish'){
     const task=tasks.find(c=>c.id===input.targetId)!;workOwner=user;workTask=task.id;
     work={id:workId,community_slug:community.slug,cohort_id:cohortId,title:task.title,skill:task.skill,caption:p.caption,learner_name:'António',mentor_name:'Maria',evidence_url:null,published:true,created_at:now};id=workId;
    }
    if(input.action==='work_hide'){work!.published=false;id=workId;}
    data={id};
   }
   await route.fulfill({json:data});
  });
  if(user)await page.addInitScript(userId=>{
   const session=JSON.stringify({access_token:btoa('{}')+'.'+btoa(JSON.stringify({sub:userId,exp:Math.floor(Date.now()/1000)+3600}))+'.signature',refresh_token:'test-only',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:userId,email:'test@example.invalid'}});
   localStorage.setItem('undefined',session);localStorage.setItem('sb-127-auth-token',session);
  },user);
 }
 const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext({...devices['iPhone 13'],baseURL:'http://localhost:8092',serviceWorkers:'block'})));
 try{
  const [teacher,student,guest,peer]=await Promise.all(contexts.map(c=>c.newPage()));
  await setup(teacher,teacherId);await setup(student,learnerId);await setup(guest,null);await setup(peer,peerId);
  await teacher.goto('/academia/comunidades/criacao-digital');
  await teacher.getByRole('button',{name:'Abrir turma como mentor'}).click();
  await teacher.getByRole('button',{name:'Usar exemplo desta comunidade'}).click();
  await teacher.getByLabel('Material, ferramentas e condições necessárias').fill('Telemóvel e papel.');
  await teacher.getByRole('button',{name:'Publicar turma gratuita'}).click();
  await expect(teacher.getByRole('heading',{name:'Acompanhamento da turma'})).toBeVisible();
  await student.goto(`/academia/comunidades/criacao-digital/turmas/${cohortId}`);
  await student.getByRole('button',{name:'Participar gratuitamente'}).click();
  await expect(student.getByRole('heading',{name:community.starter_title,exact:true})).toHaveCount(2);
  await student.getByLabel('Descreve o trabalho que realizaste').fill('PRIVATE_LEARNER_DELIVERY');
  await student.getByRole('button',{name:'Entregar trabalho'}).click();
  await expect(student.getByText('Em avaliação',{exact:true})).toBeVisible();
  await teacher.reload();
  await teacher.getByRole('link',{name:/António/}).click();
  await teacher.getByLabel('Feedback para o aluno').fill('PRIVATE_MENTOR_FEEDBACK');
  await teacher.getByRole('button',{name:'Validar trabalho'}).click();
  await expect(teacher.getByRole('button',{name:'Concluir percurso validado'})).toBeEnabled();
  await student.getByRole('button',{name:'Atualizar',exact:true}).click();
  await student.getByRole('button',{name:'Partilhar este trabalho'}).click();
  await expect(student.getByRole('button',{name:'Publicar apresentação'})).toBeDisabled();
  await student.getByLabel('O que queres mostrar sobre o teu trabalho?').fill('Aprendi a apresentar um serviço.');
  await expect(student.getByRole('button',{name:'Publicar apresentação'})).toBeDisabled();
  await student.getByRole('checkbox',{name:/Quero tornar públicos/}).check();
  await student.getByRole('button',{name:'Publicar apresentação'}).click();
  await expect(student.getByRole('link',{name:'Ver a apresentação pública'})).toHaveAttribute('href',`https://www.yamilook.com/academia/trabalhos/${workId}`);
  await guest.goto(`/academia/trabalhos/${workId}`);
  await expect(guest.getByText('Aprendi a apresentar um serviço.')).toBeVisible();
  await expect(guest.getByText('PRIVATE_MENTOR_FEEDBACK')).toHaveCount(0);await expect(guest.getByText('PRIVATE_LEARNER_DELIVERY')).toHaveCount(0);
  for(const size of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]){
   await guest.setViewportSize(size);await expect.poll(()=>guest.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await guest.setViewportSize({width:390,height:844});await guest.locator('main').evaluate(el=>el.scrollTop=0);
  await guest.screenshot({path:test.info().outputPath('academia-public-work-mobile.png'),fullPage:true});
  await guest.getByRole('link',{name:'Quero aprender também'}).click();
  const href=await guest.getByRole('link',{name:'Entrar para participar gratuitamente'}).getAttribute('href');expect(decodeURIComponent(href!)).toContain(`?origem=${workId}`);
  await peer.goto(`/academia/comunidades/criacao-digital/turmas/${cohortId}?origem=${workId}`);
  await peer.getByRole('button',{name:'Participar gratuitamente'}).click();
  await expect(peer.getByRole('heading',{name:community.starter_title,exact:true})).toHaveCount(2);
  await teacher.goto(`/academia/comunidades/criacao-digital/turmas/${cohortId}`);
  await expect(teacher.getByText(/1 entradas por partilha/)).toBeVisible();await expect(teacher.getByRole('link',{name:/Paula/})).toBeVisible();
  await student.getByRole('button',{name:'Retirar da apresentação pública'}).click();
  await expect(student.getByRole('link',{name:'Ver a apresentação pública'})).toHaveCount(0);
  await guest.goto(`/academia/trabalhos/${workId}`);
  await expect(guest.getByText('Esta apresentação não está disponível publicamente.')).toBeVisible();
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});
