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

// =====================================================
// FPS RIG (CORRECT)
// =====================================================
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

const player = new THREE.Object3D();
const yaw = new THREE.Object3D();
const pitch = new THREE.Object3D();

player.position.set(0, 1.8, 5);

yaw.add(pitch);
pitch.add(camera);
player.add(yaw);
scene.add(player);

// =====================================================
// RENDERER
// =====================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// =====================================================
// LIGHT
// =====================================================
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 5);
scene.add(sun);

// =====================================================
// START SCREEN
// =====================================================
const startScreen = document.getElementById('startScreen');
document.getElementById('startButton').onclick = () => {
  startScreen.style.display = 'none';
};

// =====================================================
// DESKTOP LOOK
// =====================================================
let locked = false;

document.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === document.body;
});

addEventListener('mousemove', (e) => {
  if (!locked) return;

  yaw.rotation.y -= e.movementX * 0.002;
  pitch.rotation.x -= e.movementY * 0.002;

  pitch.rotation.x = Math.max(-1.5, Math.min(1.5, pitch.rotation.x));
});

// =====================================================
// MOBILE LOOK (RIGHT SIDE ONLY)
// =====================================================
const lookZone = document.getElementById('lookZone');

let looking = false;
let lx = 0, ly = 0;

lookZone.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  looking = true;
  lx = t.clientX;
  ly = t.clientY;
});

lookZone.addEventListener('touchmove', (e) => {
  if (!looking) return;

  const t = e.touches[0];
  const dx = t.clientX - lx;
  const dy = t.clientY - ly;

  yaw.rotation.y -= dx * 0.003;
  pitch.rotation.x -= dy * 0.003;

  pitch.rotation.x = Math.max(-1.5, Math.min(1.5, pitch.rotation.x));

  lx = t.clientX;
  ly = t.clientY;
});

lookZone.addEventListener('touchend', () => looking = false);

// =====================================================
// JOYSTICK (LEFT SIDE ONLY)
// =====================================================
const joystickZone = document.getElementById('joystickZone');

let joy = false;
let jx = 0, jy = 0;
let j0x = 0, j0y = 0;

joystickZone.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  joy = true;
  j0x = t.clientX;
  j0y = t.clientY;
});

joystickZone.addEventListener('touchmove', (e) => {
  if (!joy) return;

  const t = e.touches[0];
  jx = t.clientX - j0x;
  jy = t.clientY - j0y;
});

joystickZone.addEventListener('touchend', () => {
  joy = false;
  jx = 0;
  jy = 0;
});

// =====================================================
// SHOOT (NO BUBBLE FIX)
// =====================================================
const shootBtn = document.getElementById('mobileShoot');

const balls = [];

function shoot() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );

  scene.add(mesh);

  mesh.position.copy(player.position);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  balls.push({
    mesh,
    velocity: dir.multiplyScalar(15),
    radius: 0.15,
    restitution: 0.8,
    friction: 0.98
  });
}

shootBtn.addEventListener('touchstart', (e) => {
  e.stopPropagation();
  shoot();
});

addEventListener('mousedown', () => {
  if (locked) shoot();
});

// =====================================================
// INPUT (DESKTOP)
// =====================================================
const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);

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
// LOOP
// =====================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // FIXED SPEED (no more 4x)
  const SPEED = 4.5;

  const forward = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const side = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

  // CORRECT DIRECTION
  player.translateZ(-forward * SPEED * dt);
  player.translateX(side * SPEED * dt);

  // MOBILE JOYSTICK (SLOWER)
  if (joy) {
    player.translateX(jx * 0.0015);
    player.translateZ(-jy * 0.0015);
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

// RESIZE
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});