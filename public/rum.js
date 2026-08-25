(() => {
  const SAMPLE_RATE = 0.05;
  if (Math.random() >= SAMPLE_RATE) return;
  const endpoint = "https://signal-api.virya.music/v1/public/telemetry/rum";
  const deviceClass = innerWidth < 768 ? "mobile" : innerWidth < 1200 ? "tablet" : "desktop";
  const route = location.pathname.slice(0, 160);
  const sent = new Set();
  // Assistant-era discovery: bucket referrer HOST ONLY (never the full URL —
  // these stay identity-free) so we can watch whether LLM/chat surfaces start
  // sending people our way. Receiver treats metadata as opaque.
  const AI_SOURCES = [
    ["chatgpt.com", "chatgpt"],
    ["openai.com", "chatgpt"],
    ["perplexity.ai", "perplexity"],
    ["gemini.google.com", "gemini"],
    ["copilot.microsoft.com", "copilot"],
    ["claude.ai", "claude"],
    ["deepseek.com", "deepseek"],
    ["mistral.ai", "mistral"],
  ];
  const aiSource = () => {
    try {
      if (!document.referrer) return null;
      const host = new URL(document.referrer).hostname.toLowerCase();
      for (const [suffix, label] of AI_SOURCES) {
        if (host === suffix || host.endsWith(`.${suffix}`)) return label;
      }
    } catch (_) {}
    return null;
  };
  const metadata = aiSource() ? { ai_source: aiSource() } : {};
  function send(metricKey, value) {
    if (!Number.isFinite(value) || value < 0 || sent.has(metricKey)) return;
    sent.add(metricKey);
    const body = JSON.stringify({
      surface: "virya_www", metric_key: metricKey, value,
      route, device_class: deviceClass, observed_at: new Date().toISOString(), metadata,
    });
    fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, mode: "cors", credentials: "omit" }).catch(() => {});
  }
  const nav = performance.getEntriesByType("navigation")[0];
  if (nav) send("ttfb_ms", nav.responseStart);
  let cls = 0;
  let inp = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.interactionId && entry.duration > inp) inp = entry.duration;
    }).observe({ type: "event", buffered: true, durationThreshold: 40 });
    new PerformanceObserver((list) => {
      const entries = list.getEntries(); const last = entries[entries.length - 1];
      if (last) send("lcp_ms", last.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (_) {}
  addEventListener("pagehide", () => { send("cls_milli", Math.round(cls * 1000)); if (inp > 0) send("inp_ms", inp); }, { once: true });
})();
