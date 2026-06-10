'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Activity,
  Sliders,
  Code,
  ArrowRight,
  RefreshCw,
  Server,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface QueryLogEntry {
  sql: string;
  params: any[];
  startTime: number;
  duration: number;
}

interface ApiResponse {
  success: boolean;
  mode: string;
  duration: number;
  queryCount: number;
  queries: QueryLogEntry[];
  solved?: boolean;
  validationError?: string | null;
  data?: any[];
  error?: string;
}

type ChallengeId = 'orders' | 'products' | 'logs';

interface Challenge {
  id: ChallengeId;
  title: string;
  badge: string;
  description: string;
  fileName: string;
  filePath: string;
  bugDescription: string;
  goal: string;
}

const CHALLENGES: Challenge[] = [
  {
    id: 'orders',
    title: '1. N+1 Query Cascade',
    badge: 'Loop Querying',
    description: 'Fetching related tables (customers, items, products, shipping, payments) inside sequential loops.',
    fileName: 'route.ts (Orders)',
    filePath: '/home/sanketh/debug/src/app/api/orders/route.ts',
    bugDescription: 'To fetch 50 orders, the database is queried once for orders, 50 times for customers, 50 times for shipping, 50 times for payments, 50 times for order items, and 100+ times for products. This creates 300+ database queries executing synchronously.',
    goal: 'Rewrite fetchOrdersOptimized() to retrieve all required details in 6 or fewer queries (ideally a single JOIN or batch IN queries).'
  },
  {
    id: 'products',
    title: '2. In-Memory Filtering',
    badge: 'Table Scan',
    description: 'Loading the entire 1000+ catalog rows into server memory to filter with JavaScript Arrays.',
    fileName: 'route.ts (Products)',
    filePath: '/home/sanketh/debug/src/app/api/products/route.ts',
    bugDescription: 'Instead of letting SQLite perform the filter, the code runs SELECT * FROM products and filters the array in Node.js using .filter(). This uses high server memory and transfers useless rows.',
    goal: 'Rewrite searchProductsOptimized() to perform filtering using SQL WHERE clauses directly in SQLite.'
  },
  {
    id: 'logs',
    title: '3. Payload Bloat & Unbounded Fetch',
    badge: 'Bandwidth Waste',
    description: 'Fetching heavy payload strings from 1000 rows only to slice the top 10 elements in Node.js.',
    fileName: 'route.ts (Logs)',
    filePath: '/home/sanketh/debug/src/app/api/logs/route.ts',
    bugDescription: 'Each log contains a heavy 20KB JSON diagnostics payload. The API loads all 1,000 logs (20MB+ data transfer) with SELECT * and cuts it down to 10 logs in JS. It also discards the payload column.',
    goal: 'Rewrite fetchLogsOptimized() to fetch only the required columns (id, action, timestamp) and apply LIMIT 10 in SQLite.'
  }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<ChallengeId>('orders');
  const [latency, setLatency] = useState<number>(15);
  const [category, setCategory] = useState<string>('Electronics');
  const [maxPrice, setMaxPrice] = useState<number>(100);
  
  // Results states
  const [buggyResult, setBuggyResult] = useState<ApiResponse | null>(null);
  const [optimizedResult, setOptimizedResult] = useState<ApiResponse | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [runningMode, setRunningMode] = useState<'buggy' | 'optimized' | 'both' | null>(null);
  const [showData, setShowData] = useState<boolean>(false);
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  const activeChallenge = CHALLENGES.find((c) => c.id === activeTab)!;

  // Clear results when switching tabs
  useEffect(() => {
    setBuggyResult(null);
    setOptimizedResult(null);
    setExpandedQuery(null);
    setShowData(false);
  }, [activeTab]);

  const runTest = async (mode: 'buggy' | 'optimized' | 'both') => {
    setRunning(true);
    setRunningMode(mode);
    setExpandedQuery(null);

    let url = '';
    if (activeTab === 'orders') {
      url = '/api/orders';
    } else if (activeTab === 'products') {
      url = `/api/products?category=${category}&maxPrice=${maxPrice}`;
    } else {
      url = '/api/logs';
    }

    const fetchMode = async (m: 'buggy' | 'optimized'): Promise<ApiResponse> => {
      const separator = url.includes('?') ? '&' : '?';
      const response = await fetch(`${url}${separator}mode=${m}&latency=${latency}`);
      return await response.json();
    };

    try {
      if (mode === 'buggy' || mode === 'both') {
        const buggy = await fetchMode('buggy');
        setBuggyResult(buggy);
      }
      if (mode === 'optimized' || mode === 'both') {
        const opt = await fetchMode('optimized');
        setOptimizedResult(opt);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setRunning(false);
      setRunningMode(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header Banner */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Database className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-400 bg-clip-text text-transparent">
                SQL Latency Lab
              </h1>
              <p className="text-xs text-slate-400">Identify & solve common database bottlenecks in real-time</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Database Status indicator */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/50 text-xs">
              <Server className="h-3.5 w-3.5 text-emerald-400" />
              <span>SQLite Database: </span>
              <span className="font-semibold text-emerald-400">Connected & Seeded</span>
            </div>

            {/* Path indicator */}
            <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/30 text-xs font-mono text-slate-300">
              <span>Port: 3000</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: Challenge Selection & Info */}
        <div className="w-full lg:w-5/12 flex flex-col gap-6">
          
          {/* Challenge Selector */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4" /> Select Challenge
            </h2>
            <div className="flex flex-col gap-2">
              {CHALLENGES.map((challenge) => {
                const isActive = activeTab === challenge.id;
                return (
                  <button
                    key={challenge.id}
                    onClick={() => setActiveTab(challenge.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-950 to-slate-900 border-indigo-500 shadow-md shadow-indigo-500/5 text-white'
                        : 'bg-slate-900/20 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">{challenge.title}</span>
                      <span className="text-xs text-slate-400/80">{challenge.badge}</span>
                    </div>
                    <ArrowRight className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'translate-x-1 text-indigo-400' : 'text-slate-600'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Config Panel */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sliders className="h-4 w-4" /> Lab Configuration
            </h2>
            
            <div className="flex flex-col gap-5">
              {/* Latency Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Simulated DB Roundtrip Latency</span>
                  <span className="text-indigo-400 font-mono font-bold">{latency} ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={latency}
                  onChange={(e) => setLatency(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 italic">
                  Simulates a typical cloud connection (e.g. database hosted on AWS RDS).
                </span>
              </div>

              {/* Tab-specific options */}
              {activeTab === 'products' && (
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-medium">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                    >
                      <option value="Electronics">Electronics</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Apparel">Apparel</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Fitness">Fitness</option>
                      <option value="Office">Office</option>
                      <option value="Books">Books</option>
                      <option value="Home Decor">Home Decor</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Max Price</span>
                      <span className="text-indigo-400 font-mono">${maxPrice}</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="300"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details & Help */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex-1">
            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">
              Challenge Details
            </h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-slate-300 text-xs mb-1">THE BOTTLENECK</h4>
                <p className="text-slate-400 text-xs leading-relaxed">{activeChallenge.bugDescription}</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 text-xs mb-1">YOUR GOAL</h4>
                <p className="text-slate-400 text-xs leading-relaxed">{activeChallenge.goal}</p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex flex-col gap-2.5">
                <h4 className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
                  <Code className="h-3.5 w-3.5 text-indigo-400" /> FILE TO MODIFY
                </h4>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] select-all break-all text-indigo-300">
                  {activeChallenge.filePath}
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Open this file in your editor, locate the optimized function placeholder, implement the query correctly, and run the optimized validation below.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Execution Dashboard */}
        <div className="w-full lg:w-7/12 flex flex-col gap-6">

          {/* Execution Controls */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-400" /> Execution Desk
                </h2>
                <p className="text-xs text-slate-400">Trigger queries and test performance benefits.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  disabled={running}
                  onClick={() => runTest('both')}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98]"
                >
                  {running && runningMode === 'both' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-white" />
                  )}
                  Run Both Paths
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              {/* Buggy Trigger */}
              <button
                disabled={running}
                onClick={() => runTest('buggy')}
                className="group text-left p-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/20 hover:bg-slate-900/40 text-slate-300 transition-all flex flex-col gap-2 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-16 w-16 bg-rose-500/5 rounded-bl-full group-hover:scale-110 transition-transform duration-300" />
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unoptimized Path</span>
                </div>
                <span className="font-semibold text-sm group-hover:text-white transition-colors">Run Unoptimized (Buggy)</span>
                <span className="text-[11px] text-slate-500 leading-normal">
                  Runs the original database implementation. Takes sequential loop routes.
                </span>
              </button>

              {/* Optimized Trigger */}
              <button
                disabled={running}
                onClick={() => runTest('optimized')}
                className="group text-left p-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/20 hover:bg-slate-900/40 text-slate-300 transition-all flex flex-col gap-2 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full group-hover:scale-110 transition-transform duration-300" />
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Optimized Path</span>
                </div>
                <span className="font-semibold text-sm group-hover:text-white transition-colors">Test Optimized Code</span>
                <span className="text-[11px] text-slate-500 leading-normal">
                  Executes your implementation and triggers real-time correctness checks.
                </span>
              </button>
            </div>
          </div>

          {/* Validation Status Banner */}
          {optimizedResult && (
            <div className={`border rounded-2xl p-5 shadow-xl transition-all ${
              optimizedResult.success && optimizedResult.solved
                ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/50 text-rose-300'
            }`}>
              <div className="flex items-start gap-4">
                {optimizedResult.success && optimizedResult.solved ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
                )}
                
                <div className="flex-1">
                  <h3 className="text-sm font-bold tracking-wide uppercase">
                    {optimizedResult.success && optimizedResult.solved
                      ? 'Challenge Solved Successfully!'
                      : 'Optimization Failed'}
                  </h3>
                  <p className="text-xs mt-1.5 leading-relaxed text-slate-300">
                    {optimizedResult.success && optimizedResult.solved
                      ? `Congratulations! You solved the bottleneck. Your optimized function passed all correctness checks, retrieved the exact same dataset, and ran with highly optimized database interaction timings.`
                      : optimizedResult.validationError || optimizedResult.error || 'The query failed to execute. Check the Node logs or console for syntax details.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Performance Metrics Panel */}
          {(buggyResult || optimizedResult) && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Metrics Analysis
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Metric 1: Latency */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Clock className="h-4 w-4 text-indigo-400" />
                    <span>Response Latency</span>
                  </div>
                  
                  <div className="flex flex-col gap-1 mt-1">
                    {buggyResult && (
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] text-slate-400">Buggy:</span>
                        <span className="text-sm font-semibold text-rose-400 font-mono">{buggyResult.duration}ms</span>
                      </div>
                    )}
                    {optimizedResult && (
                      <div className="flex justify-between items-end border-t border-slate-900 pt-1 mt-1">
                        <span className="text-[10px] text-slate-400 font-medium">Optimized:</span>
                        <span className="text-sm font-semibold text-emerald-400 font-mono">{optimizedResult.duration}ms</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metric 2: SQL Query Count */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Database className="h-4 w-4 text-indigo-400" />
                    <span>Database Queries</span>
                  </div>
                  
                  <div className="flex flex-col gap-1 mt-1">
                    {buggyResult && (
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] text-slate-400">Buggy:</span>
                        <span className="text-sm font-semibold text-rose-400 font-mono">{buggyResult.queryCount}</span>
                      </div>
                    )}
                    {optimizedResult && (
                      <div className="flex justify-between items-end border-t border-slate-900 pt-1 mt-1">
                        <span className="text-[10px] text-slate-400 font-medium">Optimized:</span>
                        <span className="text-sm font-semibold text-emerald-400 font-mono">{optimizedResult.queryCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metric 3: Optimization Gain */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-1.5 justify-center">
                  <div className="text-slate-500 text-xs flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-400" />
                    <span>Performance Increase</span>
                  </div>
                  
                  {buggyResult && optimizedResult ? (
                    <div className="mt-2.5 text-center">
                      {optimizedResult.success && optimizedResult.solved ? (
                        <div className="text-xl font-extrabold text-emerald-400 tracking-tight font-mono">
                          {Math.round((buggyResult.duration / (optimizedResult.duration || 1)) * 10) / 10}x
                          <span className="text-[10px] font-normal text-slate-400 block mt-0.5">Faster Load Times</span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 font-medium italic mt-1">
                          Awaiting solved state
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic mt-2.5 text-center">
                      Run both to compare
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Timeline Waterfall Visualizer */}
          {(buggyResult || optimizedResult) && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Query Execution Timeline
                  </h3>
                  <p className="text-[10px] text-slate-500">Visual cascade of SQL statement sequences</p>
                </div>
                <div className="flex gap-2">
                  {buggyResult && (
                    <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                      Buggy ({buggyResult.queryCount} queries)
                    </span>
                  )}
                  {optimizedResult && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      Optimized ({optimizedResult.queryCount} queries)
                    </span>
                  )}
                </div>
              </div>

              {/* Displaying waterfall timeline */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
                <div className="p-3 border-b border-slate-900 text-xs font-semibold bg-slate-900/40 text-slate-400 flex justify-between">
                  <span>SQL QUERY STATEMENT</span>
                  <span>TIMING VISUALIZATION</span>
                </div>
                
                <div className="divide-y divide-slate-900/50">
                  {/* Select which queries timeline to display (prefer optimized if solved, else buggy) */}
                  {(() => {
                    const displayResult = optimizedResult && (optimizedResult.solved || !buggyResult) ? optimizedResult : buggyResult;
                    if (!displayResult) return null;
                    
                    const list = displayResult.queries || [];
                    if (list.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-slate-500 italic">
                          No database query logs recorded.
                        </div>
                      );
                    }

                    // Scale each query's width relative to the single longest query or cumulative sequence.
                    const maxScale = Math.max(...list.map(q => q.duration), 1);
                    
                    // Show a maximum of 25 rows in the list to avoid DOM explosion on 300 queries, but show a count summary
                    const visibleQueries = list.slice(0, 30);
                    const remainingCount = list.length - 30;

                    return (
                      <>
                        {visibleQueries.map((query, index) => {
                          const isExpanded = expandedQuery === index;
                          return (
                            <div key={index} className="flex flex-col text-xs text-slate-300 hover:bg-slate-900/20">
                              <div
                                onClick={() => setExpandedQuery(isExpanded ? null : index)}
                                className="flex items-center justify-between p-3 cursor-pointer gap-4"
                              >
                                <span className="font-mono text-[11px] truncate flex-1 text-slate-400 hover:text-indigo-300">
                                  {query.sql}
                                </span>
                                
                                <div className="w-40 flex items-center justify-end gap-2.5 font-mono text-[10px] text-slate-500">
                                  <span>{query.duration}ms</span>
                                  {/* Visual bar chart */}
                                  <div className="w-20 bg-slate-900 h-2 rounded-full overflow-hidden shrink-0 border border-slate-800/40">
                                    <div
                                      style={{ width: `${Math.max(5, (query.duration / maxScale) * 100)}%` }}
                                      className={`h-full rounded-full ${
                                        displayResult.mode === 'buggy' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                      }`}
                                    />
                                  </div>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="px-3 pb-3 bg-slate-900/10 font-mono text-[10px] text-slate-400 flex flex-col gap-1 border-t border-slate-900/30 pt-1">
                                  <div>
                                    <span className="text-indigo-400 font-semibold">SQL:</span> {query.sql}
                                  </div>
                                  {query.params && query.params.length > 0 && (
                                    <div>
                                      <span className="text-indigo-400 font-semibold">Parameters:</span> {JSON.stringify(query.params)}
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-indigo-400 font-semibold">Execution overhead:</span> SQLite prepared stmt evaluation
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {remainingCount > 0 && (
                          <div className="p-3 text-center text-xs text-rose-400/80 bg-rose-950/5 font-mono italic">
                            ... and {remainingCount} more sequential query blocks running in the loop ...
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Data Output Drawer */}
          {(buggyResult || optimizedResult) && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
              <button
                onClick={() => setShowData(!showData)}
                className="w-full flex items-center justify-between text-left text-sm font-semibold text-slate-400 uppercase tracking-wider"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400" /> Response Data Explorer
                </span>
                {showData ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showData && (
                <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-400 overflow-x-auto max-h-[300px] overflow-y-auto">
                  <pre>{JSON.stringify(
                    optimizedResult && optimizedResult.success ? optimizedResult.data : buggyResult?.data, 
                    null, 
                    2
                  )}</pre>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 py-6 text-center text-xs text-slate-600 bg-slate-950/80">
        <p className="max-w-xl mx-auto leading-normal">
          Designed as an interactive developer tool. Solving performance bottlenecks at the database layer preserves resource memory and minimizes network I/O block times.
        </p>
      </footer>
    </main>
  );
}
