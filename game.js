let scene, camera, renderer;
let car, velocity = 0;
let trackGroup;
let startTime = 0, running = false;
let lastCheckpoint = null;

const keys = {};

document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);

document.addEventListener("keydown", e => {
    if (e.key === "r") resetCar();
});

init();
animate();

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // Camera
    camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 2000);
    camera.position.set(0, 6, -12);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    document.body.appendChild(renderer.domElement);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10,20,10);
    scene.add(light);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(5000, 5000),
        new THREE.MeshLambertMaterial({ color: 0x55aa55 })
    );
    ground.rotation.x = -Math.PI/2;
    scene.add(ground);

    createCar();
    loadTrack(1);
}

function createCar() {
    const bodyGeo = new THREE.BoxGeometry(2, 1, 4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xff3333 });
    car = new THREE.Mesh(bodyGeo, bodyMat);
    car.position.set(0, 1, 0);
    scene.add(car);
}

function loadTrack(id) {
    if (trackGroup) scene.remove(trackGroup);

    trackGroup = new THREE.Group();

    if (id === 1) buildTrack1();
    if (id === 2) buildTrack2();
    if (id === 3) buildTrack3();

    scene.add(trackGroup);

    resetCar();
}

function resetCar() {
    car.position.set(0, 1, 0);
    car.rotation.y = 0;
    velocity = 0;
    running = false;
    document.getElementById("finishText").innerText = "";
    document.getElementById("timer").innerText = "0.00";
}

function startTimer() {
    running = true;
    startTime = performance.now();
}

function updateTimer() {
    if (!running) return;
    const t = (performance.now() - startTime) / 1000;
    document.getElementById("timer").innerText = t.toFixed(2);
}

function animate() {
    requestAnimationFrame(animate);

    // Car movement
    if (keys["w"]) {
        if (!running) startTimer();
        velocity = Math.min(velocity + 0.002, 0.35);
    } else {
        velocity *= 0.95;
    }

    // Steering
    if (keys["a"]) car.rotation.y += 0.04;
    if (keys["d"]) car.rotation.y -= 0.04;

    // Move forward
    car.position.x -= Math.sin(car.rotation.y) * velocity * 10;
    car.position.z -= Math.cos(car.rotation.y) * velocity * 10;

    // Camera follow
    const camOffset = new THREE.Vector3(0, 6, -12).applyAxisAngle(new THREE.Vector3(0,1,0), car.rotation.y);
    camera.position.lerp(car.position.clone().add(camOffset), 0.1);
    camera.lookAt(car.position);

    // Check finish
    checkFinish();

    updateTimer();
    renderer.render(scene, camera);
}

/* ---------------- TRACK BUILDER FUNCTIONS ---------------- */

function buildTrack1() {
    // Big straight → turn → jump → finish
    buildRoad([ [0,0], [0,-50], [30,-120], [30,-180], [0,-240] ]);

    buildFinish(0, -240);
    buildCheckpoint(0, -120);
}

function buildTrack2() {
    buildRoad([ 
        [0,0], [0,-60], [40,-100], [80,-100], [120,-60], [120,0], [80,40], [40,40], [0,0]
    ]);

    buildFinish(0, 0);
    buildCheckpoint(80, -100);
}

function buildTrack3() {
    buildRoad([
        [0,0], [0,-80], [-40,-140], [-80,-160], [-120,-120], [-100,-60], [-60,-20], [0,0]
    ]);

    buildFinish(0,0);
    buildCheckpoint(-80, -160);
}

function buildRoad(points) {
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    for (let i = 0; i < points.length - 1; i++) {
        const [x1, z1] = points[i];
        const [x2, z2] = points[i+1];

        const length = Math.hypot(x2 - x1, z2 - z1);
        const angle = Math.atan2(z2 - z1, x2 - x1);

        const segment = new THREE.Mesh(
            new THREE.BoxGeometry(length, 1, 8),
            roadMat
        );

        segment.position.set((x1 + x2)/2, 0.5, (z1 + z2)/2);
        segment.rotation.y = -angle;

        trackGroup.add(segment);

        buildWalls(segment, length, angle);
    }
}

function buildWalls(segment, length, angle) {
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x444444 });

    const left = new THREE.Mesh(new THREE.BoxGeometry(length, 2, 0.5), wallMat);
    left.position.set(0, 1, 4);
    segment.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(length, 2, 0.5), wallMat);
    right.position.set(0, 1, -4);
    segment.add(right);
}

function buildFinish(x,z) {
    const geo = new THREE.BoxGeometry(8, 1, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    const finish = new THREE.Mesh(geo, mat);
    finish.position.set(x, 0.6, z);
    finish.name = "finish";
    trackGroup.add(finish);
}

function buildCheckpoint(x,z) {
    const cp = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1, 8),
        new THREE.MeshLambertMaterial({ color: 0x00ff00, transparent: true, opacity: 0.25 })
    );
    cp.position.set(x, 0.6, z);
    cp.name = "cp";
    trackGroup.add(cp);
}

function checkFinish() {
    trackGroup.children.forEach(obj => {
        if (obj.name === "cp") {
            if (car.position.distanceTo(obj.position) < 6) {
                lastCheckpoint = obj;
            }
        }
        if (obj.name === "finish") {
            if (car.position.distanceTo(obj.position) < 6) {
                if (lastCheckpoint) {
                    running = false;
                    const t = document.getElementById("timer").innerText;
                    document.getElementById("finishText").innerText = "Finished in " + t + " seconds!";
                }
            }
        }
    });
}
