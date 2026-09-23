/**
 * Fighter Class - Shadow Blade: Way of the Ninja
 * Handles character state machine, hitboxes, animation frames, and AI logic.
 */

const GRAVITY = 0.65;
const GROUND_Y_RATIO = 0.78; // ground line at 78% of canvas height

// Weapon definitions
const WEAPONS = {
    katana: { name: 'Ninjato Katana', range: 75, damage: 18, speed: 1.0, comboMax: 3, icon: '🗡️', cost: 0 },
    kama: { name: 'Dual Kamas', range: 55, damage: 12, speed: 1.5, comboMax: 5, icon: '⚔️', cost: 300 },
    nunchaku: { name: 'Steel Nunchaku', range: 50, damage: 22, speed: 0.8, comboMax: 3, icon: '🥢', cost: 500 },
    glaive: { name: 'Dragon Glaive', range: 100, damage: 25, speed: 0.7, comboMax: 2, icon: '🔱', cost: 700 }
};

// Enemy boss roster
const BOSSES = [
    { name: 'Shinobi Kenji', title: 'Pemburu Bayangan', weapon: 'katana', hp: 100, aggression: 0.4, color: '#38bdf8', eyeColor: '#38bdf8' },
    { name: 'Kunoichi Ren', title: 'Angin Malam', weapon: 'kama', hp: 120, aggression: 0.55, color: '#ec4899', eyeColor: '#f472b6' },
    { name: 'Master Shifu', title: 'Pilar Baja Ketenangan', weapon: 'nunchaku', hp: 140, aggression: 0.45, color: '#f59e0b', eyeColor: '#fbbf24' },
    { name: 'Warlord Kurogane', title: 'Badai Besi Hitam', weapon: 'glaive', hp: 160, aggression: 0.6, color: '#ef4444', eyeColor: '#f87171' },
    { name: 'Shadow Titan', title: 'Penguasa Kegelapan Abadi', weapon: 'glaive', hp: 200, aggression: 0.7, color: '#a855f7', eyeColor: '#c084fc' }
];

class Fighter {
    constructor(x, y, facing, isPlayer, canvasW, canvasH, weaponKey) {
        this.x = x;
        this.y = y;
        this.w = 50;
        this.h = 110;
        this.facing = facing; // 1 = right, -1 = left
        this.isPlayer = isPlayer;
        this.canvasW = canvasW;
        this.canvasH = canvasH;

        // Combat stats
        this.weaponKey = weaponKey || 'katana';
        this.weapon = WEAPONS[this.weaponKey];
        this.maxHp = 100;
        this.hp = 100;
        this.shadowMagicCharge = 0; // 0 to 100
        this.maxShadowMagic = 100;
        this.shurikens = 5;

        // Physics
        this.vx = 0;
        this.vy = 0;
        this.speed = 4.5;
        this.jumpForce = -14;
        this.onGround = true;
        this.groundY = canvasH * GROUND_Y_RATIO;

        // State machine
        this.state = 'idle'; // idle, walk, jump, crouch, slash, kick, hurt, block, roll, throw, magic, ko
        this.stateTimer = 0;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.stunTimer = 0;
        this.isBlocking = false;

        // Attack hitbox
        this.attackHitbox = null;
        this.attackDealt = false;
        this.attackDamage = 0;

        // Visual effects
        this.trails = [];
        this.eyeColor = isPlayer ? '#10b981' : '#ef4444';
        this.bodyColor = '#0a0a0a';

        // AI state (enemies only)
        this.aiTimer = 0;
        this.aiDecision = 'idle';
        this.aiCooldown = 0;

        // Animation wobble
        this.animFrame = 0;
    }

    setWeapon(key) {
        this.weaponKey = key;
        this.weapon = WEAPONS[key];
    }

    getGroundY() {
        return this.canvasH * GROUND_Y_RATIO;
    }

