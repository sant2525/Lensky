/**
 * Lensky Premium 3D VR Spectacles Try-On Studio Engine
 * Handles multiple Three.js scenes, procedural 3D model building, WebRTC camera streams,
 * and high-fidelity interactive physical material updates.
 */

// Core Application State
const arState = {
    activeStyle: 'aviator',
    frameColor: '#d4af37', // Polished Gold
    frameMaterialType: 'metal', // metal, acetate
    lensColor: '#4ea8de', // Ocean Blue
    lensOpacity: 0.85,
    lensIor: 1.52, // Index of refraction
    
    // Calibration parameters
    scale: 1.0,
    posY: 0.0,
    posZ: 0.0,
    rotX: 0.0,
    
    // Camera state
    cameraActive: false,
    cameraStream: null,
    activePortrait: 'model1',
    guidesEnabled: true
};

// UI Elements caching
const ui = {
    modal: document.getElementById('tryon-modal'),
    modalTitle: document.getElementById('modal-spectacles-title'),
    modalPrice: document.getElementById('modal-price'),
    webcam: document.getElementById('webcam-feed'),
    arCanvas: document.getElementById('ar-canvas'),
    portraitSelector: document.getElementById('portrait-selector'),
    toast: document.getElementById('toast-notification'),
    trackingStatus: document.getElementById('tracking-status'),
    calibrationGuide: document.getElementById('calibration-guide'),
    selectedFrameLabel: document.getElementById('selected-frame-label'),
    selectedLensLabel: document.getElementById('selected-lens-label'),
    iorValue: document.getElementById('ior-value'),
    opacityValue: document.getElementById('opacity-value'),
    cameraBtn: document.getElementById('camera-toggle-btn'),
    guideBtn: document.getElementById('guide-toggle-btn'),
    
    // Calibration inputs
    calScale: document.getElementById('cal-scale'),
    calPosy: document.getElementById('cal-posy'),
    calPosz: document.getElementById('cal-posz'),
    calRotx: document.getElementById('cal-rotx'),
    
    // Calibration labels
    valScale: document.getElementById('scale-value'),
    valPosy: document.getElementById('posy-value'),
    valPosz: document.getElementById('posz-value'),
    valRotx: document.getElementById('rotx-value'),
    
    // Sliders
    sliderIor: document.getElementById('slider-ior'),
    sliderOpacity: document.getElementById('slider-opacity')
};

// Three.js Instances
let heroScene, heroCamera, heroRenderer, heroGlasses;
let arScene, arCamera, arRenderer, arGlasses, arPortraitMesh, arPortraitTexture;
const catalogInstances = {};

// Materials Configurations
const getMaterials = (frameCol, lensCol, opacityVal, iorVal) => {
    // Premium Metallic Frame Material
    const frameMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(frameCol),
        metalness: arState.frameMaterialType === 'metal' ? 0.95 : 0.1,
        roughness: arState.frameMaterialType === 'metal' ? 0.12 : 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        reflectivity: 1.0
    });

    // Glass Lenses with Physical Refraction Shading
    const lensMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(lensCol),
        transparent: true,
        opacity: opacityVal,
        roughness: 0.0,
        metalness: 0.1,
        transmission: 0.95, // High refraction transparency
        thickness: 0.5,     // Glass thickness
        ior: iorVal,        // Index of Refraction
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        side: THREE.DoubleSide
    });

    // Secondary detail frames (screws, nose pads)
    const goldAccents = new THREE.MeshStandardMaterial({
        color: 0xe5c158,
        metalness: 0.9,
        roughness: 0.2
    });

    return { frameMaterial, lensMaterial, goldAccents };
};

