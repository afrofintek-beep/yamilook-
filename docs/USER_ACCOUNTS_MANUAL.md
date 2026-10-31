# Manual de Contas de Utilizadores — YamiLook

> Documento de referência interno sobre a criação, gestão e tipos de contas na plataforma.

---

## 1. Visão Geral

A YamiLook utiliza um sistema de contas com múltiplas camadas:

| Camada | Descrição |
|--------|-----------|
| **Autenticação** | Gerida pelo Supabase (auth) — email/password + social login |
| **Perfil** | Tabela `profiles` — dados pessoais, avatar, localização, nível |
| **Roles** | Tabela `user_roles` — permissões administrativas (admin, moderator) |
| **Negócio** | Tabela `business_profiles` — perfil comercial opcional |
| **Definições** | Tabela `user_settings` — preferências de privacidade e notificações |

---

## 2. Fluxo de Criação de Conta

### 2.1 Candidatura MVP (Pré-Registo)

O registo está restrito a candidatos aprovados durante a fase MVP.

```
Utilizador visita /apply
    ↓
Preenche formulário (nome, email, telefone, cidade, motivação)
    ↓
Dados guardados em `mvp_candidates` (status: 'pending')
    ↓
Admin revê em /admin → Aprova ou Rejeita
    ↓
Se aprovado → Código de acesso gerado (formato: XXXX-XXXX)
    ↓
Utilizador recebe código e pode prosseguir para registo
```

### 2.2 Onboarding (Antes do Registo)

O onboarding é realizado **antes** da criação da conta:

```
/welcome → /onboarding
    ↓
Step 0: Género (male / female / other)
    ↓
Step 1: Data de Nascimento (dia/mês/ano)
    ↓
Step 2: Banda / Localização (país → cidade → bairro)
         - Suporta geolocalização automática
    ↓
Step 3: Boas-vindas à Banda (ecrã informativo)
    ↓
Step 4: Foto de Perfil (upload ou câmara)
    ↓
Step 5: Bio (texto livre, max caracteres)
    ↓
Dados mantidos em estado local (não persistidos ainda)
```

### 2.3 Registo

```
/onboarding → Formulário de registo integrado no último passo
    ↓
Campos: Nome, Username, Email, Password + Código MVP
    ↓
Validação do código MVP (RPC: validate_mvp_access_code)
    ↓
supabase.auth.signUp() com metadata (display_name, username)
    ↓
Trigger `handle_new_user()` executa automaticamente:
  → Cria entrada em `profiles` (id, email, display_name, username)
  → Cria entrada em `user_settings` (user_id)
    ↓
Código MVP consumido (RPC: consume_mvp_access_code)
    ↓
Dados do onboarding persistidos no perfil (género, birthday, banda, avatar, bio)
    ↓
Verificação de email enviada
    ↓
Utilizador redirecionado para /muxi (feed)
```

### 2.4 Login Social

Providers suportados: **Google**, **Apple**, **Facebook**

```
Botão de login social → supabase.auth.signInWithOAuth({ provider })
    ↓
Redirect para provider → Autenticação externa
    ↓
Retorno → Trigger handle_new_user() (se primeiro login)
    ↓
Sessão criada automaticamente
```

---

## 3. Estrutura do Perfil (`profiles`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Chave primária (= auth.users.id) |
| `email` | text | Email do utilizador |
| `phone_number` | text | Telefone (opcional) |
| `display_name` | text | Nome de exibição |
| `username` | text | Nome de utilizador único (@username) |
| `avatar_url` | text | URL do avatar (bucket: avatars) |
| `bio` | text | Biografia |
| `birthday` | date | Data de nascimento |
| `gender` | text | male / female / other |
| `country_code` | text | Código do país |
| `city` | text | Cidade |
| `neighborhood` | text | Bairro/Banda |
| `status_message` | text | Mensagem de status |
| `is_online` | boolean | Estado online (heartbeat 30s) |
| `last_seen` | timestamp | Último acesso |
| `onboarding_completed` | boolean | Onboarding concluído |
| `app_tour_completed` | boolean | Tour da app concluído |
| `level` | text | Nível: 'default', 'verified_creator', 'founder' |
| `kumbu_available` | integer | Kumbu disponível para gastar |
| `kumbu_lifetime` | integer | Kumbu total acumulado (determina rank) |
| `afroloc_code` | text | Código de endereço declarado ou legado; não comprova certificação |
| `profile_theme_color` | text | Cor personalizada do perfil |
| `show_online_status` | boolean | Mostrar estado online |
| `show_last_seen` | boolean | Mostrar último acesso |
| `show_read_receipts` | boolean | Mostrar confirmação de leitura |
| `show_typing_indicators` | boolean | Mostrar indicador de escrita |
| `two_factor_enabled` | boolean | 2FA ativado |

