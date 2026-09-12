import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/api/health', () => {
  it('responde con status ok', async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