// Procedural 3D Spectacles Generator
function buildSpectacles(style, frameColor, lensColor, opacity, ior) {
    const glassesGroup = new THREE.Group();
    const mats = getMaterials(frameColor, lensColor, opacity, ior);
    
    // Core structural dimensions depending on style
    let rimRadius = 0.65;
    let rimTube = 0.045;
    let bridgeWidth = 0.45;
    let templeLength = 2.1;
    let shapeSegments = 32;
    let squishX = 1.0;
    let squishY = 1.0;
    
    // Configure design layouts procedurally
    switch(style) {
        case 'wayfarer':
            rimRadius = 0.6;
            rimTube = 0.08;
            bridgeWidth = 0.35;
            shapeSegments = 4; // Geometric square-like
            squishX = 1.25;
            squishY = 0.95;
            arState.frameMaterialType = 'acetate';
            break;
            
        case 'round':
            rimRadius = 0.58;
            rimTube = 0.03;
            bridgeWidth = 0.48;
            shapeSegments = 64; // High fidelity perfect circles
            arState.frameMaterialType = 'metal';
            break;
            
        case 'cateye':
            rimRadius = 0.6;
            rimTube = 0.06;
            bridgeWidth = 0.4;
            shapeSegments = 8;
            squishX = 1.3;
            squishY = 0.85;
            arState.frameMaterialType = 'acetate';
            break;
            
        case 'aviator':
        default:
            rimRadius = 0.68;
            rimTube = 0.025;
            bridgeWidth = 0.44;
            shapeSegments = 32;
            squishX = 1.15;
            squishY = 1.1;
            arState.frameMaterialType = 'metal';
            break;
    }
    
    // Re-obtain materials post category update (metalness toggling)
    const materials = getMaterials(frameColor, lensColor, opacity, ior);

    // Left Rim frame
    const rimGeom = new THREE.TorusGeometry(rimRadius, rimTube, 8, shapeSegments);
    const leftRim = new THREE.Mesh(rimGeom, materials.frameMaterial);
    leftRim.position.x = -(rimRadius * squishX + bridgeWidth / 2);
    leftRim.scale.set(squishX, squishY, 1.0);
    if(style === 'cateye') {
        leftRim.rotation.z = Math.PI / 10; // Angle the wings up
    } else if(style === 'wayfarer') {
        leftRim.rotation.z = Math.PI / 4; // Align rectangular diamond
    }
    glassesGroup.add(leftRim);

    // Right Rim frame
    const rightRim = leftRim.clone();
    rightRim.position.x = (rimRadius * squishX + bridgeWidth / 2);
    if(style === 'cateye') {
        rightRim.rotation.z = -Math.PI / 10;
    } else if(style === 'wayfarer') {
        rightRim.rotation.z = -Math.PI / 4;
    }
    glassesGroup.add(rightRim);

    // Lenses
    let lensGeom;
    if(style === 'wayfarer') {
        // Square-ish shape
        lensGeom = new THREE.CylinderGeometry(rimRadius * 0.9, rimRadius * 0.9, 0.04, 4);
    } else if(style === 'cateye') {
        lensGeom = new THREE.CylinderGeometry(rimRadius * 0.85, rimRadius * 0.85, 0.04, 8);
    } else {
        lensGeom = new THREE.CylinderGeometry(rimRadius * 0.96, rimRadius * 0.96, 0.02, 32);
    }
    
    // Left Lens
    const leftLens = new THREE.Mesh(lensGeom, materials.lensMaterial);
    leftLens.rotation.x = Math.PI / 2;
    leftLens.position.copy(leftRim.position);
    leftLens.scale.set(squishX * 0.95, 1.0, squishY * 0.95);
    if(style === 'cateye') {
        leftLens.rotation.y = Math.PI / 10;
    } else if(style === 'wayfarer') {
        leftLens.rotation.y = Math.PI / 4;
    }
    glassesGroup.add(leftLens);

    // Right Lens
    const rightLens = leftLens.clone();
    rightLens.position.copy(rightRim.position);
    if(style === 'cateye') {
        rightLens.rotation.y = -Math.PI / 10;
    } else if(style === 'wayfarer') {
        rightLens.rotation.y = -Math.PI / 4;
    }
    glassesGroup.add(rightLens);

    // Double Nose Bridge
    const bridgeGeom = new THREE.CylinderGeometry(0.022, 0.022, bridgeWidth * 1.1, 8);
    const mainBridge = new THREE.Mesh(bridgeGeom, materials.frameMaterial);
    mainBridge.rotation.z = Math.PI / 2;
    mainBridge.position.x = 0;
    mainBridge.position.y = 0.1;
    glassesGroup.add(mainBridge);
    
    // Aviator double-bar bridge
    if (style === 'aviator') {
        const topBridge = mainBridge.clone();
        topBridge.position.y = 0.32;
        glassesGroup.add(topBridge);
    }

    // Left Temple Arm (goes straight back)
    const templeGeom = new THREE.CylinderGeometry(0.02, 0.015, templeLength, 8);
    const leftTemple = new THREE.Mesh(templeGeom, materials.frameMaterial);
    leftTemple.rotation.x = Math.PI / 2;
    leftTemple.position.x = -(rimRadius * squishX * 2 + bridgeWidth / 2) + 0.05;
    leftTemple.position.y = 0.15;
    leftTemple.position.z = -(templeLength / 2);
    
    // Curved ear-hook end
    const hookGeom = new THREE.TorusGeometry(0.18, 0.02, 8, 16, Math.PI / 2);
    const leftHook = new THREE.Mesh(hookGeom, materials.frameMaterial);
    leftHook.position.set(0, -(templeLength / 2), -0.06);
    leftHook.rotation.x = Math.PI;
    leftTemple.add(leftHook);
    
    glassesGroup.add(leftTemple);

    // Right Temple Arm
    const rightTemple = leftTemple.clone();
    rightTemple.position.x = (rimRadius * squishX * 2 + bridgeWidth / 2) - 0.05;
    glassesGroup.add(rightTemple);

    // Minor Accent Details (Nose Pads)
    const padGeom = new THREE.SphereGeometry(0.06, 8, 8);
    const leftPad = new THREE.Mesh(padGeom, materials.goldAccents);
    leftPad.scale.set(0.5, 1.2, 0.8);
    leftPad.position.set(-0.24, -0.22, -0.08);
    glassesGroup.add(leftPad);

    const rightPad = leftPad.clone();
    rightPad.position.x = 0.24;
    glassesGroup.add(rightPad);

    // Group offset scaling
    glassesGroup.scale.set(0.9, 0.9, 0.9);
    
    return glassesGroup;
}

