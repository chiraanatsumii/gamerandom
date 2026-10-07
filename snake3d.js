const UKURAN_ARENA = 32;
const KUNCI_SKOR_SNAKE = 'snake3dBestScore';
const WARNA_ULAR_DEFAULT = '#f2bd4b';

let THREE;
let OrbitControls;
let scene;
let camera;
let renderer;
let controls;
let snakeCanvas;
let snakeStage;
let snakeSegments = [];
let snakeBodyMesh;
let snakeHead;
let snakeTailCap;
let foodMeshes = [];
let direction = { x: 1, z: 0 };
let queuedDirection = { x: 1, z: 0 };
let skinColor = WARNA_ULAR_DEFAULT;
let skinTexture = null;
let activeImageUrl = null;
let running = false;
let paused = false;
let initialized = false;
let gameOver = false;
let score = 0;
let moveAccumulator = 0;
let animationFrame = null;
let grassMaterial;
let snakeMaterial;
let headMaterial;
let fruitMaterial;
let resizeObserver;

const ARAH_SNAKE = {
    up: { x: 0, z: -1 },
    down: { x: 0, z: 1 },
    left: { x: -1, z: 0 },
    right: { x: 1, z: 0 }
};

function elemen(id) {
    return document.getElementById(id);
}

function tampilkanSnakeStatus(title, message, show = true) {
    const titleElement = elemen('snakeOverlayTitle');
    titleElement.textContent = title;
    titleElement.hidden = !title;
    elemen('snakeOverlayText').textContent = message;
    elemen('snakeOverlay').classList.toggle('is-hidden', !show);
}

function buatTeksturRumput() {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 1024;
    const textureContext = textureCanvas.getContext('2d');
    textureContext.fillStyle = '#376c2d';
    textureContext.fillRect(0, 0, 1024, 1024);

    for (let i = 0; i < 52000; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const shade = Math.floor(Math.random() * 70);
        textureContext.strokeStyle = `rgba(${24 + shade * 0.35}, ${66 + shade * 0.9}, ${18 + shade * 0.25}, ${0.16 + Math.random() * 0.34})`;
        textureContext.lineWidth = 0.7 + Math.random() * 1.8;
        textureContext.beginPath();
        textureContext.moveTo(x, y);
        textureContext.lineTo(x - 1 + Math.random() * 3, y - 3 - Math.random() * 9);
        textureContext.stroke();
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
    else texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(17, 17);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
}

function buatRumput3D() {
    const bladeGeometry = new THREE.ConeGeometry(0.07, 0.36, 3);
    bladeGeometry.translate(0, 0.18, 0);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: '#f4fff0',
        roughness: 0.92,
        side: THREE.DoubleSide,
        vertexColors: true
    });
    const jumlahBilahan = 14000;
    const bilahan = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, jumlahBilahan);
    const transform = new THREE.Object3D();
    const warna = new THREE.Color();

    for (let i = 0; i < jumlahBilahan; i++) {
        transform.position.set((Math.random() - 0.5) * 31, 0.025, (Math.random() - 0.5) * 31);
        transform.rotation.y = Math.random() * Math.PI;
        const ukuran = 0.5 + Math.random() * 0.65;
        transform.scale.set(ukuran, ukuran, ukuran);
        transform.updateMatrix();
        bilahan.setMatrixAt(i, transform.matrix);
        warna.setHSL(0.24 + Math.random() * 0.06, 0.5 + Math.random() * 0.25, 0.3 + Math.random() * 0.16);
        bilahan.setColorAt(i, warna);
    }
    bilahan.instanceMatrix.needsUpdate = true;
    if (bilahan.instanceColor) bilahan.instanceColor.needsUpdate = true;
    scene.add(bilahan);
}

