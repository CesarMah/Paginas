'use strict';
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION    = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const STAGE     = process.env.STAGE || 'dev';
const DB_HOST   = process.env.DB_HOST;
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ─── Menú completo de Calico ───────────────────────────────────────────────
const MENU_ITEMS = [
  // Entradas
  { name: 'Guacamole con totopos',       category: 'Entradas', price: 89,  description: 'Aguacate Hass, jitomate, cebolla, cilantro y chile serrano. Porción para 2.', sort_order: 1 },
  { name: 'Queso fundido con chorizo',   category: 'Entradas', price: 99,  description: 'Queso Chihuahua fundido con chorizo español y rajas de poblano.', sort_order: 2 },
  { name: 'Sopa azteca',                 category: 'Entradas', price: 79,  description: 'Caldo de jitomate, tortilla crujiente, crema, queso y aguacate.', sort_order: 3 },
  { name: 'Elotes callejeros',           category: 'Entradas', price: 55,  description: 'Elote en vaso con crema, mayonesa, queso cotija y chile piquín.', sort_order: 4 },

  // Tacos y Tostadas
  { name: 'Taco de birria',              category: 'Tacos',    price: 45,  description: 'Birria de res estilo Jalisco con consomé. 1 pieza.', sort_order: 1 },
  { name: 'Taco de cochinita pibil',     category: 'Tacos',    price: 42,  description: 'Cerdo marinado en achiote, naranja agria y especias. 1 pieza.', sort_order: 2 },
  { name: 'Taco de pastor',             category: 'Tacos',    price: 38,  description: 'Cerdo adobado al trompo con piña, cebolla y cilantro. 1 pieza.', sort_order: 3 },
  { name: 'Taco de canasta (3 pzas)',    category: 'Tacos',    price: 65,  description: 'Chicharrón, mole y papa con chorizo. Clásico de canasta.', sort_order: 4 },
  { name: 'Tostada de tinga de pollo',  category: 'Tacos',    price: 55,  description: 'Pollo deshebrado en salsa de jitomate y chipotle con crema y lechuga.', sort_order: 5 },

  // Platos fuertes
  { name: 'Enchiladas verdes',           category: 'Platos fuertes', price: 149, description: 'Tortillas rellenas de pollo, salsa verde, crema y queso fresco. 3 pzas.', sort_order: 1 },
  { name: 'Chiles rellenos',             category: 'Platos fuertes', price: 165, description: 'Chile poblano relleno de picadillo, capeado y bañado en salsa de jitomate.', sort_order: 2 },
  { name: 'Carne asada 250g',            category: 'Platos fuertes', price: 229, description: 'Arrachera a las brasas con arroz, frijoles y tortillas. Guacamole incluido.', sort_order: 3 },
  { name: 'Pollo en mole negro',         category: 'Platos fuertes', price: 189, description: 'Pierna de pollo en mole negro oaxaqueño con arroz y tortillas.', sort_order: 4 },
  { name: 'Camarones a la diabla',       category: 'Platos fuertes', price: 215, description: 'Camarones jumbo en salsa de chile de árbol, mantequilla y ajo.', sort_order: 5 },
  { name: 'Flautas de papa y queso',     category: 'Platos fuertes', price: 125, description: '4 flautas crujientes con crema, guacamole y salsa verde. Vegetariano.', sort_order: 6 },

  // Bebidas frías
  { name: 'Agua de horchata 500ml',      category: 'Bebidas', price: 45,  description: 'Agua fresca de arroz con canela y vainilla. Tamaño grande.', sort_order: 1 },
  { name: 'Agua de jamaica 500ml',       category: 'Bebidas', price: 45,  description: 'Flor de Jamaica con canela y naranja. Tamaño grande.', sort_order: 2 },
  { name: 'Limonada natural 500ml',      category: 'Bebidas', price: 49,  description: 'Jugo de limón fresco, azúcar y agua mineral.', sort_order: 3 },
  { name: 'Refresco 355ml',              category: 'Bebidas', price: 35,  description: 'Coca-Cola, Sprite o Fanta. Lata fría.', sort_order: 4 },
  { name: 'Cerveza nacional',            category: 'Bebidas', price: 55,  description: 'Corona, Modelo o Pacífico. Botella 355ml.', sort_order: 5 },
  { name: 'Michelada',                   category: 'Bebidas', price: 75,  description: 'Cerveza con limón, sal, clamato y chile en vaso escarChado.', sort_order: 6 },
  { name: 'Agua mineral 600ml',          category: 'Bebidas', price: 28,  description: 'Agua Peñafiel o San Pellegrino con o sin gas.', sort_order: 7 },

  // Postres
  { name: 'Churros con cajeta',          category: 'Postres', price: 69,  description: '4 churros recién hechos con cajeta artesanal y chocolate caliente.', sort_order: 1 },
  { name: 'Flan napolitano',             category: 'Postres', price: 59,  description: 'Flan casero de queso crema con cajeta y nuez.', sort_order: 2 },
  { name: 'Pastel de tres leches',       category: 'Postres', price: 75,  description: 'Porción de pastel empapado en tres leches con fresas y crema batida.', sort_order: 3 },
  { name: 'Nieve de la abuela',          category: 'Postres', price: 49,  description: 'Una bola de nieve artesanal. Sabores: mamey, guanábana o tuna.', sort_order: 4 },
];

