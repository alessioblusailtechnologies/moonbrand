import pg from 'pg';

// Il DB di moonbrand (Postgres su Supabase). È del worker: gli script dei job, e quindi Claude, non ne ricevono l'indirizzo.
export function createPool(connections: number): pg.Pool {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) throw new Error('Manca DATABASE_URL nel .env del motore.');
  const local = url.includes('localhost') || url.includes('127.0.0.1');
  return new pg.Pool({ connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }), max: connections });
}
