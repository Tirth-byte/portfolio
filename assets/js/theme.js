(function(){
  "use strict";

  var storageKey="portfolio-theme";
  var html=document.documentElement;
  var reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function getTheme(){
    var s=localStorage.getItem(storageKey);
    if(s)return s;
    return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  }

  function applyTheme(t){
    if(t==="dark")html.setAttribute("data-theme","dark");
    else html.removeAttribute("data-theme");
    localStorage.setItem(storageKey,t);
    var m=document.querySelector('meta[name="theme-color"]');
    if(m)m.content=t==="dark"?"#161618":"#EFEEE8";
  }

  var toggle=document.createElement("button");
  toggle.className="theme-toggle";
  toggle.setAttribute("aria-label","Toggle dark mode");
  toggle.setAttribute("type","button");
  toggle.innerHTML=
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'+
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';

  var topbar=document.querySelector(".topbar .wrap");
  if(topbar){
    var status=topbar.querySelector(".status, .nolink");
    if(status)topbar.insertBefore(toggle,status);
    else topbar.appendChild(toggle);
  }

  var cur=getTheme();
  applyTheme(cur);

  function toggleTheme(e){
    if(reduced){
      cur=cur==="dark"?"light":"dark";
      applyTheme(cur);
      return;
    }
    var isDark=html.getAttribute("data-theme")==="dark";
    cur=isDark?"light":"dark";
    var rect=toggle.getBoundingClientRect();
    var x=e&&e.clientX!==void 0?e.clientX:rect.left+rect.width/2;
    var y=e&&e.clientY!==void 0?e.clientY:rect.top+rect.height/2;
    var bg=isDark?"#161618":"#EFEEE8";
    var overlay=document.createElement("div");
    overlay.className="theme-overlay";
    overlay.style.cssText="position:fixed;inset:0;z-index:9999;pointer-events:none;background:"+bg+";clip-path:circle(150% at "+x+"px "+y+"px);transition:clip-path .7s cubic-bezier(.4,0,.2,1)";
    document.body.appendChild(overlay);
    overlay.offsetHeight;
    applyTheme(cur);
    overlay.style.clipPath="circle(0 at "+x+"px "+y+"px)";
    setTimeout(function(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay)},800);
  }

  toggle.addEventListener("click",toggleTheme);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(e){
    if(!localStorage.getItem(storageKey)){
      cur=e.matches?"dark":"light";
      applyTheme(cur);
    }
  });

  if(!reduced&&"IntersectionObserver"in window){
    var els=document.querySelectorAll("[data-reveal]");
    if(els.length){
      var obs=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            entry.target.classList.add("revealed");
            obs.unobserve(entry.target);
          }
        });
      },{threshold:.1});
      Array.from(els).forEach(function(el){obs.observe(el)});
    }
  }else{
    Array.from(document.querySelectorAll("[data-reveal]")).forEach(function(el){el.classList.add("revealed")});
  }
})();
