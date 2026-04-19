// Theme toggle: cycles light → dark → system.
(function () {
  const root = document.documentElement;
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function current() {
    return root.dataset.theme || "system";
  }

  function apply(t) {
    if (t === "system") {
      delete root.dataset.theme;
      try { localStorage.removeItem("theme"); } catch (e) {}
    } else {
      root.dataset.theme = t;
      try { localStorage.setItem("theme", t); } catch (e) {}
    }
  }

  btn.addEventListener("click", () => {
    const order = ["system", "light", "dark"];
    const i = order.indexOf(current());
    apply(order[(i + 1) % order.length]);
  });
})();