// ---------------- HERO CANVAS SETUP ----------------
function initHeroCanvas() {
    const container = document.getElementById('hero-3d-container');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    heroScene = new THREE.Scene();
    
    // Camera
    heroCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    heroCamera.position.z = 4.2;

    // Renderer
    heroRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    heroRenderer.setSize(width, height);
    heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(heroRenderer.domElement);

    // Premium lighting environment
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    heroScene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(2, 4, 5);
    heroScene.add(mainLight);

    const purpleGlow = new THREE.PointLight(0x7f00ff, 1.2, 10);
    purpleGlow.position.set(-2, -1, 2);
    heroScene.add(purpleGlow);

    const goldGlow = new THREE.PointLight(0xd4af37, 1.5, 10);
    goldGlow.position.set(2, 2, 2);
    heroScene.add(goldGlow);

    // Add spectacles model
    heroGlasses = buildSpectacles('aviator', '#d4af37', '#4ea8de', 0.85, 1.52);
    heroScene.add(heroGlasses);

    // Interactive mouse rotation tracking variables
    let targetRotY = 0;
    let targetRotX = 0;
    let currentRotY = 0;
    let currentRotX = 0;

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / width - 0.5;
        const y = (e.clientY - rect.top) / height - 0.5;
        
        targetRotY = x * 1.8;
        targetRotX = y * 0.8;
    });

    container.addEventListener('mouseleave', () => {
        targetRotY = 0;
        targetRotX = 0;
    });

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);

        // Constant floating effect
        const time = Date.now() * 0.0015;
        heroGlasses.position.y = Math.sin(time) * 0.06;

        // Smooth cursor lag tracking
        currentRotY += (targetRotY - currentRotY) * 0.1;
        currentRotX += (targetRotX - currentRotX) * 0.1;

        heroGlasses.rotation.y = currentRotY + (Math.sin(time * 0.3) * 0.15); // gentle idle swing
        heroGlasses.rotation.x = currentRotX;

        heroRenderer.render(heroScene, heroCamera);
    }
    animate();

    // Resize listener
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        heroCamera.aspect = w / h;
        heroCamera.updateProjectionMatrix();
        heroRenderer.setSize(w, h);
    });
}

// ---------------- PRODUCT CATALOG CARDS SETUP ----------------
function initCatalogScene(cardId, style, frameCol, lensCol) {
    const container = document.getElementById(`render-${cardId}`);
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 10);
    camera.position.z = 2.6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Basic Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(1, 3, 2);
    scene.add(directional);

    // Procedural model creation
    const glasses = buildSpectacles(style, frameCol, lensCol, 0.85, 1.52);
    glasses.scale.set(0.72, 0.72, 0.72); // slightly smaller for card grid
    scene.add(glasses);

    let isHovering = false;
    container.parentElement.addEventListener('mouseenter', () => { isHovering = true; });
    container.parentElement.addEventListener('mouseleave', () => { isHovering = false; });

    function animate() {
        requestAnimationFrame(animate);
        
        const time = Date.now() * 0.001;
        
        // Spin glasses on hover, otherwise float gently
        if (isHovering) {
            glasses.rotation.y += 0.02;
            glasses.rotation.x = Math.sin(time * 2) * 0.08;
        } else {
            glasses.rotation.y = Math.sin(time * 0.5) * 0.2;
            glasses.rotation.x = Math.cos(time * 0.5) * 0.06;
        }

        renderer.render(scene, camera);
    }
    animate();

    catalogInstances[cardId] = { scene, camera, renderer, glasses };
}

