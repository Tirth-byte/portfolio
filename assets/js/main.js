/* click-to-load facade for the live Voxel Air embed (project page).
   Keeps the page weightless until the visitor asks for it; nothing
   auto-loads, nothing breaks if they don't. */
(function () {
  "use strict";
  var band = document.querySelector("[data-embed]");
  if (!band) return;
  var btn = band.querySelector("[data-embed-launch]");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var src = band.getAttribute("data-embed");
    var frame = document.createElement("iframe");
    frame.src = src;
    frame.title = "Voxel Air — live editor";
    frame.loading = "lazy";
    frame.allow = "camera; fullscreen";
    frame.setAttribute("style",
      "width:100%;height:min(70vh,560px);border:1.5px solid var(--ink);background:var(--inset);display:block");
    band.replaceWith(frame);
    frame.focus();
  });
})();
