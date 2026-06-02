import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, QueryCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE || 'gastroflow-ws-connections';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;

  // Find the tenantId for this connectionId via a scan on GSI (or query all tenants)
  // Decision: store a reverse index by connectionId using a GSI in the CDK stack.
  // Here we query using a GSI named 'connectionId-index'.
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'connectionId-index',
      KeyConditionExpression: 'connectionId = :c',
      ExpressionAttributeValues: { ':c': { S: connectionId } },
      ProjectionExpression: 'tenantId, connectionId',
    })
  );

  if (result.Items && result.Items.length > 0) {
    const item = result.Items[0];
    await dynamo.send(
      new DeleteItemCommand({
        TableName: TABLE,
        Key: {
          tenantId: item.tenantId,
          connectionId: item.connectionId,
        },
      })
    );
  }

  return { statusCode: 200, body: 'Disconnected' };
};
