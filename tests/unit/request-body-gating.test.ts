import { describe, it, expect } from 'vitest';
import { bodyForMethod, METHODS_WITH_BODY } from '../../scripts/request-body-gating';

// Pure-helper tests (review M4 / round 2): the serve-static server must not
// forward a body for methods where `new Request` would throw (GET/HEAD).

describe('request body gating', () => {
  it('forwards bodies only for body-able methods', () => {
    const body = Buffer.from('{"email":"a@example.com"}');
    expect(bodyForMethod('POST', body)).toBe(body);
    expect(bodyForMethod('PUT', body)).toBe(body);
    expect(bodyForMethod('PATCH', body)).toBe(body);
    expect(bodyForMethod('DELETE', body)).toBe(body);
  });

  it('strips bodies for GET/HEAD/OPTIONS (the Request-constructor crash)', () => {
    const body = Buffer.from('{}');
    expect(bodyForMethod('GET', body)).toBeUndefined();
    expect(bodyForMethod('HEAD', body)).toBeUndefined();
    expect(bodyForMethod('OPTIONS', body)).toBeUndefined();
    expect(bodyForMethod('get', body)).toBeUndefined(); // case-sensitive set
  });

  it('handles missing method and missing body', () => {
    expect(bodyForMethod(undefined, undefined)).toBeUndefined();
    expect(bodyForMethod('POST', undefined)).toBeUndefined();
    expect(METHODS_WITH_BODY.has('POST')).toBe(true);
  });
});
