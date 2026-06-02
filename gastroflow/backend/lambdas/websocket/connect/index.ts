import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { verifyToken } from '../../../layers/auth/index';

const dynamo = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE || 'gastroflow-ws-connections';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const token = event.queryStringParameters?.token;

  if (!token) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    const payload = await verifyToken(token);
    const tenantId = payload['custom:tenantId'];
    const connectionId = event.requestContext.connectionId;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 7200; // TTL +2h

    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          tenantId: { S: tenantId },
          connectionId: { S: connectionId },
          connectedAt: { N: String(now) },
          expiresAt: { N: String(expiresAt) },
        },
      })
    );

    return { statusCode: 200, body: 'Connected' };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'WS connect error', error: String(err) }));
    return { statusCode: 401, body: 'Unauthorized' };
  }
};
