import * as THREE from 'three';

// --- CONFIGURATION ---
const PARTICLE_COUNT = 20000;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 6;

// --- GEOMETRY DATA GENERATION ---
const posBase = new Float32Array(PARTICLE_COUNT * 3);
const posHeart = new Float32Array(PARTICLE_COUNT * 3);
const posSaturn = new Float32Array(PARTICLE_COUNT * 3);
const posFirework = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    // 1. Cloud (Base)
    posBase[i3] = (Math.random() - 0.5) * 10;
    posBase[i3+1] = (Math.random() - 0.5) * 10;
    posBase[i3+2] = (Math.random() - 0.5) * 10;

    // 2. Heart
    const t = Math.random() * Math.PI * 2;
    posHeart[i3] = 1.6 * Math.pow(Math.sin(t), 3);
    posHeart[i3+1] = (1.3 * Math.cos(t) - 0.5 * Math.cos(2*t) - 0.2 * Math.cos(3*t) - 0.1 * Math.cos(4*t)) * 0.8;
    posHeart[i3+2] = (Math.random() - 0.5) * 0.5;

    // 3. Saturn
    if (i < PARTICLE_COUNT * 0.5) {
        const phi = Math.acos(-1 + (2 * i) / (PARTICLE_COUNT * 0.5));
        const theta = Math.sqrt(PARTICLE_COUNT * 0.5 * Math.PI) * phi;
        posSaturn[i3] = Math.cos(theta) * Math.sin(phi) * 1.5;
        posSaturn[i3+1] = Math.sin(theta) * Math.sin(phi) * 1.5;
        posSaturn[i3+2] = Math.cos(phi) * 1.5;
    } else {
        const angle = Math.random() * Math.PI * 2;
        const r = 2.0 + Math.random() * 1.0;
        posSaturn[i3] = Math.cos(angle) * r;
        posSaturn[i3+1] = (Math.random() - 0.5) * 0.1;
        posSaturn[i3+2] = Math.sin(angle) * r;
    }

    // 4. Firework (Explosion vectors)
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const dist = 2.0 + Math.random() * 4.0;
    posFirework[i3] = Math.sin(phi) * Math.cos(theta) * dist;
    posFirework[i3+1] = Math.sin(phi) * Math.sin(theta) * dist;
    posFirework[i3+2] = Math.cos(phi) * dist;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(posBase, 3));
geometry.setAttribute('targetHeart', new THREE.BufferAttribute(posHeart, 3));
geometry.setAttribute('targetSaturn', new THREE.BufferAttribute(posSaturn, 3));
geometry.setAttribute('targetFire', new THREE.BufferAttribute(posFirework, 3));

// --- SHADER WITH ANIMATION ---
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uPulse: { value: 1.0 },
        uColor: { value: new THREE.Color(0x00ffcc) }
    },
    vertexShader: `
        uniform float uTime;
        uniform float uMorph;
        uniform float uPulse;
        attribute vec3 targetHeart;
        attribute vec3 targetSaturn;
        attribute vec3 targetFire;
        varying float vDistance;

        void main() {
            vec3 target;
            // Smoothly lerp between 4 states
            if(uMorph < 1.0) target = mix(position, targetHeart, uMorph);
            else if(uMorph < 2.0) target = mix(targetHeart, targetSaturn, uMorph - 1.0);
            else target = mix(targetSaturn, targetFire, uMorph - 2.0);

            // Add Pulsing effect
            target *= uPulse;
            
            // Add subtle wave animation
            target.y += sin(uTime + target.x) * 0.1;

            vec4 mvPosition = modelViewMatrix * vec4(target, 1.0);
            gl_PointSize = (4.0 * uPulse) * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
            vDistance = length(target);
        }
    `,
    fragmentShader: `
        uniform vec3 uColor;
        varying float vDistance;
        void main() {
            float strength = distance(gl_PointCoord, vec2(0.5));
            if (strength > 0.5) discard;
            // Glow effect
            float glow = 0.5 / (strength + 0.1);
            gl_FragColor = vec4(uColor * glow, 1.0);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// --- HAND TRACKING & CAMERA ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        const lm = results.multiHandLandmarks[0];
        
        // Morph based on hand Horizontal position (X)
        material.uniforms.uMorph.value = lm[9].x * 3.0; 

        // Pulse based on hand Vertical position (Y)
        material.uniforms.uPulse.value = 0.5 + (1.0 - lm[9].y) * 1.5;

        // Color based on distance between Thumb(4) and Pinky(20)
        const d = Math.hypot(lm[4].x - lm[20].x, lm[4].y - lm[20].y);
        material.uniforms.uColor.value.setHSL(d * 1.5, 0.7, 0.5);
    }
});

const camElement = document.getElementById('webcam');
const cameraUtils = new Camera(camElement, {
    onFrame: async () => { await hands.send({image: camElement}); },
    width: 640, height: 480
});
cameraUtils.start();

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    material.uniforms.uTime.value += 0.02;
    points.rotation.y += 0.003;
    renderer.render(scene, camera);
}
animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});