    getHitbox() {
        return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    // Start attack state
    attack(type) {
        if (this.stunTimer > 0 || this.state === 'ko' || this.state === 'hurt') return;
        if (['slash', 'kick', 'throw', 'magic', 'roll'].includes(this.state)) return;

        if (type === 'slash') {
            // Check combo chain
            if (this.comboTimer > 0 && this.comboCount < this.weapon.comboMax) {
                this.comboCount++;
            } else {
                this.comboCount = 1;
            }
            this.state = 'slash';
            this.stateTimer = Math.floor(22 / this.weapon.speed);
            this.attackDealt = false;
            this.attackDamage = this.weapon.damage + (this.comboCount > 2 ? 8 : 0);
            this.comboTimer = 30;
            window.shadowAudio.playSlashWhoosh();
        } else if (type === 'kick') {
            this.state = 'kick';
            this.stateTimer = 20;
            this.attackDealt = false;
            this.attackDamage = 14;
            this.comboCount = 0;
            window.shadowAudio.playSlashWhoosh();
        } else if (type === 'throw') {
            if (this.shurikens <= 0) return;
            this.state = 'throw';
            this.stateTimer = 18;
            this.attackDealt = false;
            this.shurikens--;
            window.shadowAudio.playShurikenThrow();
        } else if (type === 'magic') {
            if (this.shadowMagicCharge < this.maxShadowMagic) return;
            this.state = 'magic';
            this.stateTimer = 40;
            this.attackDealt = false;
            this.shadowMagicCharge = 0;
            this.attackDamage = 40;
            window.shadowAudio.playShadowMagic();
        }
    }

    startBlock() {
        if (this.state === 'ko' || this.stunTimer > 0) return;
        if (['slash', 'kick', 'throw', 'magic'].includes(this.state)) return;
        this.isBlocking = true;
        this.state = 'block';
    }

    stopBlock() {
        this.isBlocking = false;
        if (this.state === 'block') this.state = 'idle';
    }

    roll() {
        if (this.state === 'ko' || this.stunTimer > 0 || !this.onGround) return;
        if (['slash', 'kick', 'throw', 'magic', 'roll'].includes(this.state)) return;
        this.state = 'roll';
        this.stateTimer = 18;
        this.invincible = true;
        this.invincibleTimer = 18;
        this.vx = this.facing * 8;
    }

    takeDamage(dmg, attackerX) {
        if (this.invincible || this.state === 'ko') return 0;

        if (this.isBlocking) {
            // Block reduces damage by 80%
            const blocked = Math.floor(dmg * 0.2);
            this.hp -= blocked;
            this.stunTimer = 5;
            window.shadowAudio.playBlock();
            return blocked;
        }

        this.hp -= dmg;
        this.state = 'hurt';
        this.stateTimer = 14;
        this.stunTimer = 14;
        this.comboCount = 0;

        // Knockback
        const dir = this.x < attackerX ? -1 : 1;
        this.vx = dir * 6;
        this.vy = -3;
        this.onGround = false;

        // Build magic charge for defender
        this.shadowMagicCharge = Math.min(this.maxShadowMagic, this.shadowMagicCharge + Math.floor(dmg * 0.8));

        window.shadowAudio.playHeavyHit();
        window.shadowAudio.playGrunt();

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'ko';
            this.stateTimer = 999;
            window.shadowAudio.playKO();
        }

        return dmg;
    }

    // Generate attack hitbox at the correct frame
    getAttackHitbox() {
        if (this.attackDealt) return null;

        let hitFrame = false;
        if (this.state === 'slash') {
            const total = Math.floor(22 / this.weapon.speed);
            hitFrame = this.stateTimer <= total - 6 && this.stateTimer >= total - 12;
        } else if (this.state === 'kick') {
            hitFrame = this.stateTimer <= 14 && this.stateTimer >= 8;
        } else if (this.state === 'magic') {
            hitFrame = this.stateTimer <= 20 && this.stateTimer >= 15;
        }

        if (!hitFrame) return null;

        const range = this.state === 'magic' ? 140 : (this.state === 'kick' ? 65 : this.weapon.range);
        const hx = this.facing === 1 ? this.x + 10 : this.x - 10 - range;
        const hy = this.state === 'kick' ? this.y - this.h * 0.5 : this.y - this.h * 0.7;
        const hh = this.state === 'magic' ? this.h : 35;
        return { x: hx, y: hy, w: range, h: hh };
    }

