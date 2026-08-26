(function (root) {
  const budgets = {
    state: { responseBytes: 500000, totalMs: 2000, parseMs: 50 },
    records: { responseBytes: 350000, totalMs: 1500, parseMs: 50, renderMs: 120 },
    analytics: { responseBytes: 250000, totalMs: 2000, parseMs: 50, renderMs: 150 },
  };

  function endpointKey(path) {
    if (String(path || "").endsWith("/state")) return "state";
    if (String(path || "").endsWith("/records")) return "records";
    if (String(path || "").endsWith("/analytics")) return "analytics";
    return "";
  }

  function evaluate(metrics) {
    const key = endpointKey(metrics?.path);
    const budget = budgets[key];
    if (!budget) return { key, exceeded: [] };
    const exceeded = Object.entries(budget)
      .filter(([metric, limit]) => Number(metrics?.[metric] || 0) > limit)
      .map(([metric, limit]) => ({ metric, actual: Number(metrics[metric]), limit }));
    return { key, exceeded };
  }

  const api = { budgets, endpointKey, evaluate };
  if (root) root.performanceBudgets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : null);
