import * as THREE from 'three';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/OutputPass.js';

const PARTICLE_COUNT = 35000; 
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false }); // Better performance for Bloom
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);

camera.position.z = 10;

// --- GEOMETRY DATA GENERATION ---
const posBase = new Float32Array(PARTICLE_COUNT * 3);
const posHeart = new Float32Array(PARTICLE_COUNT * 3);
const posFlower = new Float32Array(PARTICLE_COUNT * 3);
const posFlag = new Float32Array(PARTICLE_COUNT * 3);
const posSaturn = new Float32Array(PARTICLE_COUNT * 3);
const posFirework = new Float32Array(PARTICLE_COUNT * 3);
const particleType = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    // Base Cloud
    posBase[i3] = (Math.random() - 0.5) * 12;
    posBase[i3+1] = (Math.random() - 0.5) * 12;
    posBase[i3+2] = (Math.random() - 0.5) * 12;

    // Heart
    const t = Math.random() * Math.PI * 2;
    posHeart[i3] = (16 * Math.pow(Math.sin(t), 3)) * 0.3;
    posHeart[i3+1] = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 0.25;

    // Flower
    const angle = Math.random() * Math.PI * 2;
    const fr = 3.5 * Math.cos(5 * angle);
    posFlower[i3] = Math.cos(angle) * fr;
    posFlower[i3+1] = Math.sin(angle) * fr;

    // Flag
    const fx = (Math.random() - 0.5) * 9, fy = (Math.random() - 0.5) * 6;
    posFlag[i3] = fx; posFlag[i3+1] = fy;
    const dO = Math.sqrt(Math.pow(fx - 1.2, 2) + Math.pow(fy, 2));
    const dI = Math.sqrt(Math.pow(fx - 1.6, 2) + Math.pow(fy, 2));
    if (Math.sqrt(Math.pow(fx-2.2, 2) + Math.pow(fy-1, 2)) < 0.2 || (dO < 1.4 && dI > 1.2)) particleType[i] = 2;
    else if (fx < -2.25) particleType[i] = 1; else particleType[i] = 0;

    // Saturn
    if (i < PARTICLE_COUNT * 0.6) {
        const phi = Math.acos(-1 + (2 * i) / (PARTICLE_COUNT * 0.6));
        const theta = Math.sqrt(PARTICLE_COUNT * 0.6 * Math.PI) * phi;
        posSaturn[i3] = Math.cos(theta) * Math.sin(phi) * 2;
        posSaturn[i3+1] = Math.sin(theta) * Math.sin(phi) * 2;
        posSaturn[i3+2] = Math.cos(phi) * 2;
    } else {
        const rAngle = Math.random() * Math.PI * 2, rDist = 2.8 + Math.random() * 1.5;
        posSaturn[i3] = Math.cos(rAngle) * rDist; posSaturn[i3+1] = (Math.random()-0.5)*0.1; posSaturn[i3+2] = Math.sin(rAngle) * rDist;
    }

    // Firework
    const fT = Math.random() * Math.PI * 2, fP = Math.acos((Math.random() * 2) - 1), fS = 6 + Math.random() * 8;
    posFirework[i3] = Math.sin(fP)*Math.cos(fT)*fS; posFirework[i3+1] = Math.sin(fP)*Math.sin(fT)*fS; posFirework[i3+2] = Math.cos(fP)*fS;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(posBase, 3));
geometry.setAttribute('targetHeart', new THREE.BufferAttribute(posHeart, 3));
geometry.setAttribute('targetFlower', new THREE.BufferAttribute(posFlower, 3));
geometry.setAttribute('targetFlag', new THREE.BufferAttribute(posFlag, 3));
geometry.setAttribute('targetSaturn', new THREE.BufferAttribute(posSaturn, 3));
geometry.setAttribute('targetFire', new THREE.BufferAttribute(posFirework, 3));
geometry.setAttribute('aType', new THREE.BufferAttribute(particleType, 1));

