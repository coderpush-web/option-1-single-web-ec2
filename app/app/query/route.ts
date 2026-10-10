import postgres from 'postgres';

function getSqlClient() {
  if (!process.env.POSTGRES_URL) return null;
  return postgres(process.env.POSTGRES_URL, { ssl: 'require' });
}

async function listInvoices(sql: any) {
  const data = await sql`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;

  return data;
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      { message: 'Query endpoint is disabled in production' },
      { status: 403 }
    );
  }

  const sql = getSqlClient();
  if (!sql) {
    return Response.json(
      { message: 'Database connection not configured in stateless mode' },
      { status: 503 }
    );
  }

  try {
    return Response.json(await listInvoices(sql));
  } catch (error) {
    console.error('Database query error:', error);
    return Response.json({ message: 'Failed to query database' }, { status: 500 });
  }
}
