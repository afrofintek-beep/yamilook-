import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEST_USERS = [
  {
    email: 'maria@yamilook.test',
    password: 'TestUser123!',
    display_name: 'Maria Silva',
    username: 'maria_silva',
    bio: 'Apaixonada por culinária angolana 🍲 | Mãe de 2 | Talatona',
    status_message: 'Disponível para ajudar!',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria&backgroundColor=ffdfbf&accessories=round&accessoriesColor=3c4f5c&clothesColor=5199e4&eyes=happy&eyebrows=defaultNatural&facialHair=blank&hairColor=2c1b18&mouth=smile&skinColor=f8d25c&top=shortHairShortFlat',
  },
  {
    email: 'joao@yamilook.test',
    password: 'TestUser123!',
    display_name: 'João Santos',
    username: 'joao_santos',
    bio: 'Engenheiro de software 💻 | Amante de futebol ⚽ | Patriota',
    status_message: 'A trabalhar...',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=joao&backgroundColor=b6e3f4&accessories=blank&clothesColor=3c4f5c&eyes=default&eyebrows=defaultNatural&facialHair=beardLight&hairColor=4a312c&mouth=default&skinColor=ae5d29&top=shortHairShortRound',
  },
  {
    email: 'ana@yamilook.test',
    password: 'TestUser123!',
    display_name: 'Ana Costa',
    username: 'ana_costa',
    bio: 'Professora de inglês 📚 | Viajante 🌍 | Miramar',
    status_message: 'Em aula até às 17h',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ana&backgroundColor=ffd5dc&accessories=prescription02&clothesColor=ff5c5c&eyes=wink&eyebrows=raisedExcitedNatural&facialHair=blank&hairColor=2c1b18&mouth=smile&skinColor=d08b5b&top=longHairStraight',
  },
  {
    email: 'pedro@yamilook.test',
    password: 'TestUser123!',
    display_name: 'Pedro Ferreira',
    username: 'pedro_ferreira',
    bio: 'Músico 🎸 | DJ nos fins de semana 🎧 | Maianga',
    status_message: 'Ensaiando...',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pedro&backgroundColor=c0aede&accessories=sunglasses&clothesColor=262e33&eyes=happy&eyebrows=default&facialHair=blank&hairColor=724133&mouth=twinkle&skinColor=614335&top=shortHairDreads01',
  },
];

const SAMPLE_POSTS = [
  {
    type: 'image',
    content: 'Bom dia vizinhos! Encontrei estas frutas frescas hoje no mercado 🍎🍊',
    location: 'Talatona',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Acabei de descobrir um café incrível aqui no bairro! Recomendo muito ☕',
    location: 'Patriota',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Novo restaurante abriu na esquina. A comida é espetacular! 🍽️',
    location: 'Dangeroux',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Feira de artesanato local este fim de semana! Venham todos 🎨',
    location: 'Talatona',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1528396518501-b53b655eb9b3?w=800&q=80'],
  },
  {
    type: 'text',
    content: 'Procurando recomendações de eletricista no bairro. Alguém conhece? ⚡',
    location: 'Patriota',
    privacy: 'everyone',
    media_urls: null,
  },
  {
    type: 'image',
    content: 'Que pôr do sol lindo hoje! Luanda é mesmo especial 🌅',
    location: 'Miramar',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Alguém quer jogar futebol no fim de semana? ⚽',
    location: 'Maianga',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Dica: a padaria da Rua Principal tem pão fresco às 7h! 🥖',
    location: 'Talatona',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Aprendi uma receita nova de muamba de galinha! Quem quer a receita? 🍗',
    location: 'Talatona',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Finalmente terminei o meu projeto! Hora de celebrar 🎉',
    location: 'Patriota',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&q=80'],
  },
  {
    type: 'text',
    content: 'Alguém mais está a ter problemas com a internet hoje? 📶',
    location: 'Miramar',
    privacy: 'everyone',
    media_urls: null,
  },
  {
    type: 'image',
    content: 'Show ao vivo no Bar Central esta noite! Venham todos 🎵',
    location: 'Maianga',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Vista incrível da cidade hoje de manhã! 🏙️',
    location: 'Talatona',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80'],
  },
  {
    type: 'image',
    content: 'Acabei de plantar o meu jardim! 🌱🌻',
    location: 'Patriota',
    privacy: 'everyone',
    media_urls: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80'],
  },
];

const SAMPLE_COMMENTS = [
  'Muito bom! 👏',
  'Concordo totalmente!',
  'Obrigado pela dica!',
  'Onde fica exatamente?',
  'Vou experimentar!',
  'Que maravilha! ❤️',
  'Também quero saber!',
  'Excelente ideia!',
  'Partilha mais detalhes por favor',
  'Adorei! 😍',
];

