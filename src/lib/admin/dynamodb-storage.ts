import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { DescribeTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import type { AdminScanResult, AdminStorage, AdminTableDescription } from './types';
import { ADMIN_SCAN_LIMIT_DEFAULT } from './types';

// DynamoDB-backed admin CRUD storage (Feature 2). Thin passthrough to the AWS
// SDK DocumentClient (which marshals/unmarshals native JS values) — the
// handler validates table names + operation shape, this adapter only executes.
// IAM is scoped in terraform/modules/admin_api to the octav-* tables.

export class DynamoAdminStorage implements AdminStorage {
  constructor(private readonly client: DynamoDBDocumentClient) {}

  async listTables(): Promise<string[]> {
    const out = await this.client.send(new ListTablesCommand({}));
    return out.TableNames ?? [];
  }

  async describeTable(table: string): Promise<AdminTableDescription> {
    // DescribeTable is issued via the CLIENT (not DocumentClient) command —
    // the response's KeySchema is already plain typed data.
    const out = await this.client.send(new DescribeTableCommand({ TableName: table }));
    return {
      table,
      keySchema: (out.Table?.KeySchema ?? []).map((el) => ({
        attributeName: el.AttributeName as string,
        keyType: el.KeyType as 'HASH' | 'RANGE',
      })),
    };
  }

  async scan(
    table: string,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<AdminScanResult> {
    const out = await this.client.send(
      new ScanCommand({
        TableName: table,
        Limit: limit ?? ADMIN_SCAN_LIMIT_DEFAULT,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      })
    );
    return {
      items: out.Items ?? [],
      count: out.Count ?? 0,
      lastEvaluatedKey: out.LastEvaluatedKey,
    };
  }

  async query(
    table: string,
    keyConditionExpression: string,
    expressionValues: Record<string, unknown>,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<AdminScanResult> {
    const out = await this.client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionValues,
        Limit: limit ?? ADMIN_SCAN_LIMIT_DEFAULT,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      })
    );
    return {
      items: out.Items ?? [],
      count: out.Count ?? 0,
      lastEvaluatedKey: out.LastEvaluatedKey,
    };
  }

  async get(table: string, key: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const out = await this.client.send(new GetCommand({ TableName: table, Key: key }));
    return out.Item ?? null;
  }

  async put(table: string, item: Record<string, unknown>): Promise<void> {
    await this.client.send(new PutCommand({ TableName: table, Item: item }));
  }

  async update(
    table: string,
    key: Record<string, unknown>,
    updateExpression: string,
    expressionValues: Record<string, unknown>
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: table,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'NONE',
      })
    );
  }

  async delete(table: string, key: Record<string, unknown>): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: table, Key: key }));
  }

  async probe(): Promise<void> {
    // Exercises the ListTables IAM grant — the real failure class (missing
    // permission / wrong region) surfaces as an exception → 500.
    await this.client.send(new ListTablesCommand({}));
  }
}
