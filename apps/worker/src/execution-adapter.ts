import {
  DeterministicFakeCodeExecutionAdapter,
  type CodeExecutionPort
} from '@devleague/application';

export function createExecutionAdapter(
  environment: Readonly<Record<string, string | undefined>> = process.env
): CodeExecutionPort {
  if (environment.JUDGE_PROVIDER !== 'fake') {
    throw new Error('No production execution provider is configured.');
  }

  assertFakeJudgeIsLocal(environment);
  const fallback = environment.FAKE_JUDGE_DEFAULT === 'accepted' ? 'ACCEPTED' : 'SYSTEM_ERROR';
  return new DeterministicFakeCodeExecutionAdapter(new Map(), fallback);
}

export function assertFakeJudgeIsLocal(
  environment: Readonly<Record<string, string | undefined>>
): void {
  if (environment.NODE_ENV === 'production') {
    throw new Error('The fake judge is forbidden in production.');
  }
  if (environment.ALLOW_FAKE_JUDGE !== 'true') {
    throw new Error('ALLOW_FAKE_JUDGE=true is required to run the fake judge.');
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required by the execution worker.');

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '[::1]' && hostname !== '::1') {
    throw new Error('The fake judge can only use a loopback PostgreSQL database.');
  }
}