function buatGarisArena() {
    const borderMaterial = new THREE.MeshStandardMaterial({ color: '#604a2d', roughness: 0.9 });
    const railLong = new THREE.BoxGeometry(UKURAN_ARENA + 0.35, 0.24, 0.14);
    const railShort = new THREE.BoxGeometry(0.14, 0.24, UKURAN_ARENA + 0.35);
    [
        [railLong, 0, 0.02, -UKURAN_ARENA / 2],
        [railLong, 0, 0.02, UKURAN_ARENA / 2],
        [railShort, -UKURAN_ARENA / 2, 0.02, 0],
        [railShort, UKURAN_ARENA / 2, 0.02, 0]
    ].forEach(([geometry, x, y, z]) => {
        const rail = new THREE.Mesh(geometry, borderMaterial);
        rail.position.set(x, y, z);
        rail.castShadow = true;
        rail.receiveShadow = true;
        scene.add(rail);
    });
}

function buatSceneSnake() {
    snakeCanvas = elemen('snakeCanvas');
    snakeStage = elemen('snakeStage');
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#b5d3dc');
    scene.fog = new THREE.Fog('#b5d3dc', 48, 92);

    camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
    camera.position.set(23, 39, 29);
    renderer = new THREE.WebGLRenderer({ canvas: snakeCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.15, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 19;
    controls.maxDistance = 58;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.rotateSpeed = 0.65;

    const hemisphereLight = new THREE.HemisphereLight('#e7f5ff', '#536d35', 0.9);
    scene.add(hemisphereLight);
    const sunlight = new THREE.DirectionalLight('#fff2cc', 1.25);
    sunlight.position.set(-9, 20, 11);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1536, 1536);
    sunlight.shadow.camera.left = -24;
    sunlight.shadow.camera.right = 24;
    sunlight.shadow.camera.top = 24;
    sunlight.shadow.camera.bottom = -24;
    scene.add(sunlight);

    const groundTexture = buatTeksturRumput();
    grassMaterial = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), grassMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.23;
    ground.receiveShadow = true;
    scene.add(ground);
    buatGarisArena();
    buatObjekSnake();
    resizeObserver = new ResizeObserver(aturUkuranSnake);
    resizeObserver.observe(snakeStage);
    aturUkuranSnake();
    initialized = true;
    jalankanRenderSnake();
}

function buatObjekSnake() {
    snakeMaterial = new THREE.MeshStandardMaterial({ color: skinColor, emissive: skinColor, emissiveIntensity: 0.14, roughness: 0.34, metalness: 0.02 });
    headMaterial = new THREE.MeshStandardMaterial({ color: skinColor, emissive: skinColor, emissiveIntensity: 0.18, roughness: 0.28, metalness: 0.01 });
    fruitMaterial = new THREE.MeshStandardMaterial({ color: '#f0643b', roughness: 0.35 });
    const headGeometry = new THREE.SphereGeometry(0.46, 28, 20);

    snakeSegments = [
        { x: 16, z: 16 }, { x: 15, z: 16 }, { x: 14, z: 16 },
        { x: 13, z: 16 }, { x: 12, z: 16 }, { x: 11, z: 16 }
    ];
    snakeHead = new THREE.Mesh(headGeometry, headMaterial);
    snakeHead.castShadow = true;
    snakeHead.receiveShadow = true;
    scene.add(snakeHead);
    snakeBodyMesh = new THREE.Mesh(new THREE.BufferGeometry(), snakeMaterial);
    snakeBodyMesh.castShadow = true;
    snakeBodyMesh.receiveShadow = true;
    scene.add(snakeBodyMesh);
    snakeTailCap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), snakeMaterial);
    snakeTailCap.castShadow = true;
    snakeTailCap.receiveShadow = true;
    scene.add(snakeTailCap);
    buatMataUlar();
    foodMeshes = Array.from({ length: 3 }, () => {
        const fruitGroup = new THREE.Group();
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 22, 18), fruitMaterial);
        fruit.scale.set(1, 0.9, 1);
        fruit.castShadow = true;
        fruitGroup.add(fruit);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.23, 8), new THREE.MeshStandardMaterial({ color: '#83b650', roughness: 0.68 }));
        leaf.position.set(0.06, 0.34, 0);
        leaf.rotation.z = -0.5;
        fruitGroup.add(leaf);
        scene.add(fruitGroup);
        return fruitGroup;
    });
    foodMeshes.forEach(letakkanBuah);
    perbaruiMeshUlar();
}

