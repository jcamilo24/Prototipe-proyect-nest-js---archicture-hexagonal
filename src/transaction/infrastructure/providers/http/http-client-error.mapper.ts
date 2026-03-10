import {
  BadGatewayException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

interface AxiosErrorLike {
  isAxiosError?: boolean;
  code?: string;
  message?: string;
  response?: { status?: number; data?: unknown };
}

/**
 * Maps HTTP client errors (e.g. Axios) to Nest HTTP exceptions.
 * Preserves cause for logging.
 */
export function throwHttpClientError(err: unknown): never {
  if (err instanceof HttpException) throw err;

  const cause = err instanceof Error ? err : new Error(String(err));
  const msg = cause.message?.toLowerCase() ?? '';

  const axiosLike = err as AxiosErrorLike;
  const isAxios =
    axiosLike?.isAxiosError === true ||
    (axiosLike && typeof axiosLike === 'object' && 'response' in axiosLike);

  if (isAxios) {
    const status = axiosLike.response?.status;
    const code = axiosLike.code?.toLowerCase();

    if (
      code === 'econnaborted' ||
      code === 'err_network' ||
      code === 'econnrefused' ||
      code === 'enotfound' ||
      msg.includes('timeout') ||
      msg.includes('network')
    ) {
      throw new ServiceUnavailableException(
        `external service unreachable or timeout`,
        { cause, description: 'HTTP client network/timeout error' },
      );
    }

    if (status != null) {
      if (status >= 500) {
        throw new BadGatewayException(`external service error (${status})`, {
          cause,
          description: `Upstream returned ${status}`,
        });
      }
      if (status >= 400) {
        throw new BadGatewayException(
          `external service rejected request (${status})`,
          { cause, description: `Upstream returned ${status}` },
        );
      }
    }
  }

  if (
    msg.includes('empty response') ||
    msg.includes('invalid response structure')
  ) {
    throw new InternalServerErrorException(`${cause.message}`, {
      cause,
      description: cause.message,
    });
  }

  throw new InternalServerErrorException(`external service call failed`, {
    cause,
    description: cause.message,
  });
}
