import { uiText, useUiLocale } from '@/i18n/ui-copy';
import DocumentControls from "@/components/DocumentControls";
import { useLocation } from "react-router-dom";
import YamilookLogo from "@/components/brand/YamilookLogo";
import {
  Users, Shield, Store, Eye, Coins, UserPlus, Crown, CheckCircle2,
  Smartphone, Globe, Lock, Heart, ArrowRight,
} from "lucide-react";

/* ── brand tokens (match index.css) ── */
const BG = "#111111";
const AMBER = "#F2A900";
const WHITE = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.55)";
const MUTED2 = "rgba(255,255,255,0.35)";

/* ── reusable pieces ── */
function PageNumber({ n, total }: { n: number; total: number }) {
  return (
    <span className="absolute bottom-4 right-6 text-[10px] font-mono" style={{ color: MUTED2 }}>
      {n} / {total}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl font-bold text-center leading-tight" style={{ color: WHITE }}>
      {children}
    </h2>
  );
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-center text-lg max-w-2xl" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-base" style={{ color: "rgba(255,255,255,0.8)" }}>
      <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: AMBER }} />
      {children}
    </li>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 p-4 rounded-2xl" style={{ background: `${AMBER}22`, color: AMBER }}>
      {children}
    </div>
  );
}

function TableRow({ cells, header = false }: { cells: string[]; header?: boolean }) {
  return (
    <tr>
      {cells.map((cell, i) => {
        const Tag = header ? "th" : "td";
        return (
          <Tag
            key={i}
            className={`px-4 py-2 text-start text-sm ${header ? "font-semibold" : "font-normal"}`}
            style={{
              color: header ? WHITE : "rgba(255,255,255,0.8)",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {cell}
          </Tag>
        );
      })}
    </tr>
  );
}

/* ── PAGES ── */
const TOTAL = 12;

function CoverPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center" style={{ background: BG }}>
      <PageNumber n={1} total={TOTAL} />
      <YamilookLogo size="xl" showTagline={false} animate={false} />
      <h1 className="mt-8 text-5xl font-bold" style={{ color: WHITE }}>
        {uiText("Manual de Contas")}</h1>
      <p className="mt-3 text-xl" style={{ color: MUTED }}>
        {uiText("Guia completo do sistema de utilizadores")}</p>
      <div className="mt-8 flex items-center gap-2 px-5 py-2 rounded-full" style={{ background: `${AMBER}22` }}>
        <span className="text-sm font-medium" style={{ color: AMBER }}>{uiText("Documento interno — Conteúdo de março de 2026")}</span>
      </div>
    </div>
  );
}

function OverviewPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={2} total={TOTAL} />
      <IconBox><Globe className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Visão Geral")}</SectionTitle>
      <Subtitle>{uiText("O sistema de contas YamiLook é composto por múltiplas camadas complementares.")}</Subtitle>
      <table className="mt-8 w-full max-w-xl">
        <tbody>
          <TableRow cells={[uiText("Camada"), uiText("Descrição")]} header />
          <TableRow cells={[uiText("Autenticação"), uiText("Email/password + Google, Apple, Facebook")]} />
          <TableRow cells={[uiText("Perfil"), uiText("Dados pessoais, avatar, localização, nível")]} />
          <TableRow cells={[uiText("Funções"), uiText("Permissões administrativas (admin, moderator)")]} />
          <TableRow cells={[uiText("Negócio"), uiText("Perfil comercial opcional + publicidade")]} />
          <TableRow cells={[uiText("Definições"), uiText("Preferências de privacidade e notificações")]} />
        </tbody>
      </table>
    </div>
  );
}

