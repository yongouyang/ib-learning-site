import { handleContentGet } from '../../src/lib/content/http-handler';
import {
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production content Lambda (Phase 1b, docs/premium-content-protection-plan.md §4): a thin adapter
// between the Lambda Function URL event shape (HTTP API v2) and the shared handler in
// src/lib/content/http-handler.ts — the same contract as the Next catch-all route, which remains the
// dev/e2e path. CloudFront routes /api/content/premium/* (never cached), /api/content/public/*
// (edge-cached) and /api/content/* to this function; the premium route is a real gate (resolved
// session + exam-sets-full), which is why this function carries the users/sessions grants.
//
// The topic and paper content is BUNDLED into this function at build time (esbuild), so a content
// deploy ships atomically with the code that serves it, there is no CONTENT_TABLE, and the IAM grant
// set is the smallest in the repo. terraform/modules/content_api wires CONTENT_STORAGE=dynamodb plus
// the three shared table names.

export const handler = async (event: FunctionUrlEvent): Promise<LambdaHttpResult> => {
  const { url, method, headers } = toWebRequest(event);

  let response: Response;
  if (method !== 'GET') {
    response = Response.json({ error: 'Method not allowed' }, { status: 405 });
  } else {
    try {
      response = await handleContentGet(new Request(url, { method, headers }));
    } catch (err) {
      console.error('[content] handler error:', err instanceof Error ? err.message : err);
      response = Response.json({ error: 'Internal error' }, { status: 500 });
    }
  }

  return toLambdaResult(response);
};
