/* TrackMania-style low-poly game
   - Put this file in the same folder as index.html and style.css
   - Uses Three.js from CDN (already in index.html)
*/

// ---------------------- Basic scene ----------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // stadium sky blue

const camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(200, 400, 100);
scene.add(dirLight);

// big ground plane (stadium green)
const groundMat = new THREE.MeshPhongMaterial({ color: 0x2fb144, flatShading: true });
const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 20, 20), groundMat);
groundMesh.rotation.x = -Math.PI/2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// outer barriers
function addOuterWalls(size = 1200) {
  const wallMat = new THREE.MeshPhongMaterial({ color: 0x444444, flatShading: true });
  const thickness = 8, height = 40;
  const walls = [
    new THREE.Mesh(new THREE.BoxGeometry(thickness, height, size*2), wallMat),
    new THREE.Mesh(new THREE.BoxGeometry(thickness, height, size*2), wallMat),
    new THREE.Mesh(new THREE.BoxGeometry(size*2, height, thickness), wallMat),
    new THREE.Mesh(new THREE.BoxGeometry(size*2, height, thickness), wallMat)
  ];
  walls[0].position.set(size, height/2, 0);
  walls[1].position.set(-size, height/2, 0);
  walls[2].position.set(0, height/2, size);
  walls[3].position.set(0, height/2, -size);
  walls.forEach(w => { w.receiveShadow = true; scene.add(w); });
}
addOuterWalls(1000);

// ---------------------- Utility helpers ----------------------
const toRad = deg => deg * Math.PI / 180;
const TRACK_BLOCK = 45; // size of each track block (wider than before)
const BLOCK_HEIGHT = 3;

// simple material presets
const matTrack = new THREE.MeshPhongMaterial({ color: 0x4a4a4a, flatShading: true });
const matRamp  = new THREE.MeshPhongMaterial({ color: 0xd47a00, flatShading: true });
const matJump  = new THREE.MeshPhongMaterial({ color: 0xffd700, flatShading: true });
const matWall  = new THREE.MeshPhongMaterial({ color: 0x333333, flatShading: true });

// groups to keep scene tidy
let trackGroup = new THREE.Group();
scene.add(trackGroup);

// ---------------------- Car model ----------------------
function makeCar() {
  const g = new THREE.Group();

  // body
  const body = new THREE.Mesh(new THREE.BoxGeometry(6,2.2,10), new THREE.MeshPhongMaterial({ color: 0xff3b3b, flatShading:true }));
  body.position.set(0, 1.6, 0);
  g.add(body);

  // cockpit top
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.2,1.2,5), new THREE.MeshPhongMaterial({ color: 0x222222, flatShading:true }));
  cabin.position.set(0, 2.35, -0.5);
  g.add(cabin);

  // spoiler
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(6.2,0.6,1), new THREE.MeshPhongMaterial({ color: 0xff3b3b, flatShading:true }));
  spoiler.position.set(0, 2.4, 5);
  g.add(spoiler);

  // wheels (4)
  const wheelGeo = new THREE.BoxGeometry(1.2,1.6,4);
  const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111, flatShading:true });
  const offsets = [
    [-3, 0.7, -3.6],
    [3, 0.7, -3.6],
    [-3, 0.7, 3.6],
    [3, 0.7, 3.6],
  ];
  offsets.forEach(o => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(o[0], o[1], o[2]);
    w.rotation.y = 0;
    g.add(w);
  });

  // collision capsule info approx
  g.userData = { radius: 3, halfHeight: 2.2 };

  return g;
}

