// Accounts feature (Phase B) — public surface for the auth library.
export { getAuthDeps } from './deps';
export { InMemoryAuthStorage, DummyEmailSender } from './dummy';
export { DynamoAuthStorage } from './dynamodb-storage';
export { SesEmailSender } from './ses-sender';
export {
  handleRequestOtp,
  handleVerifyOtp,
  handleLogout,
  handleMe,
  handleAccountPost,
  handleSessionsGet,
  handleRevokeSession,
  handleExportGet,
  handleDeleteAccount,
} from './http-handler';
export {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_REQUESTS_PER_EMAIL_PER_WINDOW,
  OTP_REQUESTS_PER_IP_PER_WINDOW,
  RATE_WINDOW_MS,
} from './types';
export type {
  AuthDeps,
  AuthStorage,
  EmailSender,
  UserRecord,
  SessionRecord,
  OtpRecord,
  ChildProfile,
  Stage,
  PublicUser,
} from './types';
