import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDbClient } from '../../../layers/db/index';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const client = await getDbClient(tenantId);

  try {
    const result = await client.query(
      `SELECT * FROM menu_items WHERE tenant_id = $1 ORDER BY category ASC, sort_order ASC`,
      [tenantId]
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
      },
      body: JSON.stringify(result.rows),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error listando menú', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