// ---------------------- Tracks (handcrafted, larger & complex) ----------------------
/*
Track representation: array of pieces.
Each piece:
  { x, y, z, type: "straight"|"ramp"|"jump"|"turn", dir: degrees, len: blocks, height: y offset (for ramps/jumps) }
*/
const TRACKS = [
  // TRACK 0: Easy long with small ramps
  [
    {x:0,y:0,z:0, type:"straight", dir:0, len:3},
    {x:3,y:0,z:0, type:"ramp", dir:0, len:1, height:6},
    {x:4,y:6,z:0, type:"straight", dir:0, len:3},
    {x:7,y:6,z:0, type:"turn", dir:90, len:1},
    {x:7,y:6,z:1, type:"straight", dir:90, len:3},
    {x:7,y:6,z:4, type:"jump", dir:90, len:1, height:8},
    {x:7,y:14,z:5, type:"straight", dir:90, len:2}
  ],
  // TRACK 1: more turns, small hills
  [
    {x:0,y:0,z:0, type:"straight", dir:0, len:2},
    {x:2,y:0,z:0, type:"ramp", dir:0, len:1, height:5},
    {x:3,y:5,z:0, type:"turn", dir:90, len:1},
    {x:3,y:5,z:1, type:"straight", dir:90, len:3},
    {x:3,y:5,z:4, type:"turn", dir:-90, len:1},
    {x:4,y:5,z:4, type:"straight", dir:0, len:4},
    {x:8,y:7,z:4, type:"jump", dir:0, len:1, height:6},
    {x:9,y:13,z:4, type:"straight", dir:0, len:2}
  ],
  // TRACK 2: technical with zig-zags and jumps
  [
    {x:0,y:0,z:0, type:"straight", dir:0, len:2},
    {x:2,y:0,z:0, type:"turn", dir:45, len:1},
    {x:3,y:0,z:1, type:"straight", dir:45, len:3},
    {x:6,y:0,z:3, type:"ramp", dir:90, len:1, height:6},
    {x:6,y:6,z:4, type:"straight", dir:90, len:2},
    {x:6,y:6,z:6, type:"turn", dir:-90, len:1},
    {x:5,y:6,z:6, type:"jump", dir:-90, len:1, height:7},
    {x:4,y:13,z:6, type:"straight", dir:-90, len:3}
  ],
  // TRACK 3: longer, multiple ramps & drops
  [
    {x:0,y:0,z:0, type:"straight", dir:0, len:3},
    {x:3,y:0,z:0, type:"ramp", dir:0, len:1, height:9},
    {x:4,y:9,z:0, type:"straight", dir:0, len:2},
    {x:6,y:9,z:0, type:"turn", dir:90, len:1},
    {x:6,y:9,z:1, type:"ramp", dir:90, len:1, height:-6},
    {x:6,y:3,z:2, type:"straight", dir:90, len:3},
    {x:6,y:3,z:5, type:"jump", dir:90, len:1, height:5},
    {x:6,y:8,z:6, type:"straight", dir:90, len:3}
  ],
  // TRACK 4: hard, tight turns, big jumps
  [
    {x:0,y:0,z:0, type:"straight", dir:0, len:2},
    {x:2,y:0,z:0, type:"ramp", dir:0, len:1, height:8},
    {x:3,y:8,z:0, type:"turn", dir:60, len:1},
    {x:4,y:8,z:1, type:"straight", dir:60, len:2},
    {x:6,y:8,z:2, type:"ramp", dir:60, len:1, height:9},
    {x:7,y:17,z:3, type:"jump", dir:60, len:1, height:10},
    {x:8,y:27,z:4, type:"straight", dir:60, len:2},
    {x:10,y:27,z:6, type:"turn", dir:-120, len:1},
    {x:10,y:27,z:5, type:"straight", dir:-120, len:3}
  ]
];

// store meshes for raycast collisions & checkpoints
let blockMeshes = [];
let checkpointBoxes = [];

