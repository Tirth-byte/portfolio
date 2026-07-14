/* Read a pull request — live GitHub API, no backend, no key.
   This is the deterministic ingestion layer Qeist runs before the model
   writes a checklist: fetch a real PR, report its true change surface, and
   flag security-sensitive files. Nothing here is simulated — every number
   comes straight from api.github.com. */
(function () {
  "use strict";
  var form = document.getElementById("pr-form");
  if (!form) return;
  var input = document.getElementById("pr-input");
  var out = document.getElementById("pr-out");
  var btn = document.getElementById("pr-btn");

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
  function msg(t) { return '<p class="pr-msg">' + t + "</p>"; }

  function run(v) {
    var p = parse(v);
    if (!p) { out.innerHTML = msg("Enter a PR as <code>owner/repo#123</code> or a github.com pull-request link."); return; }
    btn.disabled = true;
    out.setAttribute("aria-busy", "true");
    out.innerHTML = msg("Reading " + esc(p.o + "/" + p.r + " #" + p.n) + " from the live GitHub API…");
    var base = "https://api.github.com/repos/" + p.o + "/" + p.r + "/pulls/" + p.n;
    var H = { headers: { Accept: "application/vnd.github+json" } };
    var meta;
    fetch(base, H).then(function (r) {
      if (r.status === 403) throw { rate: 1 };
      if (r.status === 404) throw { notfound: 1 };
      if (!r.ok) throw { status: r.status };
      return r.json();
    }).then(function (m) {
      meta = m;
      return fetch(base + "/files?per_page=100", H).then(function (r) { return r.ok ? r.json() : []; });
    }).then(function (files) {
      render(p, meta, Array.isArray(files) ? files : []);
    }).catch(function (e) {
      if (e && e.rate) out.innerHTML = msg("GitHub&rsquo;s unauthenticated API limit (60/hour) is spent for now — give it a few minutes, or open the PR on GitHub.");
      else if (e && e.notfound) out.innerHTML = msg("No public PR found at " + esc(p.o + "/" + p.r + " #" + p.n) + ". Check the owner, repo, and number.");
      else out.innerHTML = msg("Couldn&rsquo;t reach the GitHub API" + (e && e.status ? " (" + e.status + ")" : "") + " — likely a network hiccup. Try again.");
    }).then(function () {
      btn.disabled = false; out.removeAttribute("aria-busy");
    });
  }

  function render(p, meta, files) {
    var sens = files.filter(function (f) { return SENSITIVE.test(f.filename); });
    var rows = files.map(function (f) {
      var cat = category(f.filename);
      var flag = SENSITIVE.test(f.filename) ? '<span class="pr-sens">review first</span>' : "";
      return '<li class="pr-file"><span class="pr-cat">' + cat + "</span>"
        + '<a class="pr-fn" href="' + esc(f.blob_url || meta.html_url) + '" target="_blank" rel="noopener">' + esc(f.filename) + "</a>"
        + '<span class="pr-delta"><span class="pr-add">+' + f.additions + '</span> <span class="pr-del">−' + f.deletions + "</span></span>"
        + flag + "</li>";
    }).join("");
    var state = esc(meta.merged ? "merged" : meta.state);
    out.innerHTML =
      '<div class="pr-head"><span class="pr-state pr-state-' + state + '">' + state + "</span>"
      + '<a class="pr-title" href="' + esc(meta.html_url) + '" target="_blank" rel="noopener">' + esc(meta.title) + " ↗</a></div>"
      + '<div class="pr-by">#' + esc(meta.number) + " by " + esc(meta.user && meta.user.login) + " · " + esc(meta.commits) + " commit" + (meta.commits == 1 ? "" : "s") + "</div>"
      + '<div class="pr-stats"><span><b>' + esc(meta.changed_files) + "</b> file" + (meta.changed_files == 1 ? "" : "s") + '</span><span class="pr-add"><b>+' + esc(meta.additions) + '</b></span><span class="pr-del"><b>−' + esc(meta.deletions) + "</b></span></div>"
      + '<ul class="pr-files">' + rows + "</ul>"
      + '<p class="pr-note">' + (sens.length
        ? "<b>" + sens.length + " of " + files.length + "</b> changed file" + (files.length == 1 ? "" : "s") + " touch security-sensitive paths (auth, tokens, payments, API). A QA pass would start there."
        : "No obviously security-sensitive paths in this diff.")
      + "</p>"
      + '<p class="pr-src">Live from api.github.com &middot; deterministic analysis, no model in this widget.</p>';
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); run(input.value); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-pr]"), function (chip) {
    chip.addEventListener("click", function () { input.value = chip.getAttribute("data-pr"); run(input.value); });
  });
  // deep-link / demo: ?pr=owner/repo/123 auto-runs (kept out of the default page load)
  try {
    var q = new URLSearchParams(location.search).get("pr");
    if (q) { input.value = q; run(q); }
  } catch (e) {}
})();
