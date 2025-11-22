// ====== Scene Setup ======
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

let camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 3000);
let renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff,0.6));
let dirLight = new THREE.DirectionalLight(0xffffff,1);
dirLight.position.set(100,200,100);
scene.add(dirLight);

// Ground
let groundMat = new THREE.MeshPhongMaterial({color:0x228B22, flatShading:true});
let ground = new THREE.Mesh(new THREE.PlaneGeometry(5000,5000,50,50), groundMat);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Outer barriers
function buildOuterBarriers(size=500){
  let mat = new THREE.MeshPhongMaterial({color:0x444444});
  let thickness = 5, height=20;
  let walls = [];
  walls.push(new THREE.Mesh(new THREE.BoxGeometry(thickness,height,size*2), mat)); walls[walls.length-1].position.set(size,height/2,0);
  walls.push(new THREE.Mesh(new THREE.BoxGeometry(thickness,height,size*2), mat)); walls[walls.length-1].position.set(-size,height/2,0);
  walls.push(new THREE.Mesh(new THREE.BoxGeometry(size*2,height,thickness), mat)); walls[walls.length-1].position.set(0,height/2,size);
  walls.push(new THREE.Mesh(new THREE.BoxGeometry(size*2,height,thickness), mat)); walls[walls.length-1].position.set(0,height/2,-size);
  walls.forEach(w=>scene.add(w));
}
buildOuterBarriers();

// ====== Track pieces ======
const TRACK_SIZE = 40;
const TRACK_HEIGHT = 2;

let tracks = [
  // Track 1 - Easy
  [
    {x:0,y:0,z:0,type:"straight",dir:0},{x:TRACK_SIZE,y:0,z:0,type:"straight",dir:0},
    {x:TRACK_SIZE*2,y:0,z:0,type:"ramp",dir:0,height:5},{x:TRACK_SIZE*3,y:5,z:0,type:"straight",dir:0},
    {x:TRACK_SIZE*4,y:5,z:0,type:"turn",dir:90},{x:TRACK_SIZE*4,y:5,z:TRACK_SIZE,type:"straight",dir:90},
    {x:TRACK_SIZE*4,y:5,z:TRACK_SIZE*2,type:"jump",dir:90,height:5},{x:TRACK_SIZE*4,y:10,z:TRACK_SIZE*3,type:"straight",dir:90}
  ],
  // Track 2
  [
    {x:0,y:0,z:0,type:"straight",dir:0},{x:TRACK_SIZE,y:0,z:0,type:"ramp",dir:0,height:5},
    {x:TRACK_SIZE*2,y:5,z:0,type:"straight",dir:0},{x:TRACK_SIZE*3,y:5,z:0,type:"turn",dir:90},
    {x:TRACK_SIZE*3,y:5,z:TRACK_SIZE,type:"ramp",dir:90,height:-3},{x:TRACK_SIZE*3,y:2,z:TRACK_SIZE*2,type:"jump",dir:90,height:4},
    {x:TRACK_SIZE*3,y:6,z:TRACK_SIZE*3,type:"straight",dir:90}
  ],
  // Track 3
  [
    {x:0,y:0,z:0,type:"straight",dir:0},{x:TRACK_SIZE,y:0,z:0,type:"ramp",dir:0,height:5},
    {x:TRACK_SIZE*2,y:5,z:0,type:"jump",dir:0,height:5},{x:TRACK_SIZE*3,y:10,z:0,type:"turn",dir:90},
    {x:TRACK_SIZE*3,y:10,z:TRACK_SIZE,type:"ramp",dir:90,height:-4},{x:TRACK_SIZE*3,y:6,z:TRACK_SIZE*2,type:"straight",dir:90},
    {x:TRACK_SIZE*3,y:6,z:TRACK_SIZE*3,type:"jump",dir:90,height:3},{x:TRACK_SIZE*3,y:9,z:TRACK_SIZE*4,type:"straight",dir:90}
  ],
  // Track 4
  [
    {x:0,y:0,z:0,type:"straight",dir:0},{x:TRACK_SIZE,y:0,z:0,type:"ramp",dir:0,height:7},
    {x:TRACK_SIZE*2,y:7,z:0,type:"turn",dir:90},{x:TRACK_SIZE*2,y:7,z:TRACK_SIZE,type:"jump",dir:90,height:5},
    {x:TRACK_SIZE*2,y:12,z:TRACK_SIZE*2,type:"straight",dir:90},{x:TRACK_SIZE*3,y:12,z:TRACK_SIZE*2,type:"ramp",dir:0,height:-7},
    {x:TRACK_SIZE*4,y:5,z:TRACK_SIZE*2,type:"turn",dir:-90},{x:TRACK_SIZE*4,y:5,z:TRACK_SIZE*1,type:"jump",dir:-90,height:4}
  ],
  // Track 5 - Hard
  [
    {x:0,y:0,z:0,type:"straight",dir:0},{x:TRACK_SIZE,y:0,z:0,type:"ramp",dir:0,height:8},
    {x:TRACK_SIZE*2,y:8,z:0,type:"jump",dir:0,height:5},{x:TRACK_SIZE*3,y:13,z:0,type:"turn",dir:90},
    {x:TRACK_SIZE*3,y:13,z:TRACK_SIZE,type:"ramp",dir:90,height:-6},{x:TRACK_SIZE*3,y:7,z:TRACK_SIZE*2,type:"jump",dir:90,height:4},
    {x:TRACK_SIZE*3,y:11,z:TRACK_SIZE*3,type:"straight",dir:90},{x:TRACK_SIZE*4,y:11,z:TRACK_SIZE*3,type:"ramp",dir:0,height:-5},
    {x:TRACK_SIZE*5,y:6,z:TRACK_SIZE*3,type:"jump",dir:0,height:3}
  ]
];

