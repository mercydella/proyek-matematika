/**
 * Shadow Blade: Way of the Ninja - Main Game Engine
 * 60 FPS Canvas Game Loop, Collision Detection, Particles, Shurikens,
 * Parallax Backgrounds, Slow-Motion K.O., Tournament System, and Dojo Shop.
 */

class ShadowBladeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.keys = {};
        this.mouseButtons = {};

        // Game state
        this.screen = 'menu'; // menu, dojo, battle, ko, victory, gameover
        this.tournamentIdx = 0;
        this.roundNum = 1;
        this.maxRounds = 2;
        this.playerWins = 0;
        this.enemyWins = 0;

        // Player save
        this.save = this.loadSave();

        // Fighters
        this.player = null;
        this.enemy = null;

        // Projectiles (shurikens)
        this.projectiles = [];

        // Particles (sparks, sakura, hit effects)
        this.particles = [];
        this.sakuraParticles = [];

        // Slow motion for K.O.
        this.slowMo = false;
        this.slowMoTimer = 0;
        this.slowMoFactor = 0.15;

        // Screen shake
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeIntensity = 0;

        // Combo display
        this.comboText = '';
        this.comboTextTimer = 0;

        // Floating damage texts
        this.floatingTexts = [];

        // Round announcement
        this.announcement = '';
        this.announcementTimer = 0;

        // Background parallax layers
        this.bgOffset = 0;

        // Resize
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Input bindings
        this.bindInput();

        // Generate sakura petals
        this.initSakura();

        // Start loop
        this.lastTime = performance.now();
        this.gameLoop = this.gameLoop.bind(this);
        requestAnimationFrame(this.gameLoop);
    }

    loadSave() {
        const defaults = { coins: 200, unlockedWeapons: ['katana'], selectedWeapon: 'katana', highestBoss: 0 };
        try {
            const s = localStorage.getItem('shadow_blade_save');
            if (s) return { ...defaults, ...JSON.parse(s) };
        } catch (e) {}
        return defaults;
    }

    saveSave() {
        try { localStorage.setItem('shadow_blade_save', JSON.stringify(this.save)); } catch (e) {}
    }

    resizeCanvas() {
        const maxW = 1100;
        const maxH = 550;
        const containerW = Math.min(window.innerWidth - 20, maxW);
        const containerH = Math.min(window.innerHeight - 200, maxH);
        const aspect = maxW / maxH;
        let w = containerW;
        let h = w / aspect;
        if (h > containerH) { h = containerH; w = h * aspect; }
        this.canvas.width = w;
        this.canvas.height = h;
        this.W = w;
        this.H = h;
    }

    bindInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (this.screen === 'battle' && this.player) {
                if (e.code === 'KeyJ' || e.code === 'KeyZ') this.player.attack('slash');
                if (e.code === 'KeyK' || e.code === 'KeyX') this.player.attack('kick');
                if (e.code === 'KeyL' || e.code === 'KeyC') this.player.attack('throw');
                if (e.code === 'Space' || e.code === 'KeyV') this.player.attack('magic');
                if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                    if (e.shiftKey) this.player.roll();
                }
            }

            if (this.screen === 'menu' && e.code === 'Enter') {
                this.goToDojo();
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (this.player && (e.code === 'ArrowLeft' || e.code === 'KeyA')) {
                this.player.stopBlock();
            }
        });

        // Virtual button binds (mobile/mouse)
        const vBtns = {
            'vbtn-slash': () => this.player && this.player.attack('slash'),
            'vbtn-kick': () => this.player && this.player.attack('kick'),
            'vbtn-throw': () => this.player && this.player.attack('throw'),
            'vbtn-magic': () => this.player && this.player.attack('magic'),
            'vbtn-jump': () => { if (this.player) this.keys['KeyW'] = true; setTimeout(() => this.keys['KeyW'] = false, 120); },
            'vbtn-roll': () => this.player && this.player.roll(),
            'vbtn-left': null,
            'vbtn-right': null,
        };

        Object.keys(vBtns).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === 'vbtn-left') {
                el.addEventListener('pointerdown', () => this.keys['KeyA'] = true);
                el.addEventListener('pointerup', () => this.keys['KeyA'] = false);
                el.addEventListener('pointerleave', () => this.keys['KeyA'] = false);
            } else if (id === 'vbtn-right') {
                el.addEventListener('pointerdown', () => this.keys['KeyD'] = true);
                el.addEventListener('pointerup', () => this.keys['KeyD'] = false);
                el.addEventListener('pointerleave', () => this.keys['KeyD'] = false);
            } else if (vBtns[id]) {
                el.addEventListener('pointerdown', (e) => { e.preventDefault(); vBtns[id](); });
            }
        });

        // Menu / Dojo buttons
        document.getElementById('btn-start-game')?.addEventListener('click', () => { window.shadowAudio.playClick(); this.goToDojo(); });
        document.getElementById('btn-back-menu')?.addEventListener('click', () => { window.shadowAudio.playClick(); this.screen = 'menu'; this.showUI('menu'); });
        document.getElementById('btn-fight')?.addEventListener('click', () => { window.shadowAudio.playClick(); this.startBattle(); });
        document.getElementById('btn-next-round')?.addEventListener('click', () => { window.shadowAudio.playClick(); this.nextRound(); });
        document.getElementById('btn-next-boss')?.addEventListener('click', () => { window.shadowAudio.playClick(); this.nextBoss(); });
        document.getElementById('btn-retry')?.addEventListener('click', () => { window.shadowAudio.playClick(); this.retryBattle(); });
        document.getElementById('btn-back-dojo')?.addEventListener('click', () => { window.shadowAudio.playClick(); this.goToDojo(); });

        // Audio toggles
        document.getElementById('btn-toggle-sfx')?.addEventListener('click', () => {
            const on = window.shadowAudio.toggleSFX();
            document.getElementById('btn-toggle-sfx').textContent = on ? '🔊 SFX' : '🔇 Mute';
        });
        document.getElementById('btn-toggle-bgm')?.addEventListener('click', () => {
            const on = window.shadowAudio.toggleMusic();
            document.getElementById('btn-toggle-bgm').textContent = on ? '🎵 BGM' : '🎵 Off';
        });
    }

    showUI(screenName) {
        document.querySelectorAll('.ui-screen').forEach(el => el.classList.remove('active'));
        const el = document.getElementById('ui-' + screenName);
        if (el) el.classList.add('active');
    }

    goToDojo() {
        this.screen = 'dojo';
        this.showUI('dojo');
        this.renderDojoUI();
        window.shadowAudio.startBGM();
    }

    renderDojoUI() {
        const bossInfo = BOSSES[this.tournamentIdx] || BOSSES[0];
        document.getElementById('dojo-boss-name').textContent = bossInfo.name;
        document.getElementById('dojo-boss-title').textContent = bossInfo.title;
        document.getElementById('dojo-boss-hp').textContent = `${bossInfo.hp} HP`;
        document.getElementById('dojo-coins').textContent = `🪙 ${this.save.coins}`;
        document.getElementById('dojo-stage').textContent = `Babak ${this.tournamentIdx + 1} / ${BOSSES.length}`;

        // Render weapon cards
        const grid = document.getElementById('dojo-weapons-grid');
        if (!grid) return;
        grid.innerHTML = '';
        Object.keys(WEAPONS).forEach(key => {
            const w = WEAPONS[key];
            const unlocked = this.save.unlockedWeapons.includes(key);
            const selected = this.save.selectedWeapon === key;
            const card = document.createElement('div');
            card.className = `weapon-card ${selected ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`;
            card.innerHTML = `
                <div class="weapon-icon">${w.icon}</div>
                <div class="weapon-name">${w.name}</div>
                <div class="weapon-stats">
                    <span>⚔️ ${w.damage}</span>
                    <span>📏 ${w.range}</span>
                    <span>⚡ ${w.speed.toFixed(1)}x</span>
                </div>
                ${!unlocked ? `<button class="btn-buy-weapon" data-key="${key}">Beli 🪙${w.cost}</button>` : (selected ? '<div class="weapon-selected-tag">✔ Dipilih</div>' : `<button class="btn-select-weapon" data-key="${key}">Pilih</button>`)}
            `;
            grid.appendChild(card);
        });

        // Buy / Select binds
        grid.querySelectorAll('.btn-buy-weapon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.target.dataset.key;
                const w = WEAPONS[key];
                if (this.save.coins >= w.cost) {
                    this.save.coins -= w.cost;
                    this.save.unlockedWeapons.push(key);
                    this.save.selectedWeapon = key;
                    this.saveSave();
                    window.shadowAudio.playClick();
                    this.renderDojoUI();
                } else {
                    alert('Koin tidak cukup! Menangkan lebih banyak pertarungan.');
                }
            });
        });
        grid.querySelectorAll('.btn-select-weapon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.save.selectedWeapon = e.target.dataset.key;
                this.saveSave();
                window.shadowAudio.playClick();
                this.renderDojoUI();
            });
        });
    }

    startBattle() {
        this.screen = 'battle';
        this.showUI('battle');
        this.roundNum = 1;
        this.playerWins = 0;
        this.enemyWins = 0;
        this.projectiles = [];
        this.particles = [];
        this.floatingTexts = [];
        this.slowMo = false;

        const groundY = this.H * GROUND_Y_RATIO;
        this.player = new Fighter(this.W * 0.25, groundY, 1, true, this.W, this.H, this.save.selectedWeapon);
        this.player.eyeColor = '#10b981';

        const bossData = BOSSES[this.tournamentIdx];
        this.enemy = new Fighter(this.W * 0.75, groundY, -1, false, this.W, this.H, bossData.weapon);
        this.enemy.maxHp = bossData.hp;
        this.enemy.hp = bossData.hp;
        this.enemy.eyeColor = bossData.eyeColor;
        this.enemy.aggression = bossData.aggression;

        this.showAnnouncement(`RONDE ${this.roundNum}`, 90);
        window.shadowAudio.playGong();
        window.shadowAudio.startBGM();

        this.updateHUD();
    }

    nextRound() {
        this.roundNum++;
        this.projectiles = [];
        this.particles = [];
        this.floatingTexts = [];
        this.slowMo = false;
        this.screen = 'battle';
        this.showUI('battle');

        const groundY = this.H * GROUND_Y_RATIO;
        this.player.x = this.W * 0.25;
        this.player.y = groundY;
        this.player.hp = this.player.maxHp;
        this.player.state = 'idle';
        this.player.stateTimer = 0;
        this.player.shurikens = 5;
        this.player.vx = 0; this.player.vy = 0;

        this.enemy.x = this.W * 0.75;
        this.enemy.y = groundY;
        this.enemy.hp = this.enemy.maxHp;
        this.enemy.state = 'idle';
        this.enemy.stateTimer = 0;
        this.enemy.shurikens = 5;
        this.enemy.vx = 0; this.enemy.vy = 0;

        this.showAnnouncement(`RONDE ${this.roundNum}`, 90);
        window.shadowAudio.playGong();
        this.updateHUD();
    }

    nextBoss() {
        this.tournamentIdx++;
        if (this.tournamentIdx >= BOSSES.length) {
            this.tournamentIdx = 0; // Loop
            alert('🏆 Selamat! Anda telah menaklukkan semua pendekar bayangan! Turnamen diulang dengan level awal.');
        }
        if (this.tournamentIdx > this.save.highestBoss) {
            this.save.highestBoss = this.tournamentIdx;
        }
        this.saveSave();
        this.goToDojo();
    }

    retryBattle() {
        this.startBattle();
    }

    showAnnouncement(text, duration) {
        this.announcement = text;
        this.announcementTimer = duration;
    }

    addFloatingText(x, y, text, color) {
        this.floatingTexts.push({ x, y, text, color, timer: 50, vy: -2 });
    }

    spawnSparks(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.7) * 10,
                size: 2 + Math.random() * 4,
                color: color || '#fbbf24',
                alpha: 1,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    initSakura() {
        this.sakuraParticles = [];
        for (let i = 0; i < 30; i++) {
            this.sakuraParticles.push({
                x: Math.random() * 1200,
                y: Math.random() * 600,
                size: 3 + Math.random() * 5,
                speedX: 0.3 + Math.random() * 0.8,
                speedY: 0.2 + Math.random() * 0.5,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.04,
                alpha: 0.3 + Math.random() * 0.5
            });
        }
    }

    screenShake(intensity) {
        this.shakeIntensity = intensity;
    }

    updateHUD() {
        const playerHpBar = document.getElementById('hud-player-hp');
        const enemyHpBar = document.getElementById('hud-enemy-hp');
        const playerHpText = document.getElementById('hud-player-hp-text');
        const enemyHpText = document.getElementById('hud-enemy-hp-text');
        const playerMagicBar = document.getElementById('hud-player-magic');
        const enemyMagicBar = document.getElementById('hud-enemy-magic');
        const roundDisplay = document.getElementById('hud-round');
        const scoreDisplay = document.getElementById('hud-score');
        const enemyName = document.getElementById('hud-enemy-name');

        if (this.player) {
            const pp = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
            if (playerHpBar) playerHpBar.style.width = `${pp}%`;
            if (playerHpText) playerHpText.textContent = `${Math.max(0, this.player.hp)} HP`;
            if (playerMagicBar) playerMagicBar.style.width = `${(this.player.shadowMagicCharge / this.player.maxShadowMagic) * 100}%`;
        }
        if (this.enemy) {
            const ep = Math.max(0, (this.enemy.hp / this.enemy.maxHp) * 100);
            if (enemyHpBar) enemyHpBar.style.width = `${ep}%`;
            if (enemyHpText) enemyHpText.textContent = `${Math.max(0, this.enemy.hp)} HP`;
            if (enemyMagicBar) enemyMagicBar.style.width = `${(this.enemy.shadowMagicCharge / this.enemy.maxShadowMagic) * 100}%`;
            const bossData = BOSSES[this.tournamentIdx];
            if (enemyName) enemyName.textContent = bossData ? bossData.name : 'Enemy';
        }
        if (roundDisplay) roundDisplay.textContent = `Ronde ${this.roundNum}`;
        if (scoreDisplay) scoreDisplay.textContent = `${this.playerWins} - ${this.enemyWins}`;
    }

    // ---- MAIN GAME LOOP ----
    gameLoop(timestamp) {
        const dt = Math.min(timestamp - this.lastTime, 33);
        this.lastTime = timestamp;

        // Slow motion factor
        const speedFactor = this.slowMo ? this.slowMoFactor : 1;

        this.ctx.clearRect(0, 0, this.W, this.H);

        // Screen shake offset
        if (this.shakeIntensity > 0) {
            this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9;
            if (this.shakeIntensity < 0.5) { this.shakeIntensity = 0; this.shakeX = 0; this.shakeY = 0; }
        }
        this.ctx.save();
        this.ctx.translate(this.shakeX, this.shakeY);

        // Draw background (all screens)
        this.drawBackground();

        // Battle logic
        if (this.screen === 'battle' || this.screen === 'ko') {
            // Slow-mo timer
            if (this.slowMo) {
                this.slowMoTimer--;
                if (this.slowMoTimer <= 0) {
                    this.slowMo = false;
                    this.handleRoundEnd();
                }
            }

            // Update fighters
            if (this.player && this.player.state !== 'ko') {
                this.player.canvasW = this.W;
                this.player.canvasH = this.H;
                this.player.update(this.keys, this.enemy);
            } else if (this.player) {
                this.player.animFrame++;
            }

            if (this.enemy && this.enemy.state !== 'ko') {
                this.enemy.canvasW = this.W;
                this.enemy.canvasH = this.H;
                this.enemy.updateAI(this.player);
                this.enemy.update({}, this.player);
            } else if (this.enemy) {
                this.enemy.animFrame++;
            }

            // Attack collision detection
            this.checkAttackCollisions(this.player, this.enemy);
            this.checkAttackCollisions(this.enemy, this.player);

            // Projectile updates
            this.updateProjectiles();

            // Check for shuriken throw
            if (this.player && this.player.state === 'throw' && !this.player.attackDealt && this.player.stateTimer <= 12) {
                this.player.attackDealt = true;
                this.projectiles.push({
                    x: this.player.x + this.player.facing * 25,
                    y: this.player.y - this.player.h * 0.6,
                    vx: this.player.facing * 14,
                    owner: 'player',
                    damage: 12,
                    size: 8,
                    rot: 0
                });
            }
            if (this.enemy && this.enemy.state === 'throw' && !this.enemy.attackDealt && this.enemy.stateTimer <= 12) {
                this.enemy.attackDealt = true;
                this.projectiles.push({
                    x: this.enemy.x + this.enemy.facing * 25,
                    y: this.enemy.y - this.enemy.h * 0.6,
                    vx: this.enemy.facing * 12,
                    owner: 'enemy',
                    damage: 10,
                    size: 8,
                    rot: 0
                });
            }

            // Check K.O.
            if (!this.slowMo) {
                if (this.player && this.player.hp <= 0 && this.player.state === 'ko') {
                    this.triggerSlowMoKO();
                }
                if (this.enemy && this.enemy.hp <= 0 && this.enemy.state === 'ko') {
                    this.triggerSlowMoKO();
                }
            }

            // Draw fighters
            if (this.enemy) this.enemy.draw(this.ctx);
            if (this.player) this.player.draw(this.ctx);

            // Draw projectiles
            this.drawProjectiles();

            // Draw HUD
            this.updateHUD();
        }

        // Update & draw particles (sparks)
        this.updateParticles();
        this.drawParticles();

        // Draw sakura (always visible)
        this.updateSakura();
        this.drawSakura();

        // Floating texts
        this.drawFloatingTexts();

        // Announcement overlay
        if (this.announcementTimer > 0) {
            this.announcementTimer--;
            const alpha = Math.min(1, this.announcementTimer / 20);
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `bold ${this.W * 0.07}px 'Outfit', sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = '#f59e0b';
            this.ctx.shadowBlur = 20;
            this.ctx.fillText(this.announcement, this.W / 2, this.H * 0.4);
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1;
        }

        // Slow-mo visual filter
        if (this.slowMo) {
            this.ctx.fillStyle = 'rgba(10, 10, 20, 0.2)';
            this.ctx.fillRect(0, 0, this.W, this.H);
        }

        this.ctx.restore();
        requestAnimationFrame(this.gameLoop);
    }

    checkAttackCollisions(attacker, defender) {
        if (!attacker || !defender) return;
        if (attacker.attackDealt) return;
        if (defender.state === 'ko') return;

        const atkBox = attacker.getAttackHitbox();
        if (!atkBox) return;

        const defBox = defender.getHitbox();

        // AABB collision
        if (atkBox.x < defBox.x + defBox.w &&
            atkBox.x + atkBox.w > defBox.x &&
            atkBox.y < defBox.y + defBox.h &&
            atkBox.y + atkBox.h > defBox.y) {

            attacker.attackDealt = true;
            const dmg = defender.takeDamage(attacker.attackDamage, attacker.x);

            // Charge attacker magic
            attacker.shadowMagicCharge = Math.min(attacker.maxShadowMagic, attacker.shadowMagicCharge + Math.floor(dmg * 0.5));

            // Visual & Audio FX
            const hitX = (attacker.x + defender.x) / 2;
            const hitY = defender.y - defender.h * 0.5;
            this.spawnSparks(hitX, hitY, 12, '#fbbf24');
            this.screenShake(attacker.state === 'magic' ? 12 : 6);

            if (attacker.state === 'slash') {
                window.shadowAudio.playSwordClang();
            }

            // Combo text
            if (attacker.comboCount > 1) {
                this.comboText = `COMBO x${attacker.comboCount}!`;
                this.comboTextTimer = 45;
            }
            if (attacker.state === 'magic') {
                this.addFloatingText(hitX, hitY - 20, '💥 SHADOW MAGIC!', '#a855f7');
            } else if (dmg > 20) {
                this.addFloatingText(hitX, hitY - 20, `CRITICAL! -${dmg}`, '#ef4444');
            } else {
                this.addFloatingText(hitX, hitY - 20, `-${dmg}`, '#ffffff');
            }
        }
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.rot += 0.3;

            // Off-screen removal
            if (p.x < -20 || p.x > this.W + 20) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Hit detection
            const target = p.owner === 'player' ? this.enemy : this.player;
            if (!target || target.state === 'ko') continue;

            const tBox = target.getHitbox();
            if (p.x > tBox.x && p.x < tBox.x + tBox.w && p.y > tBox.y && p.y < tBox.y + tBox.h) {
                target.takeDamage(p.damage, p.x);
                this.spawnSparks(p.x, p.y, 8, '#38bdf8');
                this.screenShake(4);
                this.addFloatingText(p.x, p.y - 15, `-${p.damage}`, '#38bdf8');
                window.shadowAudio.playShurikenHit();
                this.projectiles.splice(i, 1);
            }
        }
    }

    drawProjectiles() {
        this.projectiles.forEach(p => {
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rot);
            // Shuriken star shape
            this.ctx.fillStyle = '#94a3b8';
            this.ctx.shadowColor = '#38bdf8';
            this.ctx.shadowBlur = 6;
            const s = p.size;
            for (let i = 0; i < 4; i++) {
                this.ctx.save();
                this.ctx.rotate((Math.PI / 2) * i);
                this.ctx.fillRect(-1, -s, 2, s * 2);
                this.ctx.restore();
            }
            this.ctx.shadowBlur = 0;
            this.ctx.restore();
        });
    }

    triggerSlowMoKO() {
        this.slowMo = true;
        this.slowMoTimer = 60;
        this.screen = 'ko';
        const winner = this.player.hp > 0 ? 'player' : 'enemy';
        this.showAnnouncement(winner === 'player' ? 'K.O.!' : 'KALAH!', 60);
        const loser = winner === 'player' ? this.enemy : this.player;
        this.spawnSparks(loser.x, loser.y - loser.h * 0.5, 40, winner === 'player' ? '#10b981' : '#ef4444');
    }

    handleRoundEnd() {
        if (this.player.hp > 0) {
            this.playerWins++;
        } else {
            this.enemyWins++;
        }

        // Check match winner
        const needed = Math.ceil(this.maxRounds / 2) + (this.maxRounds % 2 === 0 ? 1 : 0);

        if (this.playerWins >= 2) {
            // Player wins the match!
            this.screen = 'victory';
            this.showUI('victory');
            const bossData = BOSSES[this.tournamentIdx];
            const coins = 100 + this.tournamentIdx * 50;
            this.save.coins += coins;
            this.saveSave();
            document.getElementById('victory-title').textContent = `⚔️ ${bossData.name} Dikalahkan!`;
            document.getElementById('victory-coins').textContent = `+${coins} Koin Emas`;
            window.shadowAudio.playVictory();
        } else if (this.enemyWins >= 2) {
            // Player loses
            this.screen = 'gameover';
            this.showUI('gameover');
        } else {
            // Next round
            this.screen = 'battle';
            this.showUI('roundend');
            document.getElementById('roundend-score').textContent = `${this.playerWins} - ${this.enemyWins}`;
        }
    }

    // --- PARTICLE SYSTEMS ---
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.25;
            p.alpha -= p.decay;
            if (p.alpha <= 0) this.particles.splice(i, 1);
        }
    }

    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }

    updateSakura() {
        this.sakuraParticles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            p.rot += p.rotSpeed;
            if (p.x > this.W + 20) { p.x = -10; p.y = Math.random() * this.H; }
            if (p.y > this.H + 20) { p.y = -10; p.x = Math.random() * this.W; }
        });
    }

    drawSakura() {
        this.sakuraParticles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rot);
            this.ctx.fillStyle = '#f9a8d4';
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    drawFloatingTexts() {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy;
            ft.timer--;
            if (ft.timer <= 0) { this.floatingTexts.splice(i, 1); continue; }
            this.ctx.globalAlpha = Math.min(1, ft.timer / 15);
            this.ctx.fillStyle = ft.color;
            this.ctx.font = `bold ${this.W * 0.028}px 'Outfit', sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = '#000';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText(ft.text, ft.x, ft.y);
            this.ctx.shadowBlur = 0;
        }
        this.ctx.globalAlpha = 1;

        // Combo badge
        if (this.comboTextTimer > 0) {
            this.comboTextTimer--;
            this.ctx.globalAlpha = Math.min(1, this.comboTextTimer / 10);
            this.ctx.fillStyle = '#f59e0b';
            this.ctx.font = `bold ${this.W * 0.04}px 'Outfit', sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = '#ef4444';
            this.ctx.shadowBlur = 15;
            this.ctx.fillText(this.comboText, this.W * 0.5, this.H * 0.22);
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1;
        }
    }

    // --- PARALLAX BACKGROUND ---
    drawBackground() {
        const c = this.ctx;
        const W = this.W;
        const H = this.H;

        // Crimson sky gradient
        const skyGrad = c.createLinearGradient(0, 0, 0, H * 0.7);
        skyGrad.addColorStop(0, '#1a0a1e');
        skyGrad.addColorStop(0.3, '#3b0a2e');
        skyGrad.addColorStop(0.6, '#7c1d3e');
        skyGrad.addColorStop(1, '#c4462a');
        c.fillStyle = skyGrad;
        c.fillRect(0, 0, W, H);

        // Blood moon / sun glow
        const sunX = W * 0.78;
        const sunY = H * 0.2;
        const sunGrad = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 100);
        sunGrad.addColorStop(0, 'rgba(255, 200, 100, 0.8)');
        sunGrad.addColorStop(0.3, 'rgba(255, 100, 50, 0.4)');
        sunGrad.addColorStop(1, 'rgba(255, 50, 30, 0)');
        c.fillStyle = sunGrad;
        c.fillRect(sunX - 100, sunY - 100, 200, 200);

        // Mountains silhouette (back layer)
        c.fillStyle = '#1a0a14';
        c.beginPath();
        c.moveTo(0, H * 0.55);
        c.lineTo(W * 0.1, H * 0.35);
        c.lineTo(W * 0.25, H * 0.45);
        c.lineTo(W * 0.4, H * 0.28);
        c.lineTo(W * 0.55, H * 0.42);
        c.lineTo(W * 0.7, H * 0.32);
        c.lineTo(W * 0.85, H * 0.38);
        c.lineTo(W, H * 0.48);
        c.lineTo(W, H);
        c.lineTo(0, H);
        c.closePath();
        c.fill();

        // Torii gate silhouette
        const tX = W * 0.5;
        const tY = H * 0.5;
        c.fillStyle = '#0d0612';
        // Main pillars
        c.fillRect(tX - 50, tY - 50, 8, 90);
        c.fillRect(tX + 42, tY - 50, 8, 90);
        // Top beam
        c.fillRect(tX - 60, tY - 55, 120, 8);
        // Second beam
        c.fillRect(tX - 55, tY - 42, 110, 6);

        // Pagoda silhouette (right)
        c.fillStyle = '#0d0612';
        const pX = W * 0.82;
        const pY = H * 0.5;
        for (let i = 0; i < 3; i++) {
            const bw = 35 - i * 8;
            const by = pY - i * 22;
            c.fillRect(pX - bw, by - 5, bw * 2, 6);
            c.fillRect(pX - bw + 5, by + 1, bw * 2 - 10, 18);
        }

        // Ground plane
        const groundY = H * GROUND_Y_RATIO;
        const groundGrad = c.createLinearGradient(0, groundY, 0, H);
        groundGrad.addColorStop(0, '#0e0812');
        groundGrad.addColorStop(1, '#060408');
        c.fillStyle = groundGrad;
        c.fillRect(0, groundY, W, H - groundY);

        // Ground line accent
        c.strokeStyle = 'rgba(255, 160, 80, 0.2)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(0, groundY);
        c.lineTo(W, groundY);
        c.stroke();
    }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new ShadowBladeGame();
});
