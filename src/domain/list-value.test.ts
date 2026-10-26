import { describe, expect, it } from 'vitest';

import { parseListValue } from './list-value';

describe('parseListValue', () => {
  it('reads the JSON Twenty injects', () => {
    expect(parseListValue('["STOP", " SAIR "]')).toEqual(['STOP', 'SAIR']);
  });

  it('reads a hand-typed comma list', () => {
    expect(parseListValue('a, b,,c')).toEqual(['a', 'b', 'c']);
  });

  it('reads a single bare item', () => {
    expect(parseListValue('23f1f6f9-5f8e-4f0b-9ae1-6a400a8fc5d2')).toEqual([
      '23f1f6f9-5f8e-4f0b-9ae1-6a400a8fc5d2',
    ]);
  });

  it('treats JSON that is not an array as text', () => {
    expect(parseListValue('{"a":1}')).toEqual(['{"a":1}']);
  });

  it('is empty for an empty list', () => {
    expect(parseListValue('[]')).toEqual([]);
    expect(parseListValue('')).toEqual([]);
  });
});