const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMorph: { value: 0 }, uPulse: { value: 1 }, uFirework: { value: 0 } },
    vertexShader: `
        uniform float uTime, uMorph, uPulse, uFirework;
        attribute vec3 targetHeart, targetFlower, targetFlag, targetSaturn, targetFire;
        attribute float aType;
        varying float vType;
        varying vec3 vPos;
        void main() {
            vec3 target;
            if(uMorph < 1.0) target = mix(position, targetHeart, uMorph);
            else if(uMorph < 2.0) target = mix(targetHeart, targetFlower, uMorph - 1.0);
            else if(uMorph < 3.0) target = mix(targetFlower, targetFlag, uMorph - 2.0);
            else target = mix(targetFlag, targetSaturn, clamp(uMorph - 3.0, 0.0, 1.0));
            target = mix(target, targetFire, uFirework);
            vType = aType; vPos = target;
            if(uMorph > 2.5 && uFirework < 0.1) target.z += sin(target.x * 0.8 + uTime * 4.0) * 0.2;
            vec4 mvPos = modelViewMatrix * vec4(target * uPulse, 1.0);
            gl_PointSize = ((aType == 2.0 ? 10.0 : 6.0) + uFirework * 12.0) * (1.5 / -mvPos.z);
            gl_Position = projectionMatrix * mvPos;
        }
    `,
    fragmentShader: `
        varying float vType; varying vec3 vPos; uniform float uFirework, uTime, uMorph;
        void main() {
            float r = distance(gl_PointCoord, vec2(0.5)); if (r > 0.5) discard;
            float glow = pow(1.0 - r*2.0, 2.0);
            vec3 color;
            if(uMorph > 3.5) color = mix(vec3(0.8, 0.6, 0.3), vec3(0.6, 0.8, 1.0), length(vPos.xz) > 2.2 ? 1.0 : 0.0);
            else if(vType >= 1.0) color = vec3(1.2, 1.2, 1.5);
            else if(uMorph > 2.5) color = vec3(0.01, 0.6, 0.2);
            else color = 0.5 + 0.5*cos(uTime + length(vPos)*0.5 + vec3(0,2,4));
            if(uFirework > 0.1) color = 0.5 + 0.5*sin(uTime*15.0 + vec3(0,2,4));
            gl_FragColor = vec4(color * glow * 1.8, glow);
        }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// --- POST PROCESSING ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.1);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// --- INPUT & GESTURES ---
let tMorph = 0, tFire = 0;
window.addEventListener('keydown', (e) => { 
    if(e.key >= '1' && e.key <= '5') tMorph = parseInt(e.key) - 1; 
    if(e.key === ' ') tFire = 1; 
});
window.addEventListener('keyup', (e) => { if(e.key === ' ') tFire = 0; });

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });
hands.onResults((res) => {
    if (res.multiHandLandmarks && res.multiHandLandmarks[0]) {
        const lm = res.multiHandLandmarks[0];
        tMorph = lm[9].x * 4.5;
        material.uniforms.uPulse.value = 0.8 + (1.0 - lm[9].y) * 1.5;
        tFire = Math.hypot(lm[8].x - lm[0].x, lm[8].y - lm[0].y) < 0.15 ? 1 : 0;
    }
});
const cam = new Camera(document.getElementById('webcam'), { onFrame: async () => { await hands.send({image: document.getElementById('webcam')}); }, width: 640, height: 480 });
cam.start();

function animate() {
    requestAnimationFrame(animate);
    material.uniforms.uTime.value += 0.02;
    material.uniforms.uMorph.value = THREE.MathUtils.lerp(material.uniforms.uMorph.value, tMorph, 0.08);
    material.uniforms.uFirework.value = THREE.MathUtils.lerp(material.uniforms.uFirework.value, tFire, 0.2);
    points.rotation.y += 0.005;
    if(tMorph > 3.5) points.rotation.x = THREE.MathUtils.lerp(points.rotation.x, 0.5, 0.05);
    else points.rotation.x = THREE.MathUtils.lerp(points.rotation.x, 0, 0.1);
    composer.render();
}
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); });