"use client";

import { useEffect } from "react";

export function AnalyticsBeacon() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/area-restrita") || path.startsWith("/admin")) {
      return;
    }
    const referrer = document.referrer || undefined;
    const params = new URLSearchParams(window.location.search);
    const payload = {
      type: "page_view",
      path,
      referrer,
      utm_source: params.get("utm_source") || undefined,
      utm_medium: params.get("utm_medium") || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
    };

    fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