// build a single block (square tile)
function makeBlock(x, y, z, dirDeg, colorMat) {
  const geo = new THREE.BoxGeometry(TRACK_BLOCK, BLOCK_HEIGHT, TRACK_BLOCK);
  const mesh = new THREE.Mesh(geo, colorMat);
  mesh.position.set(x * TRACK_BLOCK, y + BLOCK_HEIGHT/2, z * TRACK_BLOCK);
  mesh.rotation.y = toRad(dirDeg || 0);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// make ramp block (tilted)
function makeRamp(x, y, z, dirDeg, height) {
  // create a wedge by scaling box and rotate slightly to simulate ramp
  const geo = new THREE.BoxGeometry(TRACK_BLOCK, BLOCK_HEIGHT, TRACK_BLOCK);
  const mesh = new THREE.Mesh(geo, matRamp);
  mesh.position.set(x * TRACK_BLOCK, y + BLOCK_HEIGHT/2, z * TRACK_BLOCK);
  mesh.rotation.y = toRad(dirDeg || 0);
  // rotate about local X to simulate slope (height controls steepness)
  const slope = Math.atan2(height, TRACK_BLOCK);
  mesh.rotation.x = -slope;
  mesh.userData.isRamp = true;
  mesh.userData.rampHeight = height;
  return mesh;
}

// make jump (a ramp-like block but colored differently)
function makeJump(x, y, z, dirDeg, height) {
  const j = makeRamp(x, y, z, dirDeg, height);
  j.material = matJump;
  j.userData.isJump = true;
  return j;
}

// build track from definition
function buildTrackFromDef(trackDef) {
  // clear previous
  blockMeshes.forEach(m => scene.remove(m));
  blockMeshes = [];
  checkpointBoxes = [];

  // create blocks for each piece, expanding len
  trackDef.forEach(piece => {
    const len = piece.len || 1;
    for (let i = 0; i < len; i++) {
      const px = piece.x + (i * Math.cos(toRad(piece.dir) )) * 1; // keep on grid steps (we already embedded positions)
      const pz = piece.z + (i * Math.sin(toRad(piece.dir) )) * 1;
      // pos are integer grid in def; we use piece.x + offset as precomputed in def
      const x = piece.x + (i * Math.round(Math.cos(toRad(piece.dir))));
      const z = piece.z + (i * Math.round(Math.sin(toRad(piece.dir))));
      const y = piece.y; // height
      let mesh;
      if (piece.type === "ramp") {
        mesh = makeRamp(x, y, z, piece.dir, piece.height || 6);
      } else if (piece.type === "jump") {
        mesh = makeJump(x, y, z, piece.dir, piece.height || 8);
      } else {
        mesh = makeBlock(x, y, z, piece.dir, matTrack);
      }
      // add side walls for each block
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, TRACK_BLOCK), matWall);
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, TRACK_BLOCK), matWall);
      // position walls relative to block orientation
      const rot = toRad(piece.dir || 0);
      const worldX = x * TRACK_BLOCK;
      const worldZ = z * TRACK_BLOCK;
      const offset = TRACK_BLOCK/2 + 3;
      leftWall.position.set(worldX + Math.sin(rot)*offset, y + 3, worldZ - Math.cos(rot)*offset);
      rightWall.position.set(worldX - Math.sin(rot)*offset, y + 3, worldZ + Math.cos(rot)*offset);
      leftWall.rotation.y = rightWall.rotation.y = rot;
      scene.add(leftWall);
      scene.add(rightWall);

      scene.add(mesh);
      blockMeshes.push(mesh);

      // checkpoint box for this block (slightly inset so you must pass through)
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(worldX, y + BLOCK_HEIGHT/2, worldZ),
        new THREE.Vector3(TRACK_BLOCK * 0.9, BLOCK_HEIGHT * 3, TRACK_BLOCK * 0.9)
      );
      checkpointBoxes.push({ box, passed: false });
    }
  });
}

// ---------------------- Physics state ----------------------
let player = {
  mesh: null,
  velocity: new THREE.Vector3(0, 0, 0), // x,z world components plus vy in y
  forwardSpeed: 0, // scalar along car's forward
  yaw: 0,
  onGround: false,
  verticalVel: 0
};

// raycaster for ground detection
const downRay = new THREE.Raycaster();
downRay.ray.direction.set(0,-1,0);

// HUD & controls
const hudTimer = document.getElementById('timer');
const hudBest = document.getElementById('bestTime');
const menuPanel = document.getElementById('menu');
const menuBtn = document.getElementById('menuBtn');

let running = false, runTime = 0, currentTrackIndex = null;

// input state
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// restart
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'r' && currentTrackIndex !== null) {
    startGame(currentTrackIndex);
  }
});

// main menu button
menuBtn.addEventListener('click', () => {
  menuPanel.style.display = 'block';
  stopRun();
  clearTrack();
  currentTrackIndex = null;
});

