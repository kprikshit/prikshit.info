// script.js
const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
let tempParticles = []; // Green balls
const numParticles = 300;
const particleSize = 2.2;
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
    const h1 = document.querySelector('h1');
    const subtitle = document.querySelector('.subtitle');
    const tagline = document.getElementById('tagline-paragraph');

    if (h1 && subtitle && tagline) {
        const r1 = h1.getBoundingClientRect();
        const r2 = subtitle.getBoundingClientRect();
        const r3 = tagline.getBoundingClientRect();

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

// Persisent Particle (Blue)
class Particle {
    constructor(x, y) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.friction = 0.99;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, particleSize, 0, Math.PI * 2);
        ctx.fillStyle = this.getParticleColor();
        ctx.fill();
    }

    update() {
        // Continuous Ambient Motion
        this.vx += (Math.random() - 0.5) * 0.1;
        this.vy += (Math.random() - 0.5) * 0.1;

        // Text Boundary Repulsion
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

        // Mouse Interaction
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

        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Screen wrapping
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxSpeed = 3;
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }
    }

    getParticleColor() {
        const isNightMode = document.body.classList.contains('night-mode');
        return isNightMode ? '#00d2ff' : '#007bff';
    }
}

// Temporary Green Particle
class GreenParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        // Faster chaotic explosion
        this.vx = (Math.random() - 0.5) * 20;
        this.vy = (Math.random() - 0.5) * 20;
        this.friction = 0.99; // Same smooth friction
        this.size = particleSize; // Match blue size

        // Lifespan: 60 to 90 seconds (approx 3600-5400 frames)
        this.life = 3600 + Math.random() * 1800;
        this.maxLife = this.life;
        this.color = '#90ee90'; // Soft green
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        // Fade out in last 2 seconds
        let alpha = 1;
        if (this.life < 120) {
            alpha = this.life / 120;
        }
        ctx.fillStyle = `rgba(144, 238, 144, ${alpha})`;
        ctx.fill();
    }

    update() {
        // Shared Logic with Particle (Ambient, Text, Mouse)

        // 1. Ambient
        this.vx += (Math.random() - 0.5) * 0.1;
        this.vy += (Math.random() - 0.5) * 0.1;

        // 2. Text Repulsion
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

        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;

        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        // Relaxed speed limit for explosion
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxSpeed = 10;
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.life--;
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

function spawnGreenExplosion(x, y) {
    // Chaos! More particles
    for (let i = 0; i < 40; i++) {
        tempParticles.push(new GreenParticle(x, y));
    }
}

// Explosions for links
function explodeParticles(x, y) {
    particles.forEach(p => {
        let dx = p.x - x;
        let dy = p.y - y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        const explosionRadius = 300;

        if (distance < explosionRadius) {
            let angle = Math.atan2(dy, dx);
            let force = (1 - distance / explosionRadius) * 15;
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
        }
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (particles.length === 0) {
        initParticles();
    }

    // Update Main Particles
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }

    // Update Temp Particles
    for (let i = tempParticles.length - 1; i >= 0; i--) {
        const p = tempParticles[i];
        p.update();
        p.draw();
        if (p.life <= 0) {
            tempParticles.splice(i, 1);
        }
    }
}

// Mouse events
let mouseTimeout;
window.addEventListener('mousemove', function (event) {
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.isMoving = true;
    clearTimeout(mouseTimeout);
    mouseTimeout = setTimeout(() => { mouse.isMoving = false; }, 100);
});
window.addEventListener('mousedown', function () { mouse.isClicked = true; });
window.addEventListener('mouseup', function () { mouse.isClicked = false; });
window.addEventListener('mouseout', function () { mouse.x = undefined; mouse.y = undefined; mouse.isClicked = false; });
window.addEventListener('touchstart', function (event) {
    mouse.isClicked = true;
    mouse.x = event.touches[0].clientX;
    mouse.y = event.touches[0].clientY;
});
window.addEventListener('touchmove', function (event) {
    mouse.x = event.touches[0].clientX;
    mouse.y = event.touches[0].clientY;
    mouse.isMoving = true;
});
window.addEventListener('touchend', function () { mouse.isClicked = false; });

// Link interactions
document.querySelectorAll('.social-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        const rect = link.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        explodeParticles(centerX, centerY);
    });
});

// Setup H1 Interaction
window.addEventListener('load', () => {
    handleResize();
    initParticles();
    animate();

    const h1Element = document.querySelector('h1');
    if (h1Element) {
        // Disable selection
        h1Element.style.userSelect = 'none';
        h1Element.style.webkitUserSelect = 'none';
        h1Element.style.cursor = 'pointer';

        // Detect touch device
        const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

        if (isTouchDevice) {
            h1Element.addEventListener('click', (e) => {
                spawnGreenExplosion(e.clientX, e.clientY);
            });
        } else {
            h1Element.addEventListener('dblclick', (e) => {
                spawnGreenExplosion(e.clientX, e.clientY);
            });
        }
    }
});

// Theme Observer
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            // Theme handled
        }
    });
});
observer.observe(document.body, { attributes: true });