// ─── Inventario de insumos ─────────────────────────────────────────────────
const INVENTORY_ITEMS = [
  // Carnes
  { name: 'Carne de res (kg)',           unit: 'kg',     quantity: 12.5, min_quantity: 5 },
  { name: 'Pollo entero (kg)',           unit: 'kg',     quantity: 8.0,  min_quantity: 4 },
  { name: 'Cerdo para birria (kg)',      unit: 'kg',     quantity: 6.0,  min_quantity: 3 },
  { name: 'Chorizo (kg)',                unit: 'kg',     quantity: 2.5,  min_quantity: 1 },
  { name: 'Camarones jumbo (kg)',        unit: 'kg',     quantity: 1.8,  min_quantity: 2 },   // ⚠️ bajo stock
  // Verduras y frescos
  { name: 'Aguacate Hass (pzas)',        unit: 'piezas', quantity: 35,   min_quantity: 20 },
  { name: 'Jitomate (kg)',               unit: 'kg',     quantity: 8.0,  min_quantity: 3 },
  { name: 'Cebolla (kg)',                unit: 'kg',     quantity: 5.0,  min_quantity: 2 },
  { name: 'Chile serrano (kg)',          unit: 'kg',     quantity: 0.8,  min_quantity: 1 },   // ⚠️ bajo stock
  { name: 'Cilantro (manojos)',          unit: 'manojo', quantity: 12,   min_quantity: 5 },
  { name: 'Limones (kg)',                unit: 'kg',     quantity: 4.5,  min_quantity: 2 },
  { name: 'Chile poblano (kg)',          unit: 'kg',     quantity: 3.0,  min_quantity: 1.5 },
  // Lácteos
  { name: 'Queso Chihuahua (kg)',        unit: 'kg',     quantity: 4.0,  min_quantity: 2 },
  { name: 'Crema ácida (lt)',            unit: 'litro',  quantity: 5.0,  min_quantity: 2 },
  { name: 'Queso cotija (kg)',           unit: 'kg',     quantity: 1.5,  min_quantity: 1 },
  // Básicos
  { name: 'Tortillas de maíz (kg)',      unit: 'kg',     quantity: 15.0, min_quantity: 8 },
  { name: 'Arroz (kg)',                  unit: 'kg',     quantity: 10.0, min_quantity: 5 },
  { name: 'Frijoles negros (kg)',        unit: 'kg',     quantity: 8.0,  min_quantity: 3 },
  { name: 'Aceite vegetal (lt)',         unit: 'litro',  quantity: 6.0,  min_quantity: 3 },
  { name: 'Sal (kg)',                    unit: 'kg',     quantity: 3.0,  min_quantity: 1 },
  // Bebidas
  { name: 'Cerveza Corona (cajas 24)',   unit: 'caja',   quantity: 3,    min_quantity: 2 },
  { name: 'Refresco surtido (cajas)',    unit: 'caja',   quantity: 2,    min_quantity: 2 },   // ⚠️ bajo stock
  { name: 'Agua mineral (cajas 12)',     unit: 'caja',   quantity: 4,    min_quantity: 2 },
  { name: 'Flor de Jamaica (kg)',        unit: 'kg',     quantity: 1.2,  min_quantity: 0.5 },
  { name: 'Arroz para horchata (kg)',    unit: 'kg',     quantity: 2.0,  min_quantity: 1 },
];

