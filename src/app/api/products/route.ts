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
  const category = searchParams.get('category') || 'Electronics';
  const maxPrice = parseFloat(searchParams.get('maxPrice') || '100');
  const latency = parseInt(searchParams.get('latency') || '15', 10);

  const queryLog: any[] = [];
  const context = { log: queryLog, latency };

  try {
    const result = await queryLocalStorage.run(context, async () => {
      const startTime = Date.now();
      let data: any[] = [];
      let solved = false;
      let validationError: string | null = null;

      if (mode === 'buggy') {
        data = await searchProductsBuggy(category, maxPrice);
      } else if (mode === 'optimized') {
        data = await searchProductsOptimized(category, maxPrice);
        const duration = Date.now() - startTime;
        const queryCount = queryLog.length;

        // Perform validation against expected results (instantly with 0ms latency)
        const validationContext = { log: [], latency: 0 };
        const expectedData = await queryLocalStorage.run(validationContext, async () => {
          return searchProductsBuggy(category, maxPrice);
        });

        // Validate 1: Matches dataset
        const isCorrect = deepEqual(data, expectedData);

        // Validate 2: Check if SQL filter was used
        const executedSQL = queryLog[0]?.sql || '';
        const hasWhereClause = executedSQL.toUpperCase().includes('WHERE');
        const hasCategoryFilter = executedSQL.toUpperCase().includes('CATEGORY');
        const hasPriceFilter = executedSQL.toUpperCase().includes('PRICE');
        
        if (!isCorrect) {
          validationError = "Data mismatch: The returned products do not match the expected filtered list. Double-check your logic and sorting.";
        } else if (queryCount === 0) {
          validationError = "No query run: Did you forget to query the database?";
        } else if (!hasWhereClause || !hasCategoryFilter || !hasPriceFilter) {
          validationError = `In-Memory Filtering Detected! Your query was: "${executedSQL}". You retrieved the records and filtered them in JavaScript. To solve this, write an SQL query that filters by category and price inside SQLite using 'WHERE' and bind parameters.`;
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
      { status: 200 }
    );
  }
}

// -------------------------------------------------------------
// BUGGY PATH: Fetch All Products, Filter in JS Memory
// -------------------------------------------------------------
async function searchProductsBuggy(category: string, maxPrice: number) {
  // Query all products in the database
  const products = await runQuery<any[]>('SELECT * FROM products');
  
  // Filter the products array in-memory
  const filtered = products.filter(
    (product) => product.category === category && product.price <= maxPrice
  );

  return filtered;
}

// -------------------------------------------------------------
// OPTIMIZED PATH: TO BE IMPLEMENTED BY THE USER
// -------------------------------------------------------------
async function searchProductsOptimized(category: string, maxPrice: number) {
  // TODO: Fix the In-Memory Filtering bug here!
  //
  // Currently, this throws an error. Your task is to rewrite this function
  // to perform the filtering directly in the database query.
  //
  // Hint: Use 'WHERE category = ? AND price <= ?' in your SQL.
  // Make sure you return an array containing only the matching products.
  try {
      const sql = 'SELECT * FROM products WHERE category = ? AND price <= ?';
  const products = await runQuery<any[]>(sql, [category, maxPrice]);
  return products;
  } catch (error) {
        throw new Error(
    "Optimized path is not yet implemented! " +
    "Please edit searchProductsOptimized() in 'src/app/api/products/route.ts' to solve the In-Memory Filtering issue."
  );
  }
  

}
