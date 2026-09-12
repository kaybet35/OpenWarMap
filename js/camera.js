/* Cameras use map coordinates; input changes never resize the backing canvas. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  const states = { world: { zoom: 1, x: 0.5, y: 0.5 }, detail: { zoom: 1, x: 0.5, y: 0.5 } };
  const gestures = new Map();
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  function view(kind, width, height) {
    const state = states[kind];
    const mw = kind === 'world' ? app.layout.width : 1024;
    const mh = kind === 'world' ? app.layout.height : 888;
    const fit = Math.min(width / mw, height / mh);
    if (!(fit > 0)) return null;
    // Each region source is 1024px wide. Do not magnify beyond its native scale.
    const nativeScale = kind === 'world' ? 1024 / 1028 : 1;
    const maxZoom = Math.max(1, nativeScale / fit);
    state.zoom = clamp(state.zoom, 1, maxZoom);
    const scale = fit * state.zoom;
    const bound = (center, span, size) => span >= size ? 0.5 : clamp(center, span / (2 * size), 1 - span / (2 * size));
    state.x = bound(state.x, width / scale, mw);
    state.y = bound(state.y, height / scale, mh);
    return { scale, offsetX: width / 2 - state.x * mw * scale,
      offsetY: height / 2 - state.y * mh * scale, width, height, mw, mh, maxZoom, zoom: state.zoom };
  }
  function canvas(kind) { return kind === 'world' ? app.ui.worldCanvas : app.ui.detailCanvas; }
  function current(kind) {
    const rect = canvas(kind).getBoundingClientRect();
    return view(kind, rect.width, rect.height);
  }
  function transform(kind, factor, from, to = from) {
    const old = current(kind);
    if (!old) return;
    const state = states[kind];
    const mx = (from.x - old.offsetX) / old.scale, my = (from.y - old.offsetY) / old.scale;
    const zoom = clamp(state.zoom * factor, 1, old.maxZoom);
    const scale = old.scale * zoom / state.zoom;
    state.zoom = zoom;
    state.x = (mx - (to.x - old.width / 2) / scale) / old.mw;
    state.y = (my - (to.y - old.height / 2) / scale) / old.mh;
    view(kind, old.width, old.height);
    app.render.request(kind);
  }
  function reset(kind, redraw = true) {
    Object.assign(states[kind], { zoom: 1, x: 0.5, y: 0.5 });
    cancel();
    if (redraw) app.render.request(kind);
  }
  function cancel() {
    for (const [node, gesture] of gestures) {
      for (const id of gesture.points.keys()) if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
      gesture.points.clear(); gesture.dragged = false;
      node.classList.remove('is-panning');
    }
  }
  function setup(kind) {
    const node = canvas(kind), g = { points: new Map(), dragged: false, suppress: false };
    gestures.set(node, g);
    const point = event => { const r = node.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
    const pair = points => {
      const [a,b] = points;
      return { midpoint: { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }, distance: Math.hypot(a.x-b.x,a.y-b.y) };
    };
    node.addEventListener('wheel', event => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1);
      transform(kind, Math.exp(-clamp(delta, -240, 240) * 0.003), point(event));
      node.dispatchEvent(new Event('mapgesture'));
    }, { passive: false });
    node.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      if (!g.points.size) { g.dragged = false; g.suppress = false; g.start = point(event); }
      g.points.set(event.pointerId, point(event));
      if (g.points.size > 1) g.dragged = g.suppress = true;
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener('pointermove', event => {
      if (!g.points.has(event.pointerId)) return;
      const before = [...g.points.values()].slice(0,2);
      const previous = g.points.get(event.pointerId), next = point(event);
      g.points.set(event.pointerId, next);
      if (g.points.size >= 2) {
        const a = pair(before), b = pair([...g.points.values()].slice(0,2));
        transform(kind, a.distance > 0 ? b.distance / a.distance : 1, a.midpoint, b.midpoint);
      } else {
        if (!g.dragged && Math.hypot(next.x-g.start.x,next.y-g.start.y) < 5) return;
        transform(kind, 1, g.dragged ? previous : g.start, next);
      }
      g.dragged = g.suppress = true;
      node.classList.add('is-panning');
      node.dispatchEvent(new Event('mapgesture'));
    });
    const end = event => {
      g.points.delete(event.pointerId);
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
      if (!g.points.size) node.classList.remove('is-panning');
    };
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', event => { g.suppress = true; end(event); });
    node.addEventListener('lostpointercapture', end);
    node.addEventListener('click', event => {
      if (g.suppress) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    node.addEventListener('keydown', event => {
      const v = current(kind); if (!v) return;
      const middle = { x: v.width/2, y: v.height/2 };
      if (['+', '=', '-', '_', '0', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        if (event.key === '0' || event.key === 'Home') reset(kind);
        else if (event.key.startsWith('Arrow')) {
          const dx = event.key === 'ArrowLeft' ? 60 : event.key === 'ArrowRight' ? -60 : 0;
          const dy = event.key === 'ArrowUp' ? 60 : event.key === 'ArrowDown' ? -60 : 0;
          transform(kind, 1, middle, {x:middle.x+dx,y:middle.y+dy});
        } else transform(kind, ['+', '='].includes(event.key) ? 1.25 : 0.8, middle);
        node.dispatchEvent(new Event('mapgesture'));
      }
    });
  }
  app.camera = { view, transform, reset, cancel,
    interacting: node => !!gestures.get(node)?.points.size,
    setup() {
      setup('world'); setup('detail');
      for (const button of document.querySelectorAll('[data-map-reset]')) {
        button.addEventListener('click', () => { reset(button.dataset.mapReset); canvas(button.dataset.mapReset).dispatchEvent(new Event('mapgesture')); });
      }
    }
  };
})();
