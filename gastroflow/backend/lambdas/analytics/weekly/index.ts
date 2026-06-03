import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDbClient } from '../../../layers/db/index';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const params   = event.queryStringParameters ?? {};

  const today    = new Date().toISOString().split('T')[0];
  const endDate  = params.endDate   || today;
  // Si viene startDate úsalo; si no, 6 días antes del endDate (7 días total)
  const startDate = params.startDate
    || new Date(new Date(endDate).getTime() - 6 * 86400000).toISOString().split('T')[0];

  const client = await getDbClient(tenantId);

  try {
    // ── Ventas por día en el rango ──────────────────────────────────────────
    const dailyResult = await client.query(
      `SELECT
         created_at::date        AS date,
         COALESCE(SUM(total), 0)::float AS revenue,
         COUNT(*)::int           AS orders
       FROM orders
       WHERE tenant_id  = $1
         AND created_at::date BETWEEN $2::date AND $3::date
         AND status != 'cancelled'
       GROUP BY created_at::date
       ORDER BY date`,
      [tenantId, startDate, endDate]
    );

    // ── Resumen del período ─────────────────────────────────────────────────
    const summaryResult = await client.query(
      `WITH period AS (
         SELECT * FROM orders
         WHERE tenant_id = $1
           AND created_at::date BETWEEN $2::date AND $3::date
       )
       SELECT
         COALESCE(SUM(total) FILTER (WHERE status != 'cancelled'), 0)::float AS total_revenue,
         COUNT(*) FILTER (WHERE status != 'cancelled')::int                  AS total_orders,
         COUNT(*) FILTER (WHERE status  = 'cancelled')::int                  AS cancelled_orders,
         CASE WHEN COUNT(*) FILTER (WHERE status != 'cancelled') > 0
              THEN (SUM(total) FILTER (WHERE status != 'cancelled') /
                    COUNT(*) FILTER (WHERE status != 'cancelled'))::float
              ELSE 0 END AS avg_ticket
       FROM period`,
      [tenantId, startDate, endDate]
    );

    // ── Top productos del período ───────────────────────────────────────────
    const topResult = await client.query(
      `SELECT
         item->>'name'                                      AS name,
         SUM((item->>'quantity')::int)::int                 AS count,
         SUM((item->>'price')::numeric * (item->>'quantity')::int)::float AS revenue
       FROM orders,
            jsonb_array_elements(items) AS item
       WHERE tenant_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date
         AND status != 'cancelled'
       GROUP BY item->>'name'
       ORDER BY count DESC
       LIMIT 10`,
      [tenantId, startDate, endDate]
    );

    // ── Desglose por estado ─────────────────────────────────────────────────
    const statusResult = await client.query(
      `SELECT status, COUNT(*)::int AS count
       FROM orders
       WHERE tenant_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date
       GROUP BY status`,
      [tenantId, startDate, endDate]
    );

    const statusBreakdown = statusResult.rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = r.count;
      return acc;
    }, {});

    const summary = summaryResult.rows[0];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate,
        endDate,
        dailyData:      dailyResult.rows,
        totalRevenue:   summary.total_revenue,
        totalOrders:    summary.total_orders,
        cancelledOrders: summary.cancelled_orders,
        avgTicket:      summary.avg_ticket,
        topProducts:    topResult.rows,
        statusBreakdown,
      }),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error en analytics por rango', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
