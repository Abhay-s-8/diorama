// Minimal stand-in for three.js: records what the runtime builds, renders nothing.
class Vec { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
class Obj { constructor() { this.position = new Vec(); this.rotation = new Vec(); this.scale = new Vec().set(1, 1, 1); this.children = []; } add(o) { this.children.push(o); return this; } }
export class Scene extends Obj { constructor() { super(); this.background = null; } }
export class Group extends Obj {}
export class PerspectiveCamera extends Obj { constructor(fov, aspect, near, far) { super(); Object.assign(this, { fov, aspect, near, far }); } lookAt() {} updateProjectionMatrix() {} }
export class Color { constructor(v) { this.value = v; } }
export class AmbientLight extends Obj { constructor(c, i) { super(); Object.assign(this, { color: c, intensity: i }); } }
export class DirectionalLight extends AmbientLight {}
export class PointLight extends AmbientLight {}
export class Mesh extends Obj { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
const geo = (type) => class { constructor(...args) { this.type = type; this.args = args; } };
export const BoxGeometry = geo('box');
export const SphereGeometry = geo('sphere');
export const CylinderGeometry = geo('cylinder');
export const ConeGeometry = geo('cone');
export const TorusGeometry = geo('torus');
export class MeshStandardMaterial { constructor(o) { this.options = o; } }
