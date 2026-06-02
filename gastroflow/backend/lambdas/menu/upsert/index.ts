import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDbClient } from '../../../layers/db/index';

const s3 = new S3Client({});

const MenuItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().nonnegative(),
  category: z.string().max(100).optional(),
  available: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  hasImage: z.boolean().optional(),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'] as string;
  const itemId = event.pathParameters?.id;
  const isUpdate = !!itemId;

  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'INVALID_JSON' }) };
  }

  const parsed = MenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'VALIDATION_ERROR', details: parsed.error.errors }),
    };
  }

  const { name, description, price, category, available, sortOrder, hasImage } = parsed.data;
  const client = await getDbClient(tenantId);

  try {
    let result;

    if (isUpdate) {
      result = await client.query(
        `UPDATE menu_items SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          price = COALESCE($3, price),
          category = COALESCE($4, category),
          available = COALESCE($5, available),
          sort_order = COALESCE($6, sort_order),
          updated_at = now()
         WHERE id = $7 AND tenant_id = $8
         RETURNING *`,
        [name, description, price, category, available, sortOrder, itemId, tenantId]
      );

      if (result.rowCount === 0) {
        return { statusCode: 404, body: JSON.stringify({ error: 'ITEM_NOT_FOUND' }) };
      }
    } else {
      result = await client.query(
        `INSERT INTO menu_items (tenant_id, name, description, price, category, available, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [tenantId, name, description ?? null, price, category ?? null, available ?? true, sortOrder ?? 0]
      );
    }

    const item = result.rows[0];
    const response: Record<string, unknown> = { ...item };

    if (hasImage) {
      const key = `${tenantId}/menu/${item.id}.webp`;
      const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.MEDIA_BUCKET,
          Key: key,
          ContentType: 'image/webp',
        }),
        { expiresIn: 900 } // 15 minutes
      );
      response.uploadUrl = uploadUrl;
      await client.query('UPDATE menu_items SET image_key = $1 WHERE id = $2', [key, item.id]);
    }

    return {
      statusCode: isUpdate ? 200 : 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', message: 'Error en upsert menú', error: String(err) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  } finally {
    client.release();
  }
};
