import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDbClient } from '../../../layers/db/index';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const endDate = event.queryStringParameters?.endDate || new Date().toISOString().split('T')[0];

  const client = await getDbClient(tenantId);

  try {
    const result = await client.query(
      `SELECT
        created_at::date AS date,
        COALESCE(SUM(total), 0)::float AS revenue,
        COUNT(*)::int AS orders
       FROM orders
       WHERE tenant_id = $1
         AND created_at::date BETWEEN ($2::date - INTERVAL '6 days') AND $2::date
         AND status != 'cancelled'
       GROUP BY created_at::date
       ORDER BY date`,
      [tenantId, endDate]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endDate, dailyData: result.rows }),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error en analytics semanal', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
