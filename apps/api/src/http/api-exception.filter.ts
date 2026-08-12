import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';

interface RequestWithId {
  readonly requestId?: string;
}

interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): void;
}

interface ErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly retryable: boolean;
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<JsonResponse>();
    const { status, envelope } = formatException(exception, request.requestId ?? 'unknown');
    response.status(status).json(envelope);
  }
}

export function formatException(
  exception: unknown,
  requestId: string
): { readonly status: number; readonly envelope: ErrorEnvelope } {
  if (!(exception instanceof HttpException)) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      envelope: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno inesperado.',
          requestId,
          retryable: false
        }
      }
    };
  }

  const status = exception.getStatus();
  const response = exception.getResponse();
  const responseObject = typeof response === 'object' && response !== null
    ? response as Record<string, unknown>
    : undefined;
  const code = typeof responseObject?.code === 'string'
    ? responseObject.code
    : defaultCode(status);
  const message = readMessage(responseObject?.message ?? response);
  const details = responseObject
    ? Object.fromEntries(Object.entries(responseObject).filter(([key]) =>
      key !== 'code' && key !== 'message' && key !== 'statusCode' && key !== 'error'))
    : undefined;

  return {
    status,
    envelope: {
      error: {
        code,
        message,
        requestId,
        ...(details && Object.keys(details).length > 0 ? { details } : {}),
        retryable: status === 503 || status === 429
      }
    }
  };
}

function readMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value.join('; ');
  }
  return 'A requisição não pôde ser processada.';
}

function defaultCode(status: number): string {
  return HttpStatus[status] ?? 'HTTP_ERROR';
}
