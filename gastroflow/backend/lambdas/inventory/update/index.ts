import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getDbClient } from '../../../layers/db/index';

const UpdateInventorySchema = z
  .object({
    quantity: z.number().nonnegative().optional(),
    delta: z.number().optional(),
  })
  .refine((d) => d.quantity !== undefined || d.delta !== undefined, {
    message: 'Se requiere quantity o delta',
  });

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const itemId = event.pathParameters?.id;

  if (!itemId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'MISSING_ITEM_ID' }) };
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'INVALID_JSON' }) };
  }

  const parsed = UpdateInventorySchema.safeParse(body);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'VALIDATION_ERROR', details: parsed.error.errors }),
    };
  }

  const { quantity, delta } = parsed.data;
  const client = await getDbClient(tenantId);

  try {
    let result;
    if (quantity !== undefined) {
      result = await client.query(
        `UPDATE inventory_items SET quantity = $1, updated_at = now()
         WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        [quantity, itemId, tenantId]
      );
    } else {
      result = await client.query(
        `UPDATE inventory_items SET quantity = GREATEST(0, quantity + $1), updated_at = now()
         WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        [delta, itemId, tenantId]
      );
    }

    if (result.rowCount === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'ITEM_NOT_FOUND' }) };
    }

    const item = result.rows[0];
    const response: Record<string, unknown> = { ...item };

    if (parseFloat(item.quantity) < parseFloat(item.min_quantity)) {
      response.alert = true;
      response.message = `Stock bajo para: ${item.name}`;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error actualizando inventario', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
