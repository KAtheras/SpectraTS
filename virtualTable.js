(function (root) {
  function windowFor(options = {}) {
    const total = Math.max(0, Number(options.total) || 0);
    const rowHeight = Math.max(1, Number(options.rowHeight) || 54);
    const viewportHeight = Math.max(rowHeight, Number(options.viewportHeight) || 600);
    const overscan = Math.max(0, Number(options.overscan) || 0);
    const visibleCount = Math.ceil(viewportHeight / rowHeight);
    const rawStart = Math.floor(Math.max(0, Number(options.scrollTop) || 0) / rowHeight) - overscan;
    const start = Math.min(Math.max(0, rawStart), Math.max(0, total - visibleCount));
    const end = Math.min(total, start + visibleCount + overscan * 2);
    return {
      start,
      end,
      beforeHeight: start * rowHeight,
      afterHeight: Math.max(0, total - end) * rowHeight,
    };
  }

  const api = { windowFor };
  if (root) root.virtualTable = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : null);
