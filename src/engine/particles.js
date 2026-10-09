export class Particles {
  constructor() { this.list = []; }

  emit(p) {
    this.list.push({
      vx: 0, vy: 0, gravity: 0, drag: 0, size: 1, additive: false, life: 1, ...p,
      maxLife: p.life ?? 1,
    });
  }

  burst(n, factory) { for (let i = 0; i < n; i++) this.emit(factory(i)); }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
      p.vy += p.gravity * dt;
      const damp = 1 - p.drag * dt;
      p.vx *= damp; p.vy *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor !== undefined && p.y > p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; }
    }
  }

  // layer: "under" (dust, below sprites) or "over" (glowing, above the darkness layer)
  draw(ctx, camera, layer) {
    ctx.save();
    for (const p of this.list) {
      if ((p.layer || "over") !== layer) continue;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalCompositeOperation = p.additive ? "lighter" : "source-over";
      ctx.globalAlpha = p.fade === false ? 1 : a;
      ctx.fillStyle = p.color;
      const x = (p.x - camera.x) | 0, y = (p.y - camera.y) | 0;
      if (p.glyph) {
        ctx.font = "bold 7px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.glyph, x, y);
      } else {
        const s = p.shrink ? Math.max(1, Math.round(p.size * a)) : p.size;
        ctx.fillRect(x, y, s, s);
        if (p.trail) ctx.fillRect(x - Math.sign(p.vx), y - Math.sign(p.vy), 1, 1);
      }
    }
    ctx.restore();
  }
}