const SAMPLE_MESSAGES = [
  'Olá! Tudo bem?',
  'Viste o meu último post?',
  'Podemos encontrar-nos amanhã?',
  'Obrigado pela ajuda!',
  'Que tal o fim de semana?',
  'Tens planos para hoje?',
  'Adorei a tua publicação!',
  'Vamos combinar algo?',
  'Já viste as novidades?',
  'Está tudo bem contigo?',
  'A que horas te dá jeito?',
  'Perfeito, combinado então!',
  'Mandei-te um convite',
  'Obrigado! 🙏',
  'Até logo!',
];

const SAMPLE_STATUSES = [
  {
    type: 'text',
    content: 'Bom dia! ☀️',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    type: 'text',
    content: 'A vida é bela! 🌸',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    type: 'text',
    content: 'Trabalhando duro hoje 💪',
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    type: 'text',
    content: 'Fim de semana finalmente! 🎉',
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Check if we're in production environment - block access in production
    const denoEnv = Deno.env.get('DENO_ENV') || Deno.env.get('ENVIRONMENT') || 'development';
    if (denoEnv === 'production') {
      return new Response(
        JSON.stringify({ success: false, error: 'Dev tools are disabled in production' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user authentication - require a valid user session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's token to verify authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role before allowing seed operations
    const { data: hasAdminRole, error: roleError } = await supabaseUser
      .rpc('admin_area_allowed', { p_area: 'admin_test_data' });

    if (roleError || !hasAdminRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User is authenticated and has admin role - proceed with admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: Record<string, unknown> = {
      users: [],
      posts: 0,
      comments: 0,
      conversations: 0,
      messages: 0,
      statuses: 0,
      contacts: 0,
    };
    
    const createdUserIds: string[] = [];
    const userIdMap: Record<string, string> = {};

    // Create or get test users
    for (const user of TEST_USERS) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      if (existingUser) {
        createdUserIds.push(existingUser.id);
        userIdMap[user.email] = existingUser.id;
        
        // Update profile with additional info including avatar
        await supabaseAdmin
          .from('profiles')
          .update({
            bio: user.bio,
            status_message: user.status_message,
            avatar_url: user.avatar_url,
            is_online: Math.random() > 0.5,
          })
          .eq('id', existingUser.id);
        
        (results.users as { email: string; status: string }[]).push({
          email: user.email,
          status: 'exists',
        });
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            display_name: user.display_name,
            username: user.username,
          },
        });

        if (!error && data.user) {
          createdUserIds.push(data.user.id);
          userIdMap[user.email] = data.user.id;
          
          // Update profile with additional info including avatar
          await supabaseAdmin
            .from('profiles')
            .update({
              bio: user.bio,
              status_message: user.status_message,
              avatar_url: user.avatar_url,
              is_online: Math.random() > 0.5,
            })
            .eq('id', data.user.id);
          
          (results.users as { email: string; status: string }[]).push({
            email: user.email,
            status: 'created',
          });
        }
      }
    }

    if (createdUserIds.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not enough users to create test data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create contacts between all users
    for (let i = 0; i < createdUserIds.length; i++) {
      for (let j = 0; j < createdUserIds.length; j++) {
        if (i !== j) {
          const { error } = await supabaseAdmin
            .from('contacts')
            .upsert({
              user_id: createdUserIds[i],
              contact_user_id: createdUserIds[j],
              is_favorite: Math.random() > 0.7,
            }, { onConflict: 'user_id,contact_user_id' });
          
          if (!error) {
            results.contacts = (results.contacts as number) + 1;
          }
        }
      }
    }

    // Create posts
    const { count: existingPostsCount } = await supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .in('user_id', createdUserIds);

    if (!existingPostsCount || existingPostsCount < 5) {
      const postsToInsert = SAMPLE_POSTS.map((post, index) => ({
        ...post,
        user_id: createdUserIds[index % createdUserIds.length],
        is_pinned: Math.random() > 0.9,
        likes_count: Math.floor(Math.random() * 50),
        comments_count: 0,
        shares_count: Math.floor(Math.random() * 5),
      }));

      const { data: insertedPosts } = await supabaseAdmin
        .from('posts')
        .insert(postsToInsert)
        .select();

      if (insertedPosts) {
        results.posts = insertedPosts.length;

        // Add comments to posts
        for (const post of insertedPosts) {
          const numComments = Math.floor(Math.random() * 4);
          for (let c = 0; c < numComments; c++) {
            const commenterId = createdUserIds[Math.floor(Math.random() * createdUserIds.length)];
            const commentContent = SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
            
            const { error } = await supabaseAdmin
              .from('post_comments')
              .insert({
                post_id: post.id,
                user_id: commenterId,
                content: commentContent,
              });
            
            if (!error) {
              results.comments = (results.comments as number) + 1;
            }
          }
        }

        // Add likes to posts
        for (const post of insertedPosts) {
          const numLikes = Math.floor(Math.random() * 3);
          const likers = [...createdUserIds].sort(() => Math.random() - 0.5).slice(0, numLikes);
          
          for (const liker of likers) {
            await supabaseAdmin
              .from('post_likes')
              .upsert({
                post_id: post.id,
                user_id: liker,
                reaction_type: 'like',
              }, { onConflict: 'post_id,user_id' });
          }
        }
      }
    }

    // Create conversations and messages
    const { count: existingConvsCount } = await supabaseAdmin
      .from('conversation_participants')
      .select('*', { count: 'exact', head: true })
      .in('user_id', createdUserIds);

    if (!existingConvsCount || existingConvsCount < 2) {
      // Create 1-on-1 conversations between pairs
      const conversationPairs = [
        [0, 1], // Maria & João
        [0, 2], // Maria & Ana
        [1, 3], // João & Pedro
        [2, 3], // Ana & Pedro
      ];

      for (const [idx1, idx2] of conversationPairs) {
        const user1 = createdUserIds[idx1];
        const user2 = createdUserIds[idx2];

        // Create conversation
        const { data: conv, error: convError } = await supabaseAdmin
          .from('conversations')
          .insert({
            type: 'direct',
            created_by: user1,
          })
          .select()
          .single();

        if (!convError && conv) {
          results.conversations = (results.conversations as number) + 1;

          // Add participants
          await supabaseAdmin
            .from('conversation_participants')
            .insert([
              { conversation_id: conv.id, user_id: user1 },
              { conversation_id: conv.id, user_id: user2 },
            ]);

          // Add messages
          const numMessages = 5 + Math.floor(Math.random() * 10);
          const messagesData = [];
          
          for (let m = 0; m < numMessages; m++) {
            const senderId = Math.random() > 0.5 ? user1 : user2;
            const content = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)];
            const createdAt = new Date(Date.now() - (numMessages - m) * 60000 * Math.floor(Math.random() * 30 + 1));
            
            messagesData.push({
              conversation_id: conv.id,
              sender_id: senderId,
              content: content,
              message_type: 'text',
              created_at: createdAt.toISOString(),
            });
          }

          const { data: insertedMessages } = await supabaseAdmin
            .from('messages')
            .insert(messagesData)
            .select();

          if (insertedMessages) {
            results.messages = (results.messages as number) + insertedMessages.length;
          }
        }
      }

      // Create a group conversation
      const { data: groupConv } = await supabaseAdmin
        .from('conversations')
        .insert({
          type: 'group',
          name: 'Vizinhos de Talatona 🏘️',
          created_by: createdUserIds[0],
        })
        .select()
        .single();

      if (groupConv) {
        results.conversations = (results.conversations as number) + 1;

        // Add all users to group
        await supabaseAdmin
          .from('conversation_participants')
          .insert(createdUserIds.map(userId => ({
            conversation_id: groupConv.id,
            user_id: userId,
          })));

        // Add group messages
        const groupMessages = [
          'Bem-vindos ao grupo! 👋',
          'Olá a todos!',
          'Que bom ter este grupo!',
          'Vamos organizar algo para o fim de semana?',
          'Boa ideia! Estou dentro!',
          'Eu também!',
          'Que tal um churrasco?',
          'Perfeito! 🍖',
        ];

        const groupMessagesData = groupMessages.map((content, idx) => ({
          conversation_id: groupConv.id,
          sender_id: createdUserIds[idx % createdUserIds.length],
          content: content,
          message_type: 'text',
          created_at: new Date(Date.now() - (groupMessages.length - idx) * 60000 * 5).toISOString(),
        }));

        const { data: insertedGroupMessages } = await supabaseAdmin
          .from('messages')
          .insert(groupMessagesData)
          .select();

        if (insertedGroupMessages) {
          results.messages = (results.messages as number) + insertedGroupMessages.length;
        }
      }
    }

    // Create statuses
    const { count: existingStatusCount } = await supabaseAdmin
      .from('statuses')
      .select('*', { count: 'exact', head: true })
      .in('user_id', createdUserIds)
      .eq('is_archived', false);

    if (!existingStatusCount || existingStatusCount < 2) {
      const statusesToInsert = SAMPLE_STATUSES.map((status, index) => ({
        ...status,
        user_id: createdUserIds[index % createdUserIds.length],
        privacy: 'everyone',
        is_archived: false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      }));

      const { data: insertedStatuses } = await supabaseAdmin
        .from('statuses')
        .insert(statusesToInsert)
        .select();

      if (insertedStatuses) {
        results.statuses = insertedStatuses.length;

        // Add views to statuses
        for (const status of insertedStatuses) {
          const viewers = createdUserIds.filter(id => id !== status.user_id);
          const numViewers = Math.floor(Math.random() * viewers.length);
          
          for (let v = 0; v < numViewers; v++) {
            await supabaseAdmin
              .from('status_views')
              .upsert({
                status_id: status.id,
                viewer_id: viewers[v],
              }, { onConflict: 'status_id,viewer_id' });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: 'Test data seeded successfully!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Seed error:', error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
