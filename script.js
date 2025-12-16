// script.js
const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
let tempParticles = []; // Green balls
let shockwaves = []; // Shockwaves from expiring green balls
const numParticles = 300;
const particleSize = 2.2;
const mouseInfluenceRadius = 150;
const mouseForce = 0.15;
const clickForce = 3;
const MAX_GREEN_PARTICLES = Math.floor(numParticles * 1.25); // 375 if numParticles is 300

// Collision System: Hierarchical
// collisionZones = [ { bounds: {top, left...}, children: [ {top, left...} ] } ]
let collisionZones = [];

let mouse = {
    x: undefined,
    y: undefined,
    prevX: undefined,
    prevY: undefined,
    isClicked: false,
    isMoving: false
};

// Shockwave Class
class Shockwave {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 1;
        // Variability: 90% small (15-30px), 10% big (50-80px)
        const isBig = Math.random() < 0.1;
        this.maxRadius = isBig ? 50 + Math.random() * 30 : 15 + Math.random() * 15;
        this.alpha = 1;
        this.speed = isBig ? 3 : 2;
        this.force = isBig ? 1.5 : 0.5;
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(144, 238, 144, ${this.alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    update() {
        this.radius += this.speed;
        this.alpha -= 0.02; // Fade out
    }
}

// Adjust canvas size and collision bounds on load and resize
function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    updateCollisionZones();
}

function updateCollisionZones() {
    collisionZones = [];

    // Elements to extract text from
    const textElements = [
        document.querySelector('h1'),
        document.querySelector('.subtitle'),
        document.getElementById('tagline-paragraph')
    ];

    // Helper to add a zone from a list of rects
    const addZone = (rects) => {
        if (rects.length === 0) return;

        // Calculate union bounding box for the zone (Broadphase)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const validRects = [];

        rects.forEach(r => {
            // Filter out empty or invisible rects
            if (r.width > 0 && r.height > 0) {
                minX = Math.min(minX, r.left);
                minY = Math.min(minY, r.top);
                maxX = Math.max(maxX, r.right);
                maxY = Math.max(maxY, r.bottom);
                validRects.push({
                    left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                    width: r.width, height: r.height
                });
            }
        });

        if (validRects.length > 0) {
            collisionZones.push({
                bounds: {
                    left: minX, top: minY, right: maxX, bottom: maxY,
                    width: maxX - minX, height: maxY - minY
                },
                children: validRects
            });
        }
    };

    // 1. Text Elements: Use Range to get per-character rects
    textElements.forEach(el => {
        if (!el) return;
        const rects = [];
        const range = document.createRange();
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walk.nextNode()) {
            const text = node.textContent;
            for (let i = 0; i < text.length; i++) {
                if (text[i].trim().length > 0) { // Ignore whitespace characters
                    range.setStart(node, i);
                    range.setEnd(node, i + 1);
                    const clientRects = range.getClientRects();
                    for (const r of clientRects) {
                        rects.push(r);
                    }
                }
            }
        }
        addZone(rects);
    });

    // 2. Social Icons: Treat each icon as a separate rect (or zone)
    document.querySelectorAll('.social-links a').forEach(el => {
        const rect = el.getBoundingClientRect();
        addZone([rect]);
    });
}

window.addEventListener('resize', handleResize);
// Call initially
handleResize();

