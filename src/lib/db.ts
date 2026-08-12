import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";
import { cache } from "react";

/**
 * D1 is a Workers binding, so a Prisma client must be derived from the active
 * request rather than retained as process-global state.
 */
export const getDb = cache(() => {
  const { env } = getCloudflareContext();
  return new PrismaClient({ adapter: new PrismaD1(env.DB) });
});

/**
 * Compatibility façade for the existing application. It resolves delegates
 * from the request-scoped D1 client at the moment they are used.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDb();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
