export class Camera {
  constructor(viewportWidth, viewportHeight) {
    this.vw = viewportWidth;
    this.vh = viewportHeight;
    this.x = 0;
    this.y = 0;
    this.bounds = null;
  }

  setBounds(width, height) { this.bounds = { width, height }; }

  follow(targetX, targetY, lerp = 0.18) {
    const desiredX = targetX - this.vw / 2;
    const desiredY = targetY - this.vh / 2;
    this.x += (desiredX - this.x) * lerp;
    this.y += (desiredY - this.y) * lerp;
    this._clamp();
  }

  snapTo(targetX, targetY) {
    this.x = targetX - this.vw / 2;
    this.y = targetY - this.vh / 2;
    this._clamp();
  }

  _clamp() {
    if (!this.bounds) return;
    const maxX = Math.max(0, this.bounds.width - this.vw);
    const maxY = Math.max(0, this.bounds.height - this.vh);
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;
    if (this.x > maxX) this.x = maxX;
    if (this.y > maxY) this.y = maxY;
  }
}
