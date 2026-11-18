import type { FastifyRequest } from "fastify";

/**
 * id пользователя для роутов с optionalAuthenticate:
 * если токена нет, request.user остаётся пустым, хотя тип говорит обратное.
 */
export function getViewerId(request: FastifyRequest): string | null {
  return (request.user as { sub: string } | undefined)?.sub ?? null;
}