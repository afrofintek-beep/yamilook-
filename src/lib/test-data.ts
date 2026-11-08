import { uiText } from '@/i18n/ui-copy';
// Test data and mock data for development/testing ONLY
// This module is excluded from production builds via the DEV guard below.

import { supabase } from '@/integrations/supabase/client';

// Credentials are only available in development mode
const DEV_ONLY = import.meta.env.DEV;

// Test user credentials — stripped from production bundle
export const TEST_USERS = DEV_ONLY
  ? {
      admin: {
        email: 'admin@yamilook.test',
        password: 'TestAdmin123!',
        displayName: 'Admin Teste',
        username: 'admin_teste',
        bio: 'Conta de administrador para testes',
        bairro: 'Talatona'
      },
      user1: {
        email: 'maria@yamilook.test',
        password: 'TestUser123!',
        displayName: 'Maria Silva',
        username: 'maria_silva',
        bio: 'Moradora do Patriota há 5 anos',
        bairro: 'Patriota'
      },
      user2: {
        email: 'joao@yamilook.test',
        password: 'TestUser123!',
        displayName: 'João Santos',
        username: 'joao_santos',
        bio: 'Empreendedor local',
        bairro: 'Dangeroux'
      },
      business: {
        email: 'negocio@yamilook.test',
        password: 'TestBusiness123!',
        displayName: 'Café do Bairro',
        username: 'cafe_bairro',
        bio: 'O melhor café de Talatona',
        bairro: 'Talatona',
        isBusiness: true
      }
    }
  : ({} as Record<string, { email: string; password: string; displayName: string; username: string; bio: string; bairro: string; isBusiness?: boolean }>);

// Sample posts for seeding
export const MOCK_POSTS = [
  {
    type: 'text' as const,
    content: 'Bom dia vizinhos! Alguém sabe onde posso encontrar frutas frescas hoje?',
    location: 'Talatona',
    privacy: 'everyone' as const
  },
  {
    type: 'photo' as const,
    content: 'Vista incrível do pôr do sol ontem! 🌅',
    location: 'Patriota',
    privacy: 'everyone' as const,
    media_urls: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800']
  },
  {
    type: 'text' as const,
    content: 'Novo restaurante abriu na esquina. Alguém já experimentou?',
    location: 'Dangeroux',
    privacy: 'everyone' as const
  },
  {
    type: 'photo' as const,
    content: 'Feira de artesanato local este fim de semana!',
    location: 'Talatona',
    privacy: 'everyone' as const,
    media_urls: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800']
  },
  {
    type: 'text' as const,
    content: 'Procurando recomendações de eletricista no bairro. Alguém conhece?',
    location: 'Patriota',
    privacy: 'everyone' as const
  }
];

// Bairros de Luanda
export const BAIRROS = [
  { name: 'Talatona', get description() { return uiText("Zona moderna e comercial"); } },
  { name: 'Patriota', get description() { return uiText("Bairro residencial tradicional"); } },
  { name: 'Dangeroux', get description() { return uiText("Área vibrante e cultural"); } },
  { name: 'Miramar', get description() { return uiText("Zona costeira"); } },
  { name: 'Maianga', get description() { return uiText("Centro histórico"); } }
];

// Create test user
export async function createTestUser(userKey: string) {
  if (!DEV_ONLY) {
    console.warn('Test functions are only available in development mode');
    return null;
  }
  const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
  if (!user) return null;

  const { data, error } = await supabase.auth.signUp({
    email: user.email,
    password: user.password,
    options: {
      data: {
        display_name: user.displayName,
        username: user.username
      }
    }
  });

  if (error) {
    console.error(`Error creating test user ${userKey}:`, error);
    return null;
  }

  return data;
}

// Login as test user
export async function loginAsTestUser(userKey: string) {
  if (!DEV_ONLY) {
    console.warn('Test functions are only available in development mode');
    return null;
  }
  const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
  if (!user) return null;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password
  });

  if (error) {
    console.error(`Error logging in as ${userKey}:`, error);
    return null;
  }

  return data;
}

// Seed mock posts for a user
export async function seedMockPosts(userId: string) {
  if (!DEV_ONLY) return null;

  const postsToInsert = MOCK_POSTS.map(post => ({
    ...post,
    user_id: userId,
    is_pinned: false,
    likes_count: Math.floor(Math.random() * 50),
    comments_count: Math.floor(Math.random() * 10),
    shares_count: Math.floor(Math.random() * 5)
  }));

  const { data, error } = await supabase
    .from('posts')
    .insert(postsToInsert)
    .select();

  if (error) {
    console.error('Error seeding posts:', error);
    return null;
  }

  return data;
}

// Seed all test data
export async function seedTestData() {
  if (!DEV_ONLY) return [];

  console.log('🌱 Seeding test data...');

  const createdUsers: { key: string; userId: string }[] = [];

  // Create all test users
  for (const key of Object.keys(TEST_USERS)) {
    const result = await createTestUser(key);
    if (result?.user) {
      createdUsers.push({ key, userId: result.user.id });
      console.log(`✅ Created test user: ${key}`);
    } else {
      const user = TEST_USERS[key as keyof typeof TEST_USERS];
      if (!user) continue;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .single();

      if (data) {
        createdUsers.push({ key, userId: data.id });
        console.log(`ℹ️ User already exists: ${key}`);
      }
    }
  }

  // Seed posts for the first user
  if (createdUsers.length > 0) {
    const firstUser = createdUsers[0];
    await seedMockPosts(firstUser.userId);
    console.log(`✅ Seeded posts for ${firstUser.key}`);
  }

  console.log('🎉 Test data seeding complete!');
  return createdUsers;
}

// Clean up test data
export async function cleanTestData() {
  if (!DEV_ONLY) return;

  console.log('🧹 Cleaning test data...');

  for (const user of Object.values(TEST_USERS)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .single();

    if (profile) {
      await supabase.from('posts').delete().eq('user_id', profile.id);
      await supabase.from('statuses').delete().eq('user_id', profile.id);
    }
  }

  console.log('🎉 Test data cleanup complete!');
}
