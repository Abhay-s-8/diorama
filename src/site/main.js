import * as THREE from './three.module.min.js';
import { createStage } from './runtime.js';

const data = JSON.parse(document.getElementById('scene-data').textContent);
const canvas = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const stage = createStage(THREE, data, canvas.clientWidth || 800, canvas.clientHeight || 600);

function fit() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  stage.resize(w, h);
}
fit();
window.addEventListener('resize', fit);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = new THREE.Clock();

function frame() {
  stage.tick(reduceMotion ? 0 : clock.getElapsedTime());
  renderer.render(stage.scene, stage.camera);
  requestAnimationFrame(frame);
}
frame();
