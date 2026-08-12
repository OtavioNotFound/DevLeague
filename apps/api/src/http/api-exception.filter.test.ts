import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { formatException } from './api-exception.filter.js';

describe('API error envelope', () => {
  it('preserves a stable application code and request correlation', () => {
    expect(formatException(new BadRequestException({
      code: 'INVALID_USERNAME',
      message: 'Username inválido.',
      field: 'username'
    }), 'req-123')).toEqual({
      status: 400,
      envelope: {
        error: {
          code: 'INVALID_USERNAME',
          message: 'Username inválido.',
          requestId: 'req-123',
          details: { field: 'username' },
          retryable: false
        }
      }
    });
  });

  it('marks dependency failures as retryable without exposing the exception', () => {
    const formatted = formatException(new ServiceUnavailableException('Banco indisponível.'), 'req-456');
    expect(formatted.envelope.error).toMatchObject({
      requestId: 'req-456',
      retryable: true
    });
  });

  it('does not expose unknown exception details', () => {
    expect(formatException(new Error('database password=secret'), 'req-789').envelope.error)
      .toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Erro interno inesperado.',
        requestId: 'req-789',
        retryable: false
      });
  });
});
