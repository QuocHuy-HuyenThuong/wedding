(function () {
  window.WEDDING_APPS_SCRIPT_URL = window.WEDDING_APPS_SCRIPT_URL
    || "https://script.google.com/macros/s/AKfycbzpj9AvSODBw-0a3VhsDMCU4vCAWwsa4ZU6wzIhXwSEzgCmNfvYdmb2Jm6HyC5aduhdAg/exec";
  const isFileOrigin = window.location.protocol === "file:";
  const isLocalServer = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const appsScriptUrl = String(window.WEDDING_APPS_SCRIPT_URL || "").trim();
  const invitationSlug = String(window.WEDDING_INVITATION_SLUG || "quochuy-thithuong");
  if (isFileOrigin) {
    const originalPushState = window.history.pushState;
    window.history.pushState = function () {
      try {
        return originalPushState.apply(this, arguments);
      } catch (error) {
        console.warn("pushState error suppressed");
      }
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function () {
      try {
        return originalReplaceState.apply(this, arguments);
      } catch (error) {
        console.warn("replaceState error suppressed");
      }
    };
  }

  const originalFetch = window.fetch;
  function jsonResponse(value, status) {
    return new Response(JSON.stringify(value), {
      status: status || 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  function loadSheetComments(slug) {
    return new Promise((resolve) => {
      const callback = "__weddingComments_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const timeout = setTimeout(() => finish({ comments: [] }), 10000);
      const finish = (data) => {
        clearTimeout(timeout);
        delete window[callback];
        script.remove();
        resolve(data && Array.isArray(data.comments) ? data : { comments: [] });
      };
      window[callback] = finish;
      script.onerror = () => finish({ comments: [] });
      script.src = appsScriptUrl + (appsScriptUrl.includes("?") ? "&" : "?")
        + new URLSearchParams({ action: "comments", slug, callback });
      document.head.appendChild(script);
    });
  }

  function verifySheetWrite(requestId) {
    return new Promise((resolve) => {
      const callback = "__weddingWriteCheck_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const timeout = setTimeout(() => finish({ supported: false, ok: false }), 3000);
      const finish = (result) => {
        clearTimeout(timeout);
        delete window[callback];
        script.remove();
        resolve(result);
      };
      window[callback] = (result) => finish({ supported: true, ok: result && result.ok === true });
      script.onerror = () => finish({ supported: false, ok: false });
      script.src = appsScriptUrl + (appsScriptUrl.includes("?") ? "&" : "?")
        + new URLSearchParams({ action: "verify", requestId, callback });
      document.head.appendChild(script);
    });
  }

  function isSheetReady(slug) {
    return new Promise((resolve) => {
      const callback = "__weddingSheetReady_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const timeout = setTimeout(() => finish(false), 5000);
      const finish = (ready) => {
        clearTimeout(timeout);
        delete window[callback];
        script.remove();
        resolve(ready === true);
      };
      window[callback] = (result) => finish(result && Array.isArray(result.comments));
      script.onerror = () => finish(false);
      script.src = appsScriptUrl + (appsScriptUrl.includes("?") ? "&" : "?")
        + new URLSearchParams({ action: "comments", slug, callback });
      document.head.appendChild(script);
    });
  }

  async function postToSheet(action, slug, input, init) {
    let body = init?.body;
    if (body === undefined && input instanceof Request) body = await input.clone().text();
    let data = {};
    try { data = typeof body === "string" ? JSON.parse(body) : {}; } catch {}

    const fields = new URLSearchParams({ action, slug });
    const requestId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : Date.now() + "-" + Math.random().toString(36).slice(2);
    fields.set("requestId", requestId);
    for (const key of ["name", "message", "attending", "guestCount"]) {
      if (data[key] !== undefined && data[key] !== null) fields.set(key, String(data[key]));
    }
    const guestCode = data.guestCode ?? data.guest_code;
    if (guestCode !== undefined && guestCode !== null) fields.set("guestCode", String(guestCode));
    if (data.rsvpAnswers) fields.set("rsvpAnswers", JSON.stringify(data.rsvpAnswers));

    try {
      await originalFetch.call(window, appsScriptUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: fields
      });
      const verification = await verifySheetWrite(requestId);
      let confirmed = verification.ok;
      if (!confirmed && action === "wish") {
        const result = await loadSheetComments(slug);
        const submittedName = String(data.name || "").trim();
        const submittedMessage = String(data.message || "").trim();
        confirmed = result.comments.some(comment =>
          String(comment.name || "").trim() === submittedName
          && String(comment.message || "").trim() === submittedMessage
        );
      }
      if (!confirmed && action === "rsvp" && !verification.supported) {
        confirmed = await isSheetReady(slug);
      }
      if (!confirmed) {
        return jsonResponse({ ok: false, error: "The response was not confirmed in the response sheet" }, 502);
      }
      return jsonResponse({ ok: true, comment: { id: "pending-" + Date.now(), ...data } });
    } catch (error) {
      return jsonResponse({ ok: false, error: "Could not submit to the response sheet" }, 502);
    }
  }

  window.fetch = async function (input) {
    const url = typeof input === "string" ? input : input?.url;
    if (isFileOrigin && url?.includes("/api/geo")) {
      return new Response(JSON.stringify({ country: "VN" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if ((isLocalServer || isFileOrigin) && url) {
      let remoteUrl;
      try {
        remoteUrl = new URL(url, window.location.href);
      } catch {}

      if (remoteUrl?.hostname === "api.chungdoi.com") {
        const isComments = /^\/api\/invite\/[^/]+\/comments$/.test(remoteUrl.pathname);
        const rsvpMatch = remoteUrl.pathname.match(/^\/api\/invitations\/([^/]+)\/rsvp$/);
        const isMusicTrack = /^\/api\/music-tracks(?:\/[^/]+)?$/.test(remoteUrl.pathname);
        const method = String(arguments[1]?.method || (input instanceof Request && input.method) || "GET").toUpperCase();

        if (appsScriptUrl && isComments && method === "GET") {
          return jsonResponse(await loadSheetComments(remoteUrl.pathname.split("/")[3]));
        }
        if (appsScriptUrl && isComments && method === "POST") {
          return postToSheet("wish", remoteUrl.pathname.split("/")[3], input, arguments[1]);
        }
        if (appsScriptUrl && rsvpMatch && method === "POST") {
          return postToSheet("rsvp", invitationSlug, input, arguments[1]);
        }

        const isTelemetry = remoteUrl.pathname === "/api/client-errors"
          || remoteUrl.pathname === "/api/track/pageview"
          || /^\/api\/invite\/[^/]+\/view$/.test(remoteUrl.pathname);

        if (isTelemetry) return new Response(null, { status: 204 });
        if (isComments || isMusicTrack || (rsvpMatch && method === "POST")) {
          const localUrl = `${window.location.origin}${remoteUrl.pathname}${remoteUrl.search}`;
          const localInput = input instanceof Request ? new Request(localUrl, input) : localUrl;
          return input instanceof Request
            ? originalFetch.call(this, localInput)
            : originalFetch.call(this, localInput, arguments[1]);
        }
      }

      if (remoteUrl?.hostname === "monitoring.soloflag.com" && remoteUrl.pathname === "/faro/collect") {
        return new Response(null, { status: 204 });
      }
    }

    return originalFetch.apply(this, arguments);
  };
})();
