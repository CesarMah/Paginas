import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDbClient } from '../../../layers/db/index';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const { status, date, limit: limitStr, cursor } = event.queryStringParameters || {};

  const limit = Math.min(parseInt(limitStr || '50', 10), 200);
  const client = await getDbClient(tenantId);

  try {
    const conditions: string[] = ['o.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (status) {
      conditions.push(`o.status = $${idx++}`);
      params.push(status);
    }
    if (date) {
      conditions.push(`o.created_at::date = $${idx++}`);
      params.push(date);
    }
    if (cursor) {
      conditions.push(`o.id > $${idx++}`);
      params.push(cursor);
    }

    const where = conditions.join(' AND ');

    const [ordersResult, countResult] = await Promise.all([
      client.query(
        `SELECT * FROM orders o WHERE ${where} ORDER BY o.created_at DESC LIMIT $${idx}`,
        [...params, limit]
      ),
      client.query(`SELECT COUNT(*) FROM orders o WHERE ${where}`, params),
    ]);

    const orders = ordersResult.rows;
    const total = parseInt(countResult.rows[0].count, 10);
    const nextCursor = orders.length === limit ? orders[orders.length - 1].id : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders, nextCursor, total }),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error listando órdenes', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
