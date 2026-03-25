import {
  BadGatewayException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

type AxiosErrorLike = {
  isAxiosError?: boolean;
  code?: string;
  message?: string;
  response?: { status?: number; data?: unknown };
};

function isNetworkOrTimeout(code: string | undefined, msg: string): boolean {
  const c = code?.toLowerCase();
  return (
    c === 'econnaborted' ||
    c === 'err_network' ||
    c === 'econnrefused' ||
    c === 'econnreset' ||
    c === 'enotfound' ||
    msg.includes('timeout') ||
    msg.includes('network')
  );
}

function throwServiceUnavailable(cause: Error): never {
  throw new ServiceUnavailableException(
    `external service unreachable or timeout`,
    { cause, description: 'HTTP client network/timeout error' },
  );
}

export function throwHttpClientError(err: unknown): void {
  if (err instanceof HttpException) throw err;

  const cause = err instanceof Error ? err : new Error(String(err));
  const msg = cause.message?.toLowerCase() ?? '';

  const axiosLike = err as AxiosErrorLike;
  const isAxios =
    axiosLike?.isAxiosError === true ||
    (axiosLike && typeof axiosLike === 'object' && 'response' in axiosLike);

  if (isAxios) {
    const code = axiosLike.code?.toLowerCase();
    if (isNetworkOrTimeout(code, msg)) throwServiceUnavailable(cause);

    const status = axiosLike.response?.status;
    if (status != null && status >= 500) {
      throw new BadGatewayException(`external service error (${status})`, {
        cause,
        description: `Upstream returned ${status}`,
      });
    }
    if (status != null && status >= 400) {
      throw new BadGatewayException(
        `external service rejected request (${status})`,
        { cause, description: `Upstream returned ${status}` },
      );
    }
  }

  const code = (cause as NodeJS.ErrnoException).code?.toLowerCase();
  if (isNetworkOrTimeout(code, msg)) throwServiceUnavailable(cause);

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
