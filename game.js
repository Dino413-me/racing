// ====== Scene Setup ======
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Blue sky

let camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
let renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff,0.5));
let dirLight = new THREE.DirectionalLight(0xffffff,1);
dirLight.position.set(50,50,50);
scene.add(dirLight);

// Ground
let groundMat = new THREE.MeshPhongMaterial({color:0x228B22, flatShading:true});
let ground = new THREE.Mesh(new THREE.PlaneGeometry(1000,1000,50,50), groundMat);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Outer barriers
function buildOuterBarriers(size=200){
  let barrierMat = new THREE.MeshPhongMaterial({color:0x444444});
  let thickness = 5, height = 20;
  let walls = [];
  walls.push(new THREE.Mesh(new THREE.BoxGeometry(thickness, height, size*2), barrierMat));
  walls[walls.length-1].position.set(size, height/2, 0);
  walls.push(new THREE.Mesh(new THREE.BoxGeometry(thickness, height, size*2), barrierMat));
  walls[walls.length-1].position.set(-size, height/2, 0);
  walls.push(new THREE.Mesh(new THREE.BoxGeometry(size*2, height, thickness), barrierMat));
  walls[walls.length-1].position.set(0, height/2, size);
  walls.push(new THREE.Mesh(new THREE.BoxGeometry(size*2, height, thickness), barrierMat));
  walls[walls.length-1].position.set(0, height/2, -size);
  walls.forEach(w=>scene.add(w));
}
buildOuterBarriers(200);

// ====== Tracks ======
let tracks = [
  [[0,0,0],[40,0,0],[40,0,40],[0,0,40],[0,0,0]],
  [[0,0,0],[30,2,0],[60,0,30],[30,2,60],[0,0,30],[0,0,0]],
  [[0,0,0],[20,0,0],[40,3,20],[60,0,40],[40,3,60],[20,0,40],[0,0,20],[0,0,0]],
  [[0,0,0],[15,2,0],[30,0,15],[45,2,30],[60,0,45],[45,2,60],[30,0,45],[15,2,30],[0,0,15],[0,0,0]],
  [[0,0,0],[10,3,0],[20,0,10],[30,3,20],[40,0,30],[30,3,40],[20,0,30],[10,3,20],[0,0,10],[0,0,0]]
];

let trackCurve, kart, tPos, speed, obstacles=[], running=false, time=0, maxSpeed=0.002;
let checkpoints=[];

// ====== Walls & Checkpoints ======
function buildWalls(curve,numWalls=50){
  let wallGroup = new THREE.Group();
  for(let i=0;i<numWalls;i++){
    let t=i/numWalls;
    let pos=curve.getPointAt(t);
    let next=curve.getPointAt(Math.min(t+0.01,1));
    let dir=new THREE.Vector3().subVectors(next,pos).normalize();
    let left=new THREE.Vector3(-dir.z,0,dir.x).multiplyScalar(7);
    let right=left.clone().multiplyScalar(-1);
    let wallGeo = new THREE.BoxGeometry(1,3,5);
    let wallMat = new THREE.MeshPhongMaterial({color:0x333333});
    let wallLeft = new THREE.Mesh(wallGeo,wallMat);
    wallLeft.position.copy(pos.clone().add(left)); wallLeft.lookAt(next); wallGroup.add(wallLeft);
    let wallRight = new THREE.Mesh(wallGeo,wallMat);
    wallRight.position.copy(pos.clone().add(right)); wallRight.lookAt(next); wallGroup.add(wallRight);
  }
  scene.add(wallGroup);
}

function buildCheckpoints(curve,numCheckpoints=10){
  checkpoints=[];
  for(let i=1;i<=numCheckpoints;i++){
    let t=i/numCheckpoints;
    let pos=curve.getPointAt(t);
    let size=10;
    let box = new THREE.Box3(
      new THREE.Vector3(pos.x-size/2,pos.y-5,pos.z-size/2),
      new THREE.Vector3(pos.x+size/2,pos.y+5,pos.z+size/2)
    );
    checkpoints.push({box:box,passed:false});
  }
}

