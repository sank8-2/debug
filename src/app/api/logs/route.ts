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

  const queryLog: any[] = [];
  const context = { log: queryLog, latency };

  try {
    const result = await queryLocalStorage.run(context, async () => {
      const startTime = Date.now();
      let data: any[] = [];
      let solved = false;
      let validationError: string | null = null;

      if (mode === 'buggy') {
        data = await fetchLogsBuggy();
      } else if (mode === 'optimized') {
        data = await fetchLogsOptimized();
        const duration = Date.now() - startTime;
        const queryCount = queryLog.length;

        // Perform validation against expected results (instantly with 0ms latency)
        const validationContext = { log: [], latency: 0 };
        const expectedData = await queryLocalStorage.run(validationContext, async () => {
          return fetchLogsBuggy();
        });

        // Validate 1: Matches dataset
        const isCorrect = deepEqual(data, expectedData);

        // Validate 2: Check SQL details
        const executedSQL = queryLog[0]?.sql || '';
        const hasLimit = executedSQL.toUpperCase().includes('LIMIT');
        const hasPayloadColumn = executedSQL.toUpperCase().includes('PAYLOAD');
        const hasAsterisk = executedSQL.includes('*');

        if (!isCorrect) {
          validationError = "Data mismatch: The returned logs do not match the expected 10 most recent logs. Make sure you order by timestamp DESC.";
        } else if (queryCount === 0) {
          validationError = "No query run: Did you forget to query the database?";
        } else if (hasAsterisk) {
          validationError = "Select Asterisk (*) Detected: You are selecting all columns. This still retrieves the heavy 'payload' column from the database. Explicitly select only the columns you need: 'id', 'action', and 'timestamp'.";
        } else if (hasPayloadColumn) {
          validationError = "Payload Column Selected: The 'payload' column contains heavy JSON diagnostics (~20KB per row). To resolve the payload bloat, omit the 'payload' column from your SELECT statement.";
        } else if (!hasLimit) {
          validationError = "Unbounded Fetch Detected: Your SQL statement is missing a 'LIMIT' clause. You are fetching all 1000 rows from SQLite and slicing in JS. Put 'LIMIT 10' in your SQL query to let SQLite truncate the result set.";
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
// BUGGY PATH: Fetch All Columns and All Records, Slice in JS
// -------------------------------------------------------------
async function fetchLogsBuggy() {
  // Query all logs and all columns (including heavy payload)
  const logs = await runQuery<any[]>('SELECT * FROM audit_logs ORDER BY timestamp DESC');

  // Truncate to 10 logs and strip the payload field in JavaScript
  const recentLogs = logs.slice(0, 10).map((log) => ({
    id: log.id,
    action: log.action,
    timestamp: log.timestamp,
  }));

  return recentLogs;
}

// -------------------------------------------------------------
// OPTIMIZED PATH: TO BE IMPLEMENTED BY THE USER
// -------------------------------------------------------------
async function fetchLogsOptimized() {
  // TODO: Fix the Payload Bloat & Unbounded Fetch bug here!
  //
  // Currently, this throws an error. Your task is to rewrite this function
  // to fetch only the required columns ('id', 'action', 'timestamp')
  // and only the 10 most recent records directly from the database.
  //
  // Hint: Order by 'timestamp' descending and use 'LIMIT 10'.
  // Do NOT select the 'payload' column or use '*'.
  const sql = 'SELECT id, action,timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 10';
  const logs = await runQuery<any[]>(sql);
  return logs;
  
  throw new Error(
    "Optimized path is not yet implemented! " +
    "Please edit fetchLogsOptimized() in 'src/app/api/logs/route.ts' to solve the database bloat and unbounded query issue."
  );
}
