import * as THREE from 'three';

const PARTICLE_COUNT = 30000; // Increased for a sharper flag
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 8;

// --- GEOMETRY DATA GENERATION ---
const posBase = new Float32Array(PARTICLE_COUNT * 3);
const posHeart = new Float32Array(PARTICLE_COUNT * 3);
const posFlower = new Float32Array(PARTICLE_COUNT * 3);
const posFlag = new Float32Array(PARTICLE_COUNT * 3);
const particleType = new Float32Array(PARTICLE_COUNT); // 0=Green, 1=WhiteStripe, 2=Crescent/Star

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    // 1. Cloud (Base)
    posBase[i3] = (Math.random() - 0.5) * 12;
    posBase[i3+1] = (Math.random() - 0.5) * 12;
    posBase[i3+2] = (Math.random() - 0.5) * 12;

    // 2. Heart (Accurate Equation)
    const t = Math.random() * Math.PI * 2;
    posHeart[i3] = 2.5 * (16 * Math.pow(Math.sin(t), 3)) * 0.1;
    posHeart[i3+1] = 2.5 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 0.1;
    posHeart[i3+2] = (Math.random() - 0.5) * 0.5;

    // 3. Flower (Rhodonea)
    const angle = Math.random() * Math.PI * 2;
    const r = 3.0 * Math.cos(5 * angle);
    posFlower[i3] = Math.cos(angle) * r;
    posFlower[i3+1] = Math.sin(angle) * r;
    posFlower[i3+2] = (Math.random() - 0.5) * 0.2;

    // 4. ACCURATE PAKISTANI FLAG GEOMETRY
    const x = (Math.random() - 0.5) * 8; // Flag Width
    const y = (Math.random() - 0.5) * 5.33; // Flag Height (3:2 ratio)
    
    posFlag[i3] = x;
    posFlag[i3+1] = y;
    posFlag[i3+2] = 0;

    // Accurate Crescent Math: Outer circle offset from Inner circle
    const distOuter = Math.sqrt(Math.pow(x - 0.8, 2) + Math.pow(y - 0, 2));
    const distInner = Math.sqrt(Math.pow(x - 1.25, 2) + Math.pow(y - 0, 2));
    
    // Accurate Star Math (5 points)
    const starX = 1.6, starY = 0.8;
    const dx = x - starX, dy = y - starY;
    const starDist = Math.sqrt(dx*dx + dy*dy);
    const starAngle = Math.atan2(dy, dx);
    const starShape = 0.25 * (Math.cos(5 * starAngle) * 0.5 + 0.5);

    if (starDist < starShape + 0.1 || (distOuter < 1.3 && distInner > 1.1)) {
        particleType[i] = 2.0; // White Crescent/Star
    } else if (x < -2.0) {
        particleType[i] = 1.0; // White Stripe
    } else {
        particleType[i] = 0.0; // Pakistan Green Field
    }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(posBase, 3));
geometry.setAttribute('targetHeart', new THREE.BufferAttribute(posHeart, 3));
geometry.setAttribute('targetFlower', new THREE.BufferAttribute(posFlower, 3));
geometry.setAttribute('targetFlag', new THREE.BufferAttribute(posFlag, 3));
geometry.setAttribute('aType', new THREE.BufferAttribute(particleType, 1));

// --- ENHANCED FLAG SHADER ---
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uPulse: { value: 1.0 },
        uBaseColor: { value: new THREE.Color(0x00ffcc) }
    },
    vertexShader: `
        uniform float uTime;
        uniform float uMorph;
        uniform float uPulse;
        attribute vec3 targetHeart;
        attribute vec3 targetFlower;
        attribute vec3 targetFlag;
        attribute float aType;
        varying float vType;

        void main() {
            vec3 target;
            if(uMorph < 1.0) target = mix(position, targetHeart, uMorph);
            else if(uMorph < 2.0) target = mix(targetHeart, targetFlower, uMorph - 1.0);
            else target = mix(targetFlower, targetFlag, clamp(uMorph - 2.0, 0.0, 1.0));

            vType = aType;
            
            // Flag waving physics
            if(uMorph > 2.5) {
                target.z += sin(target.x * 0.5 + uTime * 3.0) * 0.3;
                target.y += cos(target.x * 0.3 + uTime * 2.0) * 0.1;
            }

            vec4 mvPosition = modelViewMatrix * vec4(target * uPulse, 1.0);
            gl_PointSize = (5.0 * (aType + 1.0)) * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 uBaseColor;
        varying float vType;
        void main() {
            if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
            
            vec3 finalColor;
            if(vType > 0.5) { 
                finalColor = vec3(1.0, 1.0, 1.0); // Pure White for Stripe/Crescent/Star
            } else {
                finalColor = vec3(0.0039, 0.2549, 0.1098); // Official Pakistan Green #01411C
            }
            
            // Apply uBaseColor only when NOT in flag mode
            // We use a simple mix based on the vType here if needed, 
            // but for accuracy, we stick to the flag colors.
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// --- HAND TRACKING ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        const lm = results.multiHandLandmarks[0];
        // X-Axis: 0 to 3.5 Morphing range
        material.uniforms.uMorph.value = lm[9].x * 3.5; 
        // Y-Axis: Size/Pulse
        material.uniforms.uPulse.value = 0.7 + (1.0 - lm[9].y) * 1.3;
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
    
    // Auto-rotate only for shapes, not for the flag
    if(material.uniforms.uMorph.value < 2.2) {
        points.rotation.y += 0.005;
    } else {
        points.rotation.y *= 0.9; // Smooth stop
    }
    
    renderer.render(scene, camera);
}
animate();