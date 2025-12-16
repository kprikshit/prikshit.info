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
    constructor(x, y, opts = null) {
        this.x = x;
        this.y = y;
        this.radius = 1;

        if (opts) {
            this.maxRadius = opts.maxRadius || 50;
            this.speed = opts.speed || 3;
            this.force = opts.force || 1;
        } else {
            // Variability: 90% small (15-30px), 10% big (50-80px)
            const isBig = Math.random() < 0.1;
            this.maxRadius = isBig ? 50 + Math.random() * 30 : 15 + Math.random() * 15;
            this.speed = isBig ? 3 : 2;
            this.force = isBig ? 1.5 : 0.5;
        }

        this.alpha = 1;
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

    interact(p) {
        const dx = p.x - this.x;
        const dy = p.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Push particles at the wavefront
        if (dist < this.radius + 5 && dist > this.radius - 20) {
            const angle = Math.atan2(dy, dx);
            const force = this.force;
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
        }
    }
}

class RectangularShockwave {
    constructor(rect, opts = null) {
        this.rect = rect;
        this.expansion = 0;
        this.maxExpansion = opts && opts.maxRadius ? opts.maxRadius : 60;
        this.speed = opts && opts.speed ? opts.speed : 3;
        this.force = opts && opts.force ? opts.force : 2;
        this.alpha = 1;
        this.cornerRadius = 10;
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        const r = {
            x: this.rect.left - this.expansion,
            y: this.rect.top - this.expansion,
            w: this.rect.width + this.expansion * 2,
            h: this.rect.height + this.expansion * 2
        };

        ctx.strokeStyle = `rgba(0, 123, 255, ${this.alpha})`;
        ctx.lineWidth = 2; // Thinner line
        // Draw rounded rectangle
        ctx.roundRect(r.x, r.y, r.w, r.h, this.cornerRadius + this.expansion);
        ctx.stroke();
        ctx.restore();
    }

    update() {
        this.expansion += this.speed;
        this.alpha -= 0.02;
    }

