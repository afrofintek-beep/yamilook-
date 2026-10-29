import { expect, it } from 'vitest';
import { callSetupFailure } from './call-setup-failure';
it('distinguishes permission, device and connection failures with bounded diagnostics', () => {
  expect(callSetupFailure('microphone', new DOMException('private device', 'NotAllowedError'))).toEqual({ message: expect.stringContaining('microfone não foi autorizado'), reason: 'transport_failed:microphone:NotAllowedError' });
  expect(callSetupFailure('room_connect', new Error('wss://private-host/?token=secret'))).toEqual({ message: expect.stringContaining('serviço de chamadas'), reason: 'transport_failed:room_connect:Error' });
  expect(callSetupFailure('untrusted-stage', { name: 'secret:device id' }).reason).toBe('transport_failed:unknown:Error');
});
