import { describe, expect, it } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoLearningJourneyStorage } from '@/lib/analytics/journey-dynamodb';
import type { LearningJourneyEventInput } from '@/lib/analytics/journey';

const NOW = Date.parse('2026-11-27T12:00:00.000Z');

interface CommandLike {
  constructor: { name: string };
  input: Record<string, unknown>;
}

function client(handler: (command: CommandLike) => unknown): DynamoDBDocumentClient {
  return { send: async (command: unknown) => handler(command as CommandLike) } as unknown as DynamoDBDocumentClient;
}

function input(overrides: Partial<LearningJourneyEventInput> = {}): LearningJourneyEventInput {
  return {
    userId: 'user-1',
    profileId: 'profile-1',
    eventId: '11111111-1111-4111-8111-111111111111',
    name: 'quiz_completed',
    props: { subjectId: 'math', topicId: 'algebra', attemptId: 'attempt-1', correctCount: 3, totalCount: 4 },
    urlPath: '/subjects/math/algebra/quiz',
    host: 'octavlearning.com',
    sessionId: 'session-1',
    occurredAt: '2026-11-26T10:00:00.000Z',
    test: false,
    ...overrides,
  };
}

describe('DynamoLearningJourneyStorage', () => {
  it('conditionally puts only the minimized item with server timestamps and TTL', async () => {
    const calls: CommandLike[] = [];
    const storage = new DynamoLearningJourneyStorage(client((command) => {
      calls.push(command);
      return {};
    }), 'octav-learning-journey-events', () => NOW);

    expect(await storage.recordJourneyEvent(input())).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].constructor.name).toBe('PutCommand');
    expect(calls[0].input).toMatchObject({
      TableName: 'octav-learning-journey-events',
      ConditionExpression: 'attribute_not_exists(userId)',
      Item: {
        userId: 'user-1',
        profileId: 'profile-1',
        eventKey: '2026-11-26T10:00:00.000Z#11111111-1111-4111-8111-111111111111',
        eventId: '11111111-1111-4111-8111-111111111111',
        receivedAt: '2026-11-27T12:00:00.000Z',
        schemaVersion: 1,
        expiresAt: Math.floor(NOW / 1000) + 90 * 86_400,
      },
    });
    const stored = calls[0].input.Item as Record<string, unknown>;
    for (const forbidden of ['email', 'ip', 'referrer', 'ua', 'textAnswer', 'helpResponse']) {
      expect(stored).not.toHaveProperty(forbidden);
    }
  });

  it('returns false for a duplicate and rethrows real database errors', async () => {
    const duplicate = new DynamoLearningJourneyStorage(client(() => {
      const error = new Error('duplicate');
      error.name = 'ConditionalCheckFailedException';
      throw error;
    }), 'journey');
    expect(await duplicate.recordJourneyEvent(input())).toBe(false);

    const broken = new DynamoLearningJourneyStorage(client(() => {
      throw new Error('AccessDeniedException');
    }), 'journey');
    await expect(broken.recordJourneyEvent(input())).rejects.toThrow('AccessDeniedException');
  });

  it('queries a user time range consistently and follows every page', async () => {
    const queries: CommandLike[] = [];
    const storage = new DynamoLearningJourneyStorage(client((command) => {
      queries.push(command);
      if (queries.length === 1) {
        return { Items: [{ userId: 'user-1', eventKey: 'a' }], LastEvaluatedKey: { userId: 'user-1', eventKey: 'a' } };
      }
      return { Items: [{ userId: 'user-1', eventKey: 'b' }] };
    }), 'journey');

    const items = await storage.listJourneyEventsByUser('user-1', { from: 'a', to: 'z' });
    expect(items.map((item) => item.eventKey)).toEqual(['a', 'b']);
    expect(queries).toHaveLength(2);
    expect(queries[0].input).toMatchObject({
      TableName: 'journey',
      KeyConditionExpression: 'userId = :userId AND eventKey BETWEEN :from AND :to',
      ExpressionAttributeValues: { ':userId': 'user-1', ':from': 'a', ':to': 'z' },
      ConsistentRead: true,
    });
    expect(queries[1].input.ExclusiveStartKey).toEqual({ userId: 'user-1', eventKey: 'a' });
  });

  it('deletes every key returned by the authoritative user query', async () => {
    const calls: CommandLike[] = [];
    const storage = new DynamoLearningJourneyStorage(client((command) => {
      calls.push(command);
      if (command.constructor.name === 'QueryCommand') {
        return { Items: [
          { userId: 'user-1', eventKey: 'a' },
          { userId: 'user-1', eventKey: 'b' },
        ] };
      }
      return {};
    }), 'journey');

    await storage.deleteJourneyEventsByUser('user-1');
    expect(calls.map((call) => call.constructor.name)).toEqual(['QueryCommand', 'DeleteCommand', 'DeleteCommand']);
    expect(calls.slice(1).map((call) => call.input.Key)).toEqual([
      { userId: 'user-1', eventKey: 'a' },
      { userId: 'user-1', eventKey: 'b' },
    ]);
  });

  it('health-probes the journey table with a bounded query', async () => {
    const calls: CommandLike[] = [];
    const storage = new DynamoLearningJourneyStorage(client((command) => {
      calls.push(command);
      return {};
    }), 'journey');
    await storage.probeJourneyStorage();
    expect(calls[0].input).toEqual({
      TableName: 'journey',
      KeyConditionExpression: 'userId = :probe',
      ExpressionAttributeValues: { ':probe': '__health_probe_nonexistent__' },
      Limit: 1,
    });
  });
});
