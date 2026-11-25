import { useAdminAreas } from '@/features/admin-areas/useAdminAreas';
import type { AdminArea } from '@/features/admin-areas/catalog';
import { adminAreaCopy } from '@/features/admin-areas/copy';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Users, Banknote, FileText, ShieldCheck, Crown } from 'lucide-react';

export default function AdminMonetization() {
  const copy = adminAreaCopy(useUiLocale());
  const access = useAdminAreas();
  const navigate = useNavigate();

  const links = [
    { label: uiText("Gestão de Mentores"), icon: Users, path: '/admin/mentors' },
    { label: uiText("Mokubico Pro — Faturação"), icon: Crown, path: '/admin/billing' },
    { label: uiText("Candidaturas de Criadores"), icon: Users, area: 'admin_creators', path: '/admin/applications' },
    { label: uiText("Certificações AFROLOC"), icon: ShieldCheck, area: 'admin_certifications', path: '/admin/afroloc-certifications' },
    { label: uiText("Pedidos de Payout"), icon: Banknote, area: 'admin_payouts', path: '/admin/payouts' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{uiText("Monetização — Admin")}</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">{copy.permissionHint}</AlertDescription>
        </Alert>

        {links.filter(l => l.area ? access.allowed[l.area as AdminArea] : access.admin).map((l) => (
          <Card
            key={l.path}
            className="border-none shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate(l.path)}
          >
            <CardContent className="p-5 flex items-center gap-3">
              <l.icon className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium">{l.label}</span>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
