import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import {
  makeLearningJourneyEventItem,
  type LearningJourneyEventInput,
  type LearningJourneyEventItem,
  type LearningJourneyRange,
  type LearningJourneyStorage,
} from './journey';

function isConditionalFailure(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

export class DynamoLearningJourneyStorage implements LearningJourneyStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly clock: () => number = Date.now
  ) {}

  async recordJourneyEvent(event: LearningJourneyEventInput): Promise<boolean> {
    const item = makeLearningJourneyEventItem(event, this.clock());
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(userId)',
      }));
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  async listJourneyEventsByUser(
    userId: string,
    range?: LearningJourneyRange
  ): Promise<LearningJourneyEventItem[]> {
    const items: LearningJourneyEventItem[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const response = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: range
          ? 'userId = :userId AND eventKey BETWEEN :from AND :to'
          : 'userId = :userId',
        ExpressionAttributeValues: range
          ? { ':userId': userId, ':from': range.from, ':to': range.to }
          : { ':userId': userId },
        ConsistentRead: true,
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      }));
      items.push(...((response.Items ?? []) as LearningJourneyEventItem[]));
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }

  async probeJourneyStorage(): Promise<void> {
    await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :probe',
      ExpressionAttributeValues: { ':probe': '__health_probe_nonexistent__' },
      Limit: 1,
    }));
  }

  async deleteJourneyEventsByUser(userId: string): Promise<void> {
    const items = await this.listJourneyEventsByUser(userId);
    for (const item of items) {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { userId: item.userId, eventKey: item.eventKey },
      }));
    }
  }
}
