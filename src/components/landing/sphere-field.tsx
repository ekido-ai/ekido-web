"use client";

import { useEffect, useRef } from "react";

/**
 * Field of glossy 3D spheres that drift and get pushed away by the pointer.
 * Each sphere stands for a GPU node: most share the warm accent, a few carry the
 * provider colors from the dashboard. Pure canvas, no libraries.
 * Respects prefers-reduced-motion (draws one still frame) and pauses when hidden.
 */

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  sprite: number;
  phase: number;
}

const HUES = [
  // [base, highlight, shadow]: warm accent first, it is the majority.
  ["#f04a2a", "#ffb7a3", "#a31d0b"],
  ["#3987e5", "#b9d6ff", "#1c4f94"],
  ["#199e70", "#a6ecd1", "#0b5e41"],
] as const;

function makeSprite(colors: readonly string[], size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = size / 2;
  // Body: light from the upper left.
  const body = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.05, r, r, r);
  body.addColorStop(0, colors[1]);
  body.addColorStop(0.35, colors[0]);
  body.addColorStop(1, colors[2]);
  g.fillStyle = body;
  g.beginPath();
  g.arc(r, r, r * 0.98, 0, Math.PI * 2);
  g.fill();
  // Specular highlight.
  const spec = g.createRadialGradient(r * 0.68, r * 0.55, 0, r * 0.68, r * 0.55, r * 0.38);
  spec.addColorStop(0, "rgba(255,255,255,0.85)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = spec;
  g.fill();
  return c;
}

/** `density` scales the sphere count (1 = landing hero; lower for a decorative band). */
export function SphereField({ className, density = 1 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sprites = HUES.map((h) => makeSprite(h, 256));
    let w = 0;
    let h = 0;
    let balls: Ball[] = [];
    const pointer = { x: -9999, y: -9999 };
    let raf = 0;
    let visible = true;

    const seed = () => {
      // Density scales with area, so phones are not buried in spheres.
      const count = Math.round(Math.min(110, Math.max(28, (w * h) / 14000)) * density);
      balls = Array.from({ length: count }, () => {
        const roll = Math.random();
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: 10 + Math.random() ** 2 * 34 + (w > 900 ? 6 : 0),
          sprite: roll < 0.84 ? 0 : roll < 0.93 ? 1 : 2,
          phase: Math.random() * Math.PI * 2,
        };
      });
      // Small ones behind, big ones in front: reads as depth.
      balls.sort((a, b) => a.r - b.r);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw(0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const b of balls) {
        const bob = reduced ? 0 : Math.sin(t / 1400 + b.phase) * 0.12 * b.r;
        // Soft contact shadow.
        ctx.fillStyle = "rgba(90, 40, 20, 0.08)";
        ctx.beginPath();
        ctx.ellipse(b.x + b.r * 0.15, b.y + bob + b.r * 0.9, b.r * 0.8, b.r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(sprites[b.sprite], b.x - b.r, b.y + bob - b.r, b.r * 2, b.r * 2);
      }
    };

    const step = (t: number) => {
      for (const b of balls) {
        const dx = b.x - pointer.x;
        const dy = b.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const reach = 140 + b.r;
        if (d2 < reach * reach && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = ((reach - d) / reach) * 0.9;
          b.vx += (dx / d) * push;
          b.vy += (dy / d) * push;
        }
        b.vx *= 0.94;
        b.vy *= 0.94;
        // Gentle wander keeps the field alive after a push dies down.
        b.vx += (Math.random() - 0.5) * 0.03;
        b.vy += (Math.random() - 0.5) * 0.03;
        b.x += b.vx;
        b.y += b.vy;
        const m = b.r;
        if (b.x < -m) b.x = w + m;
        if (b.x > w + m) b.x = -m;
        if (b.y < -m) b.y = h + m;
        if (b.y > h + m) b.y = -m;
      }
      draw(t);
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (reduced || raf || !visible || document.hidden) return;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = pointer.y = -9999;
    };
    const onVis = () => (document.hidden ? stop() : start());

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    resize();
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
