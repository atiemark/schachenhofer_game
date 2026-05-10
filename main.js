import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
  StaticGeometryGenerator
} from 'three-mesh-bvh';

// =====================================================
// BVH ENABLE
// =====================================================
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// =====================================================
// SCENE
// =====================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

// =====================================================
// CAMERA
// =====================================================
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.8, 5);

// =====================================================
// RENDERER
// =====================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// =====================================================
// LIGHTS
// =====================================================
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 5);
scene.add(sun);

// =====================================================
// CONTROLS
// =====================================================
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// =====================================================
// UI (SAFE INIT)
// =====================================================
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const mobileShoot = document.getElementById('mobileShoot');

// =====================================================
// START GAME
// =====================================================
startButton?.addEventListener('click', () => {
  controls.lock();
  if (startScreen) startScreen.style.display = 'none';
});

// =====================================================
// INPUT
// =====================================================
const move = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') move.forward = true;
  if (e.code === 'KeyS') move.backward = true;
  if (e.code === 'KeyA') move.left = true;
  if (e.code === 'KeyD') move.right = true;
  if (e.code === 'ShiftLeft') move.sprint = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') move.forward = false;
  if (e.code === 'KeyS') move.backward = false;
  if (e.code === 'KeyA') move.left = false;
  if (e.code === 'KeyD') move.right = false;
  if (e.code === 'ShiftLeft') move.sprint = false;
});

// =====================================================
// MOBILE SHOOT (SAFE)
// =====================================================
function shootBall() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );

  scene.add(mesh);
  mesh.position.copy(camera.position);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  balls.push({
    mesh,
    velocity: dir.multiplyScalar(20),
    radius: 0.15,
    restitution: 0.8,
    friction: 0.985
  });
}

mobileShoot?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  shootBall();
});

// desktop shoot
window.addEventListener('mousedown', () => {
  if (controls.isLocked) shootBall();
});

// =====================================================
// FLOOR
// =====================================================
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x444444 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// =====================================================
// BVH COLLIDER
// =====================================================
let collider = null;

const loader = new GLTFLoader();
const ROOM_OFFSET = new THREE.Vector3(-32.642, 15.5, -19.152);

loader.load('./model.glb', (gltf) => {

  const room = gltf.scene;
  room.position.copy(ROOM_OFFSET);
  scene.add(room);

  room.updateMatrixWorld(true);

  const generator = new StaticGeometryGenerator(room);
  const merged = generator.generate();

  merged.computeBoundsTree = computeBoundsTree;
  merged.disposeBoundsTree = disposeBoundsTree;
  merged.computeBoundsTree();

  collider = new THREE.Mesh(
    merged,
    new THREE.MeshBasicMaterial({ visible: false })
  );

  scene.add(collider);

  console.log("BVH READY");
});

// =====================================================
// BALLS
// =====================================================
const balls = [];

// =====================================================
// ANIMATE
// =====================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // movement
  const speed = move.sprint ? 18 : 10;

  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();

  direction.z = Number(move.forward) - Number(move.backward);
  direction.x = Number(move.right) - Number(move.left);
  direction.normalize();

  velocity.z -= direction.z * speed * delta;
  velocity.x -= direction.x * speed * delta;

  controls.moveRight(-velocity.x);
  controls.moveForward(-velocity.z);

  // balls
  for (const b of balls) {
    b.velocity.y -= 9.8 * delta;

    const old = b.mesh.position.clone();

    b.mesh.position.addScaledVector(b.velocity, delta);

    if (collider) {
      const dir = new THREE.Vector3().subVectors(b.mesh.position, old);
      const dist = dir.length();

      if (dist > 0) {
        dir.normalize();

        const ray = new THREE.Raycaster(old, dir, 0, dist + b.radius);
        const hits = ray.intersectObject(collider, false);

        if (hits.length) {
          const hit = hits[0];

          const normal = hit.face.normal.clone();
          normal.transformDirection(collider.matrixWorld);
          normal.normalize();

          b.mesh.position.copy(hit.point);
          b.mesh.position.addScaledVector(normal, b.radius + 0.01);

          b.velocity.reflect(normal);
          b.velocity.multiplyScalar(b.restitution);
          b.velocity.multiplyScalar(b.friction);
        }
      }
    }
  }

  renderer.render(scene, camera);
}

animate();

// =====================================================
// RESIZE
// =====================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});