    update(keys, opponent) {
        this.animFrame++;
        this.groundY = this.getGroundY();

        // Timers
        if (this.comboTimer > 0) this.comboTimer--;
        if (this.comboTimer <= 0) this.comboCount = 0;
        if (this.invincibleTimer > 0) { this.invincibleTimer--; if (this.invincibleTimer <= 0) this.invincible = false; }
        if (this.stunTimer > 0) this.stunTimer--;

        // State completion
        if (this.stateTimer > 0) {
            this.stateTimer--;
            if (this.stateTimer <= 0) {
                if (this.state !== 'ko') {
                    this.state = 'idle';
                    this.attackHitbox = null;
                }
            }
        }

        // Face opponent
        if (opponent && this.state !== 'roll' && this.state !== 'ko') {
            this.facing = opponent.x > this.x ? 1 : -1;
        }

        // Movement (only when not in attack/hurt/ko states)
        const canMove = ['idle', 'walk', 'jump', 'crouch', 'block'].includes(this.state);

        if (this.isPlayer && canMove && this.stunTimer <= 0) {
            this.vx = 0;
            if (keys['ArrowLeft'] || keys['KeyA']) { this.vx = -this.speed; this.state = this.onGround ? 'walk' : this.state; }
            if (keys['ArrowRight'] || keys['KeyD']) { this.vx = this.speed; this.state = this.onGround ? 'walk' : this.state; }
            if ((keys['ArrowUp'] || keys['KeyW']) && this.onGround) {
                this.vy = this.jumpForce;
                this.onGround = false;
                this.state = 'jump';
            }
            if ((keys['ArrowDown'] || keys['KeyS']) && this.onGround) {
                this.state = 'crouch';
                this.vx = 0;
            }
            if (!keys['ArrowLeft'] && !keys['KeyA'] && !keys['ArrowRight'] && !keys['KeyD'] && this.onGround && this.state === 'walk') {
                this.state = 'idle';
            }
        }

        // Apply physics
        if (!this.onGround || this.state === 'roll') {
            this.vy += GRAVITY;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Ground collision
        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.vy = 0;
            this.onGround = true;
            if (this.state === 'jump') this.state = 'idle';
        }

        // Canvas boundaries
        this.x = Math.max(this.w / 2 + 10, Math.min(this.canvasW - this.w / 2 - 10, this.x));

        // Friction
        if (this.onGround && this.state !== 'walk' && this.state !== 'roll') {
            this.vx *= 0.8;
        }

        // Weapon trail
        if (['slash', 'kick', 'magic'].includes(this.state)) {
            const trailX = this.x + this.facing * 30;
            const trailY = this.y - this.h * 0.6;
            this.trails.push({ x: trailX, y: trailY, alpha: 1, size: 8 + Math.random() * 12 });
        }

        // Decay trails
        for (let i = this.trails.length - 1; i >= 0; i--) {
            this.trails[i].alpha -= 0.06;
            if (this.trails[i].alpha <= 0) this.trails.splice(i, 1);
        }

        // Shuriken regeneration (slow)
        if (this.animFrame % 180 === 0 && this.shurikens < 5) this.shurikens++;
    }

