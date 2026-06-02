import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDbClient } from '../../../layers/db/index';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const date = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];

  const client = await getDbClient(tenantId);

  try {
    const result = await client.query(
      `WITH day_orders AS (
        SELECT * FROM orders
        WHERE tenant_id = $1
          AND created_at::date = $2::date
          AND status != 'cancelled'
      ),
      summary AS (
        SELECT
          COALESCE(SUM(total), 0)::float AS total_revenue,
          COUNT(*)::int AS total_orders,
          CASE WHEN COUNT(*) > 0 THEN (SUM(total) / COUNT(*))::float ELSE 0 END AS avg_ticket
        FROM day_orders
      ),
      top_products AS (
        SELECT
          item->>'name' AS name,
          SUM((item->>'quantity')::int) AS count,
          SUM((item->>'price')::numeric * (item->>'quantity')::int) AS revenue
        FROM day_orders, jsonb_array_elements(items) AS item
        GROUP BY item->>'name'
        ORDER BY count DESC
        LIMIT 10
      ),
      hourly AS (
        SELECT
          EXTRACT(HOUR FROM created_at)::int AS hour,
          COALESCE(SUM(total), 0)::float AS revenue
        FROM day_orders
        GROUP BY hour
        ORDER BY hour
      ),
      status_breakdown AS (
        SELECT status, COUNT(*)::int AS cnt
        FROM orders
        WHERE tenant_id = $1 AND created_at::date = $2::date
        GROUP BY status
      )
      SELECT
        (SELECT row_to_json(summary) FROM summary) AS summary,
        (SELECT json_agg(top_products) FROM top_products) AS top_products,
        (SELECT json_agg(hourly) FROM hourly) AS hourly_revenue,
        (SELECT json_object_agg(status, cnt) FROM status_breakdown) AS status_breakdown`,
      [tenantId, date]
    );

    const row = result.rows[0];
    const summary = row.summary || { total_revenue: 0, total_orders: 0, avg_ticket: 0 };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        totalRevenue: summary.total_revenue,
        totalOrders: summary.total_orders,
        avgTicket: summary.avg_ticket,
        topProducts: row.top_products || [],
        hourlyRevenue: row.hourly_revenue || [],
        statusBreakdown: row.status_breakdown || {},
      }),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error en analytics diario', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
