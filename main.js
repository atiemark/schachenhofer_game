import * as THREE from 'three';

import {
  GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';

import {
  PointerLockControls
} from 'three/addons/controls/PointerLockControls.js';

import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
  StaticGeometryGenerator
} from 'three-mesh-bvh';

// =====================================================
// ENABLE BVH
// =====================================================
THREE.Mesh.prototype.raycast =
  acceleratedRaycast;

// =====================================================
// SCENE
// =====================================================
const scene = new THREE.Scene();

scene.background =
  new THREE.Color(0x101018);

// =====================================================
// CAMERA
// =====================================================
const camera =
  new THREE.PerspectiveCamera(
    75,
    window.innerWidth /
      window.innerHeight,
    0.1,
    1000
  );

camera.position.set(
  0,
  1.8,
  5
);

// =====================================================
// RENDERER
// =====================================================
const renderer =
  new THREE.WebGLRenderer({
    antialias: true
  });

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.shadowMap.enabled = true;

document.body.appendChild(
  renderer.domElement
);

// =====================================================
// LIGHTS
// =====================================================
scene.add(
  new THREE.AmbientLight(
    0xffffff,
    1.2
  )
);

const sun =
  new THREE.DirectionalLight(
    0xffffff,
    2
  );

sun.position.set(5, 10, 5);

sun.castShadow = true;

scene.add(sun);

// =====================================================
// CONTROLS
// =====================================================
const controls =
  new PointerLockControls(
    camera,
    document.body
  );

scene.add(
  controls.getObject()
);

// =====================================================
// START SCREEN
// =====================================================
const startScreen =
  document.getElementById(
    'startScreen'
  );

const startButton =
  document.getElementById(
    'startButton'
  );

startButton.onclick =
  () => {

    controls.lock();

    startScreen.style.display =
      'none';

  };

controls.addEventListener(
  'unlock',
  () => {

    startScreen.style.display =
      'flex';

  }
);

// =====================================================
// MOVEMENT
// =====================================================
const move = {

  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false

};

const velocity =
  new THREE.Vector3();

const direction =
  new THREE.Vector3();

let speed = 10;

// =====================================================
// INPUT
// =====================================================
window.addEventListener(
  'keydown',
  (e) => {

    if (e.code === 'KeyW')
      move.forward = true;

    if (e.code === 'KeyS')
      move.backward = true;

    if (e.code === 'KeyA')
      move.left = true;

    if (e.code === 'KeyD')
      move.right = true;

    if (e.code === 'ShiftLeft')
      move.sprint = true;

  }
);

window.addEventListener(
  'keyup',
  (e) => {

    if (e.code === 'KeyW')
      move.forward = false;

    if (e.code === 'KeyS')
      move.backward = false;

    if (e.code === 'KeyA')
      move.left = false;

    if (e.code === 'KeyD')
      move.right = false;

    if (e.code === 'ShiftLeft')
      move.sprint = false;

  }
);

// =====================================================
// FLOOR
// =====================================================
const floor =
  new THREE.Mesh(

    new THREE.PlaneGeometry(
      100,
      100
    ),

    new THREE.MeshStandardMaterial({
      color: 0x444444
    })

  );

floor.rotation.x =
  -Math.PI / 2;

floor.receiveShadow = true;

scene.add(floor);

// =====================================================
// BVH COLLIDER
// =====================================================
let collider = null;

// =====================================================
// LOAD MODEL
// =====================================================
const loader =
  new GLTFLoader();

const ROOM_OFFSET =
  new THREE.Vector3(
    -32.642,
    15.5,
    -19.152
  );

loader.load(
  './model.glb',

  (gltf) => {

    const room =
      gltf.scene;

    room.position.copy(
      ROOM_OFFSET
    );

    scene.add(room);

    room.updateMatrixWorld(true);

    room.traverse((child) => {

      if (!child.isMesh)
        return;

      child.castShadow = true;
      child.receiveShadow = true;

    });

    // =================================
    // GENERATE STATIC GEOMETRY
    // =================================
    const generator =
      new StaticGeometryGenerator(
        room
      );

    const merged =
      generator.generate();

    merged.computeBoundsTree =
      computeBoundsTree;

    merged.disposeBoundsTree =
      disposeBoundsTree;

    merged.computeBoundsTree();

    collider =
      new THREE.Mesh(

        merged,

        new THREE.MeshBasicMaterial({
          visible: false
        })

      );

    scene.add(collider);

    console.log(
      'BVH READY'
    );

  }
);

