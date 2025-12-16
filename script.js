// script.js
const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
const numParticles = 300;
const particleSize = 2.2; // Increased size by ~10%
const mouseInfluenceRadius = 150;
const mouseForce = 0.15;
const clickForce = 3;
const textRepelRadius = 30;

let mouse = {
    x: undefined,
    y: undefined,
    prevX: undefined,
    prevY: undefined,
    isClicked: false,
    isMoving: false
};

let textBounds = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, centerX: 0, centerY: 0 };

// Adjust canvas size and text bounds on load and resize
function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    updateTextBounds();
}

function updateTextBounds() {
    // Query elements here to ensure they exist and get current dimensions
    const h1 = document.querySelector('h1');
    const subtitle = document.querySelector('.subtitle');
    const tagline = document.getElementById('tagline-paragraph');

    if (h1 && subtitle && tagline) {
        const r1 = h1.getBoundingClientRect();
        const r2 = subtitle.getBoundingClientRect();
        const r3 = tagline.getBoundingClientRect();

        // Calculate the union bounding box of the text elements
        const top = Math.min(r1.top, r2.top, r3.top);
        const bottom = Math.max(r1.bottom, r2.bottom, r3.bottom);
        const left = Math.min(r1.left, r2.left, r3.left);
        const right = Math.max(r1.right, r2.right, r3.right);

        textBounds = {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: right - left,
            height: bottom - top,
            centerX: (left + right) / 2,
            centerY: (top + bottom) / 2
        };
    }
}

window.addEventListener('resize', handleResize);

// Particle class
class Particle {
    constructor(x, y) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.friction = 0.99;
        // Trails removed as requested
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, particleSize, 0, Math.PI * 2);
        ctx.fillStyle = this.getParticleColor();
        ctx.fill();
    }

    update() {
        // 1. Continuous Ambient Motion
        this.vx += (Math.random() - 0.5) * 0.1;
        this.vy += (Math.random() - 0.5) * 0.1;

        // 2. Text Boundary Repulsion
        if (this.x > textBounds.left - textRepelRadius &&
            this.x < textBounds.right + textRepelRadius &&
            this.y > textBounds.top - textRepelRadius &&
            this.y < textBounds.bottom + textRepelRadius) {

            let dx = this.x - textBounds.centerX;
            let dy = this.y - textBounds.centerY;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                let force = 0.5;
                this.vx += (dx / distance) * force;
                this.vy += (dy / distance) * force;
            }
        }

        // 3. Mouse Interaction
        if (mouse.x !== undefined && mouse.y !== undefined) {
            let dx = this.x - mouse.x;
            let dy = this.y - mouse.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouseInfluenceRadius) {
                let angle = Math.atan2(dy, dx);
                let forceMultiplier = (1 - distance / mouseInfluenceRadius);

                if (mouse.isMoving && mouse.prevX !== undefined && mouse.prevY !== undefined) {
                    const mouseVx = mouse.x - mouse.prevX;
                    const mouseVy = mouse.y - mouse.prevY;

                    this.vx += mouseVx * 0.05 * forceMultiplier;
                    this.vy += mouseVy * 0.05 * forceMultiplier;

                    this.vx += Math.cos(angle) * mouseForce * forceMultiplier;
                    this.vy += Math.sin(angle) * mouseForce * forceMultiplier;
                }

                if (mouse.isClicked) {
                    this.vx += Math.cos(angle) * clickForce * forceMultiplier;
                    this.vy += Math.sin(angle) * clickForce * forceMultiplier;
                }
            }
        }

        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;

        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Screen wrapping
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        // Speed limit
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxSpeed = 3;
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }
    }

    getParticleColor() {
        const isNightMode = document.body.classList.contains('night-mode');
        // Brighter blues:
        // Night: #00d2ff (Neon Cyan/Blue) - stands out well on dark
        // Day: #007bff (Standard Bright Blue) - stands out well on light
        return isNightMode ? '#00d2ff' : '#007bff';
    }
}

// Initialize particles
function initParticles() {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;

        // Avoid spawning inside text bounds
        if (textBounds.width > 0 &&
            x > textBounds.left && x < textBounds.right &&
            y > textBounds.top && y < textBounds.bottom) {
            y = y < textBounds.centerY ? textBounds.top - 10 : textBounds.bottom + 10;
        }

        particles.push(new Particle(x, y));
    }
}

// Explosion effect for links
function explodeParticles(x, y) {
    particles.forEach(p => {
        let dx = p.x - x;
        let dy = p.y - y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        const explosionRadius = 300;

        if (distance < explosionRadius) {
            let angle = Math.atan2(dy, dx);
            let force = (1 - distance / explosionRadius) * 15; // Strong burst
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
        }
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Safety check
    if (particles.length === 0) {
        initParticles();
    }

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }
}

// Mouse interaction events
let mouseTimeout;

window.addEventListener('mousemove', function (event) {
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.isMoving = true;

    clearTimeout(mouseTimeout);
    mouseTimeout = setTimeout(() => {
        mouse.isMoving = false;
    }, 100);
});

window.addEventListener('mousedown', function (event) {
    mouse.isClicked = true;
});

window.addEventListener('mouseup', function (event) {
    mouse.isClicked = false;
});

window.addEventListener('mouseout', function () {
    mouse.x = undefined;
    mouse.y = undefined;
    mouse.isClicked = false;
    mouse.isMoving = false;
});

// Touch events
window.addEventListener('touchstart', function (event) {
    mouse.isClicked = true;
    mouse.x = event.touches[0].clientX;
    mouse.y = event.touches[0].clientY;
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
});

window.addEventListener('touchmove', function (event) {
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.x = event.touches[0].clientX;
    mouse.y = event.touches[0].clientY;
    mouse.isMoving = true;
    clearTimeout(mouseTimeout);
    mouseTimeout = setTimeout(() => {
        mouse.isMoving = false;
    }, 100);
});

window.addEventListener('touchend', function () {
    mouse.isClicked = false;
    mouse.x = undefined;
    mouse.y = undefined;
    mouse.isMoving = false;
});

// Link interaction
document.querySelectorAll('.social-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        const rect = link.getBoundingClientRect();
        // Since event listeners might be added before layout is final, calculate center dyanmically
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        explodeParticles(centerX, centerY);
    });
});


// Start everything when loaded
window.addEventListener('load', () => {
    handleResize();
    initParticles();
    animate();
});

// Re-initialize particles when theme changes
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            // Theme change handled dynamically
        }
    });
});
observer.observe(document.body, { attributes: true });
