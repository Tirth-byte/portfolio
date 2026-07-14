/* Read a pull request — live GitHub API, no backend, no key.
   The deterministic ingestion layer Qeist runs before the model writes a
   checklist: fetch a real PR, report its true change surface, flag
   security-sensitive files. Every number comes straight from api.github.com.

   Hardened: explicit state for every failure (403 rate-limit, 404, malformed
   input, network error, timeout), an 8s timeout so it can never hang, and a
   pre-baked cache (window.PR_CACHE) so the three examples ALWAYS render — even
   rate-limited or fully offline. */
(function () {
  "use strict";
  var form = document.getElementById("pr-form");
  if (!form) return;
  var input = document.getElementById("pr-input");
  var out = document.getElementById("pr-out");
  var btn = document.getElementById("pr-btn");
  var CACHE = window.PR_CACHE || {};
  var TIMEOUT = 8000;

  var SENSITIVE = /(auth|token|login|session|password|secret|cred|payment|billing|checkout|webhook|security|permission|firestore|\.env|(^|\/)api[\/.]|(^|\/)rules)/i;
  function category(f) {
    if (/(\.test\.|\.spec\.|(^|\/)tests?\/|__tests__)/i.test(f)) return "test";
    if (/(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|dockerfile)/i.test(f)) return "build";
    if (/\.(css|scss|sass|less)$/i.test(f)) return "style";
    if (/(\.(md|mdx|txt)$|(^|\/)docs?\/)/i.test(f)) return "docs";
    if (/(\.(ya?ml|toml|ini|env)$|(^|\/)\.github\/|\.config\.[jt]s$|\.json$)/i.test(f)) return "config";
    return "source";
  }
  function parse(v) {
    v = (v || "").trim();
    var m = v.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)\/pull\/(\d+)/i)
      || v.match(/^([^\/\s]+)\/([^\/#\s]+)#(\d+)$/)
      || v.match(/^([^\/\s]+)\/([^\/\s]+)\/(\d+)$/);
    return m ? { o: m[1], r: m[2], n: m[3] } : null;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function refLabel(p) { return esc(p.o + "/" + p.r + " #" + p.n); }
  function show(html) { out.innerHTML = html; }

  // ---------- visible states ----------
  function box(kind, role, label, body) {
    return '<div class="pr-msg pr-msg--' + kind + '" role="' + role + '">'
      + '<div class="pr-msg__label">' + label + '</div>'
      + '<div class="pr-msg__body">' + body + '</div></div>';
  }
  function waitBox(p) {
    return box("wait", "status", 'Reading<span class="dots" aria-hidden="true"></span>',
      "Querying api.github.com for <b>" + refLabel(p) + "</b>.");
  }
  function errorFor(kind, p, status) {
    switch (kind) {
      case "rate": return box("rate", "alert", "Rate limit",
        "GitHub&rsquo;s anonymous limit is 60 requests/hour — and it&rsquo;s spent for now. Try one of the examples below; they&rsquo;re cached and always work.");
      case "notfound": return box("notfound", "alert", "Not found",
        "No public PR at <b>" + refLabel(p) + "</b>. It may be a private repo, or the owner, name, or number is off.");
      case "malformed": return box("malformed", "alert", "Check the format",
        "That doesn&rsquo;t parse as a pull request. Use <code>owner/repo#123</code> or paste a github.com pull-request URL.");
      case "network": return box("network", "alert", "Network error",
        "Couldn&rsquo;t reach api.github.com — this looks like a network problem. Check your connection, or try a cached example below.");
      case "timeout": return box("timeout", "alert", "Timed out",
        "api.github.com didn&rsquo;t respond within 8 seconds. Try again, or use a cached example below.");
      default: return box("network", "alert", "Unexpected response",
        "GitHub returned an unexpected response" + (status ? " (" + status + ")" : "") + ". Try again, or use a cached example below.");
    }
  }
  function reasonText(r) {
    return { rate: "rate-limited", timeout: "timed out", network: "offline", notfound: "unavailable", status: "error" }[r] || "unavailable";
  }

  // ---------- fetch with hard timeout (never hangs) ----------
  function fetchJson(url) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);
    return fetch(url, { headers: { Accept: "application/vnd.github+json" }, signal: ctrl.signal })
      .then(function (r) { clearTimeout(timer); return r; },
            function (e) { clearTimeout(timer); throw e; });
  }

  function done() { btn.disabled = false; out.removeAttribute("aria-busy"); }

  function run(value) {
    var p = parse(value);
    if (!p) { show(errorFor("malformed", { o: "", r: "", n: "" })); return; }
    var cached = CACHE[(p.o + "/" + p.r + "#" + p.n).toLowerCase()];
    btn.disabled = true; out.setAttribute("aria-busy", "true");
    show(waitBox(p));
    var base = "https://api.github.com/repos/" + p.o + "/" + p.r + "/pulls/" + p.n;

    fetchJson(base).then(function (r) {
      if (r.status === 403 || r.status === 429) return fail("rate", p, cached);
      if (r.status === 404) return fail("notfound", p, cached);
      if (!r.ok) return fail("status", p, cached, r.status);
      return r.json().then(function (meta) {
        return fetchJson(base + "/files?per_page=100")
          .then(function (fr) { return fr.ok ? fr.json() : []; }, function () { return []; })
          .then(function (files) { renderResult(p, meta, Array.isArray(files) ? files : [], null); });
      });
    }, function (e) {
      fail(e && e.name === "AbortError" ? "timeout" : "network", p, cached);
    }).catch(function () {
      fail("network", p, cached);
    }).then(done);
  }

  // On any failure, an example falls back to its cached snapshot; anything else
  // shows the explicit error state.
  function fail(kind, p, cached, status) {
    if (cached) renderResult(p, cached.meta, cached.files, { reason: kind });
    else show(errorFor(kind, p, status));
  }

  function renderResult(p, meta, files, opts) {
    files = Array.isArray(files) ? files : [];
    var sens = files.filter(function (f) { return SENSITIVE.test(f.filename); });
    var rows = files.map(function (f) {
      var flag = SENSITIVE.test(f.filename) ? '<span class="pr-sens">review first</span>' : "";
      return '<li class="pr-file"><span class="pr-cat">' + category(f.filename) + "</span>"
        + '<a class="pr-fn" href="' + esc(f.blob_url || meta.html_url) + '" target="_blank" rel="noopener">' + esc(f.filename) + "</a>"
        + '<span class="pr-delta"><span class="pr-add">+' + f.additions + '</span> <span class="pr-del">&minus;' + f.deletions + "</span></span>"
        + flag + "</li>";
    }).join("");
    var state = esc(meta.merged ? "merged" : meta.state);
    var badge = opts && opts.reason
      ? '<div class="pr-cachebadge">Cached snapshot &middot; live API ' + reasonText(opts.reason) + "</div>" : "";
    var src = opts && opts.reason
      ? "Served from a pre-cached snapshot &middot; the three examples always work."
      : "Live from api.github.com &middot; deterministic analysis, no model in this widget.";
    show(badge
      + '<div class="pr-head"><span class="pr-state pr-state-' + state + '">' + state + "</span>"
      + '<a class="pr-title" href="' + esc(meta.html_url) + '" target="_blank" rel="noopener">' + esc(meta.title) + " &#8599;</a></div>"
      + '<div class="pr-by">#' + esc(meta.number) + " by " + esc(meta.user && meta.user.login) + " &middot; " + esc(meta.commits) + " commit" + (meta.commits == 1 ? "" : "s") + "</div>"
      + '<div class="pr-stats"><span><b>' + esc(meta.changed_files) + "</b> file" + (meta.changed_files == 1 ? "" : "s") + '</span><span class="pr-add"><b>+' + esc(meta.additions) + '</b></span><span class="pr-del"><b>&minus;' + esc(meta.deletions) + "</b></span></div>"
      + '<ul class="pr-files">' + rows + "</ul>"
      + '<p class="pr-note">' + (sens.length
        ? "<b>" + sens.length + " of " + files.length + "</b> changed file" + (files.length == 1 ? "" : "s") + " touch security-sensitive paths (auth, tokens, payments, API). A QA pass would start there."
        : "No obviously security-sensitive paths in this diff.")
      + "</p><p class=\"pr-src\">" + src + "</p>");
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); run(input.value); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-pr]"), function (chip) {
    chip.addEventListener("click", function () { input.value = chip.getAttribute("data-pr"); run(input.value); });
  });

  // deep-link ?pr=owner/repo/123 auto-runs · ?pr_sim=<state> renders a state for review
  try {
    var params = new URLSearchParams(location.search);
    var sim = params.get("pr_sim");
    if (sim) demo(sim);
    else { var q = params.get("pr"); if (q) { input.value = q; run(q); } }
  } catch (e) {}

  function demo(kind) {
    var fake = { o: "Tirth-byte", r: "private-billing", n: "42" };
    if (kind === "wait") show(waitBox({ o: "Tirth-byte", r: "testing-testosa", n: "3" }));
    else if (kind === "cached") {
      var c = CACHE["tirth-byte/testing-testosa#3"];
      if (c) renderResult({ o: "Tirth-byte", r: "testing-testosa", n: "3" }, c.meta, c.files, { reason: "rate" });
    }
    else show(errorFor(kind, fake));
  }
})();
