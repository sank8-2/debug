import Database from 'better-sqlite3';
import { AsyncLocalStorage } from 'node:async_hooks';

// Initialize the SQLite database
const db = new Database('orders.db');

export interface QueryLogEntry {
  sql: string;
  params: any[];
  startTime: number;
  duration: number;
}

export interface QueryContext {
  log: QueryLogEntry[];
  latency: number;
}

// Global storage to track query execution timelines and request-specific latency
export const queryLocalStorage = new AsyncLocalStorage<QueryContext>();

// Initialize the database tables
export function initDb() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      tier TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      order_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS shipping_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      address TEXT NOT NULL,
      carrier TEXT NOT NULL,
      tracking_number TEXT NOT NULL UNIQUE,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS payment_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      payment_method TEXT NOT NULL,
      transaction_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);

  // Check if seeding is needed
  const count = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
  if (count.count === 0) {
    try {
      seedData();
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
        console.log('Parallel seeding detected. Database already seeded.');
      } else {
        throw err;
      }
    }
  }
}

function seedData() {
  console.log('Seeding SQLite database...');

  const customerNames = [
    'Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince', 'Evan Wright',
    'Fiona Gallagher', 'George Miller', 'Hannah Abbott', 'Ian Malcolm', 'Julia Roberts',
    'Kevin Bacon', 'Laura Croft', 'Michael Scott', 'Nina Simone', 'Oscar Wilde',
    'Pam Beesly', 'Quentin Tarantino', 'Rachel Green', 'Steve Rogers', 'Tina Turner',
    'Ulysses Grant', 'Valerie Perez', 'Walter White', 'Xena Warrior', 'Yusuf Islam',
    'Zack Morris', 'Arthur Pendragon', 'Bruce Wayne', 'Clark Kent', 'David Miller',
    'Emma Watson', 'Freddie Mercury', 'Grace Kelly', 'Harry Potter', 'Indiana Jones',
    'Jack Sparrow', 'Katherine Hepburn', 'Luke Skywalker', 'Marilyn Monroe', 'Neo Anderson'
  ];

  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const categories = ['Electronics', 'Accessories', 'Apparel', 'Kitchen', 'Fitness', 'Office', 'Books', 'Home Decor'];

  // Run in a single transaction for efficiency
  const runSeeding = db.transaction(() => {
    // 1. Insert Customers (50)
    const insertCustomer = db.prepare('INSERT INTO customers (name, email, tier) VALUES (?, ?, ?)');
    customerNames.forEach((name, i) => {
      const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
      const tier = tiers[i % tiers.length];
      insertCustomer.run(name, email, tier);
    });

    // 2. Insert Products (1000+)
    const insertProduct = db.prepare('INSERT INTO products (name, price, sku, category) VALUES (?, ?, ?, ?)');
    const productNamesByCategory: Record<string, string[]> = {
      Electronics: ['Wireless Headphones', 'Smart Watch', 'Mechanical Keyboard', 'Gaming Mouse', 'USB-C Hub', 'Bluetooth Speaker', 'Phone Charger', 'Laptop Stand'],
      Accessories: ['Leather Wallet', 'Polarized Sunglasses', 'Backpack', 'Baseball Cap', 'Stainless Steel Ring', 'Leather Belt', 'Canvas Tote Bag'],
      Apparel: ['Running Shoes', 'Cotton T-Shirt', 'Denim Jacket', 'Socks Pack', 'Hooded Sweatshirt', 'Chino Pants', 'Wool Scarf'],
      Kitchen: ['Ceramic Coffee Mug', 'Chef Knife', 'Water Bottle', 'Toaster', 'Cutting Board', 'Spice Rack', 'Silicon Spatula Set'],
      Fitness: ['Yoga Mat', 'Adjustable Dumbbells', 'Resistance Bands', 'Jump Rope', 'Foam Roller', 'Kettlebell', 'Running Belt'],
      Office: ['LED Desk Lamp', 'Ergonomic Chair', 'Notebook Set', 'Gel Pens Pack', 'Desk Pad', 'Monitor Mount', 'File Organizer'],
      Books: ['Science Fiction Novel', 'History Textbook', 'Programming Guide', 'Cookbook Masterclass', 'Mystery Thriller', 'Biography of Legends'],
      'Home Decor': ['Scented Candle', 'Indoor Plant Pot', 'Throw Pillow', 'Wall Art Frame', 'Desk Organizer Tray', 'LED Strip Lights']
    };

    let skuCounter = 1000;
    for (const category of categories) {
      const names = productNamesByCategory[category] || ['Generic Item'];
      for (let i = 1; i <= 130; i++) {
        const baseName = names[i % names.length];
        const name = `${baseName} (Gen-${i})`;
        const price = parseFloat((10 + Math.random() * 290).toFixed(2));
        const sku = `${category.substring(0, 3).toUpperCase()}-${skuCounter++}`;
        insertProduct.run(name, price, sku, category);
      }
    }

    // Fetch created ids
    const customers = db.prepare('SELECT id FROM customers').all() as { id: number }[];
    const products = db.prepare('SELECT * FROM products').all() as { id: number; price: number }[];

    const orderStatuses = ['Delivered', 'Shipped', 'Processing', 'Cancelled', 'Pending Payment'];
    const carriers = ['FedEx', 'UPS', 'USPS', 'DHL'];
    const paymentMethods = ['Credit Card', 'PayPal', 'Apple Pay', 'Google Pay', 'Bank Transfer'];

    // 3. Seed 50 Orders
    const insertOrder = db.prepare('INSERT INTO orders (customer_id, order_date, total_amount, status) VALUES (?, ?, ?, ?)');
    const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
    const insertShipping = db.prepare('INSERT INTO shipping_details (order_id, address, carrier, tracking_number) VALUES (?, ?, ?, ?)');
    const insertPayment = db.prepare('INSERT INTO payment_details (order_id, payment_method, transaction_id, status) VALUES (?, ?, ?, ?)');

    for (let i = 1; i <= 50; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const status = orderStatuses[i % orderStatuses.length];
      
      const numItems = Math.floor(Math.random() * 3) + 1; // 1 to 3 items
      const selectedProducts = [];
      let totalAmount = 0;
      
      for (let j = 0; j < numItems; j++) {
        const p = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        selectedProducts.push({ product: p, qty });
        totalAmount += p.price * qty;
      }

      // Insert order
      const orderResult = insertOrder.run(customer.id, date, parseFloat(totalAmount.toFixed(2)), status);
      const orderId = orderResult.lastInsertRowid as number;

      // Insert order items
      selectedProducts.forEach(({ product, qty }) => {
        insertOrderItem.run(orderId, product.id, qty, product.price);
      });

      // Insert shipping details
      const carrier = carriers[i % carriers.length];
      const tracking = `TRK-${100000000 + i}`;
      const address = `${Math.floor(Math.random() * 900) + 100} Main St, Suite ${i}, New York, NY 10001`;
      insertShipping.run(orderId, address, carrier, tracking);

      // Insert payment details
      const method = paymentMethods[i % paymentMethods.length];
      const txId = `TXN-${500000000 + i}`;
      const payStatus = status === 'Cancelled' ? 'Refunded' : status === 'Pending Payment' ? 'Pending' : 'Completed';
      insertPayment.run(orderId, method, txId, payStatus);
    }

    // 4. Seed 1000 Audit Logs with heavy payloads
    const insertLog = db.prepare('INSERT INTO audit_logs (action, timestamp, payload) VALUES (?, ?, ?)');
    
    const generateHeavyPayload = (id: number) => {
      const data: any = {
        meta: {
          requestId: `req-uuid-${id}-abc-xyz`,
          triggeredBy: `user-${100 + (id % 15)}@admin.company.com`,
          clientIp: `192.168.1.${id % 254}`,
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'en-US',
          timezone: 'America/New_York'
        },
        payload_details: {
          actionPerformed: 'ORDER_UPDATE_STATUS',
          databaseAffected: 'orders_production_replica',
          rowsUpdated: 1,
          previousState: {
            id: id,
            customer_id: 25,
            status: 'Processing',
            total_amount: 145.99,
            updated_at: '2026-06-01T12:00:00Z',
            tags: ['priority', 'requires_packaging'],
            internal_flags: {
              processed_by_worker: true,
              worker_id: 'node-worker-08',
              retry_count: 0
            }
          },
          newState: {
            id: id,
            customer_id: 25,
            status: 'Shipped',
            total_amount: 145.99,
            updated_at: '2026-06-01T14:30:00Z',
            tags: ['priority', 'shipped_out'],
            internal_flags: {
              processed_by_worker: true,
              worker_id: 'node-worker-08',
              retry_count: 0
            }
          }
        },
        system_diagnostics: {
          nodeHeapUsedBytes: 45290128,
          nodeHeapTotalBytes: 78912384,
          cpuUsagePercent: 12.4,
          activeDatabaseConnections: 18,
          redisCacheHits: 1042,
          redisCacheMisses: 48
        },
        debug_logs: Array.from({ length: 40 }, (_, index) => ({
          timestamp: new Date().toISOString(),
          level: 'DEBUG',
          message: `Worker node 08 verified connection pool status. Thread state is idle. Database replica latency is verified at 2.4ms. Transaction log written successfully for offset ${1000 + id * 40 + index}. Re-verifying checksum indices for order details.`
        }))
      };
      return JSON.stringify(data);
    };

    const actions = [
      'USER_LOGIN', 'ORDER_CREATE', 'ITEM_UPDATE', 'PAYMENT_RECEIVE', 'SHIPPING_CREATE',
      'USER_LOGOUT', 'PRODUCT_SEARCH', 'CART_ABANDON', 'SYSTEM_BACKUP', 'CONFIG_CHANGE'
    ];

    for (let i = 1; i <= 1000; i++) {
      const action = actions[i % actions.length];
      const timestamp = new Date(Date.now() - i * 15 * 60 * 1000).toISOString();
      const payload = generateHeavyPayload(i);
      insertLog.run(action, timestamp, payload);
    }
  });

  runSeeding();
  console.log('Seeding completed successfully!');
}

// Wrapper for executing query with artificial latency to simulate real network round-trips
export async function runQuery<T>(sql: string, params: any[] = [], type: 'all' | 'get' | 'run' = 'all'): Promise<T> {
  const store = queryLocalStorage.getStore();
  
  // Read dynamic request-specific latency, or fall back to default
  const delay = store !== undefined ? store.latency : 15;
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const stmt = db.prepare(sql);
  
  let result: any;
  if (type === 'all') {
    result = stmt.all(...params);
  } else if (type === 'get') {
    result = stmt.get(...params);
  } else {
    result = stmt.run(...params);
  }

  if (store) {
    store.log.push({
      sql,
      params,
      startTime: Date.now() - delay,
      duration: delay,
    });
  }

  return result as T;
}

// Initialize on load
initDb();