    interact(p) {
        // Calculate closest point on the original rect
        const closestX = Math.max(this.rect.left, Math.min(p.x, this.rect.right));
        const closestY = Math.max(this.rect.top, Math.min(p.y, this.rect.bottom));

        const dx = p.x - closestX;
        const dy = p.y - closestY;
        const distToRect = Math.sqrt(dx * dx + dy * dy);

        // Push particles if they are near the expanding wavefront
        if (Math.abs(distToRect - this.expansion) < 15) {
            let nx, ny;
            if (distToRect === 0) {
                // Inside rect: push away from center
                const cx = this.rect.left + this.rect.width / 2;
                const cy = this.rect.top + this.rect.height / 2;
                const cdx = p.x - cx;
                const cdy = p.y - cy;
                const cdist = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
                nx = cdx / cdist;
                ny = cdy / cdist;
            } else {
                nx = dx / distToRect;
                ny = dy / distToRect;
            }

            p.vx += nx * this.force;
            p.vy += ny * this.force;
        }
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

    // Elements to treat as boundaries
    const elements = [
        document.querySelector('h1'),
        document.querySelector('.subtitle'),
        document.getElementById('tagline-text'), // Use the span to get exact text width
        ...document.querySelectorAll('.social-links a')
    ];

    elements.forEach(el => {
        if (!el) return;
        const r = el.getBoundingClientRect();

        // Filter out empty or invisible rects
        if (r.width > 0 && r.height > 0) {
            // Create a simple zone for the element's bounding box
            collisionZones.push({
                bounds: {
                    left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                    width: r.width, height: r.height
                },
                children: [{ // Treat the whole box as the collision shape
                    left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                    width: r.width, height: r.height
                }]
            });
        }
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
        this.life = 900 + Math.random() * 2700; // 15-60s
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

    // Ensure zones are up to date
    updateCollisionZones();
    // Gather all exclusion rects with a small buffer
    const forbiddenZones = collisionZones.map(z => ({
        left: z.bounds.left - 10,
        top: z.bounds.top - 10,
        right: z.bounds.right + 10,
        bottom: z.bounds.bottom + 10
    }));

    for (let i = 0; i < numParticles; i++) {
        let x, y, safe = false;
        let attempts = 0;

        while (!safe && attempts < 100) {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
            safe = true;

            for (let r of forbiddenZones) {
                if (x > r.left && x < r.right && y > r.top && y < r.bottom) {
                    safe = false;
                    break;
                }
            }
            attempts++;
        }

        particles.push(new Particle(x, y));
    }
}

// Context-aware spawn function: spawns on perimeter if 'target' is a Rect, or clusters if 'target' is a Point {x,y}
function spawnGreenExplosion(target) {
    // Randomize count: 20 to 40
    const count = 20 + Math.floor(Math.random() * 21);

    const isRect = (target.width !== undefined);

    for (let i = 0; i < count; i++) {
        if (tempParticles.length >= MAX_GREEN_PARTICLES) break;

        let x, y, vx, vy;

        if (isRect) {
            // Spawn on PERIMETER of the text/element
            const side = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left
            switch (side) {
                case 0: // Top
                    x = target.left + Math.random() * target.width;
                    y = target.top - 5;
                    break;
                case 1: // Right
                    x = target.right + 5;
                    y = target.top + Math.random() * target.height;
                    break;
                case 2: // Bottom
                    x = target.left + Math.random() * target.width;
                    y = target.bottom + 5;
                    break;
                case 3: // Left
                    x = target.left - 5;
                    y = target.top + Math.random() * target.height;
                    break;
            }
        } else {
            // Spawn in a small cluster around the POINT (click in void)
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 10;
            x = target.x + Math.cos(angle) * radius;
            y = target.y + Math.sin(angle) * radius;
        }

        // Emit in all directions at medium pace
        vx = (Math.random() - 0.5) * 6;
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
        all.forEach(p => sw.interact(p));

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

    // Export function to trigger shockwave from external scripts (e.g. index.html)
    window.triggerNameShockwave = function () {
        const h1 = document.querySelector('h1');
        if (h1) {
            const rect = h1.getBoundingClientRect();
            // Contained expansion (subtle) around the name
            // Use RectangularShockwave
            shockwaves.push(new RectangularShockwave(rect, {
                maxRadius: 30, // Slightly larger than tagline but still subtle relative to H1 size
                force: 2,
                speed: 1 // Slower speed
            }));
        }
    };

    const h1Element = document.querySelector('h1');
    if (h1Element) {
        // Only set cursor style, remove specific listener
        h1Element.style.userSelect = 'none';
        h1Element.style.webkitUserSelect = 'none';
        h1Element.style.cursor = 'default'; // No longer a special pointer target
    }

    // Unified Double Interaction Handler
    function handleDoubleInteraction(clientX, clientY) {
        // Check if clicked on specific text elements
        const h1 = document.querySelector('h1');
        const sub = document.querySelector('.subtitle');
        const tag = document.getElementById('tagline-paragraph');

        let spawnedOnText = false;

        [h1, sub, tag].forEach(el => {
            if (el && !spawnedOnText) {
                const rect = el.getBoundingClientRect();
                if (clientX >= rect.left && clientX <= rect.right &&
                    clientY >= rect.top && clientY <= rect.bottom) {
                    spawnGreenExplosion(rect); // Spawn on perimeter
                    spawnedOnText = true;
                }
            }
        });

        if (!spawnedOnText) {
            spawnGreenExplosion({ x: clientX, y: clientY }); // Spawn on point
        }
    }

    // Global Double Click to spawn green particles (Desktop)
    window.addEventListener('dblclick', (e) => {
        handleDoubleInteraction(e.clientX, e.clientY);
    });

    // Mobile Double Tap Detection
    let lastTap = 0;
    window.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 500 && tapLength > 0) {
            e.preventDefault(); // Prevent zoom
            const touch = e.changedTouches[0];
            handleDoubleInteraction(touch.clientX, touch.clientY);
        }
        lastTap = currentTime;
    });

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
