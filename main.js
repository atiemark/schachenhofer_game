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
// FPS RIG (IMPORTANT FIX)
// =====================================================
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

const player = new THREE.Object3D();
const yaw = new THREE.Object3D();
const pitch = new THREE.Object3D();

yaw.add(pitch);
pitch.add(camera);
scene.add(player);
player.add(yaw);

camera.position.set(0, 1.6, 0);

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
// INPUT (DESKTOP)
// =====================================================
const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);

// =====================================================
// MOUSE LOOK (DESKTOP)
// =====================================================
let pointerLocked = false;

document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === document.body;
});

addEventListener('mousemove', e => {
  if (!pointerLocked) return;

  yaw.rotation.y -= e.movementX * 0.002;
  pitch.rotation.x -= e.movementY * 0.002;

  pitch.rotation.x = Math.max(-1.5, Math.min(1.5, pitch.rotation.x));
});

// =====================================================
// MOBILE LOOK (RIGHT HALF SCREEN ONLY)
// =====================================================
let touchLook = false;
let lx = 0, ly = 0;

addEventListener('touchstart', e => {
  const t = e.touches[0];
  if (t.clientX > innerWidth * 0.5) {
    touchLook = true;
    lx = t.clientX;
    ly = t.clientY;
  }
});

addEventListener('touchmove', e => {
  if (!touchLook) return;

  const t = e.touches[0];
  const dx = t.clientX - lx;
  const dy = t.clientY - ly;

  yaw.rotation.y -= dx * 0.003;
  pitch.rotation.x -= dy * 0.003;

  pitch.rotation.x = Math.max(-1.5, Math.min(1.5, pitch.rotation.x));

  lx = t.clientX;
  ly = t.clientY;
});

addEventListener('touchend', () => touchLook = false);

// =====================================================
// JOYSTICK (LEFT SIDE ONLY)
// =====================================================
const joystick = document.getElementById('joystick');

let joy = false;
let jx = 0, jy = 0;
let j0x = 0, j0y = 0;

joystick.addEventListener('touchstart', e => {
  joy = true;
  j0x = e.touches[0].clientX;
  j0y = e.touches[0].clientY;
});

joystick.addEventListener('touchmove', e => {
  if (!joy) return;
  jx = e.touches[0].clientX - j0x;
  jy = e.touches[0].clientY - j0y;
});

joystick.addEventListener('touchend', () => {
  joy = false;
  jx = jy = 0;
});

// =====================================================
// SHOOT (ONLY RIGHT BUTTON)
// =====================================================
const shootBtn = document.getElementById('mobileShoot');

function shoot() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );

  scene.add(mesh);
  mesh.position.copy(camera.getWorldPosition(new THREE.Vector3()));

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

shootBtn.addEventListener('touchstart', e => {
  e.stopPropagation();
  shoot();
});

addEventListener('mousedown', shoot);

// =====================================================
// FLOOR + BVH
// =====================================================
scene.add(new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x444444 })
));

// BVH collider
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

// =====================================================
// LOOP
// =====================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // movement speed FIXED
  const speed = 6;

  const forward = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const side = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

  const moveX = side * speed * dt;
  const moveZ = forward * speed * dt;

  player.translateX(moveX);
  player.translateZ(-moveZ);

  // joystick (mobile)
  if (joy) {
    player.translateX(jx * 0.005);
    player.translateZ(-jy * 0.005);
  }

  // balls physics
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

// resize
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});