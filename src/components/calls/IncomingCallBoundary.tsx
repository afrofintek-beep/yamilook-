import { Component, type ReactNode, type ErrorInfo } from 'react';
import { renderDiagnostic } from '@/lib/render-diagnostic';
import { logger } from '@/lib/logger';

type Props = { children: ReactNode; onAnswer: () => void; onDecline: () => void };
/** Keep an incoming invitation actionable if its rich presentation fails. */
export class IncomingCallBoundary extends Component<Props, { failed: boolean; diagnostic: string }> {
  state = { failed: false, diagnostic: '' };
  static getDerivedStateFromError() { return { failed: true, diagnostic: '' }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ diagnostic: JSON.stringify(renderDiagnostic(error, info.componentStack)) });
    logger.error('Incoming call presentation failed', 'IncomingCallBoundary', {
      name: error.name, message: error.message, componentStack: info.componentStack,
    });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="dialog" aria-modal="true" aria-label="Chamada recebida" className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Chamada recebida</h1>
      <details><summary>Diagnóstico técnico</summary><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{this.state.diagnostic}</pre></details>
      <p>Pode atender ou recusar a chamada.</p>
      <button type="button" className="rounded-full bg-green-600 text-white px-8 py-4" onClick={this.props.onAnswer}>Atender</button>
      <button type="button" className="rounded-full bg-red-600 text-white px-8 py-4" onClick={this.props.onDecline}>Recusar</button>
    </div>;
  }
}