// Initialize all static components
document.addEventListener('DOMContentLoaded', () => {
    initHeroCanvas();
    
    // Load catalog scenes with customized setups
    initCatalogScene('aviator', 'aviator', '#d4af37', '#4ea8de');
    initCatalogScene('wayfarer', 'wayfarer', '#111111', '#111111');
    initCatalogScene('round', 'round', '#b76e79', '#f77f00');
    initCatalogScene('cateye', 'cateye', '#9b5de5', '#a5a5a5');

    // Attach event listeners for web camera & photo studio triggers
    setupCameraControls();
    setupThemeToggle();
});

// ---------------- AR TRY-ON STUDIO MODAL CORE ----------------

// Static portrait models details (Unsplash luxury headshots)
const faceModels = {
    model1: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=720', // Elena
    model2: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=720', // Lucas
    model3: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=720'  // Marcus
};

function openTryOnModal(event, style) {
    if(event) event.preventDefault();
    
    arState.activeStyle = style;
    ui.modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // stop background scroll

    // Select the active style card in modal UI
    document.querySelectorAll('.style-card').forEach(card => {
        card.classList.remove('active');
        if(card.getAttribute('data-style') === style) {
            card.classList.add('active');
        }
    });

    // Match config values to style
    let defaultFrameName = 'Polished Gold';
    let defaultLensName = 'Ocean Blue Refractive';
    let defaultPrice = '$289.00';
    let defaultColor = '#d4af37';
    let defaultLensColor = '#4ea8de';

    if (style === 'wayfarer') {
        defaultFrameName = 'Obsidian Black';
        defaultLensName = 'Dark Tint Sunglasses';
        defaultPrice = '$245.00';
        defaultColor = '#111111';
        defaultLensColor = '#111111';
    } else if(style === 'round') {
        defaultFrameName = 'Rose Gold';
        defaultLensName = 'Sunset Amber';
        defaultPrice = '$210.00';
        defaultColor = '#b76e79';
        defaultLensColor = '#f77f00';
    } else if(style === 'cateye') {
        defaultFrameName = 'Obsidian Black';
        defaultLensName = 'Clear Blue Light Filter';
        defaultPrice = '$265.00';
        defaultColor = '#111111';
        defaultLensColor = '#a5a5a5';
    }

    // Set UI labels
    arState.frameColor = defaultColor;
    arState.lensColor = defaultLensColor;
    ui.modalTitle.innerText = `${style.charAt(0).toUpperCase() + style.slice(1)} Try-On Studio`;
    ui.modalPrice.innerText = defaultPrice;
    ui.selectedFrameLabel.innerText = defaultFrameName;
    ui.selectedLensLabel.innerText = defaultLensName;

    // Highlight proper material color swatches in modal config panel
    document.querySelectorAll('#frame-color-row .color-swatch').forEach(sw => {
        sw.classList.remove('active');
        if(sw.getAttribute('data-color') === defaultColor) sw.classList.add('active');
    });
    
    document.querySelectorAll('#lens-color-row .color-swatch').forEach(sw => {
        sw.classList.remove('active');
        if(sw.getAttribute('data-lens-color') === defaultLensColor) sw.classList.add('active');
    });

    // Reset calibration sliders to base defaults
    resetCalibration();

    // Trigger AR Canvas Initialization
    setTimeout(() => {
        initArStudio();
    }, 150);
}

function closeTryOnModal() {
    ui.modal.classList.remove('active');
    document.body.style.overflow = ''; // restore scroll
    
    // Terminate webcam feed to free hardware access
    stopCameraStream();
}

