import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
  StaticGeometryGenerator
} from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;

// =====================================================
// SCENE
// =====================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

// CAMERA
const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.8, 5);

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// LIGHT
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 5);
scene.add(sun);

// =====================================================
// START SCREEN FIX
// =====================================================
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');

function startGame() {
  if (startScreen) {
    startScreen.style.display = 'none';
    startScreen.style.pointerEvents = 'none';
  }
}

startButton?.addEventListener('click', startGame);

// =====================================================
// INPUT (DESKTOP)
// =====================================================
const move = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false
};

addEventListener('keydown', e => {
  if (e.code === 'KeyW') move.forward = true;
  if (e.code === 'KeyS') move.back = true;
  if (e.code === 'KeyA') move.left = true;
  if (e.code === 'KeyD') move.right = true;
  if (e.code === 'ShiftLeft') move.sprint = true;
});

addEventListener('keyup', e => {
  if (e.code === 'KeyW') move.forward = false;
  if (e.code === 'KeyS') move.back = false;
  if (e.code === 'KeyA') move.left = false;
  if (e.code === 'KeyD') move.right = false;
  if (e.code === 'ShiftLeft') move.sprint = false;
});

// =====================================================
// MOBILE LOOK (FIXED - smooth & correct)
// =====================================================
let touch = false;
let lastX = 0;
let lastY = 0;

addEventListener('touchstart', e => {
  touch = true;
  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;
});

addEventListener('touchend', () => {
  touch = false;
});

addEventListener('touchmove', e => {
  if (!touch) return;

  const dx = e.touches[0].clientX - lastX;
  const dy = e.touches[0].clientY - lastY;

  camera.rotation.y -= dx * 0.002;
  camera.rotation.x -= dy * 0.002;

  camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));

  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;
});

// =====================================================
// JOYSTICK (FIXED SIGN)
// =====================================================
const joystick = document.getElementById('joystick');

let joy = false;
let jx = 0;
let jy = 0;
let j0x = 0;
let j0y = 0;

joystick?.addEventListener('touchstart', e => {
  joy = true;
  j0x = e.touches[0].clientX;
  j0y = e.touches[0].clientY;
});

joystick?.addEventListener('touchmove', e => {
  if (!joy) return;

  jx = e.touches[0].clientX - j0x;
  jy = e.touches[0].clientY - j0y;
});

joystick?.addEventListener('touchend', () => {
  joy = false;
  jx = 0;
  jy = 0;
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

loader.load('./model.glb', gltf => {
  const room = gltf.scene;
  room.position.copy(ROOM_OFFSET);
  scene.add(room);
  room.updateMatrixWorld(true);

  const gen = new StaticGeometryGenerator(room);
  const merged = gen.generate();

  merged.computeBoundsTree = computeBoundsTree;
  merged.disposeBoundsTree = disposeBoundsTree;
  merged.computeBoundsTree();

  collider = new THREE.Mesh(
    merged,
    new THREE.MeshBasicMaterial({ visible: false })
  );

  scene.add(collider);
});

// =====================================================
// BALLS
// =====================================================
const balls = [];

function shoot() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15),
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
    friction: 0.98
  });
}

addEventListener('mousedown', shoot);
document.getElementById('mobileShoot')
  ?.addEventListener('touchstart', shoot);

// =====================================================
// LOOP
// =====================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  const speed = move.sprint ? 18 : 10;

  const forward = (move.forward ? 1 : 0) - (move.back ? 1 : 0);
  const side = (move.right ? 1 : 0) - (move.left ? 1 : 0);

  // FIXED: correct directions
  camera.translateZ(-forward * speed * dt);
  camera.translateX(side * speed * dt);

  // MOBILE JOYSTICK (FIXED SIGN)
  if (joy) {
    camera.translateX(jx * 0.01);
    camera.translateZ(-jy * 0.01);
  }

  // BALLS
  for (const b of balls) {
    b.velocity.y -= 9.8 * dt;

    const old = b.mesh.position.clone();
    b.mesh.position.addScaledVector(b.velocity, dt);

    if (collider) {
      const mv = new THREE.Vector3().subVectors(b.mesh.position, old);
      const d = mv.length();

      if (d > 0) {
        mv.normalize();

        const ray = new THREE.Raycaster(old, mv, 0, d + b.radius);
        const hit = ray.intersectObject(collider, false);

        if (hit.length) {
          const h = hit[0];

          const n = h.face.normal.clone()
            .transformDirection(collider.matrixWorld)
            .normalize();

          b.mesh.position.copy(h.point).addScaledVector(n, b.radius + 0.01);

          b.velocity.reflect(n).multiplyScalar(b.restitution);
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
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});