import { NextRequest, NextResponse } from 'next/server';
import { runQuery, queryLocalStorage } from '@/lib/db';

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'buggy';
  const latency = parseInt(searchParams.get('latency') || '15', 10);

  // Initialize query log array for this request
  const queryLog: any[] = [];
  const context = { log: queryLog, latency };

  try {
    const result = await queryLocalStorage.run(context, async () => {
      const startTime = Date.now();
      let data: any[] = [];
      let solved = false;
      let validationError: string | null = null;

      if (mode === 'buggy') {
        data = await fetchOrdersBuggy();
      } else if (mode === 'optimized') {
        // Execute the user's optimized function
        data = await fetchOrdersOptimized();
        const duration = Date.now() - startTime;
        const queryCount = queryLog.length;

        // Perform validation against the expected data (buggy path run instantly with 0ms latency)
        const validationContext = { log: [], latency: 0 };
        const expectedData = await queryLocalStorage.run(validationContext, async () => {
          return fetchOrdersBuggy();
        });

        // 1. Check if the result matches the expected dataset
        const isCorrect = deepEqual(data, expectedData);
        
        if (!isCorrect) {
          validationError = "Data structure mismatch: The optimized function did not return the exact same data as the buggy function. Make sure customer names, order items, nested product details, carrier info, and payment statuses are preserved and correctly ordered.";
        } else if (queryCount > 6) {
          validationError = `Query count too high: Your optimization successfully returned the correct data, but it executed ${queryCount} queries. To solve the N+1 bug, you must retrieve all data in 6 or fewer queries (aim for a single SQL JOIN or batched queries using IN).`;
        } else {
          solved = true;
        }

        return {
          success: true,
          mode,
          duration,
          queryCount,
          queries: [...queryLog],
          solved,
          validationError,
          data,
        };
      } else {
        throw new Error(`Invalid mode: ${mode}`);
      }

      const duration = Date.now() - startTime;
      return {
        success: true,
        mode,
        duration,
        queryCount: queryLog.length,
        queries: queryLog,
        solved: false,
        validationError: null,
        data,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred during query execution',
        queryCount: queryLog.length,
        queries: queryLog,
        solved: false,
        validationError: error.message || 'Query failed',
      },
      { status: 200 } // Don't crash Next.js for unhandled errors, let front-end handle it
    );
  }
}

// -------------------------------------------------------------
// BUGGY PATH: Classic N+1 and Nested Loop Database Queries
// -------------------------------------------------------------
async function fetchOrdersBuggy() {
  // 1. Fetch all orders
  const orders = await runQuery<any[]>('SELECT * FROM orders ORDER BY order_date DESC');

  const detailedOrders = [];

  // 2. Loop through each order and fetch related information sequentially
  for (const order of orders) {
    // A. Fetch customer
    const customer = await runQuery<any>(
      'SELECT * FROM customers WHERE id = ?',
      [order.customer_id],
      'get'
    );

    // B. Fetch shipping details
    const shipping = await runQuery<any>(
      'SELECT * FROM shipping_details WHERE order_id = ?',
      [order.id],
      'get'
    );

    // C. Fetch payment details
    const payment = await runQuery<any>(
      'SELECT * FROM payment_details WHERE order_id = ?',
      [order.id],
      'get'
    );

    // D. Fetch order items
    const items = await runQuery<any[]>(
      'SELECT * FROM order_items WHERE order_id = ?',
      [order.id]
    );

    // E. Loop through items to fetch individual product details (Nested N+1!)
    const itemsWithProducts = [];
    for (const item of items) {
      const product = await runQuery<any>(
        'SELECT * FROM products WHERE id = ?',
        [item.product_id],
        'get'
      );
      itemsWithProducts.push({
        ...item,
        product,
      });
    }

    detailedOrders.push({
      ...order,
      customer,
      shipping,
      payment,
      items: itemsWithProducts,
    });
  }

  return detailedOrders;
}

// -------------------------------------------------------------
// OPTIMIZED PATH: TO BE IMPLEMENTED BY THE USER
// -------------------------------------------------------------
async function fetchOrdersOptimized() {
  // TODO: Fix the N+1 Query bug here!
  //
  // Currently, this throws an error. Your task is to rewrite this function
  // to fetch all orders along with their customers, shipping, payments,
  // items, and products in a high-performance way.
  //
  // Solutions to consider:
  // 1. A single large SQL JOIN that returns multiple rows per order item,
  //    followed by aggregating the rows in JavaScript. (Recommended: 1 SQL query!)
  // 2. Batching: Fetch orders, extract all relevant IDs, and do a single query
  //    using the SQL `IN (...)` clause for customers, shipping, payments, items, and products.
  //    (6 SQL queries total instead of 350+!)
  //
  // Remember: Use `runQuery<any[]>(sql, params)` to execute queries.
  // The structure returned MUST match the structure returned by `fetchOrdersBuggy()`.
  
  throw new Error(
    "Optimized path is not yet implemented! " +
    "Please edit fetchOrdersOptimized() in 'src/app/api/orders/route.ts' to solve the N+1 database querying issue."
  );
}