// ---------------------- Vehicle physics params ----------------------
const PHYS = {
  accel: 1.2,          // acceleration (units/s^2)
  brake: 3.5,          // braking deceleration
  maxSpeed: 60,        // top speed (units/s)
  reverseMax: -14,     // max reverse speed
  steerSpeed: 0.035,   // radians per update for steering
  drag: 1.8,           // linear drag
  gravity: 38.0,       // gravity for vertical
  groundSnap: 0.5,     // snap to ground distance
  jumpBoost: 0.0       // optional extra upward when hitting jump ramps
};

// scale conversion: our units are large; adjust dt accordingly
let lastTime = performance.now();

// ---------------------- Build tracks + car ----------------------
function clearTrack() {
  blockMeshes.forEach(m => scene.remove(m));
  blockMeshes = [];
  checkpointBoxes = [];
  if (player.mesh) { scene.remove(player.mesh); player.mesh = null; }
}

function startGame(trackIndex) {
  // hide menu
  menuPanel.style.display = 'none';
  currentTrackIndex = trackIndex;

  clearTrack();

  // build chosen track
  buildTrackFromDef(TRACKS[trackIndex]);

  // place car at first block center (with slight offset forward)
  const firstBlock = blockMeshes[0];
  const pos = firstBlock.position.clone();
  const car = makeCar();
  car.position.set(pos.x, pos.y + 4.5, pos.z - (TRACK_BLOCK/3));
  player.mesh = car;
  player.mesh.rotation.y = 0; // face along +Z world axis
  player.forwardSpeed = 0;
  player.velocity.set(0,0,0);
  player.verticalVel = 0;
  player.onGround = false;
  scene.add(player.mesh);

  // reset checkpoints
  checkpointBoxes.forEach(c => c.passed = false);

  running = false;
  runTime = 0;
  hudTimer.textContent = 'Time: 0.00s';
  const best = localStorage.getItem('bestTime_' + trackIndex);
  hudBest.textContent = best ? `Best: ${best}s` : 'Best: --';
}

// stop run
function stopRun() {
  running = false;
}

// ---------------------- Ground casting helper ----------------------
function getGroundInfo(position) {
  // cast down from a bit above the position to find nearest block or ground
  downRay.ray.origin.set(position.x, 300, position.z);
  const intersects = downRay.intersectObjects(blockMeshes.concat([groundMesh]), true);
  if (intersects.length > 0) {
    return intersects[0]; // nearest hit
  }
  return null;
}

