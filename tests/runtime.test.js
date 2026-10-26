import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './stubThree.js';
import { createStage } from '../src/runtime.js';
import { FALLBACK_SCENE } from '../src/schema.js';

const data = () => ({
  title: 't',
  mood: 'calm',
  palette: { background: '#101820', primary: '#f2aa4c', accent: '#e0e0e0' },
  objects: [
    { shape: 'box', color: '#111111', position: [1, 2, 3], size: 2, animation: 'none' },
    { shape: 'sphere', color: '#222222', position: [0, 0, 0], size: 1, animation: 'float' },
    { shape: 'cylinder', color: '#333333', position: [0, 0, 0], size: 1, animation: 'spin' },
    { shape: 'cone', color: '#444444', position: [0, 0, 0], size: 1, animation: 'pulse' },
    { shape: 'torus', color: '#555555', position: [0, 0, 0], size: 1.5, animation: 'none' },
  ],
  sections: [],
});

test('builds one mesh per object with the right geometry and colour', () => {
  const s = createStage(THREE, data(), 800, 600);
  assert.equal(s.meshes.length, 5);
  assert.deepEqual(s.meshes.map((m) => m.geometry.type), ['box', 'sphere', 'cylinder', 'cone', 'torus']);
  assert.equal(s.meshes[0].material.options.color, '#111111');
  assert.deepEqual(s.meshes[0].geometry.args, [2, 2, 2]);
  assert.equal(s.meshes[1].geometry.args[0], 0.5);
});

test('positions come from the scene, and the scene has no backdrop so the page shows through', () => {
  const s = createStage(THREE, data(), 800, 600);
  assert.deepEqual([s.meshes[0].position.x, s.meshes[0].position.y, s.meshes[0].position.z], [1, 2, 3]);
  assert.equal(s.scene.background, null);
});

test('the camera uses the viewport aspect ratio and can resize', () => {
  const s = createStage(THREE, data(), 800, 400);
  assert.equal(s.camera.aspect, 2);
  s.resize(300, 600);
  assert.equal(s.camera.aspect, 0.5);
});

test('resize ignores zero height', () => {
  const s = createStage(THREE, data(), 800, 400);
  s.resize(100, 0);
  assert.equal(s.camera.aspect, 2);
});

test('there is at least one light', () => {
  const s = createStage(THREE, data(), 800, 600);
  const lights = s.scene.children.filter((c) => 'intensity' in c);
  assert.ok(lights.length >= 2);
});

test('tick leaves animation none objects in place', () => {
  const s = createStage(THREE, data(), 800, 600);
  s.tick(3);
  assert.deepEqual([s.meshes[0].position.x, s.meshes[0].position.y, s.meshes[0].position.z], [1, 2, 3]);
  assert.equal(s.meshes[0].rotation.y, 0);
});

test('float moves up and down around the base height', () => {
  const s = createStage(THREE, data(), 800, 600);
  const ys = [0, 0.5, 1, 1.5, 2, 2.5, 3].map((t) => { s.tick(t); return s.meshes[1].position.y; });
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.1);
  assert.ok(ys.every((y) => Math.abs(y) <= 0.31));
});

test('spin changes the rotation over time', () => {
  const s = createStage(THREE, data(), 800, 600);
  s.tick(0);
  const a = s.meshes[2].rotation.y;
  s.tick(1);
  assert.notEqual(s.meshes[2].rotation.y, a);
});

test('pulse stays within a small scale range and never collapses', () => {
  const s = createStage(THREE, data(), 800, 600);
  for (let t = 0; t < 10; t += 0.1) {
    s.tick(t);
    assert.ok(s.meshes[3].scale.x > 0.8 && s.meshes[3].scale.x < 1.2);
  }
});

test('the whole group turns slowly so every scene has some motion', () => {
  const s = createStage(THREE, data(), 800, 600);
  s.tick(0);
  const a = s.group.rotation.y;
  s.tick(10);
  assert.notEqual(s.group.rotation.y, a);
});

test('tick is deterministic', () => {
  const a = createStage(THREE, data(), 800, 600);
  const b = createStage(THREE, data(), 800, 600);
  a.tick(2.5); b.tick(2.5);
  assert.equal(a.meshes[1].position.y, b.meshes[1].position.y);
});

test('works with the fallback scene', () => {
  const s = createStage(THREE, FALLBACK_SCENE, 640, 480);
  assert.equal(s.meshes.length, FALLBACK_SCENE.objects.length);
  s.tick(1);
});

/* ---------- camera framing: the whole scene must fit, even in a tall, narrow canvas ---------- */

const wide = () => ({
  ...data(),
  objects: [
    { shape: 'box', color: '#111111', position: [-3, 0, 0], size: 1, animation: 'spin' },
    { shape: 'torus', color: '#222222', position: [3, 1, 0], size: 1, animation: 'spin' },
  ],
});

// The group turns around the y axis, so what must fit is the largest distance from that axis.
const reach = (objs) => Math.max(...objs.map((o) => Math.hypot(o.position[0], o.position[2]) + o.size / 2));
const fits = (s, objs) => {
  const r = reach(objs);
  const halfWidthAtNearEdge = (s.camera.position.z - r) * Math.tan((s.camera.fov / 2) * Math.PI / 180) * s.camera.aspect;
  return halfWidthAtNearEdge >= r;
};

test('every object fits across a tall, narrow canvas', () => {
  const d = wide();
  const s = createStage(THREE, d, 498, 787);
  assert.ok(fits(s, d.objects), `camera z ${s.camera.position.z}`);
});

test('the camera pulls back when the canvas gets narrower, and again after a resize', () => {
  const d = wide();
  const s = createStage(THREE, d, 1200, 600);
  const zWide = s.camera.position.z;
  s.resize(400, 800);
  assert.ok(s.camera.position.z > zWide);
  assert.ok(fits(s, d.objects));
  s.resize(1200, 600);
  assert.equal(s.camera.position.z, zWide);
});

test('a small scene in a wide canvas keeps the default distance of 10', () => {
  const d = { ...data(), objects: [{ shape: 'sphere', color: '#111111', position: [0, 0, 0], size: 1, animation: 'none' }] };
  const s = createStage(THREE, d, 1200, 600);
  assert.equal(s.camera.position.z, 10);
});

test('a scene with no objects does not break the camera', () => {
  const s = createStage(THREE, { ...data(), objects: [] }, 300, 800);
  assert.equal(s.camera.position.z, 10);
});
