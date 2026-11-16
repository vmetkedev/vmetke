import type { FastifyReply } from "fastify";

export class NotFoundError extends Error {}
export class NotOwnerError extends Error {}

export function handleOwnershipError(err: unknown, reply: FastifyReply) {
  if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof NotOwnerError) return reply.code(403).send({ error: err.message });
  throw err;
}