// ---------------- AR THREE.JS ENGINE ----------------
function initArStudio() {
    const width = ui.arCanvas.parentElement.clientWidth;
    const height = ui.arCanvas.parentElement.clientHeight;

    // Avoid duplicate initialization
    if (arRenderer) {
        arRenderer.setSize(width, height);
        arCamera.aspect = width / height;
        arCamera.updateProjectionMatrix();
        updateArSpectacles();
        return;
    }

    arScene = new THREE.Scene();
    
    // Orthographic flat lighting with perspective projections
    arCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    arCamera.position.z = 5;

    arRenderer = new THREE.WebGLRenderer({
        canvas: ui.arCanvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true // Required for camera screenshots
    });
    arRenderer.setSize(width, height);
    arRenderer.setPixelRatio(window.devicePixelRatio);

    // Realistic Lighting setup
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    arScene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(0, 4, 6);
    arScene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.35, 10);
    pointLight.position.set(-2, 1, 3);
    arScene.add(pointLight);

    // Initial Glasses Render
    updateArSpectacles();

    // Setup background portrait texture scene mapping (when camera is offline)
    setupPortraitBackgroundMesh();

    // Responsive Canvas drag mapping & holographic head tilt tracker
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    ui.arCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Holographic Parallax tracking effect (Face alignment tracker)
    let arRotY = 0;
    let arRotX = 0;
    
    ui.arCanvas.addEventListener('mousemove', (e) => {
        const rect = ui.arCanvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / width - 0.5;
        const mouseY = (e.clientY - rect.top) / height - 0.5;

        if (isDragging) {
            // Drag adjustments offset calibration values
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            
            arState.posY += deltaY * -0.01;
            // Update inputs
            ui.calPosy.value = arState.posY * 50; // Map back to scale range
            ui.valPosy.innerText = `${(arState.posY * 50).toFixed(0)}px`;
            
            previousMousePosition = { x: e.clientX, y: e.clientY };
        } else {
            // holographic visual head tilt rotation simulation!
            arRotY = mouseX * 0.45;
            arRotX = mouseY * 0.25;
        }
    });

    // Studio Canvas Animation rendering Loop
    function renderStudio() {
        requestAnimationFrame(renderStudio);

        if (arGlasses) {
            // Adjust coordinates based on webcam vs portrait setup
            const basePosY = arState.cameraActive ? 0.05 : 0.45; // Face coordinates align differently
            const basePosZ = arState.cameraActive ? 1.2 : -1.1;  // Align glasses flush on the 3D portrait depth plane
            const baseScale = arState.cameraActive ? 1.05 : 1.45; // Compensate for depth perspective scaling
            
            // Apply Calibration variables combined with dynamic interactive rotations
            arGlasses.scale.set(arState.scale * baseScale, arState.scale * baseScale, arState.scale * baseScale);
            
            arGlasses.position.y = basePosY + arState.posY;
            arGlasses.position.z = basePosZ + arState.posZ;
            
            // Smoothly lerp towards target mouse rotation matrix for parallax
            arGlasses.rotation.y += (arRotY - arGlasses.rotation.y) * 0.12;
            arGlasses.rotation.x += ((arRotX + arState.rotX) - arGlasses.rotation.x) * 0.12;
        }

        arRenderer.render(arScene, arCamera);
    }
    renderStudio();

    // Resize support inside modal
    window.addEventListener('resize', () => {
        if (!ui.modal.classList.contains('active')) return;
        const w = ui.arCanvas.parentElement.clientWidth;
        const h = ui.arCanvas.parentElement.clientHeight;
        arCamera.aspect = w / h;
        arCamera.updateProjectionMatrix();
        arRenderer.setSize(w, h);
    });
}

