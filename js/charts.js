/* =========================================================
   USIAMS - js/charts.js
   Thin Chart.js factory with a consistent USIAMS palette so
   every chart across the system looks and behaves the same way.
   ========================================================= */
(function (global) {
  "use strict";

  const PALETTE = ["#1c60a4", "#1a8b5e", "#4e90fe", "#c0362c", "#8b5cf6", "#0891b2", "#b5790a", "#0a2741"];

  // Charts draw on a canvas, which does not inherit the page font - set it
  // here so labels, legends and tooltips use Mulish like the rest of USIAMS.
  if (global.Chart && global.Chart.defaults) {
    global.Chart.defaults.font.family = "'Mulish', 'Segoe UI', sans-serif";
  }

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function gridColor() { return isDark() ? "rgba(255,255,255,.08)" : "rgba(16,24,40,.06)"; }
  function textColor() { return isDark() ? "#9aa5b8" : "#667085"; }

  function baseOptions(overrides = {}) {
    return Chart.helpers.merge({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor(), font: { size: 11 }, usePointStyle: true } },
        tooltip: { backgroundColor: "#1c2333", titleFont: { size: 12 }, bodyFont: { size: 12 }, padding: 10, cornerRadius: 8 }
      },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: textColor(), font: { size: 11 } } },
        y: { grid: { color: gridColor() }, ticks: { color: textColor(), font: { size: 11 } } }
      }
    }, overrides);
  }

  function lineChart(canvasId, labels, datasets, opts = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
      type: "line",
      data: { labels, datasets: datasets.map((d, i) => ({ tension: 0.35, fill: d.fill ?? true, borderWidth: 2, pointRadius: 3, borderColor: PALETTE[i % PALETTE.length], backgroundColor: hexToRgba(PALETTE[i % PALETTE.length], 0.12), ...d })) },
      options: baseOptions(opts)
    });
  }

  function barChart(canvasId, labels, datasets, opts = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: datasets.map((d, i) => ({ borderRadius: 6, backgroundColor: PALETTE[i % PALETTE.length], maxBarThickness: 34, ...d })) },
      options: baseOptions({ scales: { x: { grid: { display: false } } }, ...opts })
    });
  }

  function doughnutChart(canvasId, labels, data, opts = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: PALETTE, borderWidth: 2, borderColor: isDark() ? "#131c2b" : "#fff" }] },
      options: Chart.helpers.merge(baseOptions(), { cutout: "68%", scales: undefined, ...opts })
    });
  }

  function hexToRgba(hex, alpha) {
    const bigint = parseInt(hex.replace("#", ""), 16);
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.charts = { PALETTE, lineChart, barChart, doughnutChart };

})(window);
