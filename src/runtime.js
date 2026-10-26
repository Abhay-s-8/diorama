/* Scene runtime. Takes the THREE namespace as a parameter so it can be tested with a stub. */

function geometryFor(THREE, shape, size) {
  switch (shape) {
    case 'sphere': return new THREE.SphereGeometry(size / 2, 32, 24);
    case 'cylinder': return new THREE.CylinderGeometry(size / 2, size / 2, size, 32);
    case 'cone': return new THREE.ConeGeometry(size / 2, size, 32);
    case 'torus': return new THREE.TorusGeometry(size / 2, size / 6, 16, 48);
    default: return new THREE.BoxGeometry(size, size, size);
  }
}

export function createStage(THREE, data, width, height) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(data.palette.background);

  const FOV = 50;
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 100);

  // The group turns around the y axis, so what must stay in view is the largest
  // distance from that axis. Pull the camera back until that fits the canvas width.
  const reach = Math.max(0, ...data.objects.map((o) => Math.hypot(o.position[0], o.position[2]) + o.size / 2));
  const tanHalf = Math.tan((FOV / 2) * Math.PI / 180);
  function placeCamera() {
    const fitWidth = (reach * 1.15) / (tanHalf * camera.aspect) + reach;
    camera.position.set(0, 1.5, Math.min(Math.max(10, fitWidth), 60));
    camera.lookAt(0, 0, 0);
  }
  placeCamera();

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.PointLight(data.palette.accent, 40);
  rim.position.set(-6, 3, -4);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  const meshes = data.objects.map((o) => {
    const mesh = new THREE.Mesh(
      geometryFor(THREE, o.shape, o.size),
      new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.45, metalness: 0.2 }),
    );
    mesh.position.set(o.position[0], o.position[1], o.position[2]);
    group.add(mesh);
    return mesh;
  });

  function tick(t) {
    group.rotation.y = t * 0.15;
    data.objects.forEach((o, i) => {
      const m = meshes[i];
      if (o.animation === 'spin') {
        m.rotation.y = t * 1.2;
        m.rotation.x = t * 0.4;
      } else if (o.animation === 'float') {
        m.position.y = o.position[1] + Math.sin(t * 1.5 + i) * 0.3;
      } else if (o.animation === 'pulse') {
        const s = 1 + 0.12 * Math.sin(t * 2 + i);
        m.scale.set(s, s, s);
      }
    });
  }

  function resize(w, h) {
    if (!h) return;
    camera.aspect = w / h;
    placeCamera();
    camera.updateProjectionMatrix();
  }

  return { scene, camera, group, meshes, tick, resize };
}