// Generates a gorgeous, high-tech holographic HUD face wireframe outline when offline or on CORS blocking origins
function createProceduralFaceTexture(modelKey) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 680;
    const ctx = canvas.getContext('2d');

    // Gradient Background
    const grad = ctx.createRadialGradient(256, 340, 50, 256, 340, 400);
    grad.addColorStop(0, '#16192d');
    grad.addColorStop(1, '#050608');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 680);

    // Draw grid lines for high-tech HUD styling
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 512; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 680);
        ctx.stroke();
    }
    for (let j = 0; j < 680; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(512, j);
        ctx.stroke();
    }

    // Stylized Face Outline (Aesthetic minimalist vector)
    ctx.strokeStyle = modelKey === 'model2' ? '#d4af37' : '#00f2fe';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 15;
    ctx.lineWidth = 3;
    
    // Draw stylized head silhouette
    ctx.beginPath();
    ctx.arc(256, 260, 110, 0, Math.PI * 2);
    ctx.stroke();

    // Jaw/chin shape
    ctx.beginPath();
    ctx.moveTo(146, 260);
    ctx.quadraticCurveTo(146, 420, 256, 460);
    ctx.quadraticCurveTo(366, 420, 366, 260);
    ctx.stroke();

    // Neck
    ctx.beginPath();
    ctx.moveTo(196, 430);
    ctx.lineTo(196, 520);
    ctx.moveTo(316, 430);
    ctx.lineTo(316, 520);
    ctx.stroke();

    // Draw stylized high-tech scanning indicators (eye nodes and nose bridge)
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    
    // Left eye node
    ctx.beginPath();
    ctx.arc(206, 250, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    
    // Right eye node
    ctx.beginPath();
    ctx.arc(306, 250, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    
    // Nose bridge node (Landmark 168 target)
    ctx.fillStyle = '#ff3b56';
    ctx.strokeStyle = '#ff3b56';
    ctx.shadowColor = '#ff3b56';
    ctx.beginPath();
    ctx.arc(256, 270, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Drawing target crosshair circles around nose bridge
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(256, 270, 25, 0, Math.PI*2);
    ctx.stroke();

    // HUD Text
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9aa0b9';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("VR CALIBRATION HUD V2.1", 256, 80);
    
    ctx.fillStyle = modelKey === 'model2' ? '#d4af37' : '#00f2fe';
    ctx.fillText("FACIAL PROFILE ENGAGED: " + (modelKey === 'model1' ? "FEMALE_A" : modelKey === 'model2' ? "MALE_A" : "MALE_B"), 256, 580);
    
    ctx.fillStyle = '#5e647e';
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText("LATENCY: 0.12ms | TRACKING SENSORS: OK", 256, 610);

    return new THREE.CanvasTexture(canvas);
}

// Procedural texture rendering for mock head selector mesh (resilient to CORS)
function setupPortraitBackgroundMesh() {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    
    const geom = new THREE.PlaneGeometry(3.6, 4.8);
    
    // Load remote image with CORS safety fallback
    arPortraitTexture = loader.load(
        faceModels[arState.activePortrait],
        // onSuccess
        () => {
            arPortraitMesh.material.map = arPortraitTexture;
            arPortraitMesh.material.needsUpdate = true;
        },
        // onProgress
        undefined,
        // onError (CORS or network error fallback)
        () => {
            console.warn("CORS or Network error loading remote portrait face model. Switching to interactive vector HUD texture.");
            arPortraitTexture = createProceduralFaceTexture(arState.activePortrait);
            arPortraitMesh.material.map = arPortraitTexture;
            arPortraitMesh.material.needsUpdate = true;
        }
    );
    
    const mat = new THREE.MeshBasicMaterial({
        map: arPortraitTexture,
        depthWrite: false
    });
    
    arPortraitMesh = new THREE.Mesh(geom, mat);
    arPortraitMesh.position.set(0, 0, -1.5); // Placed at background depth
    arScene.add(arPortraitMesh);
}

// ---------------- WEBCAM & CALIBRATION DYNAMICS ----------------

function setupCameraControls() {
    // Toggle Camera Event
    ui.cameraBtn.addEventListener('click', () => {
        if (arState.cameraActive) {
            stopCameraStream();
        } else {
            startCameraStream();
        }
    });

    // Toggle Calibration guides
    ui.guideBtn.addEventListener('click', () => {
        arState.guidesEnabled = !arState.guidesEnabled;
        ui.guideBtn.classList.toggle('active', arState.guidesEnabled);
        ui.calibrationGuide.classList.toggle('active', arState.guidesEnabled && arState.cameraActive);
    });

    // Snap Shot image download trigger
    document.getElementById('snapshot-btn').addEventListener('click', () => {
        takeARSnapshot();
    });
}

function startCameraStream() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        ui.trackingStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Initializing AR Camera Stream...`;
        
        navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 }, 
                height: { ideal: 720 }, 
                facingMode: "user" 
            } 
        })
        .then(stream => {
            arState.cameraActive = true;
            arState.cameraStream = stream;
            
            ui.webcam.srcObject = stream;
            ui.webcam.style.display = 'block';
            ui.portraitSelector.classList.add('hidden');
            ui.cameraBtn.classList.add('active');
            
            if (arPortraitMesh) arPortraitMesh.visible = false; // Hide mock static head
            
            ui.trackingStatus.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--accent-cyan)"></i> Live Webcam Active. Auto Calibration Complete.`;
            if (arState.guidesEnabled) ui.calibrationGuide.classList.add('active');
        })
        .catch(err => {
            console.error("Camera access error: ", err);
            showToast("Camera Access Denied", "Using high-fidelity portrait faces for calibration instead.", "warning");
            ui.trackingStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Camera Access Blocked. Using Portrait Headshot.`;
        });
    } else {
        showToast("WebRTC Unsupported", "Your browser does not support video streaming hardware.", "warning");
    }
}

function stopCameraStream() {
    arState.cameraActive = false;
    ui.cameraBtn.classList.remove('active');
    
    if (arState.cameraStream) {
        arState.cameraStream.getTracks().forEach(track => track.stop());
        arState.cameraStream = null;
    }
    
    ui.webcam.style.display = 'none';
    ui.webcam.srcObject = null;
    ui.portraitSelector.classList.remove('hidden');
    ui.calibrationGuide.classList.remove('active');
    
    if (arPortraitMesh) arPortraitMesh.visible = true; // Show mock head back
    
    ui.trackingStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Camera Stream Off. Using Static Model Face.`;
}

// Swaps preloaded portrait face template background textures (resilient to CORS)
function selectModelFace(modelKey) {
    arState.activePortrait = modelKey;
    
    document.querySelectorAll('.portrait-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.portrait-btn[data-img="${modelKey}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (arPortraitMesh) {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        
        arPortraitTexture = loader.load(
            faceModels[modelKey],
            // onSuccess
            () => {
                arPortraitMesh.material.map = arPortraitTexture;
                arPortraitMesh.material.needsUpdate = true;
            },
            // onProgress
            undefined,
            // onError
            () => {
                console.warn("CORS or Network error loading swapped face model. Using vector HUD.");
                arPortraitTexture = createProceduralFaceTexture(modelKey);
                arPortraitMesh.material.map = arPortraitTexture;
                arPortraitMesh.material.needsUpdate = true;
            }
        );
    }
}

// ---------------- LIVE MODIFICATORS & UPDATERS ----------------

function changeSpectaclesStyle(style) {
    arState.activeStyle = style;
    
    document.querySelectorAll('.style-card').forEach(card => {
        card.classList.remove('active');
        if (card.getAttribute('data-style') === style) card.classList.add('active');
    });

    // Populate frame price details dynamically
    let price = '$289.00';
    let defaultColor = '#d4af37';
    let defaultLensColor = '#4ea8de';

    if (style === 'wayfarer') {
        price = '$245.00';
        defaultColor = '#111111';
        defaultLensColor = '#111111';
    } else if(style === 'round') {
        price = '$210.00';
        defaultColor = '#b76e79';
        defaultLensColor = '#f77f00';
    } else if(style === 'cateye') {
        price = '$265.00';
        defaultColor = '#111111';
        defaultLensColor = '#a5a5a5';
    }

    ui.modalTitle.innerText = `${style.charAt(0).toUpperCase() + style.slice(1)} Try-On Studio`;
    ui.modalPrice.innerText = price;
    
    // Trigger swatch highlight & state update
    changeFrameColor(defaultColor);
    changeLensColor(defaultLensColor);
    
    updateArSpectacles();
}

function updateArSpectacles() {
    if (!arScene) return;

    // Clean old mesh
    if (arGlasses) arScene.remove(arGlasses);

    // Build new
    arGlasses = buildSpectacles(
        arState.activeStyle,
        arState.frameColor,
        arState.lensColor,
        arState.lensOpacity,
        arState.lensIor
    );
    
    arScene.add(arGlasses);
}

function changeFrameColor(hexVal, labelName) {
    arState.frameColor = hexVal;
    
    if (labelName) {
        ui.selectedFrameLabel.innerText = labelName;
    }

    // Set swatch selection border ring active
    document.querySelectorAll('#frame-color-row .color-swatch').forEach(sw => {
        sw.classList.remove('active');
        if(sw.getAttribute('data-color') === hexVal) sw.classList.add('active');
    });

    updateArSpectacles();
}

function changeLensColor(hexVal, labelName, optOpacity, optIor) {
    arState.lensColor = hexVal;
    
    if (labelName) {
        ui.selectedLensLabel.innerText = labelName;
    }

    if (optOpacity !== undefined) {
        arState.lensOpacity = optOpacity;
        ui.sliderOpacity.value = optOpacity * 100;
        ui.opacityValue.innerText = `${(optOpacity * 100).toFixed(0)}%`;
    }
    
    if (optIor !== undefined) {
        arState.lensIor = optIor;
        ui.sliderIor.value = optIor;
        ui.iorValue.innerText = optIor.toFixed(2);
    }

    // Swatches selection border trigger
    document.querySelectorAll('#lens-color-row .color-swatch').forEach(sw => {
        sw.classList.remove('active');
        if(sw.getAttribute('data-lens-color') === hexVal) sw.classList.add('active');
    });

    updateArSpectacles();
}

function adjustLensProperty(propName, val) {
    if (propName === 'ior') {
        const numericVal = parseFloat(val);
        arState.lensIor = numericVal;
        ui.iorValue.innerText = numericVal.toFixed(2);
    } else if (propName === 'opacity') {
        const numericVal = parseInt(val) / 100;
        arState.lensOpacity = numericVal;
        ui.opacityValue.innerText = `${val}%`;
    }
    
    updateArSpectacles();
}

// Adjusts manual calibration sliders positioning coordinates
function adjustSpectaclesCalibration(type, val) {
    const floatVal = parseFloat(val);
    
    switch(type) {
        case 'scale':
            arState.scale = floatVal;
            ui.valScale.innerText = `${floatVal.toFixed(2)}x`;
            break;
        case 'posy':
            arState.posY = floatVal / 50; // map -120 to 120 pixels to Three coordinates range
            ui.valPosy.innerText = `${floatVal.toFixed(0)}px`;
            break;
        case 'posz':
            arState.posZ = floatVal / 100; // map -150 to 150 pixels depth
            ui.valPosz.innerText = `${floatVal.toFixed(0)}px`;
            break;
        case 'rotx':
            arState.rotX = floatVal * (Math.PI / 180); // map degrees to radians
            ui.valRotx.innerText = `${floatVal.toFixed(0)}°`;
            break;
    }
}

function resetCalibration() {
    arState.scale = 1.0;
    arState.posY = 0.0;
    arState.posZ = 0.0;
    arState.rotX = 0.0;

    // Reset sliders inputs
    ui.calScale.value = 1.0;
    ui.calPosy.value = 0;
    ui.calPosz.value = 0;
    ui.calRotx.value = 0;

    // Reset labels text display
    ui.valScale.innerText = "1.00x";
    ui.valPosy.innerText = "0px";
    ui.valPosz.innerText = "0px";
    ui.valRotx.innerText = "0°";
}

// ---------------- MOCK SHOPPING ACTIONS & ALERTS ----------------

function addToCartAndCheckout() {
    const productNames = {
        aviator: "Aurelia Aviator 18K",
        wayfarer: "Carbon Noir Wayfarer",
        round: "Celeste Round Rose Gold",
        cateye: "Valkyrie Cat-Eye chic"
    };

    const selectedName = productNames[arState.activeStyle];
    
    showToast(
        "Secure Transaction Initialized", 
        `Redirecting securely to checkout with your customized ${selectedName}...`, 
        "success"
    );

    setTimeout(() => {
        closeTryOnModal();
    }, 2800);
}

// AR Camera snapshot photo export capture
function takeARSnapshot() {
    showToast("Capturing Frame", "Analyzing camera stream rendering state and rendering pixels...", "success");

    setTimeout(() => {
        try {
            // Render one synchronous frame to ensure drawing buffer matches exactly
            arRenderer.render(arScene, arCamera);
            
            const dataUrl = ui.arCanvas.toDataURL("image/png");
            
            // Create automated download attachment clicker
            const link = document.createElement('a');
            link.download = `lensky-tryon-${arState.activeStyle}.png`;
            link.href = dataUrl;
            link.click();
            
            showToast("Selfie Downloaded!", "Your virtual try-on portrait was successfully saved to your downloads folder.", "success");
        } catch(e) {
            console.error("Snapshot error: ", e);
            showToast("Snapshot Failed", "WebRTC cross-origin security prevented snapshot encoding.", "warning");
        }
    }, 500);
}

function setupThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', nextTheme);
        toggle.innerHTML = nextTheme === 'light' ? `<i class="fa-solid fa-sun"></i>` : `<i class="fa-solid fa-moon"></i>`;
        
        showToast(
            `${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)} Mode Enabled`,
            `The design palettes have updated to ${nextTheme} ambient presets.`,
            "success"
        );
    });
}

// Premium visual alert toaster notifications
function showToast(title, message, type = "success") {
    const toast = ui.toast;
    const icon = toast.querySelector('.toast-icon');
    const titleEl = toast.querySelector('.toast-title');
    const messageEl = toast.querySelector('.toast-message');

    // Customize layout coloring according to severity
    if (type === "warning") {
        toast.style.borderLeftColor = "#ffbe0b";
        toast.style.boxShadow = "0 10px 30px rgba(255, 190, 11, 0.15)";
        icon.className = "fa-solid fa-triangle-exclamation toast-icon";
        icon.style.color = "#ffbe0b";
    } else {
        toast.style.borderLeftColor = "var(--accent-cyan)";
        toast.style.boxShadow = "0 10px 30px rgba(0, 242, 254, 0.2)";
        icon.className = "fa-solid fa-circle-check toast-icon";
        icon.style.color = "var(--accent-cyan)";
    }

    titleEl.innerText = title;
    messageEl.innerText = message;

    toast.classList.add('active');

    // Auto dismiss
    setTimeout(() => {
        toast.classList.remove('active');
    }, 4000);
}