// ====== Build Track ======
function buildTrack(trackIndex){
  scene.children = scene.children.filter(obj=>obj===ground||obj.type==="DirectionalLight"||obj.type==="AmbientLight");
  obstacles=[];

  let pts = tracks[trackIndex].map(p=>new THREE.Vector3(p[0],p[1],p[2]));
  trackCurve = new THREE.CatmullRomCurve3(pts,false);
  let trackMesh = new THREE.Mesh(
    new THREE.TubeGeometry(trackCurve, 200, 2, 8, false),
    new THREE.MeshPhongMaterial({color:0x8B4513, flatShading:true})
  );
  trackMesh.position.y+=1;
  scene.add(trackMesh);

  // Kart
  kart = new THREE.Mesh(new THREE.BoxGeometry(4,2,6),new THREE.MeshPhongMaterial({color:0xff0000,flatShading:true}));
  kart.position.copy(trackCurve.getPointAt(0));
  scene.add(kart);

  // Obstacles
  let numObs=3+trackIndex*2;
  for(let i=0;i<numObs;i++){
    let t=Math.random();
    let pos=trackCurve.getPointAt(t);
    let obs=new THREE.Mesh(new THREE.BoxGeometry(3,3,3), new THREE.MeshPhongMaterial({color:0x0000ff,flatShading:true}));
    obs.position.copy(pos); scene.add(obs); obstacles.push(obs);
  }

  buildWalls(trackCurve);
  buildCheckpoints(trackCurve);

  tPos=0; speed=0; time=0; running=false;
  let bestTime = localStorage.getItem('bestTime_'+trackIndex);
  document.getElementById('bestTime').textContent = bestTime ? `Best Time: ${bestTime}s` : "Best Time: --";
}

// ====== Start Game ======
function startGame(trackIndex){
  buildTrack(trackIndex);
  document.getElementById('menu').style.display='none';
}

// ====== Controls ======
let keys={};
document.addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);
document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

// Restart track
document.addEventListener('keydown', e=>{
  if(e.key.toLowerCase()==='r' && trackCurve){
    tPos=0; speed=0; time=0; running=false;
    kart.position.copy(trackCurve.getPointAt(0));
    kart.lookAt(trackCurve.getPointAt(0.01));
    checkpoints.forEach(c=>c.passed=false);
    document.getElementById('timer').textContent=`Time: 0.00s`;
  }
});

// Main menu button
document.getElementById('menuBtn').addEventListener('click', ()=>{
  document.getElementById('menu').style.display='block';
  scene.children = scene.children.filter(obj=>obj===ground||obj.type==="DirectionalLight"||obj.type==="AmbientLight");
  trackCurve=null;
  running=false;
});

// Timer
setInterval(()=>{
  if(running){time+=0.016; document.getElementById('timer').textContent=`Time: ${time.toFixed(2)}s`;}
},16);

// Animate
function animate(){
  requestAnimationFrame(animate);
  if(!trackCurve) return;

  // Controls
  if(keys['arrowup'] || keys['w']) speed+=0.0002;
  if(keys['arrowdown'] || keys['s']) speed-=0.0002;
  if(keys['arrowleft'] || keys['a']) tPos-=0.0005;
  if(keys['arrowright'] || keys['d']) tPos+=0.0005;
  speed=Math.max(Math.min(speed,maxSpeed),0);
  tPos+=speed;

  // Kart movement
  let pos=trackCurve.getPointAt(Math.min(tPos,1));
  let next=trackCurve.getPointAt(Math.min(tPos+0.01,1));
  kart.position.copy(pos); kart.lookAt(next);

  // Camera
  camera.position.set(kart.position.x-10,kart.position.y+5,kart.position.z-15);
  camera.lookAt(kart.position);

  // Obstacles
  obstacles.forEach(obs=>{
    let dx=kart.position.x-obs.position.x;
    let dz=kart.position.z-obs.position.z;
    let dy=kart.position.y-obs.position.y;
    let dist=Math.sqrt(dx*dx+dz*dz+dy*dy);
    if(dist<5) speed*=0.5;
  });

  // Checkpoints
  checkpoints.forEach(c=>{ if(!c.passed && c.box.containsPoint(kart.position)) c.passed=true; });
  let allPassed=checkpoints.every(c=>c.passed);

  // Finish
  if(running && allPassed && tPos>=1){
    running=false;
    let trackIndex = tracks.findIndex(t=>t[0][0]===trackCurve.points[0].x && t[0][2]===trackCurve.points[0].z);
    let bestTime=localStorage.getItem('bestTime_'+trackIndex);
    if(!bestTime || time<bestTime) {
      localStorage.setItem('bestTime_'+trackIndex,time.toFixed(2));
      document.getElementById('bestTime').textContent=`Best Time: ${time.toFixed(2)}s`;
    }
    alert(`Lap finished in ${time.toFixed(2)}s!`);
    tPos=0; speed=0;
    checkpoints.forEach(c=>c.passed=false);
  }

  renderer.render(scene,camera);
}
animate();

// Start timer on first key press
document.addEventListener('keydown', e=>{ if(!running && trackCurve) running=true; });
