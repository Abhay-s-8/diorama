import * as THREE from './three.module.min.js';
import { createStage } from './runtime.js';

const data = JSON.parse(document.getElementById('scene-data').textContent);
const canvas = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const stage = createStage(THREE, data, window.innerWidth, window.innerHeight);

function fit() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  stage.resize(window.innerWidth, window.innerHeight);
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