// =====================================================
// BALLS
// =====================================================
const balls = [];

function shootBall() {

  const mesh =
    new THREE.Mesh(

      new THREE.SphereGeometry(
        0.15,
        16,
        16
      ),

      new THREE.MeshStandardMaterial({
        color: 0xffff00
      })

    );

  mesh.castShadow = true;

  scene.add(mesh);

  mesh.position.copy(
    camera.position
  );

  const dir =
    new THREE.Vector3();

  camera.getWorldDirection(
    dir
  );

  balls.push({

    mesh,

    velocity:
      dir.multiplyScalar(20),

    radius: 0.15,

    mass: 1,

    restitution: 0.8,

    friction: 0.985

  });

}

// DESKTOP
window.addEventListener(
  'mousedown',
  () => {

    if (
      controls.isLocked
    ) {

      shootBall();

    }

  }
);

// MOBILE
const mobileShoot =
  document.getElementById(
    'mobileShoot'
  );

if (mobileShoot) {

  mobileShoot.addEventListener(
    'touchstart',
    (e) => {

      e.preventDefault();

      shootBall();

    },
    { passive: false }
  );

}

// =====================================================
// CLOCK
// =====================================================
const clock =
  new THREE.Clock();

// =====================================================
// ANIMATE
// =====================================================
function animate() {

  requestAnimationFrame(
    animate
  );

  const delta =
    clock.getDelta();

  // =================================
  // PLAYER MOVEMENT
  // =================================
  speed =
    move.sprint ? 18 : 10;

  velocity.x -=
    velocity.x *
    8 *
    delta;

  velocity.z -=
    velocity.z *
    8 *
    delta;

  direction.z =
    Number(move.forward) -
    Number(move.backward);

  direction.x =
    Number(move.right) -
    Number(move.left);

  direction.normalize();

  if (
    move.forward ||
    move.backward
  ) {

    velocity.z -=
      direction.z *
      speed *
      delta;

  }

  if (
    move.left ||
    move.right
  ) {

    velocity.x -=
      direction.x *
      speed *
      delta;

  }

  controls.moveRight(
    -velocity.x * delta
  );

  controls.moveForward(
    -velocity.z * delta
  );

  // =================================
  // BALL PHYSICS
  // =================================
  for (const b of balls) {

    // GRAVITY
    b.velocity.y -=
      9.8 * delta;

    const oldPos =
      b.mesh.position.clone();

    // MOVE
    b.mesh.position.addScaledVector(
      b.velocity,
      delta
    );

    // =================================
    // BVH COLLISION
    // =================================
    if (collider) {

      const moveVec =
        new THREE.Vector3()
          .subVectors(
            b.mesh.position,
            oldPos
          );

      const dist =
        moveVec.length();

      if (dist > 0) {

        moveVec.normalize();

        const raycaster =
          new THREE.Raycaster(
            oldPos,
            moveVec,
            0,
            dist + b.radius
          );

        const hits =
          raycaster.intersectObject(
            collider,
            false
          );

        if (
          hits.length > 0
        ) {

          const hit =
            hits[0];

          // ---------------------------
          // SURFACE NORMAL
          // ---------------------------
          const normal =
            hit.normal
              ? hit.normal.clone()
              : hit.face.normal.clone();

          normal.normalize();

          // ---------------------------
          // MOVE OUTSIDE SURFACE
          // ---------------------------
          b.mesh.position.copy(
            hit.point
          );

          b.mesh.position.addScaledVector(
            normal,
            b.radius + 0.02
          );

          // ---------------------------
          // BOUNCE
          // ---------------------------
          b.velocity.reflect(
            normal
          );

          b.velocity.multiplyScalar(
            b.restitution
          );

          // ---------------------------
          // FRICTION
          // ---------------------------
          b.velocity.multiplyScalar(
            b.friction
          );

        }

      }

    }

  }

  renderer.render(
    scene,
    camera
  );

}

animate();

// =====================================================
// RESIZE
// =====================================================
window.addEventListener(
  'resize',
  () => {

    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

  }
);