function buatMataUlar() {
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#17231a', roughness: 0.35 });
    const eyeGeometry = new THREE.SphereGeometry(0.075, 12, 10);
    const eyes = [-1, 1].map(side => {
        const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        eye.position.set(0.21, 0.14, side * 0.2);
        snakeHead.add(eye);
        return eye;
    });
    snakeHead.userData.eyes = eyes;
}

function perbaruiMeshUlar() {
    const points = snakeSegments.slice().reverse().map(segment => new THREE.Vector3(
        segment.x - UKURAN_ARENA / 2 + 0.5,
        0.4,
        segment.z - UKURAN_ARENA / 2 + 0.5
    ));
    if (snakeBodyMesh.geometry) snakeBodyMesh.geometry.dispose();
    snakeBodyMesh.geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        Math.max(24, points.length * 8),
        0.38,
        12,
        false
    );
    const headPosition = snakeSegments[0];
    snakeHead.position.set(headPosition.x - UKURAN_ARENA / 2 + 0.5, 0.47, headPosition.z - UKURAN_ARENA / 2 + 0.5);
    const tailPosition = snakeSegments[snakeSegments.length - 1];
    snakeTailCap.position.set(tailPosition.x - UKURAN_ARENA / 2 + 0.5, 0.4, tailPosition.z - UKURAN_ARENA / 2 + 0.5);
    const lookAngle = Math.atan2(-direction.z, direction.x);
    snakeHead.rotation.y = lookAngle;
}

function letakkanBuah(foodMesh) {
    let position;
    const foodPositions = foodMeshes
        .filter(food => food !== foodMesh && food.userData.gridPosition)
        .map(food => food.userData.gridPosition);
    do {
        position = { x: Math.floor(Math.random() * UKURAN_ARENA), z: Math.floor(Math.random() * UKURAN_ARENA) };
    } while (snakeSegments.some(segment => segment.x === position.x && segment.z === position.z)
        || foodPositions.some(food => food.x === position.x && food.z === position.z));
    foodMesh.position.set(position.x - UKURAN_ARENA / 2 + 0.5, 0.35, position.z - UKURAN_ARENA / 2 + 0.5);
    foodMesh.userData.gridPosition = position;
}

