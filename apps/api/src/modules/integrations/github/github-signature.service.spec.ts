import { createHmac } from 'crypto';
import { GithubSignatureService } from './github-signature.service';

describe('GithubSignatureService', () => {
  const service = new GithubSignatureService();

  it('returns true for valid signature', () => {
    const payload = Buffer.from('{"zen":"hello"}');
    const secret = 'super-secret';
    const digest = createHmac('sha256', secret).update(payload).digest('hex');

    const ok = service.verifySignature(payload, `sha256=${digest}`, secret);
    expect(ok).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const payload = Buffer.from('{"zen":"hello"}');
    const ok = service.verifySignature(payload, 'sha256=deadbeef', 'super-secret');
    expect(ok).toBe(false);
  });

  it('returns false for missing header', () => {
    const payload = Buffer.from('{"zen":"hello"}');
    const ok = service.verifySignature(payload, undefined, 'super-secret');
    expect(ok).toBe(false);
  });
});
