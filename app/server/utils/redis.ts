import Redis from "ioredis";

declare global {
   
  var __redis: Redis | undefined;
}

function createRedisClient(): Redis {
  const config = useRuntimeConfig();
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

export const redis = globalThis.__redis || createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}

export default redis;