// ---------------------- Main loop ----------------------
function updatePhysics(dt) {
  if (!player.mesh) return;

  // input: accelerate / brake
  const accelPressed = keys['w'] || keys['arrowup'];
  const brakePressed = keys['s'] || keys['arrowdown'];
  const left = keys['a'] || keys['arrowleft'];
  const right = keys['d'] || keys['arrowright'];

  // steering: rotate yaw based on current forward speed sign
  const steerFactor = THREE.MathUtils.clamp(player.forwardSpeed / PHYS.maxSpeed, -1, 1);
  if (left) player.mesh.rotation.y += PHYS.steerSpeed * (0.9 + 0.6 * (1 - Math.abs(steerFactor)));
  if (right) player.mesh.rotation.y -= PHYS.steerSpeed * (0.9 + 0.6 * (1 - Math.abs(steerFactor)));

  // forward/back speed update (scalar)
  if (accelPressed) {
    player.forwardSpeed += PHYS.accel * dt;
  } else if (brakePressed) {
    // stronger braking if moving forward, else small reverse throttle
    if (player.forwardSpeed > 0) player.forwardSpeed -= PHYS.brake * dt;
    else player.forwardSpeed -= PHYS.accel * 0.6 * dt;
  } else {
    // natural drag
    if (player.forwardSpeed > 0) {
      player.forwardSpeed -= PHYS.drag * dt * 0.6;
      if (player.forwardSpeed < 0) player.forwardSpeed = 0;
    } else {
      player.forwardSpeed += PHYS.drag * dt * 0.4; // recover to zero from reverse
      if (player.forwardSpeed > 0) player.forwardSpeed = 0;
    }
  }

  // clamp speeds
  player.forwardSpeed = THREE.MathUtils.clamp(player.forwardSpeed, PHYS.reverseMax, PHYS.maxSpeed);

  // compute world forward vector
  const forwardVec = new THREE.Vector3(0, 0, 1).applyQuaternion(player.mesh.quaternion).normalize();

  // horizontal velocity update from forwardSpeed
  player.velocity.x = forwardVec.x * player.forwardSpeed;
  player.velocity.z = forwardVec.z * player.forwardSpeed;

  // vertical (y) physics
  const groundHit = getGroundInfo(player.mesh.position);
  let groundY = -10000;
  let groundNormal = new THREE.Vector3(0, 1, 0);
  if (groundHit) {
    groundY = groundHit.point.y;
    if (groundHit.face) groundNormal.copy(groundHit.face.normal);
  }

  const feetY = player.mesh.position.y - 1.5; // bottom of car approx
  const distToGround = feetY - groundY;

  if (distToGround > 1.0) {
    // in air: apply gravity
    player.verticalVel -= PHYS.gravity * dt;
    player.onGround = false;
  } else {
    // on ground: snap to ground and zero vertical vel
    player.onGround = true;
    player.verticalVel = 0;
    // if we are standing on a jump/ramp that is 'jump' type, give a little boost
    // detect if groundHit.object has userData.isJump or isRamp
    const obj = groundHit && groundHit.object;
    if (obj && obj.userData && obj.userData.isJump && accelPressed) {
      player.verticalVel = (obj.userData.rampHeight || 7) * 0.6;
      player.onGround = false;
    }
  }

  // apply vertical vel
  player.mesh.position.y += player.verticalVel * dt;

  // apply horizontal movement
  player.mesh.position.x += player.velocity.x * dt;
  player.mesh.position.z += player.velocity.z * dt;

  // when on ground, ensure the car sits on top (snap)
  if (player.onGround && groundHit) {
    // gently place car on top of ground
    const desiredY = groundY + 1.7; // car base offset
    player.mesh.position.y += (desiredY - player.mesh.position.y) * 0.35;
  }
}

function updateCamera(dt) {
  if (!player.mesh) return;
  // camera offset relative to car orientation (behind & above)
  const offsetLocal = new THREE.Vector3(0, 12, -40); // a bit farther back for stadium view
  const worldOffset = offsetLocal.applyQuaternion(player.mesh.quaternion);
  const desired = player.mesh.position.clone().add(worldOffset);
  camera.position.lerp(desired, 0.12);
  camera.lookAt(player.mesh.position.clone().add(new THREE.Vector3(0,2,0)));
}

function updateCheckpointsAndFinish(dt) {
  if (!player.mesh) return;
  // check checkpoints
  checkpointBoxes.forEach(c => {
    if (!c.passed && c.box.containsPoint(player.mesh.position)) c.passed = true;
  });

  // when all passed and car has progressed far (approx check by distance to last block)
  const all = checkpointBoxes.every(c => c.passed);
  if (all && running) {
    // finish: record time
    running = false;
    const bestKey = 'bestTime_' + currentTrackIndex;
    const prev = localStorage.getItem(bestKey);
    if (!prev || runTime < parseFloat(prev)) {
      localStorage.setItem(bestKey, runTime.toFixed(2));
      hudBest.textContent = `Best: ${runTime.toFixed(2)}s`;
    }
    setTimeout(() => alert(`Finished! Time: ${runTime.toFixed(2)}s`), 80);
  }
}

// animation & loop
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  let dt = (now - lastTime) / 1000; // seconds
  if (dt > 0.05) dt = 0.05; // clamp big frames
  lastTime = now;

  // physics update
  updatePhysics(dt);

  // camera update
  updateCamera(dt);

  // timer
  if (running) {
    runTime += dt;
    hudTimer.textContent = `Time: ${runTime.toFixed(2)}s`;
  } else {
    // if player moving while not running, start
    if (player.mesh && (Math.abs(player.forwardSpeed) > 0.1)) {
      running = true;
      runTime = 0;
    }
  }

  // checkpoint logic
  updateCheckpointsAndFinish(dt);

  renderer.render(scene, camera);
}
animate();

