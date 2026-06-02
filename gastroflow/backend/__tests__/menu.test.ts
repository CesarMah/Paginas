import { handler as listHandler } from '../lambdas/menu/list/index';
import { handler as upsertHandler } from '../lambdas/menu/upsert/index';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

jest.mock('../layers/db/index', () => ({
  getDbClient: jest.fn(),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.s3.example.com/upload'),
}));

import { getDbClient } from '../layers/db/index';

const mockGetDbClient = getDbClient as jest.MockedFunction<typeof getDbClient>;

function makeEvent(body: unknown, pathParams: Record<string, string> = {}): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    body: JSON.stringify(body),
    pathParameters: pathParams,
    requestContext: {
      authorizer: {
        jwt: { claims: { 'custom:tenantId': 'tenant-abc' } },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

const mockItem = { id: 'item-1', tenant_id: 'tenant-abc', name: 'Taco', price: 25, available: true, sort_order: 0, category: 'Tacos', created_at: '', updated_at: '' };

describe('menu/list', () => {
  it('devuelve ítems filtrados por tenant', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [mockItem] }),
      release: jest.fn(),
    };
    mockGetDbClient.mockResolvedValue(mockClient as unknown as ReturnType<typeof getDbClient> extends Promise<infer T> ? T : never);

    const res = await listHandler(makeEvent({}));
    expect((res as { statusCode: number }).statusCode).toBe(200);
    const body = JSON.parse((res as { body: string }).body);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Taco');
  });
});

describe('menu/upsert', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crea un ítem nuevo', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [mockItem] }),
      release: jest.fn(),
    };
    mockGetDbClient.mockResolvedValue(mockClient as unknown as ReturnType<typeof getDbClient> extends Promise<infer T> ? T : never);

    const res = await upsertHandler(makeEvent({ name: 'Taco', price: 25 }));
    expect((res as { statusCode: number }).statusCode).toBe(201);
  });

  it('actualiza un ítem existente', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ ...mockItem, name: 'Burrito' }] }),
      release: jest.fn(),
    };
    mockGetDbClient.mockResolvedValue(mockClient as unknown as ReturnType<typeof getDbClient> extends Promise<infer T> ? T : never);

    const res = await upsertHandler(makeEvent({ name: 'Burrito', price: 30 }, { id: 'item-1' }));
    expect((res as { statusCode: number }).statusCode).toBe(200);
    const body = JSON.parse((res as { body: string }).body);
    expect(body.name).toBe('Burrito');
  });

  it('genera pre-signed URL si hasImage es true', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [mockItem] })
        .mockResolvedValueOnce({ rows: [] }), // image_key update
      release: jest.fn(),
    };
    mockGetDbClient.mockResolvedValue(mockClient as unknown as ReturnType<typeof getDbClient> extends Promise<infer T> ? T : never);

    const res = await upsertHandler(makeEvent({ name: 'Taco', price: 25, hasImage: true }));
    expect((res as { statusCode: number }).statusCode).toBe(201);
    const body = JSON.parse((res as { body: string }).body);
    expect(body.uploadUrl).toBe('https://presigned.s3.example.com/upload');
  });
});
