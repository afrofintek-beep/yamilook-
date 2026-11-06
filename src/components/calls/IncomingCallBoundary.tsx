import { Component, type ReactNode, type ErrorInfo } from 'react';
import { renderDiagnostic } from '@/lib/render-diagnostic';
import { logger } from '@/lib/logger';

type Props = { children: ReactNode; onAnswer: () => void; onDecline: () => void; waiting?: boolean; busy?: boolean; answerLabel?: string; waitingLabel?: string };
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
    return <div role="dialog" aria-modal={!this.props.waiting} aria-label={this.props.waitingLabel || 'Chamada recebida'} className={this.props.waiting ? 'fixed top-4 left-3 right-3 z-[200] rounded-2xl border bg-background p-4 space-y-3' : 'fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-6 p-6'}>
      <h1 className="text-xl font-semibold">{this.props.waitingLabel || 'Chamada recebida'}</h1>
      <details><summary>Diagnóstico técnico</summary><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{this.state.diagnostic}</pre></details>
      <p>Pode atender ou recusar a chamada.</p>
      <button type="button" disabled={this.props.busy} className="rounded-full bg-green-600 text-white px-8 py-4" onClick={this.props.onAnswer}>{this.props.answerLabel || 'Atender'}</button>
      <button type="button" disabled={this.props.busy} className="rounded-full bg-red-600 text-white px-8 py-4" onClick={this.props.onDecline}>Recusar</button>
    </div>;
  }
}