// ---------------------- Build & helpers for track layout placement ----------------------
/*
Since TRACKS define cultured pieces at grid coords, build them by mapping each piece
to blocks placed at piece.x, piece.z grid. For ramps/jumps we rotate blocks and set userData.
*/
function buildTrackFromDef(def) {
  // remove old blocks and walls
  blockMeshes.forEach(m => scene.remove(m));
  blockMeshes = [];
  checkpointBoxes = [];

  // create block for each piece (and for length if len>1)
  def.forEach(piece => {
    const pieceLen = piece.len || 1;
    for (let i = 0; i < pieceLen; i++) {
      // place block at grid x + i*dirVec
      const dir = piece.dir || 0;
      const dirRad = toRad(dir);
      const gx = Math.round(piece.x + i * Math.cos(dirRad));
      const gz = Math.round(piece.z + i * Math.sin(dirRad));
      const gy = piece.y || 0;
      let mesh;
      if (piece.type === 'ramp') {
        mesh = makeRamp(gx, gy, gz, dir, piece.height || 6);
      } else if (piece.type === 'jump') {
        mesh = makeJump(gx, gy, gz, dir, piece.height || 8);
      } else {
        mesh = makeBlock(gx, gy, gz, dir, matTrack);
      }
      scene.add(mesh);
      blockMeshes.push(mesh);

      // add small side walls (visual barrier) per-block
      const rot = toRad(dir || 0);
      const worldX = gx * TRACK_BLOCK;
      const worldZ = gz * TRACK_BLOCK;
      const offset = TRACK_BLOCK/2 + 4;
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, TRACK_BLOCK), matWall);
      leftWall.position.set(worldX + Math.sin(rot)*offset, gy + 3, worldZ - Math.cos(rot)*offset);
      leftWall.rotation.y = rot;
      leftWall.receiveShadow = true;
      leftWall.castShadow = true;
      scene.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, TRACK_BLOCK), matWall);
      rightWall.position.set(worldX - Math.sin(rot)*offset, gy + 3, worldZ + Math.cos(rot)*offset);
      rightWall.rotation.y = rot;
      rightWall.receiveShadow = true;
      rightWall.castShadow = true;
      scene.add(rightWall);

      // checkpoint box slightly inside block
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(worldX, gy + BLOCK_HEIGHT/2, worldZ),
        new THREE.Vector3(TRACK_BLOCK * 0.85, BLOCK_HEIGHT * 4, TRACK_BLOCK * 0.85)
      );
      checkpointBoxes.push({ box, passed: false });
    }
  });
}

// wrap builder for chosen track
function loadTrack(index) {
  buildTrackFromDef(TRACKS[index]);
}

// ---------------------- Simplified build call for previous startGame wrapper -------------
function startGame(index) {
  // show/hide menu
  document.getElementById('menu').style.display = 'none';
  currentTrackIndex = index;

  // clear old scene blocks
  blockMeshes.forEach(m => scene.remove(m)); blockMeshes = [];
  checkpointBoxes = [];

  // build and spawn player
  loadTrack(index);

  // spawn car at first block position
  if (blockMeshes.length === 0) return;
  const first = blockMeshes[0];
  const spawnPos = first.position.clone();
  if (player.mesh) scene.remove(player.mesh);
  player.mesh = makeCar();
  player.mesh.position.set(spawnPos.x, spawnPos.y + 5, spawnPos.z - TRACK_BLOCK * 0.4);
  player.mesh.rotation.y = 0;
  scene.add(player.mesh);

  // reset physics & hud
  player.forwardSpeed = 0;
  player.verticalVel = 0;
  player.onGround = false;
  runTime = 0;
  running = false;
  hudTimer.textContent = 'Time: 0.00s';
  const best = localStorage.getItem('bestTime_' + index);
  hudBest.textContent = best ? `Best: ${best}s` : 'Best: --';
}

// expose startGame to global (index.html buttons call it)
window.startGame = startGame;

// on load: center camera far above until game starts
camera.position.set(0, 250, 400);
camera.lookAt(0, 0, 0);

// handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
