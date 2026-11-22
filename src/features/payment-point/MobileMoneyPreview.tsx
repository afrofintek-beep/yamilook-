import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function MobileMoneyPreview({ total, reference }: { total: string; reference: string }) {
  const [step, setStep] = useState<'start' | 'waiting' | 'approved' | 'expired'>('start');

  return <details className="rounded-xl border p-3">
    <summary className="cursor-pointer font-medium">UNITEL Money · demonstração</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p>Simulação local de uma cobrança de {total}. Não movimenta dinheiro nem altera o pedido.</p>
      <p className="break-all">Referência do pedido: {reference}</p>
      <div aria-live="polite">
        {step === 'waiting' && 'A aguardar autorização simulada.'}
        {step === 'approved' && 'Demonstração concluída · autorização simulada.'}
        {step === 'expired' && 'Demonstração concluída · pedido simulado expirado.'}
      </div>
      {step === 'start' && <Button variant="outline" onClick={() => setStep('waiting')}>Experimentar cobrança</Button>}
      {step === 'waiting' && <div className="flex flex-wrap gap-2">
        <Button onClick={() => setStep('approved')}>Simular autorização</Button>
        <Button variant="outline" onClick={() => setStep('expired')}>Simular expiração</Button>
      </div>}
      {(step === 'approved' || step === 'expired') && <Button variant="outline" onClick={() => setStep('start')}>Repetir demonstração</Button>}
    </div>
  </details>;
}