    // AI Decision Making (for enemy fighters)
    updateAI(opponent) {
        if (this.state === 'ko' || this.stunTimer > 0) return;
        if (['slash', 'kick', 'throw', 'magic', 'roll', 'hurt'].includes(this.state)) return;

        this.aiTimer++;
        if (this.aiCooldown > 0) { this.aiCooldown--; return; }

        const dist = Math.abs(this.x - opponent.x);
        const aggression = this.aggression || 0.4;

        // Decision every N frames
        if (this.aiTimer % 15 !== 0) {
            // Continue current movement
            if (this.aiDecision === 'approach') {
                const dir = opponent.x > this.x ? 1 : -1;
                this.vx = dir * this.speed * 0.75;
                this.state = 'walk';
            } else if (this.aiDecision === 'retreat') {
                const dir = opponent.x > this.x ? -1 : 1;
                this.vx = dir * this.speed * 0.6;
                this.state = 'walk';
            }
            return;
        }

        const rng = Math.random();

        if (dist > 250) {
            // Far: approach or throw shuriken
            if (rng < 0.15 && this.shurikens > 0) {
                this.attack('throw');
                this.aiCooldown = 30;
            } else {
                this.aiDecision = 'approach';
            }
        } else if (dist > 80) {
            // Medium range
            if (rng < aggression * 0.7) {
                this.aiDecision = 'approach';
            } else if (rng < aggression * 0.85 && this.shurikens > 0) {
                this.attack('throw');
                this.aiCooldown = 25;
            } else {
                this.aiDecision = 'idle';
                this.vx = 0;
                this.state = 'idle';
            }
        } else {
            // Close range: attack!
            if (rng < aggression * 0.5) {
                this.attack('slash');
                this.aiCooldown = Math.floor(18 + Math.random() * 15);
            } else if (rng < aggression * 0.7) {
                this.attack('kick');
                this.aiCooldown = 20;
            } else if (rng < aggression * 0.8 && this.shadowMagicCharge >= this.maxShadowMagic) {
                this.attack('magic');
                this.aiCooldown = 45;
            } else if (rng < aggression * 0.85) {
                // Block stance
                this.startBlock();
                setTimeout(() => this.stopBlock(), 600 + Math.random() * 500);
                this.aiCooldown = 20;
            } else if (rng < 0.9) {
                this.roll();
                this.aiCooldown = 22;
            } else {
                this.aiDecision = 'retreat';
                this.aiCooldown = 15;
            }
        }

        // Reactive dodge: if opponent is attacking at close range
        if (dist < 90 && ['slash', 'kick', 'magic'].includes(opponent.state) && Math.random() < aggression * 0.3) {
            if (Math.random() < 0.5) {
                this.roll();
            } else {
                this.startBlock();
                setTimeout(() => this.stopBlock(), 400);
            }
            this.aiCooldown = 20;
        }
    }