---

## 4. Tipos de Conta / Níveis

### 4.1 Utilizador Padrão (`level: 'default'`)

- **Acesso**: Todas as funcionalidades base
- **Visual**: Anel primário subtil no avatar
- **Obtenção**: Registo normal

**Funcionalidades:**
- Criar publicações, stories, ritmos
- Chat direto e de grupo
- Chamadas de voz e vídeo
- Participar em rodas do Palco
- Acumular Kumbu
- Participar na Academia

### 4.2 Criador Verificado (`level: 'verified_creator'`)

- **Acesso**: Funcionalidades base + monetização
- **Visual**: Anel cinza + badge Shield azul
- **Obtenção**: Candidatura em `/creator/apply` → Aprovação admin

**Fluxo de candidatura:**
```
/creator/apply
    ↓
Formulário (nome completo, razão, tipo: 'creator')
    ↓
Upload de documento de identidade (bucket: creator-documents)
    ↓
Guardado em `creator_applications` (status: 'pending')
    ↓
Admin revê em /admin/monetization → Aprova ou Rejeita
    ↓
Se aprovado → profile.level = 'verified_creator'
```

**Funcionalidades adicionais:**
- Solicitar pagamentos (payouts)
- Criar sessões na Academia como mentor
- Badge de verificação no perfil

### 4.3 Fundador (`level: 'founder'`)