// ─── Órdenes de ejemplo en distintos estados ────────────────────────────────
// Construidas después de insertar menú (se necesitan los IDs)
function buildOrders(menuIds) {
  const now = new Date();
  const ago = (min) => new Date(now.getTime() - min * 60000).toISOString();

  return [
    // En cocina — llegaron hace 8 min
    {
      items: [
        { menuItemId: menuIds['Taco de birria'],         name: 'Taco de birria',         price: 45, quantity: 3 },
        { menuItemId: menuIds['Agua de horchata 500ml'], name: 'Agua de horchata 500ml', price: 45, quantity: 2 },
      ],
      total: 225, status: 'cooking', table_number: '4',
      notes: 'Sin cebolla en los tacos', created_at: ago(8),
    },
    // En cocina — llegaron hace 12 min
    {
      items: [
        { menuItemId: menuIds['Enchiladas verdes'],       name: 'Enchiladas verdes',      price: 149, quantity: 2 },
        { menuItemId: menuIds['Camarones a la diabla'],   name: 'Camarones a la diabla',  price: 215, quantity: 1 },
        { menuItemId: menuIds['Cerveza nacional'],        name: 'Cerveza nacional',        price: 55,  quantity: 3 },
      ],
      total: 628, status: 'cooking', table_number: 'Terraza-1',
      notes: '', created_at: ago(12),
    },
    // Listo — esperando entrega
    {
      items: [
        { menuItemId: menuIds['Guacamole con totopos'],  name: 'Guacamole con totopos', price: 89, quantity: 1 },
        { menuItemId: menuIds['Queso fundido con chorizo'], name: 'Queso fundido con chorizo', price: 99, quantity: 1 },
        { menuItemId: menuIds['Michelada'],              name: 'Michelada',             price: 75, quantity: 2 },
      ],
      total: 338, status: 'ready', table_number: '7',
      notes: 'Michelada sin sal en el vaso', created_at: ago(18),
    },
    // Nueva — recién llegó
    {
      items: [
        { menuItemId: menuIds['Taco de pastor'],         name: 'Taco de pastor',        price: 38, quantity: 4 },
        { menuItemId: menuIds['Limonada natural 500ml'], name: 'Limonada natural 500ml',price: 49, quantity: 2 },
      ],
      total: 250, status: 'new', table_number: '2',
      notes: '', created_at: ago(2),
    },
    // Nueva — recién llegó
    {
      items: [
        { menuItemId: menuIds['Carne asada 250g'],       name: 'Carne asada 250g',      price: 229, quantity: 1 },
        { menuItemId: menuIds['Cerveza nacional'],        name: 'Cerveza nacional',       price: 55,  quantity: 2 },
        { menuItemId: menuIds['Sopa azteca'],             name: 'Sopa azteca',            price: 79,  quantity: 1 },
      ],
      total: 418, status: 'new', table_number: 'Barra-1',
      notes: 'Término: bien cocida', created_at: ago(1),
    },
    // Entregadas hoy (historial)
    {
      items: [
        { menuItemId: menuIds['Flautas de papa y queso'], name: 'Flautas de papa y queso', price: 125, quantity: 1 },
        { menuItemId: menuIds['Agua de jamaica 500ml'],   name: 'Agua de jamaica 500ml',   price: 45,  quantity: 2 },
      ],
      total: 215, status: 'delivered', table_number: '1',
      notes: '', created_at: ago(45), customer_email: 'cessarmahwk@gmail.com',
    },
    {
      items: [
        { menuItemId: menuIds['Pollo en mole negro'],   name: 'Pollo en mole negro',    price: 189, quantity: 2 },
        { menuItemId: menuIds['Churros con cajeta'],    name: 'Churros con cajeta',      price: 69,  quantity: 2 },
        { menuItemId: menuIds['Refresco 355ml'],        name: 'Refresco 355ml',          price: 35,  quantity: 2 },
      ],
      total: 586, status: 'delivered', table_number: '5',
      notes: '', created_at: ago(60),
    },
    {
      items: [
        { menuItemId: menuIds['Taco de cochinita pibil'], name: 'Taco de cochinita pibil', price: 42, quantity: 6 },
        { menuItemId: menuIds['Agua de horchata 500ml'],  name: 'Agua de horchata 500ml',  price: 45, quantity: 3 },
      ],
      total: 387, status: 'delivered', table_number: '3',
      notes: '', created_at: ago(90),
    },
    {
      items: [
        { menuItemId: menuIds['Chiles rellenos'],        name: 'Chiles rellenos',        price: 165, quantity: 1 },
        { menuItemId: menuIds['Flan napolitano'],        name: 'Flan napolitano',         price: 59,  quantity: 1 },
        { menuItemId: menuIds['Agua mineral 600ml'],    name: 'Agua mineral 600ml',      price: 28,  quantity: 2 },
      ],
      total: 280, status: 'delivered', table_number: '6',
      notes: '', created_at: ago(120),
    },
    // Cancelada
    {
      items: [
        { menuItemId: menuIds['Nieve de la abuela'],    name: 'Nieve de la abuela',     price: 49, quantity: 2 },
      ],
      total: 98, status: 'cancelled', table_number: '8',
      notes: 'Cliente se fue antes de que llegara', created_at: ago(30),
    },
  ];
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function run() {
  if (!DB_HOST) { console.error('❌  Falta DB_HOST'); process.exit(1); }

  const sm = new SecretsManagerClient({ region: REGION });
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: `gastroflow/${STAGE}/db-credentials` })
  );
  const { username, password } = JSON.parse(SecretString);

  const db = new Client({
    host: DB_HOST, port: 5432, database: 'gastroflow',
    user: username, password,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  console.log('✅  Conectado a PostgreSQL\n');

  // Activar RLS para el tenant
  await db.query(`SET app.current_tenant = '${TENANT_ID}'`);

  // ── 1. Limpiar datos previos (para re-ejecutar limpio) ──
  console.log('🧹  Limpiando datos de demo previos...');
  await db.query(`DELETE FROM orders        WHERE tenant_id = $1`, [TENANT_ID]);
  await db.query(`DELETE FROM inventory_items WHERE tenant_id = $1`, [TENANT_ID]);
  await db.query(`DELETE FROM menu_items    WHERE tenant_id = $1`, [TENANT_ID]);

  // ── 2. Insertar menú ──
  console.log('🍽️   Insertando menú...');
  const menuIds = {};
  for (const item of MENU_ITEMS) {
    const { rows } = await db.query(
      `INSERT INTO menu_items (tenant_id, name, description, price, category, available, sort_order)
       VALUES ($1,$2,$3,$4,$5,true,$6) RETURNING id`,
      [TENANT_ID, item.name, item.description, item.price, item.category, item.sort_order]
    );
    menuIds[item.name] = rows[0].id;
    process.stdout.write('.');
  }
  console.log(`\n✅  ${MENU_ITEMS.length} platillos insertados`);

  // ── 3. Insertar inventario ──
  console.log('📦  Insertando inventario...');
  for (const inv of INVENTORY_ITEMS) {
    await db.query(
      `INSERT INTO inventory_items (tenant_id, name, unit, quantity, min_quantity)
       VALUES ($1,$2,$3,$4,$5)`,
      [TENANT_ID, inv.name, inv.unit, inv.quantity, inv.min_quantity]
    );
    process.stdout.write('.');
  }
  console.log(`\n✅  ${INVENTORY_ITEMS.length} insumos insertados`);

  // ── 4. Insertar órdenes ──
  console.log('🧾  Insertando órdenes...');
  const orders = buildOrders(menuIds);
  for (const o of orders) {
    await db.query(
      `INSERT INTO orders (tenant_id, items, total, status, table_number, notes, customer_email, created_at)
       VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8)`,
      [TENANT_ID, JSON.stringify(o.items), o.total, o.status,
       o.table_number, o.notes || null, o.customer_email || null, o.created_at]
    );
    process.stdout.write('.');
  }
  console.log(`\n✅  ${orders.length} órdenes insertadas`);

  await db.end();

  // ── Resumen ──
  const byStatus = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1; return acc;
  }, {});

  console.log(`
╔══════════════════════════════════════════════════╗
║         🎉  DATOS DE DEMO CARGADOS               ║
╠══════════════════════════════════════════════════╣
║  MENÚ: ${String(MENU_ITEMS.length).padEnd(41)}║
║    • Entradas (4)  • Tacos (5)                   ║
║    • Platos fuertes (6)  • Bebidas (7)           ║
║    • Postres (4)                                 ║
╠══════════════════════════════════════════════════╣
║  INVENTARIO: ${String(INVENTORY_ITEMS.length).padEnd(37)}║
║    ⚠️  3 insumos con stock bajo (rojo en UI)      ║
╠══════════════════════════════════════════════════╣
║  ÓRDENES: ${String(orders.length).padEnd(40)}║
║    • Nuevas:     ${String(byStatus.new || 0).padEnd(33)}║
║    • En cocina:  ${String(byStatus.cooking || 0).padEnd(33)}║
║    • Listas:     ${String(byStatus.ready || 0).padEnd(33)}║
║    • Entregadas: ${String(byStatus.delivered || 0).padEnd(33)}║
║    • Canceladas: ${String(byStatus.cancelled || 0).padEnd(33)}║
╚══════════════════════════════════════════════════╝`);
}

run().catch(err => { console.error('\n❌', err.message); process.exit(1); });