// Hierarchical Collision Resolution
function resolveCollisions(p) {
    // Check Broadphase Zones first
    const broadPadding = 20;
    const detailPadding = 2; // Tight padding for letters

    for (let z = 0; z < collisionZones.length; z++) {
        const zone = collisionZones[z];
        const bounds = zone.bounds;

        // Optimization: AABB Check
        if (p.x >= bounds.left - broadPadding &&
            p.x <= bounds.right + broadPadding &&
            p.y >= bounds.top - broadPadding &&
            p.y <= bounds.bottom + broadPadding) {

            // Inside Broadphase: Check children (Detailed Characters)
            for (let i = 0; i < zone.children.length; i++) {
                const rect = zone.children[i];

                // Closest Point Logic
                const closestX = Math.max(rect.left - detailPadding, Math.min(p.x, rect.right + detailPadding));
                const closestY = Math.max(rect.top - detailPadding, Math.min(p.y, rect.bottom + detailPadding));

                const dx = p.x - closestX;
                const dy = p.y - closestY;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < particleSize * particleSize) {
                    const distance = Math.sqrt(distanceSq);

                    // Collision Response
                    let nx = dx;
                    let ny = dy;

                    if (distance === 0) {
                        // Inside rect logic...
                        const dLeft = Math.abs(p.x - (rect.left - detailPadding));
                        const dRight = Math.abs(p.x - (rect.right + detailPadding));
                        const dTop = Math.abs(p.y - (rect.top - detailPadding));
                        const dBottom = Math.abs(p.y - (rect.bottom + detailPadding));
                        const min = Math.min(dLeft, dRight, dTop, dBottom);
                        if (min === dLeft) nx = -1;
                        else if (min === dRight) nx = 1;
                        else if (min === dTop) ny = -1;
                        else ny = 1;
                    } else {
                        nx = nx / distance;
                        ny = ny / distance;
                    }

                    // Push out
                    const overlap = particleSize - distance + 0.5;
                    p.x += nx * overlap;
                    p.y += ny * overlap;

                    // Bounce
                    const dot = p.vx * nx + p.vy * ny;
                    if (dot < 0) {
                        p.vx -= 2 * dot * nx;
                        p.vy -= 2 * dot * ny;
                        p.vx *= 0.7; // Damp
                        p.vy *= 0.7;
                    }
                }
            }
        }
    }
}

// Persisent Particle (Blue)
class Particle {
    constructor(x, y) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.friction = 0.99;
        this.size = particleSize;
        this.markedForConversion = false; // Infection flag
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.getParticleColor();
        ctx.fill();
    }

    update() {
        // Ambient Motion
        this.vx += (Math.random() - 0.5) * 0.1;
        this.vy += (Math.random() - 0.5) * 0.1;

        // Resolve Collision with Text/Icons
        resolveCollisions(this);

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

        // Wall Reflection (Bounce)
        if (this.x < this.size) {
            this.x = this.size;
            this.vx *= -1;
        } else if (this.x > canvas.width - this.size) {
            this.x = canvas.width - this.size;
            this.vx *= -1;
        }

        if (this.y < this.size) {
            this.y = this.size;
            this.vy *= -1;
        } else if (this.y > canvas.height - this.size) {
            this.y = canvas.height - this.size;
            this.vy *= -1;
        }

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
        this.vx = (Math.random() - 0.5) * 20;
        this.vy = (Math.random() - 0.5) * 20;
        this.friction = 0.99;
        this.size = particleSize;
        this.life = 3600 + Math.random() * 1800; // 60-90s
        this.maxLife = this.life;
        this.color = '#90ee90';
        // removed markedForRemoval as random explosions are disabled
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        let alpha = 1;
        if (this.life < 120) {
            alpha = this.life / 120;
        }
        ctx.fillStyle = `rgba(144, 238, 144, ${alpha})`;
        ctx.fill();
    }

    update() {
        // Ambient
        this.vx += (Math.random() - 0.5) * 0.1;
        this.vy += (Math.random() - 0.5) * 0.1;

        // Collisions
        resolveCollisions(this);

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

        // Wall Reflection (Bounce)
        if (this.x < this.size) {
            this.x = this.size;
            this.vx *= -1;
        } else if (this.x > canvas.width - this.size) {
            this.x = canvas.width - this.size;
            this.vx *= -1;
        }

        if (this.y < this.size) {
            this.y = this.size;
            this.vy *= -1;
        } else if (this.y > canvas.height - this.size) {
            this.y = canvas.height - this.size;
            this.vy *= -1;
        }

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxSpeed = 10;
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.life--;
        // Random explosion logic removed
    }
}

// Handle particle-particle collisions and Infection
function handleParticleCollisions() {
    const all = [...particles, ...tempParticles];
    for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
            const p1 = all[i];
            const p2 = all[j];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distSq = dx * dx + dy * dy;

            const r1 = p1.size || particleSize;
            const r2 = p2.size || particleSize;
            const minDist = r1 + r2;

            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq);

                // Normal
                const nx = dx / dist;
                const ny = dy / dist;

                // Separate to prevent overlap
                const overlap = minDist - dist;
                const sepX = nx * overlap * 0.5;
                const sepY = ny * overlap * 0.5;

                p1.x -= sepX;
                p1.y -= sepY;
                p2.x += sepX;
                p2.y += sepY;

                // Elastic Bounce
                const dvx = p1.vx - p2.vx;
                const dvy = p1.vy - p2.vy;
                const dot = dvx * nx + dvy * ny;

                if (dot > 0) {
                    p1.vx -= dot * nx;
                    p1.vy -= dot * ny;
                    p2.vx += dot * nx;
                    p2.vy += dot * ny;
                }

                // INFECTION LOGIC: Green converts Blue
                if (Math.random() < 0.01) { // 1% chance on collision
                    if (p1 instanceof GreenParticle && p2 instanceof Particle) {
                        p2.markedForConversion = true;
                    } else if (p2 instanceof GreenParticle && p1 instanceof Particle) {
                        p1.markedForConversion = true;
                    }
                }
            }
        }
    }
}