    // Draw the silhouette fighter on canvas
    draw(ctx) {
        ctx.save();
        const bx = this.x;
        const by = this.y;
        const f = this.facing;
        ctx.translate(bx, by);
        ctx.scale(f, 1);

        // Weapon trails
        this.trails.forEach(t => {
            ctx.globalAlpha = t.alpha * 0.6;
            ctx.fillStyle = this.isPlayer ? '#10b981' : (this.eyeColor || '#ef4444');
            ctx.beginPath();
            ctx.arc(t.x - bx, t.y - by, t.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Invincibility flash
        if (this.invincible && this.animFrame % 4 < 2) {
            ctx.globalAlpha = 0.4;
        }

        // Body proportions
        const headR = 14;
        const torsoH = 38;
        const legH = 35;
        const armLen = 30;

        // Animation offsets
        let legAngle1 = 0, legAngle2 = 0, armAngle = 0, bodyTilt = 0;
        let weaponAngle = -0.3;
        const wobble = Math.sin(this.animFrame * 0.08) * 2;

        if (this.state === 'idle') {
            legAngle1 = Math.sin(this.animFrame * 0.03) * 0.03;
            legAngle2 = -legAngle1;
            armAngle = Math.sin(this.animFrame * 0.04) * 0.08;
        } else if (this.state === 'walk') {
            const walkCycle = this.animFrame * 0.18;
            legAngle1 = Math.sin(walkCycle) * 0.5;
            legAngle2 = -legAngle1;
            armAngle = -Math.sin(walkCycle) * 0.3;
        } else if (this.state === 'jump') {
            legAngle1 = -0.4;
            legAngle2 = 0.3;
            armAngle = -0.5;
        } else if (this.state === 'crouch') {
            legAngle1 = 0.8;
            legAngle2 = -0.5;
        } else if (this.state === 'slash') {
            const prog = 1 - (this.stateTimer / Math.floor(22 / this.weapon.speed));
            weaponAngle = -2.5 + prog * 4;
            armAngle = -1.5 + prog * 2.5;
            bodyTilt = Math.sin(prog * Math.PI) * 0.15;
        } else if (this.state === 'kick') {
            const prog = 1 - (this.stateTimer / 20);
            legAngle1 = -0.2 + prog * 1.8;
            armAngle = -0.3;
        } else if (this.state === 'hurt') {
            bodyTilt = -0.2;
            armAngle = 0.4;
        } else if (this.state === 'block') {
            armAngle = -1.2;
            weaponAngle = -1.5;
        } else if (this.state === 'roll') {
            const prog = 1 - (this.stateTimer / 18);
            bodyTilt = prog * Math.PI * 2;
        } else if (this.state === 'ko') {
            bodyTilt = 1.2;
            legAngle1 = 0.5;
            legAngle2 = 0.3;
        } else if (this.state === 'magic') {
            const prog = 1 - (this.stateTimer / 40);
            armAngle = -Math.PI * 0.5;
            weaponAngle = prog * Math.PI;
        }

        ctx.rotate(bodyTilt);

        // Shadow (ground)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 3, 28, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.save();
        const legY = -legH - 2;
        // Leg 1
        ctx.save();
        ctx.translate(-8, legY);
        ctx.rotate(legAngle1);
        ctx.fillStyle = this.bodyColor;
        ctx.fillRect(-5, 0, 10, legH);
        // Foot
        ctx.fillRect(-5, legH - 4, 14, 5);
        ctx.restore();
        // Leg 2
        ctx.save();
        ctx.translate(8, legY);
        ctx.rotate(legAngle2);
        ctx.fillStyle = this.bodyColor;
        ctx.fillRect(-5, 0, 10, legH);
        ctx.fillRect(-5, legH - 4, 14, 5);
        ctx.restore();
        ctx.restore();

        // Torso
        const torsoY = -(legH + torsoH);
        ctx.fillStyle = this.bodyColor;
        ctx.beginPath();
        ctx.moveTo(-16, torsoY + torsoH);
        ctx.lineTo(-12, torsoY);
        ctx.lineTo(12, torsoY);
        ctx.lineTo(16, torsoY + torsoH);
        ctx.closePath();
        ctx.fill();

        // Back Arm (behind torso)
        ctx.save();
        ctx.translate(-10, torsoY + 8);
        ctx.rotate(-armAngle * 0.5);
        ctx.fillStyle = this.bodyColor;
        ctx.fillRect(-4, 0, 8, armLen);
        ctx.restore();

        // Front Arm with Weapon
        ctx.save();
        ctx.translate(10, torsoY + 8);
        ctx.rotate(armAngle);
        ctx.fillStyle = this.bodyColor;
        ctx.fillRect(-4, 0, 8, armLen);

        // Weapon blade
        ctx.save();
        ctx.translate(0, armLen);
        ctx.rotate(weaponAngle);
        const bladeLen = this.weapon.range * 0.6;
        // Blade glow
        ctx.shadowColor = this.isPlayer ? '#10b981' : (this.eyeColor || '#ef4444');
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -bladeLen);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.restore();

        // Head
        const headY = torsoY - headR - 2;
        ctx.fillStyle = this.bodyColor;
        ctx.beginPath();
        ctx.arc(0, headY, headR, 0, Math.PI * 2);
        ctx.fill();

        // Glowing eyes
        ctx.fillStyle = this.eyeColor;
        ctx.shadowColor = this.eyeColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(4, headY - 2, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, headY - 2, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shadow magic aura when charged
        if (this.shadowMagicCharge >= this.maxShadowMagic) {
            ctx.globalAlpha = 0.15 + Math.sin(this.animFrame * 0.1) * 0.1;
            ctx.fillStyle = this.isPlayer ? '#10b981' : '#a855f7';
            ctx.beginPath();
            ctx.arc(0, headY + 20, 50, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
