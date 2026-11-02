import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAppSurface } from "@/lib/app-surface";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { Home, Flame, GraduationCap, MessageCircle, User, Users, Phone, Settings } from "lucide-react";

const navItems = [
  { to: "/muxi", label: "Muxi", Icon: Flame },
  { to: "/mokubico", label: "Mokubico", Icon: Home },
  { to: "/academia", label: "Academia", Icon: GraduationCap },
  { to: "/papos", label: "KOSOLOLA", Icon: MessageCircle },
  { to: "/perfil", label: "Perfil", Icon: User },
];

export default function BottomNav({ layout = 'default' }: { layout?: 'default' | 'feed' }) {
  useTranslation();
  const surface = useAppSurface();
  const items = surface === 'papos' ? [
    { to: '/papos', label: i18n.t('settingsScreen.text1'), Icon: MessageCircle },
    { to: '/contacts', label: i18n.t('settingsScreen.text2'), Icon: Users },
    { to: '/calls', label: i18n.t('settingsScreen.text3'), Icon: Phone },
    { to: '/settings', label: i18n.t('settingsScreen.text4'), Icon: Settings },
  ] : navItems;
  return createPortal(
    <nav aria-label={i18n.t('settingsScreen.text5')} className={`app-bottom-nav fixed bottom-0 left-0 right-0 z-50 h-[calc(5rem+env(safe-area-inset-bottom,0px))] glass-nav ${layout === 'feed' && surface !== 'papos' ? 'feed-primary-nav' : ''}`}>
      <div style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} className="mx-auto grid h-full max-w-md items-center px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "flex h-full flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-[11px] transition-all duration-150 active:scale-[0.92]",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative rounded-lg p-1 transition-all duration-150 ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon className={`h-5 w-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`} />
                  {isActive && (
                    <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary animate-scale-in" />
                  )}
                </div>
                <span className="leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>,
    document.body,
  );
}

