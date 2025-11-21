// ====== Scene Setup ======
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

let camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
let renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff,0.5));
let dirLight = new THREE.DirectionalLight(0xffffff,1);
dirLight.position.set(50,50,50);
scene.add(dirLight);

// Ground
let groundMat = new THREE.MeshPhongMaterial({color:0x228B22, flatShading:true});
let ground = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000,50,50), groundMat);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Outer barriers
function buildOuterBarriers(size=300){
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

// ====== Tracks (low-poly style) ======
let tracks = [
  // Track 1 - flat
  [{x:0,y:0,z:0},{x:40,y:0,z:0},{x:40,y:0,z:40},{x:0,y:0,z:40},{x:0,y:0,z:0}],
  // Track 2 - small ramps
  [{x:0,y:0,z:0},{x:30,y:2,z:0},{x:60,y:0,z:30},{x:30,y:2,z:60},{x:0,y:0,z:30},{x:0,y:0,z:0}],
  // Track 3 - hills
  [{x:0,y:0,z:0},{x:20,y:0,z:0},{x:40,y:3,z:20},{x:60,y:0,z:40},{x:40,y:3,z:60},{x:20,y:0,z:40},{x:0,y:0,z:20},{x:0,y:0,z:0}],
  // Track 4 - ramps + hills
  [{x:0,y:0,z:0},{x:15,y:2,z:0},{x:30,y:0,z:15},{x:45,y:2,z:30},{x:60,y:0,z:45},{x:45,y:2,z:60},{x:30,y:0,z:45},{x:15,y:2,z:30},{x:0,y:0,z:15},{x:0,y:0,z:0}],
  // Track 5 - advanced jumps
  [{x:0,y:0,z:0},{x:10,y:3,z:0},{x:20,y:0,z:10},{x:30,y:3,z:20},{x:40,y:0,z:30},{x:30,y:3,z:40},{x:20,y:0,z:30},{x:10,y:3,z:20},{x:0,y:0,z:10},{x:0,y:0,z:0}]
];

let trackCurve, kart, tPos, speed, obstacles=[], running=false, time=0, maxSpeed=0.003;
let checkpoints=[];

// ====== Build track pieces ======
function buildTrack(trackIndex){
  scene.children = scene.children.filter(obj=>obj===ground||obj.type==="DirectionalLight"||obj.type==="AmbientLight");
  obstacles=[];
  let pts = tracks[trackIndex].map(p=>new THREE.Vector3(p.x,p.y,p.z));
  trackCurve = new THREE.CatmullRomCurve3(pts,false);

  // Track Mesh
  let mesh = new THREE.Mesh(
    new THREE.TubeGeometry(trackCurve, 200, 2, 8, false),
    new THREE.MeshPhongMaterial({color:0x888888, flatShading:true})
  );
  mesh.position.y+=1;
  scene.add(mesh);

  // Kart
  kart = new THREE.Mesh(new THREE.BoxGeometry(4,2,6),new THREE.MeshPhongMaterial({color:0xff0000, flatShading:true}));
  kart.position.copy(trackCurve.getPointAt(0));
  scene.add(kart);

  // Obstacles
  let numObs=3+trackIndex*2;
  for(let i=0;i<numObs;i++){
    let t=Math.random();
    let pos=trackCurve.getPointAt(t);
    let obs=new THREE.Mesh(new THREE.BoxGeometry(3,3,3), new THREE.MeshPhongMaterial({color:0x0000ff, flatShading:true}));
    obs.position.copy(pos); scene.add(obs); obstacles.push(obs);
  }

  buildCheckpoints(trackCurve);
  tPos=0; speed=0; time=0; running=false;
  let bestTime=localStorage.getItem('bestTime_'+trackIndex);
  document.getElementById('bestTime').textContent = bestTime ? `Best Time: ${bestTime}s` : "Best Time: --";
}

// ====== Checkpoints ======
function buildCheckpoints(curve,num=10){
  checkpoints=[];
  for(let i=1;i<=num;i++){
    let t=i/num;
    let pos=curve.getPointAt(t);
    let size=10;
    let box = new THREE.Box3(
      new THREE.Vector3(pos.x-size/2,pos.y-5,pos.z-size/2),
      new THREE.Vector3(pos.x+size/2,pos.y+5,pos.z+size/2)
    );
    checkpoints.push({box:box,passed:false});
  }
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

document.addEventListener('keydown', e=>{
  if(e.key.toLowerCase()==='r' && trackCurve){
    tPos=0; speed=0; time=0; running=false;
    kart.position.copy(trackCurve.getPointAt(0));
    kart.lookAt(trackCurve.getPointAt(0.01));
    checkpoints.forEach(c=>c.passed=false);
    document.getElementById('timer').textContent=`Time: 0.00s`;
  }
});

// Main menu
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
  let camTarget = new THREE.Vector3().copy(kart.position);
  camera.position.lerp(camTarget.clone().add(new THREE.Vector3(-10,5,-15)),0.1);
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
    let trackIndex = tracks.findIndex(t=>t[0].x===trackCurve.points[0].x && t[0].z===trackCurve.points[0].z);
    let bestTime=localStorage.getItem('bestTime_'+trackIndex);
    if(!bestTime || time<bestTime){
      localStorage.setItem('bestTime_'+trackIndex,time.toFixed(2));
      document.getElementById('bestTime').textContent=`Best Time: ${time.toFixed(2)}s`;
    }
    alert(`Lap finished in ${time.toFixed(2)}s!`);
    tPos=0; speed=0; checkpoints.forEach(c=>c.passed=false);
  }

  renderer.render(scene,camera);
}
animate();

// Start timer on first key press
document.addEventListener('keydown', e=>{ if(!running && trackCurve) running=true; });