function FlowPage() {
  const steps = [
    { label: "/apply", desc: uiText("Candidatura MVP") },
    { label: uiText("Administrador"), desc: uiText("Aprovação + Código XXXX-XXXX") },
    { label: "/welcome", desc: uiText("Ecrã de boas-vindas") },
    { label: "/onboarding", desc: uiText("Género → Aniversário → Banda → Foto → Bio") },
    { label: uiText("Registo"), desc: uiText("Nome + Email + Password + Código MVP") },
    { label: uiText("Perfil criado"), desc: uiText("profiles + user_settings automáticos") },
  ];

  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={3} total={TOTAL} />
      <IconBox><UserPlus className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Fluxo de Criação de Conta")}</SectionTitle>
      <Subtitle>{uiText("Da candidatura MVP ao perfil completo.")}</Subtitle>
      <div className="mt-8 space-y-3 max-w-lg w-full">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: AMBER, color: BG }}>
              {i + 1}
            </div>
            <div>
              <span className="font-semibold text-sm" style={{ color: WHITE }}>{step.label}</span>
              <span className="ml-2 text-sm" style={{ color: MUTED }}>{step.desc}</span>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" style={{ color: MUTED2 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileFieldsPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-12" style={{ background: BG }}>
      <PageNumber n={4} total={TOTAL} />
      <IconBox><Users className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Estrutura do Perfil")}</SectionTitle>
      <Subtitle>{uiText("Campos principais da tabela profiles.")}</Subtitle>
      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 max-w-2xl w-full">
        {[
          ["display_name", uiText("Nome de exibição")],
          ["username", uiText("Nome único (@)")],
          ["avatar_url", uiText("Foto de perfil")],
          ["bio", uiText("Biografia")],
          ["birthday", uiText("Data de nascimento")],
          ["gender", "male / female / other"],
          ["city / neighborhood", uiText("Identidade territorial (Banda)")],
          ["level", "default / verified_creator / founder"],
          ["kumbu_available", uiText("Kumbu para gastar")],
          ["kumbu_lifetime", uiText("Kumbu total (rank)")],
          ["afroloc_code", uiText("Código AfroLoc único")],
          ["profile_theme_color", uiText("Cor personalizada")],
          ["is_online", uiText("Estado online (heartbeat 30s)")],
          ["status_message", uiText("Mensagem de status")],
        ].map(([field, desc], i) => (
          <div key={i} className="flex items-baseline gap-2 py-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <code className="text-xs font-mono shrink-0" style={{ color: AMBER }}>{field}</code>
            <span className="text-xs" style={{ color: MUTED }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountTypesPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={5} total={TOTAL} />
      <IconBox><Heart className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Tipos de Conta")}</SectionTitle>
      <Subtitle>{uiText("Três níveis de perfil com funcionalidades progressivas.")}</Subtitle>
      <div className="mt-8 grid grid-cols-3 gap-6 max-w-3xl w-full">
        {[
          { title: uiText("Padrão"), level: "default", ring: "rgba(255,255,255,0.2)", icon: <Users className="w-8 h-8" />, features: [uiText("Todas funcionalidades base"), uiText("Publicações, stories, ritmos"), uiText("Chat, chamadas, rodas"), uiText("Acumular Kumbu")] },
          { title: uiText("Criador Verificado"), level: "verified_creator", ring: "rgba(255,255,255,0.5)", icon: <CheckCircle2 className="w-8 h-8" />, features: [uiText("Tudo do Padrão +"), uiText("Monetização (payouts)"), uiText("Mentor na Academia"), uiText("Badge de verificação")] },
          { title: uiText("Fundador"), level: "founder", ring: AMBER, icon: <Crown className="w-8 h-8" />, features: [uiText("Acesso total"), uiText("Anel dourado #C9A23F"), uiText("Badge Crown dourada"), uiText("Verificação dourada")] },
        ].map((type, i) => (
          <div key={i} className="rounded-2xl p-5 flex flex-col items-center text-center"
            style={{ border: `2px solid ${type.ring}`, background: "rgba(255,255,255,0.03)" }}>
            <div className="mb-3" style={{ color: type.ring }}>{type.icon}</div>
            <h3 className="text-lg font-bold" style={{ color: WHITE }}>{type.title}</h3>
            <code className="text-[10px] font-mono mt-1 mb-4" style={{ color: MUTED2 }}>{type.level}</code>
            <ul className="space-y-1.5 text-start w-full">
              {type.features.map((f, j) => (
                <li key={j} className="text-xs flex items-start gap-2" style={{ color: MUTED }}>
                  <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: type.ring }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function RolesPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={6} total={TOTAL} />
      <IconBox><Shield className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Funções Administrativas")}</SectionTitle>
      <Subtitle>{uiText("Separados da tabela de perfis por segurança (anti-escalação de privilégios).")}</Subtitle>
      <div className="mt-8 space-y-6 max-w-xl w-full">
        {[
          { role: uiText("Administrador"), route: "/admin", perms: [uiText("Gestão de tópicos e categorias"), uiText("Aprovação de candidatos MVP"), uiText("Gestão de monetização e payouts"), uiText("Promoção de moderadores")] },
          { role: uiText("Moderador"), route: "/moderation", perms: [uiText("Revisão de denúncias"), uiText("Emissão de strikes"), uiText("Gestão de apelações"), uiText("Log de ações de moderação")] },
        ].map((r, i) => (
          <div key={i} className="rounded-xl p-5" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-lg font-bold" style={{ color: WHITE }}>{r.role}</span>
              <code className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: `${AMBER}22`, color: AMBER }}>{r.route}</code>
            </div>
            <ul className="space-y-1.5">
              {r.perms.map((p, j) => <Bullet key={j}>{p}</Bullet>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={7} total={TOTAL} />
      <IconBox><Store className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Perfil de Negócio")}</SectionTitle>
      <Subtitle>{uiText("Qualquer utilizador pode criar um perfil comercial para aceder à publicidade.")}</Subtitle>
      <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-2 max-w-2xl w-full">
        {[
          ["business_name", uiText("Nome do negócio")],
          ["business_category", uiText("Categoria")],
          ["logo_url / cover_image_url", uiText("Imagens da marca")],
          ["city / neighborhood", uiText("Localização")],
          ["phone / email / website", uiText("Contactos")],
          ["latitude / longitude", uiText("Identidade digital territorial")],
          ["credit_balance", uiText("Saldo de créditos")],
          ["is_verified", uiText("Estado de verificação")],
        ].map(([field, desc], i) => (
          <div key={i} className="flex items-baseline gap-2 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <code className="text-xs font-mono shrink-0" style={{ color: AMBER }}>{field}</code>
            <span className="text-xs" style={{ color: MUTED }}>{desc}</span>
          </div>
        ))}
      </div>
      <ul className="mt-6 space-y-2 max-w-lg w-full">
        <Bullet>{uiText("Dashboard de publicidade com métricas em tempo real")}</Bullet>
        <Bullet>{uiText("Anúncios patrocinados no feed e negócios em destaque")}</Bullet>
        <Bullet>{uiText("Segmentação por cidade, bairro e demografia")}</Bullet>
      </ul>
    </div>
  );
}

function PresencePage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={8} total={TOTAL} />
      <IconBox><Smartphone className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Sistema de Presença")}</SectionTitle>
      <Subtitle>{uiText("Rastreamento de estado online/offline com heartbeat automático.")}</Subtitle>
      <div className="mt-8 space-y-4 max-w-lg w-full">
        {[
          { step: uiText("Iniciar sessão"), desc: uiText("updatePresence(userId, true) → online") },
          { step: uiText("Verificação periódica"), desc: uiText("A cada 30 segundos confirma presença") },
          { step: uiText("Separador oculto"), desc: uiText("stopPresenceHeartbeat → offline") },
          { step: uiText("Separador visível"), desc: uiText("startPresenceHeartbeat → online") },
          { step: uiText("Fechar o navegador"), desc: uiText("fetch com keepalive → offline") },
          { step: uiText("Terminar sessão"), desc: uiText("stopPresenceHeartbeat → offline") },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: i < 2 ? "#22c55e" : i < 4 ? AMBER : "#ef4444", color: BG }}>
              {i + 1}
            </div>
            <div>
              <span className="text-sm font-semibold" style={{ color: WHITE }}>{s.step}</span>
              <span className="ml-2 text-sm" style={{ color: MUTED }}>{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KumbuPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={9} total={TOTAL} />
      <IconBox><Coins className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Sistema Kumbu")}</SectionTitle>
      <Subtitle>{uiText("Economia de participação com progressão por níveis.")}</Subtitle>
      <div className="mt-8 grid grid-cols-4 gap-4 max-w-2xl w-full">
        {[
          { name: uiText("Bronze"), range: "0 – 200", color: "#CD7F32" },
          { name: uiText("Prata"), range: "200 – 800", color: "#C0C0C0" },
          { name: uiText("Ouro"), range: "800 – 2000", color: AMBER },
          { name: "KOTA", range: "2000+", color: "#FFD700" },
        ].map((level, i) => (
          <div key={i} className="rounded-xl p-4 flex flex-col items-center text-center"
            style={{ border: `2px solid ${level.color}`, background: "rgba(255,255,255,0.03)" }}>
            <span className="text-2xl font-bold" style={{ color: level.color }}>{level.name}</span>
            <span className="text-xs mt-1" style={{ color: MUTED }}>{level.range}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 px-5 py-3 rounded-xl max-w-lg text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
        <p className="text-sm italic" style={{ color: MUTED }}>
          {uiText("\"Na Yamilook, quem participa ganha Kumbu.\"")}</p>
        <p className="text-xs mt-1" style={{ color: MUTED2 }}>
          {uiText("Kumbu não é transferível entre utilizadores.")}</p>
      </div>
    </div>
  );
}

function SecurityPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={10} total={TOTAL} />
      <IconBox><Lock className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Segurança & Privacidade")}</SectionTitle>
      <Subtitle>{uiText("Proteção de dados sensíveis com estratégia de whitelist.")}</Subtitle>
      <div className="mt-8 space-y-3 max-w-lg w-full">
        <Bullet>{uiText("SELECT direto a profiles bloqueado para colunas sensíveis (email, telefone)")}</Bullet>
        <Bullet>{uiText("Vista public_profiles expõe apenas campos seguros")}</Bullet>
        <Bullet>{uiText("get_my_profile() — SECURITY DEFINER para dados próprios")}</Bullet>
        <Bullet>{uiText("get_public_profiles_by_ids() — dados públicos de terceiros")}</Bullet>
      </div>
      <h3 className="mt-8 text-lg font-semibold" style={{ color: WHITE }}>{uiText("Definições de Privacidade")}</h3>
      <table className="mt-3 max-w-lg w-full">
        <tbody>
          <TableRow cells={[uiText("Definição"), uiText("Predefinição")]} header />
          <TableRow cells={["show_online_status", "true"]} />
          <TableRow cells={["show_last_seen", "true"]} />
          <TableRow cells={["show_read_receipts", "true"]} />
          <TableRow cells={["show_typing_indicators", "true"]} />
          <TableRow cells={["two_factor_enabled", "false"]} />
        </tbody>
      </table>
    </div>
  );
}

function VisibilityPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center px-16" style={{ background: BG }}>
      <PageNumber n={11} total={TOTAL} />
      <IconBox><Eye className="h-12 w-12" /></IconBox>
      <SectionTitle>{uiText("Visibilidade & Relações")}</SectionTitle>
      <Subtitle>{uiText("Controlo granular de quem vê o quê.")}</Subtitle>
      <div className="mt-8 grid grid-cols-2 gap-6 max-w-2xl w-full">
        <div>
          <h3 className="text-lg font-semibold mb-3" style={{ color: WHITE }}>{uiText("Níveis de Visibilidade")}</h3>
          <ul className="space-y-2">
            <Bullet>{uiText("Público — Visível para todos")}</Bullet>
            <Bullet>{uiText("Contacts — Apenas Kambas")}</Bullet>
            <Bullet>{uiText("Close Friends — Apenas Bradas")}</Bullet>
            <Bullet>{uiText("Private — Apenas o próprio")}</Bullet>
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-3" style={{ color: WHITE }}>{uiText("Tipos de Relação")}</h3>
          <ul className="space-y-2">
            <Bullet>{uiText("Contactos (contacts) — Lista com favoritos")}</Bullet>
            <Bullet>{uiText("Bradas (close_friends) — Acesso exclusivo")}</Bullet>
            <Bullet>{uiText("Seguidores (followers) — Unidirecional")}</Bullet>
            <Bullet>{uiText("Bloqueados (blocked_users) — Restrição total")}</Bullet>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ClosingPage() {
  return (
    <div className="print-page flex flex-col items-center justify-center" style={{ background: BG }}>
      <PageNumber n={12} total={TOTAL} />
      <YamilookLogo size="lg" showTagline={false} animate={false} />
      <h2 className="mt-6 text-3xl font-bold" style={{ color: WHITE }}>
        {uiText("Onde a tua banda vive.")}</h2>
      <p className="mt-3 text-base" style={{ color: MUTED }}>
        {uiText("Documento interno — Versão 1.0 — Conteúdo de março de 2026")}</p>
      <p className="mt-1 text-xs" style={{ color: MUTED2 }}>
        {uiText("Confidencial — Apenas para equipa YamiLook")}</p>
    </div>
  );
}

const PAGES = [
  CoverPage, OverviewPage, FlowPage, ProfileFieldsPage,
  AccountTypesPage, RolesPage, BusinessPage, PresencePage,
  KumbuPage, SecurityPage, VisibilityPage, ClosingPage,
];

export default function UserAccountsManualPrint() {
  useUiLocale();
  const location = useLocation();

  return (
    <>
      <DocumentControls title={uiText("Manual de Contas")} autoPrint={location.pathname.endsWith("/pdf") && new URLSearchParams(location.search).get("print") !== "0"} />
      <style>{`
        .print-page { position: relative; padding-block: 2rem; }
        .print-page code { direction: ltr; unicode-bidi: isolate; }
        @media screen {
          .print-page {
            width: 100%;
            min-height: 56.25vw;
            page-break-after: always;
            break-after: page;
          }
        }
        @media screen and (max-width: 639px) {
          .print-page { padding-inline: 1.25rem; }
          .print-page .grid { grid-template-columns: 1fr; }
          .print-page h1 { font-size: 2rem; text-align: center; }
          .print-page code { white-space: normal; overflow-wrap: anywhere; flex-shrink: 1; }
          .print-page td, .print-page th { padding-inline: 0.5rem; overflow-wrap: anywhere; }
        }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body, html {
            margin: 0 !important; padding: 0 !important;
            background: ${BG} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav, header, footer, .bottom-nav {
            display: none !important;
          }
          .print-page {
            width: 297mm; min-height: 210mm;
            page-break-after: always; break-after: page;
            page-break-inside: avoid; break-inside: avoid;
          }
          .print-page:last-child {
            page-break-after: auto; break-after: auto;
          }
        }
      `}</style>
      <div className="print-container">
        {PAGES.map((Page, i) => <Page key={i} />)}
      </div>
    </>
  );
}
