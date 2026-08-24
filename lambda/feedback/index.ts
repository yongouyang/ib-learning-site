import { handleFeedbackGet, handleFeedbackPost } from '../../src/lib/feedback/http-handler';
import {
  toLambdaResult,
  toWebRequest,
  type FunctionUrlEvent,
  type LambdaHttpResult,
} from '../shared/lambda-adapter';

// Production feedback Lambda (docs/aws-deployment-plan.md §5). Thin adapter
// between the Lambda Function URL event shape (HTTP API v2 format) and the
// shared handler in src/lib/feedback/http-handler.ts — same validation and
// contract as the Next route, which remains the dev/e2e path.
//
// Phase E2: the handler now authenticates (shared resolveSession) and reads/
// writes the monthly AI-mark quota, so this function has DynamoDB wiring
// (users/sessions GetItem, sessions Update/Delete, rate-limits Get/Update —
// terraform/modules/feedback_api). Event/request plumbing is shared with the
// auth/progress adapters (lambda/shared/lambda-adapter.ts): method body-gating
// and the cookies-array Set-Cookie conversion (the handler re-issues the
// session cookie on every authenticated call).

export const handler = async (event: FunctionUrlEvent): Promise<LambdaHttpResult> => {
  const { url, method, headers, body } = toWebRequest(event);

  let response: Response;
  try {
    if (method === 'GET') {
      response = await handleFeedbackGet(new Request(url, { method, headers }));
    } else if (method === 'POST') {
      response = await handleFeedbackPost(new Request(url, { method, headers, body }));
    } else {
      response = Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
  } catch (err) {
    console.error('[feedback] handler error:', err instanceof Error ? err.message : err);
    response = Response.json({ error: 'Internal error' }, { status: 500 });
  }

  return toLambdaResult(response);
};
