import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDbClient } from '../../../layers/db/index';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const client = await getDbClient(tenantId);

  try {
    const result = await client.query(
      `SELECT * FROM inventory_items WHERE tenant_id = $1 ORDER BY name ASC`,
      [tenantId]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.rows),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error listando inventario', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
