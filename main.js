import * as THREE from 'three';

const PARTICLE_COUNT = 35000; 
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

camera.position.z = 8;

// --- GEOMETRY DATA ---
const posBase = new Float32Array(PARTICLE_COUNT * 3);
const posHeart = new Float32Array(PARTICLE_COUNT * 3);
const posFlower = new Float32Array(PARTICLE_COUNT * 3);
const posFlag = new Float32Array(PARTICLE_COUNT * 3);
const posFirework = new Float32Array(PARTICLE_COUNT * 3);
const particleType = new Float32Array(PARTICLE_COUNT); 

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    // 1. Cloud
    posBase[i3] = (Math.random() - 0.5) * 12;
    posBase[i3+1] = (Math.random() - 0.5) * 12;
    posBase[i3+2] = (Math.random() - 0.5) * 12;

    // 2. Heart
    const t = Math.random() * Math.PI * 2;
    posHeart[i3] = (16 * Math.pow(Math.sin(t), 3)) * 0.3;
    posHeart[i3+1] = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 0.25;

    // 3. Flower
    const angle = Math.random() * Math.PI * 2;
    const r = 3.5 * Math.cos(5 * angle);
    posFlower[i3] = Math.cos(angle) * r;
    posFlower[i3+1] = Math.sin(angle) * r;

    // 4. Flag (Accurate 3:2)
    const width = 9, height = 6;
    const x = (Math.random() - 0.5) * width;
    const y = (Math.random() - 0.5) * height;
    posFlag[i3] = x; posFlag[i3+1] = y;

    const crescentCenterX = 1.2; 
    const distOuter = Math.sqrt(Math.pow(x - crescentCenterX, 2) + Math.pow(y, 2));
    const distInner = Math.sqrt(Math.pow(x - (crescentCenterX + 0.4), 2) + Math.pow(y, 2));
    const starCenterX = 2.2, starCenterY = 1.0;
    const starDist = Math.sqrt(Math.pow(x-starCenterX, 2) + Math.pow(y-starCenterY, 2));
    const starAngle = Math.atan2(y-starCenterY, x-starCenterX);
    const starShape = 0.2 * (Math.cos(5 * starAngle) * 0.5 + 0.5) + 0.15;

    if (starDist < starShape || (distOuter < 1.4 && distInner > 1.2)) {
        particleType[i] = 2.0; // Crescent/Star
    } else if (x < -width/4) {
        particleType[i] = 1.0; // Stripe
    } else {
        particleType[i] = 0.0; // Green
    }

    // 5. Firework
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const speed = 6.0 + Math.random() * 8.0;
    posFirework[i3] = Math.sin(phi) * Math.cos(theta) * speed;
    posFirework[i3+1] = Math.sin(phi) * Math.sin(theta) * speed;
    posFirework[i3+2] = Math.cos(phi) * speed;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(posBase, 3));
geometry.setAttribute('targetHeart', new THREE.BufferAttribute(posHeart, 3));
geometry.setAttribute('targetFlower', new THREE.BufferAttribute(posFlower, 3));
geometry.setAttribute('targetFlag', new THREE.BufferAttribute(posFlag, 3));
geometry.setAttribute('targetFire', new THREE.BufferAttribute(posFirework, 3));
geometry.setAttribute('aType', new THREE.BufferAttribute(particleType, 1));

// --- VIBRANT GLOW SHADER ---
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uPulse: { value: 1.0 },
        uFirework: { value: 0.0 }
    },
    vertexShader: `
        uniform float uTime, uMorph, uPulse, uFirework;
        attribute vec3 targetHeart, targetFlower, targetFlag, targetFire;
        attribute float aType;
        varying float vType;
        varying float vDistance;

        void main() {
            vec3 target;
            if(uMorph < 1.0) target = mix(position, targetHeart, uMorph);
            else if(uMorph < 2.0) target = mix(targetHeart, targetFlower, uMorph - 1.0);
            else target = mix(targetFlower, targetFlag, clamp(uMorph - 2.0, 0.0, 1.0));

            target = mix(target, targetFire, uFirework);
            vType = aType;
            vDistance = length(target);

            if(uMorph > 2.5 && uFirework < 0.1) {
                target.z += sin(target.x * 1.2 + uTime * 5.0) * 0.15;
            }

            vec4 mvPosition = modelViewMatrix * vec4(target * uPulse, 1.0);
            float pSize = (aType == 2.0) ? 12.0 : 7.0; // Larger particles
            gl_PointSize = (pSize + uFirework * 15.0) * (1.5 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying float vType;
        varying float vDistance;
        uniform float uFirework, uTime, uMorph;

        void main() {
            float r = distance(gl_PointCoord, vec2(0.5));
            if (r > 0.5) discard;
            
            // Bloom Effect: Brighter center
            float glow = pow(1.0 - r*2.0, 2.0);
            
            vec3 color;
            if(vType >= 1.0) {
                color = vec3(1.2, 1.2, 1.5); // Bright White-Blue Neon
            } else if (uMorph > 2.5) {
                color = vec3(0.01, 0.6, 0.2); // Vibrant Neon Pakistan Green
            } else {
                // Vibrant Cycling Colors for Heart/Flower
                color = 0.5 + 0.5*cos(uTime + vDistance*0.5 + vec3(0,2,4));
            }
            
            if(uFirework > 0.1) {
                color = 0.5 + 0.5*sin(uTime*15.0 + vDistance + vec3(0,2,4));
                color *= 2.0; // Over-brighten fireworks
            }
            
            float finalBrightness = (vType == 2.0) ? 2.5 : 1.5;
            gl_FragColor = vec4(color * glow * finalBrightness, glow);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// --- LOGIC & TRACKING ---
let targetMorph = 0, targetFirework = 0;

window.addEventListener('keydown', (e) => {
    if(e.key === '1') targetMorph = 0;
    if(e.key === '2') targetMorph = 1;
    if(e.key === '3') targetMorph = 2;
    if(e.key === '4') targetMorph = 3;
    if(e.key === ' ') targetFirework = 1;
});
window.addEventListener('keyup', (e) => { if(e.key === ' ') targetFirework = 0; });

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        const lm = results.multiHandLandmarks[0];
        targetMorph = lm[9].x * 3.5; 
        material.uniforms.uPulse.value = 0.8 + (1.0 - lm[9].y) * 1.5;

        const d = (p1, p2) => Math.hypot(p1.x-p2.x, p1.y-p2.y);
        const palmDist = (d(lm[8], lm[0]) + d(lm[12], lm[0]) + d(lm[16], lm[0]) + d(lm[20], lm[0])) / 4;
        targetFirework = (palmDist < 0.15) ? 1.0 : 0.0;
    }
});

const camElement = document.getElementById('webcam');
const cameraUtils = new Camera(camElement, {
    onFrame: async () => { await hands.send({image: camElement}); },
    width: 640, height: 480
});
cameraUtils.start();

function animate() {
    requestAnimationFrame(animate);
    material.uniforms.uTime.value += 0.02;
    material.uniforms.uMorph.value = THREE.MathUtils.lerp(material.uniforms.uMorph.value, targetMorph, 0.08);
    material.uniforms.uFirework.value = THREE.MathUtils.lerp(material.uniforms.uFirework.value, targetFirework, 0.2);
    
    if(material.uniforms.uMorph.value < 2.2) points.rotation.y += 0.007;
    renderer.render(scene, camera);
}
animate();