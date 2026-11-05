import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import serverless from 'serverless-http';
import type { Express } from 'express';
import { bootstrap } from '../../backend/dist/bootstrap.js';
import { createApp } from '../../backend/dist/app.js';

let app: Express | null = null;
let handlerFn: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!handlerFn) {
    await bootstrap();
    app = createApp();
    handlerFn = serverless(app);
  }
  return handlerFn;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    const fn = await getHandler();
    const result = await fn(event, context);
    return result as Awaited<ReturnType<Handler>>;
  } catch (err) {
    console.error('API function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
