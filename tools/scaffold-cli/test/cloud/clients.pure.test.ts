import { describe, it, expect } from 'vitest';
import { deriveImage } from '../../src/cloud/repo.js';
import { classifyHttp, mapRenderType, parseServices } from '../../src/cloud/clients/render.js';
import { classifyCliError } from '../../src/cloud/clients/exec.js';
import {
  AuthError,
  NotFoundError,
  ConflictError,
  RetryableError,
  ToolError,
} from '../../src/cloud/clients/types.js';

describe('deriveImage', () => {
  it('lowercases owner/repo', () => {
    expect(deriveImage('MyOrg', 'MyApp')).toBe('ghcr.io/myorg/myapp');
  });
});

describe('classifyHttp', () => {
  it('maps status ranges to typed errors', () => {
    expect(classifyHttp(200)).toBeUndefined();
    expect(classifyHttp(401)).toBeInstanceOf(AuthError);
    expect(classifyHttp(403)).toBeInstanceOf(AuthError);
    expect(classifyHttp(404)).toBeInstanceOf(NotFoundError);
    expect(classifyHttp(409)).toBeInstanceOf(ConflictError);
    expect(classifyHttp(429)).toBeInstanceOf(RetryableError);
    expect(classifyHttp(503)).toBeInstanceOf(RetryableError);
    expect(classifyHttp(400)).toBeInstanceOf(ToolError);
  });
});

describe('mapRenderType', () => {
  it('maps Render API service types to render.yaml types', () => {
    expect(mapRenderType('web_service')).toBe('web');
    expect(mapRenderType('background_worker')).toBe('worker');
    expect(mapRenderType('key_value')).toBe('keyvalue');
    expect(mapRenderType('redis')).toBe('keyvalue');
    expect(mapRenderType('cron_job')).toBe('cron');
    expect(mapRenderType('static_site')).toBeUndefined();
  });
});

describe('parseServices', () => {
  it('parses the { service } envelope with image + url, skipping unknown types', () => {
    const json = [
      {
        service: {
          id: 'srv-1',
          name: 'production-server',
          type: 'web_service',
          imagePath: 'ghcr.io/acme/app:production',
          serviceDetails: { url: 'https://app.onrender.com' },
        },
      },
      { service: { id: 'srv-2', name: 'production-worker', type: 'background_worker' } },
      { service: { id: 'ss-1', name: 'marketing', type: 'static_site' } }, // skipped
    ];
    const out = parseServices(json);
    expect(out).toEqual([
      {
        id: 'srv-1',
        name: 'production-server',
        type: 'web',
        imagePath: 'ghcr.io/acme/app:production',
        url: 'https://app.onrender.com',
      },
      { id: 'srv-2', name: 'production-worker', type: 'worker', imagePath: undefined, url: undefined },
    ]);
  });

  it('handles bare service objects and non-arrays', () => {
    expect(parseServices('nope')).toEqual([]);
    expect(parseServices([{ id: 'x', name: 'y', type: 'web_service' }])[0].name).toBe('y');
  });
});

describe('classifyCliError', () => {
  it('maps stderr patterns to typed errors', () => {
    expect(classifyCliError('gh: Not logged in to any GitHub hosts', 1)).toBeInstanceOf(AuthError);
    expect(classifyCliError('HTTP 404: Not Found', 1)).toBeInstanceOf(NotFoundError);
    expect(classifyCliError('name already exists', 1)).toBeInstanceOf(ConflictError);
    expect(classifyCliError('request timed out', 1)).toBeInstanceOf(RetryableError);
    expect(classifyCliError('some other failure', 2)).toBeInstanceOf(ToolError);
  });
});