let trackBlocks = [];
let kart, tPos=0, speed=0, running=false, time=0, checkpoints=[];
let currentTrack = 0;

// ====== Build track blocks ======
function buildTrack(trackIndex){
  trackBlocks.forEach(b=>scene.remove(b));
  trackBlocks=[];
  checkpoints=[];
  currentTrack=trackIndex;

  let track = tracks[trackIndex];
  track.forEach((piece)=>{
    let mat = new THREE.MeshPhongMaterial({color:piece.type==="jump"?0xffd700:0x888888, flatShading:true});
    let geom = new THREE.BoxGeometry(TRACK_SIZE,TRACK_HEIGHT,TRACK_SIZE);
    let block = new THREE.Mesh(geom,mat);
    block.position.set(piece.x,piece.y+TRACK_HEIGHT/2,piece.z);
    block.rotation.y = THREE.MathUtils.degToRad(piece.dir);
    scene.add(block);
    trackBlocks.push(block);

    let box = new THREE.Box3().setFromObject(block);
    checkpoints.push({box:box,passed:false});
  });

  if(kart) scene.remove(kart);
  kart = new THREE.Mesh(new THREE.BoxGeometry(4,2,6),new THREE.MeshPhongMaterial({color:0xff0000,flatShading:true}));
  let first = track[0];
  kart.position.set(first.x,first.y+TRACK_HEIGHT+1,first.z);
  scene.add(kart);

  tPos=0; speed=0; time=0; running=false;
  document.getElementById('timer').textContent="Time: 0.00s";
  let bestTime = localStorage.getItem('bestTime_'+trackIndex);
  document.getElementById('bestTime').textContent = bestTime ? `Best Time: ${bestTime}s` : "Best Time: --";
}

// ====== Start game ======
function startGame(trackIndex){
  buildTrack(trackIndex);
  document.getElementById('menu').style.display='none';
}

// ====== Controls ======
let keys={};
document.addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);
document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
document.addEventListener('keydown',e=>{
  if(e.key.toLowerCase()==='r') buildTrack(currentTrack);
});
document.getElementById('menuBtn').addEventListener('click', ()=>{ document.getElementById('menu').style.display='block'; });

// Timer
setInterval(()=>{
  if(running) { time+=0.016; document.getElementById('timer').textContent=`Time: ${time.toFixed(2)}s`; }
},16);

// ====== Animate ======
function animate(){
  requestAnimationFrame(animate);
  if(!kart) return;

  // Forward/backward
  speed = 0;
  if(keys['w']||keys['arrowup']) speed=0.2; // move forward
  if(keys['s']||keys['arrowdown']) speed=-0.1; // brake/back

  // Steering
  if(keys['a']||keys['arrowleft']) kart.rotation.y += 0.03;
  if(keys['d']||keys['arrowright']) kart.rotation.y -= 0.03;

  // Move kart
  let forward = new THREE.Vector3(0,0,1).applyEuler(kart.rotation).multiplyScalar(speed);
  kart.position.add(forward);

  // Camera follow
  let camPos = kart.position.clone().add(new THREE.Vector3(-20,15,-30));
  camera.position.lerp(camPos,0.1);
  camera.lookAt(kart.position);

  // Checkpoints
  checkpoints.forEach(c=>{
    if(!c.passed && c.box.containsPoint(kart.position)) c.passed=true;
  });
  let allPassed = checkpoints.every(c=>c.passed);

  if(running && allPassed){
    running=false;
    let bestTime = localStorage.getItem('bestTime_'+currentTrack);
    if(!bestTime || time<bestTime){
      localStorage.setItem('bestTime_'+currentTrack,time.toFixed(2));
      document.getElementById('bestTime').textContent=`Best Time: ${time.toFixed(2)}s`;
    }
    alert(`Track finished in ${time.toFixed(2)}s!`);
  }

  if(!running && speed>0) running=true;

  renderer.render(scene,camera);
}
animate();