function aturUkuranSnake() {
    if (!renderer || !snakeStage) return;
    const width = Math.max(1, snakeStage.clientWidth);
    const height = Math.max(1, snakeStage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function loopRenderSnake(waktu) {
    if (!renderer || !scene) return;
    if (running && !paused && !gameOver) {
        moveAccumulator += Math.min(0.05, clockDelta(waktu));
        const interval = Math.max(0.14, 0.28 - score * 0.003);
        if (moveAccumulator >= interval) {
            moveAccumulator = 0;
            gerakkanUlar();
        }
    }
    foodMeshes.forEach(food => { food.rotation.y += 0.006; });
    controls?.update();
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(loopRenderSnake);
}

function jalankanRenderSnake() {
    if (initialized && animationFrame === null) animationFrame = requestAnimationFrame(loopRenderSnake);
}

let waktuFrameSebelumnya = 0;
function clockDelta(waktu) {
    const delta = waktuFrameSebelumnya ? (waktu - waktuFrameSebelumnya) / 1000 : 0;
    waktuFrameSebelumnya = waktu;
    return delta;
}

function gerakkanUlar() {
    direction = queuedDirection;
    const head = snakeSegments[0];
    const next = { x: head.x + direction.x, z: head.z + direction.z };
    const foodIndex = foodMeshes.findIndex(food => next.x === food.userData.gridPosition.x && next.z === food.userData.gridPosition.z);
    const makan = foodIndex !== -1;
    const bodyEnd = makan ? snakeSegments.length : snakeSegments.length - 1;
    const tabrakDiri = snakeSegments.slice(0, bodyEnd).some(segment => segment.x === next.x && segment.z === next.z);
    if (next.x < 0 || next.x >= UKURAN_ARENA || next.z < 0 || next.z >= UKURAN_ARENA || tabrakDiri) {
        kalahSnake();
        return;
    }
    snakeSegments.unshift(next);
    if (makan) {
        score++;
        elemen('snakeScore').textContent = score;
        const best = Math.max(score, Number(localStorage.getItem(KUNCI_SKOR_SNAKE)) || 0);
        localStorage.setItem(KUNCI_SKOR_SNAKE, String(best));
        elemen('snakeBest').textContent = best;
        elemen('snakeStatus').textContent = `Nyam! ${foodMeshes.length} makanan masih ada di arena.`;
        letakkanBuah(foodMeshes[foodIndex]);
    } else {
        snakeSegments.pop();
    }
    perbaruiMeshUlar();
}

function ubahArahSnake(namaArah) {
    const nextDirection = ARAH_SNAKE[namaArah];
    if (!nextDirection || gameOver) return;
    if (nextDirection.x === -direction.x && nextDirection.z === -direction.z) return;
    queuedDirection = nextDirection;
    if (paused) jedaSnake(false);
}

function gerakkanJoystick(event, joystick, knob) {
    const batas = joystick.getBoundingClientRect();
    const pusatX = batas.left + batas.width / 2;
    const pusatY = batas.top + batas.height / 2;
    const dx = event.clientX - pusatX;
    const dy = event.clientY - pusatY;
    const batasGerak = 34;
    const jarak = Math.hypot(dx, dy);
    const skala = jarak > batasGerak ? batasGerak / jarak : 1;
    const x = dx * skala;
    const y = dy * skala;
    knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    if (jarak > 13) {
        if (Math.abs(dx) > Math.abs(dy)) ubahArahSnake(dx < 0 ? 'left' : 'right');
        else ubahArahSnake(dy < 0 ? 'up' : 'down');
    }
}

function pasangJoystick() {
    const joystick = elemen('snakeJoystick');
    const knob = elemen('snakeJoystickKnob');
    let pointerId = null;

    joystick.addEventListener('pointerdown', event => {
        event.preventDefault();
        pointerId = event.pointerId;
        joystick.setPointerCapture(pointerId);
        gerakkanJoystick(event, joystick, knob);
    });
    joystick.addEventListener('pointermove', event => {
        if (event.pointerId === pointerId) gerakkanJoystick(event, joystick, knob);
    });
    const kembalikanKeTengah = event => {
        if (event.pointerId !== pointerId) return;
        pointerId = null;
        knob.style.transform = 'translate(-50%, -50%)';
    };
    joystick.addEventListener('pointerup', kembalikanKeTengah);
    joystick.addEventListener('pointercancel', kembalikanKeTengah);
}

function kalahSnake() {
    running = false;
    gameOver = true;
    elemen('snakePauseButton').textContent = 'Jeda';
    tampilkanSnakeStatus('Yah, kalah!', `Skor ${score}. Semangat, ulang lagi yuk!`, true);
    elemen('snakeStatus').textContent = 'Tabrak batas atau badan sendiri. Coba lagi!';
}

function mulaiUlangSnake3D() {
    if (!initialized) {
        tampilkanSnakeStatus('MEMUAT ARENA', 'Menyiapkan arena rumput…', true);
        return inisialisasiSnake3D().then(() => mulaiUlangSnake3D());
    }
    const best = Number(localStorage.getItem(KUNCI_SKOR_SNAKE)) || 0;
    score = 0;
    elemen('snakeScore').textContent = '0';
    elemen('snakeBest').textContent = best;
    elemen('snakePauseButton').textContent = 'Jeda';
    elemen('snakeStatus').textContent = 'Ambil buah dan hindari ekor sendiri.';
    snakeSegments = [
        { x: 16, z: 16 }, { x: 15, z: 16 }, { x: 14, z: 16 },
        { x: 13, z: 16 }, { x: 12, z: 16 }, { x: 11, z: 16 }
    ];
    direction = { x: 1, z: 0 };
    queuedDirection = { x: 1, z: 0 };
    moveAccumulator = 0;
    gameOver = false;
    paused = false;
    running = true;
    foodMeshes.forEach(letakkanBuah);
    perbaruiMeshUlar();
    tampilkanSnakeStatus('', '', false);
}

function jedaSnake(forcePause) {
    if (!running || gameOver) return;
    paused = typeof forcePause === 'boolean' ? forcePause : !paused;
    elemen('snakePauseButton').textContent = paused ? 'Lanjut' : 'Jeda';
    tampilkanSnakeStatus(paused ? 'DIJEDA' : '', paused ? 'Tekan Lanjut atau pilih arah.' : '', paused);
}

function resetKameraSnake() {
    if (!camera || !controls) return;
    camera.position.set(14, 25, 18);
    controls.target.set(0, 0.15, 0);
    controls.update();
}

function ubahWarnaUlar(color) {
    skinColor = color;
    skinTexture = null;
    if (!snakeMaterial || !headMaterial) return;
    snakeMaterial.map = null;
    headMaterial.map = null;
    snakeMaterial.color.set(color);
    headMaterial.color.set(color);
    snakeMaterial.emissive.set(color);
    headMaterial.emissive.set(color);
    snakeMaterial.needsUpdate = true;
    headMaterial.needsUpdate = true;
}

function pakaiGambarSkin(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (activeImageUrl) URL.revokeObjectURL(activeImageUrl);
    activeImageUrl = URL.createObjectURL(file);
    new THREE.TextureLoader().load(activeImageUrl, texture => {
        if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
        else texture.encoding = THREE.sRGBEncoding;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(2, 1);
        texture.center.set(0.5, 0.5);
        texture.needsUpdate = true;
        skinTexture = texture;
        snakeMaterial.map = texture;
        headMaterial.map = texture;
        snakeMaterial.color.set('#ffffff');
        headMaterial.color.set('#ffffff');
        snakeMaterial.emissive.set('#000000');
        headMaterial.emissive.set('#000000');
        snakeMaterial.needsUpdate = true;
        headMaterial.needsUpdate = true;
    }, undefined, () => {
        elemen('snakeStatus').textContent = 'Gambar skin tidak dapat dibuka.';
    });
}

async function inisialisasiSnake3D() {
    if (initialized) return;
    try {
        if (!window.THREE || !window.THREE.OrbitControls) throw new Error('Three.js atau OrbitControls tidak tersedia.');
        THREE = window.THREE;
        OrbitControls = THREE.OrbitControls;
        buatSceneSnake();
    } catch (error) {
        console.error('Three.js gagal dimuat.', error);
        tampilkanSnakeStatus('GAGAL MEMUAT', 'Periksa koneksi internet lalu tekan Mulai lagi.', true);
        elemen('snakeStatus').textContent = 'Scene 3D membutuhkan koneksi untuk memuat Three.js.';
        throw error;
    }
}

window.mulaiSnake3D = () => {
    running = false;
    paused = false;
    gameOver = false;
    elemen('snakeBest').textContent = String(Number(localStorage.getItem(KUNCI_SKOR_SNAKE)) || 0);
    jalankanRenderSnake();
    if (!initialized) {
        tampilkanSnakeStatus('MEMUAT ARENA', 'Menyiapkan arena rumput…', true);
        inisialisasiSnake3D().then(() => tampilkanSnakeStatus('', 'Tekan kalo mau main', true)).catch(() => {});
        return;
    }
    tampilkanSnakeStatus('', 'Tekan kalo mau main', true);
};
window.mulaiUlangSnake3D = mulaiUlangSnake3D;
window.hentikanSnake3D = () => {
    running = false;
    paused = false;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
};

window.addEventListener('DOMContentLoaded', () => {
    elemen('snakeStartButton').addEventListener('click', mulaiUlangSnake3D);
    elemen('snakePauseButton').addEventListener('click', () => jedaSnake());
    elemen('snakeCameraButton').addEventListener('click', resetKameraSnake);
    pasangJoystick();
    document.querySelectorAll('[data-snake-color]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('[data-snake-color]').forEach(swatch => swatch.classList.remove('is-selected'));
            button.classList.add('is-selected');
            ubahWarnaUlar(button.dataset.snakeColor);
        });
    });
    elemen('snakeSkinUpload').addEventListener('change', event => pakaiGambarSkin(event.target.files[0]));
    window.addEventListener('keydown', event => {
        if (window.modeGame !== 'snake') return;
        const keyDirections = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        if (keyDirections[event.key]) {
            event.preventDefault();
            ubahArahSnake(keyDirections[event.key]);
        }
        if (event.key.toLowerCase() === 'p') jedaSnake();
    });
});
