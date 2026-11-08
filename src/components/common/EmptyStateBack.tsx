import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { ArrowLeft, Compass, Newspaper } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export interface EmptyStateAction {
  label: string;
  to: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

interface EmptyStateBackProps {
  message: string;
  fallbackRoute?: string;
  title?: string;
  /**
   * Quick actions shown under the message. Defaults to "Ir para o Feed" and "Explorar".
   * Pass an empty array to hide.
   */
  actions?: EmptyStateAction[];
}

const DEFAULT_ACTIONS: EmptyStateAction[] = [
  { get label() { return uiText("Ir para o Feed"); }, to: '/muxi', icon: Newspaper, variant: 'default' },
  { get label() { return uiText("Explorar"); }, to: '/discover', icon: Compass, variant: 'outline' },
];

/**
 * Generic dead-end screen with a back arrow header and quick actions.
 * Use whenever a route renders an empty/not-found state with no next step.
 */
export function EmptyStateBack({
  message,
  fallbackRoute = '/',
  title,
  actions = DEFAULT_ACTIONS,
}: EmptyStateBackProps) {
  useUiLocale();
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackRoute);
  };

  return (
    <div className="flex min-h-screen-safe flex-col bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 safe-top">
        <div className="flex items-center gap-3 h-14">
          <button
            onClick={handleBack}
            aria-label={uiText("Voltar")}
            className="p-1 -ml-1 rounded-lg hover:bg-card transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">{title ?? uiText("Voltar")}</h1>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-5 text-center max-w-xs w-full">
          <p className="text-sm text-muted-foreground">{message}</p>
          {actions.length > 0 && (
            <div className="flex flex-col gap-2 w-full">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.to}
                    variant={action.variant ?? 'default'}
                    className="w-full rounded-full gap-2"
                    onClick={() => navigate(action.to)}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
