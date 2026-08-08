import { describe, expect, it, vi } from 'vitest';
import { localAuth } from '../src/middleware/auth.js';

function mockReqRes(authHeader?: string) {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockResolvedValue(undefined),
  };
  const request = { headers: authHeader ? { authorization: authHeader } : {} };
  return { request: request as never, reply: reply as never, replySpy: reply };
}

describe('localAuth middleware', () => {
  it('passes through when LOCAL_AUTH_TOKEN is unset', async () => {
    vi.stubEnv('LOCAL_AUTH_TOKEN', '');
    const { request, reply, replySpy } = mockReqRes();
    await localAuth(request, reply);
    expect(replySpy.code).not.toHaveBeenCalled();
  });

  it('rejects missing/invalid token when configured', async () => {
    vi.stubEnv('LOCAL_AUTH_TOKEN', 's3cret');
    const { request, reply, replySpy } = mockReqRes('Bearer wrong');
    await localAuth(request, reply);
    expect(replySpy.code).toHaveBeenCalledWith(401);
  });

  it('accepts the correct bearer token', async () => {
    vi.stubEnv('LOCAL_AUTH_TOKEN', 's3cret');
    const { request, reply, replySpy } = mockReqRes('Bearer s3cret');
    await localAuth(request, reply);
    expect(replySpy.code).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
