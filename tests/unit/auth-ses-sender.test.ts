import { describe, it, expect, vi } from 'vitest';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { SesEmailSender } from '@/lib/auth/ses-sender';

// The SESv2Client is mocked — assert the SendEmailCommand the sender builds
// (from-address, recipient, subject, branded HTML/text bodies with the code).

function mockSesClient(): { client: SESv2Client; commands: SendEmailCommand[] } {
  const commands: SendEmailCommand[] = [];
  const send = vi.fn(async (cmd: SendEmailCommand) => {
    commands.push(cmd);
    return {};
  });
  return { client: { send } as unknown as SESv2Client, commands };
}

describe('SesEmailSender', () => {
  it('sends the OTP email with branded HTML and plain-text bodies', async () => {
    const { client, commands } = mockSesClient();
    const sender = new SesEmailSender(client, 'noreply@octavlearning.com');

    await sender.sendOtpEmail({ to: 'student@example.com', code: '654321', expiresInMinutes: 10 });

    expect(commands).toHaveLength(1);
    const input = commands[0].input;
    expect(input.FromEmailAddress).toBe('noreply@octavlearning.com');
    expect(input.Destination).toEqual({ ToAddresses: ['student@example.com'] });
    expect(input.Content?.Simple?.Subject?.Data).toContain('sign-in code');
    expect(input.Content?.Simple?.Body?.Html?.Data).toContain('654321');
    expect(input.Content?.Simple?.Body?.Html?.Data).toContain('OCTAV LEARNING');
    expect(input.Content?.Simple?.Body?.Html?.Data).toContain('expires in 10 minutes');
    expect(input.Content?.Simple?.Body?.Text?.Data).toContain('654321');
  });
});
