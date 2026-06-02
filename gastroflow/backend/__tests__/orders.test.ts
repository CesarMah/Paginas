import { handler as createHandler } from '../lambdas/orders/create/index';
import { handler as updateHandler } from '../lambdas/orders/update-status/index';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

// Mock layers
jest.mock('../layers/db/index', () => ({
  getDbClient: jest.fn(),
}));
jest.mock('../layers/websocket/index', () => ({
  broadcastToKDS: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  PublishCommand: jest.fn(),
}));

import { getDbClient } from '../layers/db/index';

const mockGetDbClient = getDbClient as jest.MockedFunction<typeof getDbClient>;

function makeEvent(body: unknown, pathParams: Record<string, string> = {}, claims: Record<string, string> = {}): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    body: JSON.stringify(body),
    pathParameters: pathParams,
    queryStringParameters: {},
    requestContext: {
      authorizer: {
        jwt: {
          claims: { 'custom:tenantId': 'tenant-123', 'custom:role': 'owner', ...claims },
        },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

const validItems = [
  { menuItemId: '00000000-0000-0000-0000-000000000001', name: 'Taco', price: 25, quantity: 2 },
];

describe('orders/create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crea una orden válida y responde 201', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // menu check
        .mockResolvedValueOnce({ rows: [{ id: 'order-1', items: validItems, total: 50, status: 'new', created_at: new Date().toISOString() }] }),
      release: jest.fn(),
    };
    mockGetDbClient.mockResolvedValue(mockClient as unknown as ReturnType<typeof getDbClient> extends Promise<infer T> ? T : never);

    const res = await createHandler(makeEvent({ items: validItems }));
    expect((res as { statusCode: number }).statusCode).toBe(201);
  });

  it('responde 400 si el body es inválido', async () => {
    const res = await createHandler(makeEvent({ items: [] }));
    expect((res as { statusCode: number }).statusCode).toBe(400);
  });

  it('responde 400 si no hay items', async () => {
    const res = await createHandler(makeEvent({}));
    expect((res as { statusCode: number }).statusCode).toBe(400);
  });
});

describe('orders/update-status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('transición válida new → cooking', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'order-1', status: 'new', tenant_id: 'tenant-123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'order-1', status: 'cooking' }] }),
      release: jest.fn(),
    };
    mockGetDbClient.mockResolvedValue(mockClient as unknown as ReturnType<typeof getDbClient> extends Promise<infer T> ? T : never);

    const res = await updateHandler(makeEvent({ status: 'cooking' }, { id: 'order-1' }));
    expect((res as { statusCode: number }).statusCode).toBe(200);
  });

  it('transición inválida responde 400', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'order-1', status: 'new' }] }),
      release: jest.fn(),
    };
    mockGetDbClient.mockResolvedValue(mockClient as unknown as ReturnType<typeof getDbClient> extends Promise<infer T> ? T : never);

    const res = await updateHandler(makeEvent({ status: 'delivered' }, { id: 'order-1' }));
    expect((res as { statusCode: number }).statusCode).toBe(400);
    expect(JSON.parse((res as { body: string }).body).message).toMatch(/inválida/);
  });

  it('intento de modificar orden delivered responde 400', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'order-1', status: 'delivered' }] }),
      release: jest.fn(),
    };
    mockGetDbClient.mockResolvedValue(mockClient as unknown as ReturnType<typeof getDbClient> extends Promise<infer T> ? T : never);

    const res = await updateHandler(makeEvent({ status: 'cancelled' }, { id: 'order-1' }));
    expect((res as { statusCode: number }).statusCode).toBe(400);
  });
});
