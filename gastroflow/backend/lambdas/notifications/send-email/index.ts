import { SNSEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@gastroflow.mx';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  table_number?: string;
  notes?: string;
  customer_email?: string;
  created_at: string;
}

function buildEmailHtml(order: Order): string {
  const itemRows = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Confirmación de pedido</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#f97316;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;">GastroFlow</h1>
    <p style="color:white;margin:5px 0 0;">Confirmación de tu pedido</p>
  </div>
  <div style="background:white;padding:20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
    <p>¡Gracias por tu pedido! Aquí está el resumen:</p>
    <p><strong>Número de orden:</strong> ${order.id.slice(0, 8).toUpperCase()}</p>
    ${order.table_number ? `<p><strong>Mesa:</strong> ${order.table_number}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead>
        <tr style="background:#f8f8f8;">
          <th style="padding:8px;text-align:left;">Producto</th>
          <th style="padding:8px;text-align:center;">Cant.</th>
          <th style="padding:8px;text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:8px;font-weight:bold;text-align:right;">Total:</td>
          <td style="padding:8px;font-weight:bold;text-align:right;">$${Number(order.total).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
    <p style="color:#888;font-size:12px;margin-top:30px;">Este correo fue generado automáticamente por GastroFlow.</p>
  </div>
</body>
</html>`;
}

export const handler = async (event: SNSEvent): Promise<void> => {
  for (const record of event.Records) {
    let order: Order;
    try {
      order = JSON.parse(record.Sns.Message) as Order;
    } catch {
      console.log(JSON.stringify({ level: 'warn', message: 'SNS message parse error' }));
      continue;
    }

    if (!order.customer_email) continue;

    try {
      await ses.send(
        new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: { ToAddresses: [order.customer_email] },
          Message: {
            Subject: { Data: `Tu pedido en GastroFlow — ${order.id.slice(0, 8).toUpperCase()}` },
            Body: {
              Html: { Data: buildEmailHtml(order) },
            },
          },
        })
      );
      console.log(JSON.stringify({ level: 'info', message: 'Email enviado', orderId: order.id, email: order.customer_email }));
    } catch (err) {
      console.log(JSON.stringify({ level: 'error', message: 'Error enviando email', error: String(err) }));
    }
  }
};