- **Acesso**: Todas as funcionalidades
- **Visual**: Anel dourado (#C9A23F) + badge Crown dourada + ✓ verificação dourada
- **Obtenção**: Atribuído manualmente na base de dados

**Identificação visual:**
- Anel de 4px dourado à volta do avatar
- Gradiente dourado decorativo
- Badge "Fundador" com ícone Crown
- Check de verificação dourado ao lado do nome

---

## 5. Roles Administrativos (`user_roles`)

Separados da tabela de perfis por segurança (prevenção de escalação de privilégios).

| Role | Permissões | Rota |
|------|-----------|------|
| **admin** | Acesso total: gestão de tópicos, aprovação MVP, gestão de monetização, promoção de moderadores | `/admin` |
| **moderator** | Gestão de conteúdo: denúncias, strikes, apelações, log de ações | `/moderation` |

**Verificação de roles:**
```sql
-- Função SECURITY DEFINER (sem recursão RLS)
SELECT public.has_role(auth.uid(), 'admin');
SELECT public.is_moderator_or_admin(auth.uid());
```

**Admins atuais:**
- Antonio Henriques Silva (@tony_dinguanza)
- Ana Rafaela (@maria_silva)

---

## 6. Perfil de Negócio (`business_profiles`)

Qualquer utilizador pode criar um perfil comercial.

| Campo | Descrição |
|-------|-----------|
| `business_name` | Nome do negócio |
| `business_category` | Categoria |
| `description` | Descrição |
| `logo_url` / `cover_image_url` | Imagens |
| `city` / `neighborhood` | Localização |
| `phone` / `email` / `website` | Contactos |
| `latitude` / `longitude` | Coordenadas GPS |
| `credit_balance` | Saldo de créditos para publicidade |
| `is_verified` | Verificação do negócio |

**Funcionalidades do negócio:**
- Dashboard de publicidade (`/advertising`)
- Criar anúncios (sponsored posts, featured cards)
- Estatísticas de impressões e cliques
- Gestão de créditos

---

## 7. Sistema de Presença (Online/Offline)

```
Login → updatePresence(userId, true)
    ↓
Heartbeat a cada 30 segundos
    ↓
Tab oculta → stopPresenceHeartbeat → offline
Tab visível → startPresenceHeartbeat → online
    ↓
Fechar browser → fetch com keepalive → offline
    ↓
Logout → stopPresenceHeartbeat → offline
```

**Privacidade:** O utilizador pode desativar `show_online_status` e `show_last_seen` nas definições.

---

## 8. Sistema Kumbu (Progressão)

| Nível | Kumbu Lifetime | Benefícios |
|-------|---------------|------------|
| **Bronze** | 0 – 200 | Acesso base |
| **Prata** | 200 – 800 | Desbloqueios intermédios |
| **Ouro** | 800 – 2000 | Funcionalidades avançadas |
| **KOTA** | 2000+ | Estatuto máximo na comunidade |

**Kumbu não é transferível entre utilizadores.**

---

## 9. Segurança e Privacidade

### Proteção de Dados Sensíveis

- `SELECT` direto à tabela `profiles` bloqueado para colunas sensíveis (email, telefone)
- Vista `public_profiles` expõe apenas: id, display_name, username, avatar_url, bio, level, is_online, last_seen, status_message
- Função `get_my_profile()` (SECURITY DEFINER) para aceder aos próprios dados completos
- Função `get_public_profiles_by_ids()` (SECURITY DEFINER) para dados públicos de outros utilizadores

### Definições de Privacidade

| Definição | Descrição | Default |
|-----------|-----------|---------|
| `show_online_status` | Mostrar estado online | true |
| `show_last_seen` | Mostrar último acesso | true |
| `show_read_receipts` | Confirmação de leitura | true |
| `show_typing_indicators` | Indicador de escrita | true |
| `two_factor_enabled` | Autenticação 2FA | false |

### Visibilidade de Conteúdo

Os posts suportam 4 níveis de visibilidade:
- **Público/Everyone** — Visível para todos
- **Contacts/Friends** — Apenas Kambas (contactos)
- **Close Friends** — Apenas Bradas (amigos próximos)
- **Private/Only Me** — Apenas o próprio

---

## 10. Eliminação e Gestão de Conta

### Sessões
- Tabela `device_sessions` rastreia dispositivos ativos
- Função `revoke_other_sessions()` termina todas as sessões exceto a atual

### Password Reset
```
/forgot-password → Email com link
    ↓
Link redireciona para /reset-password
    ↓
supabase.auth.updateUser({ password })
```

### Relações entre Utilizadores
- **Contactos** (`contacts`): Lista de contactos com favoritos e bloqueios
- **Amigos Próximos** (`close_friends`): Bradas com acesso a conteúdo exclusivo
- **Seguidores** (`followers`): Relação unidirecional de seguimento
- **Bloqueados** (`blocked_users`): Utilizadores bloqueados com razão opcional

---

## 11. Código AfroLoc

O campo `afroloc_code` pode conter um código declarado ou um identificador legado. A sua presença não comprova certificação, residência ou direito de utilização.

O formato histórico `AFRO-[CIDADE]-[BANDA]-[USER_ID_PREFIX]` não deve ser apresentado como o formato oficial atual do AFROLOC. O código oficial deve ser preservado conforme emitido pela autoridade AFROLOC, sem gerar equivalentes locais.

A certificação exige evidência autorizada e correspondência com o endereço declarado. A integração automática e as dependências de identidade estão descritas em [Contrato do ecossistema](afrofintek-ecosystem-contract.md).

---

## 12. Diagrama Resumo

```
                    ┌─────────────┐
                    │   /apply    │ ← Candidatura MVP
                    └──────┬──────┘
                           ↓
                    ┌─────────────┐
                    │ Admin aprova│ → Código XXXX-XXXX
                    └──────┬──────┘
                           ↓
                    ┌─────────────┐
                    │  /welcome   │
                    └──────┬──────┘
                           ↓
                    ┌─────────────┐
                    │ /onboarding │ ← Género, Birthday, Banda, Foto, Bio
                    └──────┬──────┘
                           ↓
                    ┌─────────────┐
                    │  Registo    │ ← Nome + Email + Password + Código MVP
                    └──────┬──────┘
                           ↓
              ┌────────────┼────────────┐
              ↓            ↓            ↓
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ profiles │ │user_roles│ │user_sets │
        └──────────┘ └──────────┘ └──────────┘
              │
              ├── level: default ──→ Utilizador base
              ├── level: verified_creator ──→ + Monetização
              └── level: founder ──→ + Tudo
              │
              └── business_profiles (opcional) ──→ Publicidade
```

---

*Última atualização: Março 2026*
