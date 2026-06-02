import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getDbClient } from '../../../layers/db/index';
import { broadcastToKDS } from '../../../layers/websocket/index';

type OrderStatus = 'new' | 'cooking' | 'ready' | 'delivered' | 'cancelled';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['cooking', 'cancelled'],
  cooking: ['ready', 'cancelled'],
  ready: ['delivered'],
  delivered: [],
  cancelled: [],
};

const UpdateStatusSchema = z.object({
  status: z.enum(['new', 'cooking', 'ready', 'delivered', 'cancelled']),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const orderId = event.pathParameters?.id;

  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'MISSING_ORDER_ID' }) };
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'INVALID_JSON' }) };
  }

  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'VALIDATION_ERROR', details: parsed.error.errors }),
    };
  }

  const { status: requestedStatus } = parsed.data;
  const client = await getDbClient(tenantId);

  try {
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
      [orderId, tenantId]
    );

    if (orderResult.rowCount === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'ORDER_NOT_FOUND' }) };
    }

    const order = orderResult.rows[0];
    const currentStatus = order.status as OrderStatus;
    const allowedNext = VALID_TRANSITIONS[currentStatus];

    if (!allowedNext.includes(requestedStatus as OrderStatus)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'INVALID_TRANSITION',
          message: `Transición de status inválida: ${currentStatus} → ${requestedStatus}`,
        }),
      };
    }

    const updated = await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [requestedStatus, orderId, tenantId]
    );

    const updatedOrder = updated.rows[0];
    await broadcastToKDS(tenantId, { type: 'UPDATE_ORDER', payload: updatedOrder });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedOrder),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error actualizando orden', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
