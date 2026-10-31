import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Users, Banknote, FileText, ShieldCheck, Crown } from 'lucide-react';

export default function AdminMonetization() {
  const navigate = useNavigate();

  const links = [
    { label: 'Gestão de Mentores', icon: Users, path: '/admin/mentors' },
    { label: 'Mokubico Pro — Faturação', icon: Crown, path: '/admin/billing' },
    { label: 'Candidaturas de Criadores', icon: Users, path: '/admin/applications' },
    { label: 'Certificações AFROLOC', icon: ShieldCheck, path: '/admin/afroloc-certifications' },
    { label: 'Pedidos de Payout', icon: Banknote, path: '/admin/payouts' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Monetização — Admin</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Área restrita a administradores. Acesso verificado por role.
          </AlertDescription>
        </Alert>

        {links.map((l) => (
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
