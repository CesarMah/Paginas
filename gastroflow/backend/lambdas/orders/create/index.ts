import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { getDbClient } from '../../../layers/db/index';
import { broadcastToKDS } from '../../../layers/websocket/index';

const sns = new SNSClient({});

const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        name: z.string(),
        price: z.number().positive(),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1),
  tableNumber: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
  customerEmail: z.string().email().optional(),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;

  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'INVALID_JSON' }) };
  }

  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'VALIDATION_ERROR', details: parsed.error.errors }),
    };
  }

  const { items, tableNumber, notes, customerEmail } = parsed.data;
  const client = await getDbClient(tenantId);

  try {
    const menuIds = items.map((i) => i.menuItemId);
    const menuCheck = await client.query(
      `SELECT id FROM menu_items WHERE id = ANY($1::uuid[]) AND tenant_id = $2 AND available = true`,
      [menuIds, tenantId]
    );

    if (menuCheck.rowCount !== menuIds.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'INVALID_MENU_ITEMS', details: 'Uno o más ítems no existen o no están disponibles' }),
      };
    }

    const result = await client.query(
      `INSERT INTO orders (tenant_id, items, table_number, notes, customer_email)
       VALUES ($1, $2::jsonb, $3, $4, $5)
       RETURNING *`,
      [tenantId, JSON.stringify(items), tableNumber ?? null, notes ?? null, customerEmail ?? null]
    );

    const order = result.rows[0];

    await Promise.all([
      sns.send(
        new PublishCommand({
          TopicArn: process.env.SNS_TOPIC_ARN,
          Message: JSON.stringify(order),
          Subject: 'new-order',
        })
      ),
      broadcastToKDS(tenantId, { type: 'NEW_ORDER', payload: order }),
    ]);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error creando orden', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
