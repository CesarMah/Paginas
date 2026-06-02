import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE || 'gastroflow-ws-connections';

export async function broadcastToKDS(tenantId: string, message: object): Promise<void> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'tenantId = :t',
      ExpressionAttributeValues: { ':t': { S: tenantId } },
      ProjectionExpression: 'connectionId',
    })
  );

  const connections = result.Items || [];
  if (connections.length === 0) return;

  const wsEndpoint = process.env.WS_ENDPOINT!;
  const apigw = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });
  const data = Buffer.from(JSON.stringify(message));

  await Promise.all(
    connections.map(async (item) => {
      const connectionId = item.connectionId.S!;
      try {
        await apigw.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }));
      } catch (err) {
        if (err instanceof GoneException) {
          await dynamo.send(
            new DeleteItemCommand({
              TableName: TABLE,
              Key: { tenantId: { S: tenantId }, connectionId: { S: connectionId } },
            })
          );
        } else {
          console.log(JSON.stringify({ level: 'warn', message: 'WS send error', connectionId, error: String(err) }));
        }
      }
    })
  );
}