// Initialize particles
function initParticles() {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        particles.push(new Particle(x, y));
    }
}

function spawnGreenExplosionAround(rect) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Randomize count: 1 to 20
    const count = 1 + Math.floor(Math.random() * 20);

    for (let i = 0; i < count; i++) {
        if (tempParticles.length >= MAX_GREEN_PARTICLES) break;
        let x, y, vx, vy;
        const side = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left

        // Spawn on perimeter
        switch (side) {
            case 0: // Top
                x = rect.left + Math.random() * rect.width;
                y = rect.top - 5;
                break;
            case 1: // Right
                x = rect.right + 5;
                y = rect.top + Math.random() * rect.height;
                break;
            case 2: // Bottom
                x = rect.left + Math.random() * rect.width;
                y = rect.bottom + 5;
                break;
            case 3: // Left
                x = rect.left - 5;
                y = rect.top + Math.random() * rect.height;
                break;
        }

        // Emit in all directions at medium pace
        vx = (Math.random() - 0.5) * 6; // Medium speed, random direction
        vy = (Math.random() - 0.5) * 6;

        const p = new GreenParticle(x, y);
        p.vx = vx;
        p.vy = vy;
        tempParticles.push(p);
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

    // Update Shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.update();
        sw.draw();

        // Interaction: Shockwave pushes all particles
        const all = [...particles, ...tempParticles];
        all.forEach(p => {
            const dx = p.x - sw.x;
            const dy = p.y - sw.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Push particles at the wavefront
            if (dist < sw.radius + 5 && dist > sw.radius - 20) {
                const angle = Math.atan2(dy, dx);
                const force = sw.force;
                p.vx += Math.cos(angle) * force;
                p.vy += Math.sin(angle) * force;
            }
        });

        if (sw.alpha <= 0) {
            shockwaves.splice(i, 1);
        }
    }

    // Update Temp Particles
    for (let i = tempParticles.length - 1; i >= 0; i--) {
        const p = tempParticles[i];
        p.update();
        p.draw();

        // Death Logic: Spawn Shockwave with low probability
        if (p.life <= 0) {
            if (Math.random() < 0.05) { // 5% chance
                shockwaves.push(new Shockwave(p.x, p.y));
            }
            tempParticles.splice(i, 1);
        }
    }

    // Resolve Particle-Particle Collisions (Physics & Infection)
    handleParticleCollisions();

    // Process Infections (Blue -> Green)
    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].markedForConversion) {
            const p = particles[i];
            const gp = new GreenParticle(p.x, p.y);
            gp.vx = p.vx;
            gp.vy = p.vy;
            tempParticles.push(gp);
            particles.splice(i, 1);
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
        h1Element.style.userSelect = 'none';
        h1Element.style.webkitUserSelect = 'none';
        h1Element.style.cursor = 'pointer';

        const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

        if (isTouchDevice) {
            h1Element.addEventListener('click', (e) => {
                spawnGreenExplosionAround(h1Element.getBoundingClientRect());
            });
        } else {
            h1Element.addEventListener('dblclick', (e) => {
                spawnGreenExplosionAround(h1Element.getBoundingClientRect());
            });
        }
    }

    // Disable selection for other text elements
    const unselectableElements = [
        document.querySelector('.subtitle'),
        document.getElementById('tagline-paragraph')
    ];

    unselectableElements.forEach(el => {
        if (el) {
            el.style.userSelect = 'none';
            el.style.webkitUserSelect = 'none';
            el.style.cursor = 'default';
        }
    });

    // Observe tagline for text changes (typewriter effect) to update collision zones dynamically
    const taglineNode = document.getElementById('tagline-paragraph');
    let updateTimeout;
    if (taglineNode) {
        const taglineObserver = new MutationObserver(() => {
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                updateCollisionZones();
            }, 100);
        });
        taglineObserver.observe(taglineNode, { childList: true, subtree: true, characterData: true });
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
