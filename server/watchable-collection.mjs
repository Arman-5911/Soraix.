// Limit expensive provider checks and return what is ready by the deadline.
export async function collectWatchable(candidates, lookup, { concurrency = 6, budgetMs = 10000 } = {}) {
  const results = Array(candidates.length).fill(null);
  let cursor = 0;
  let failures = 0;
  let completed = 0;
  const deadline = Date.now() + budgetMs;
  const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, async () => {
    while (cursor < candidates.length && Date.now() < deadline) {
      const index = cursor++;
      try { results[index] = await lookup(candidates[index]); }
      catch { failures++; }
      completed++;
    }
  });
  let timer;
  await Promise.race([
    Promise.all(workers),
    new Promise(resolve => { timer = setTimeout(resolve, Math.max(0, deadline - Date.now())); }),
  ]);
  clearTimeout(timer);
  return { items: results.filter(Boolean), failures, partial: completed < candidates.length || failures > 0 };
}
