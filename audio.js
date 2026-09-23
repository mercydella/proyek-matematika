/**
 * Shadow Blade Audio Engine - Web Audio API Synthesizer
 * Martial Arts Combat SFX: Steel Clang, Thuds, Whooshes, Taiko Drums
 */
class ShadowAudio {
    constructor() {
        this.ctx = null;
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.musicGain = null;
        this.musicNodes = [];
        this.masterVol = 0.6;
        this._initOnGesture();
    }

    _initOnGesture() {
        const unlock = () => {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = 0.12;
                this.musicGain.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
            window.removeEventListener('click', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
    }

    _ensure() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.12;
            this.musicGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    _tone(freq, type, dur, vol, bend) {
        if (!this.sfxEnabled) return;
        this._ensure();
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (bend) o.frequency.exponentialRampToValueAtTime(bend, t + dur);
        g.gain.setValueAtTime(vol * this.masterVol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + dur);
    }

    _noise(dur, vol, lpFreq, hpFreq) {
        if (!this.sfxEnabled) return;
        this._ensure();
        const sr = this.ctx.sampleRate;
        const len = sr * dur;
        const buf = this.ctx.createBuffer(1, len, sr);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        const t = this.ctx.currentTime;
        g.gain.setValueAtTime(vol * this.masterVol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let chain = src;
        if (hpFreq) {
            const hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass'; hp.frequency.value = hpFreq;
            chain.connect(hp); chain = hp;
        }
        if (lpFreq) {
            const lp = this.ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = lpFreq;
            chain.connect(lp); chain = lp;
        }
        chain.connect(g); g.connect(this.ctx.destination);
        src.start(t); src.stop(t + dur);
    }

    // Steel sword clang
    playSwordClang() {
        this._tone(1800, 'square', 0.08, 0.12, 600);
        this._tone(2400, 'sine', 0.15, 0.06, 800);
        this._noise(0.06, 0.15, 4000, 1500);
    }

    // Sword slash whoosh
    playSlashWhoosh() {
        this._noise(0.12, 0.1, 2500, 800);
        this._tone(600, 'sawtooth', 0.1, 0.04, 150);
    }

    // Heavy punch/kick thud
    playHeavyHit() {
        this._tone(80, 'sine', 0.18, 0.2, 30);
        this._noise(0.08, 0.12, 400, 60);
    }

    // Light punch
    playLightHit() {
        this._tone(200, 'triangle', 0.08, 0.1, 80);
        this._noise(0.05, 0.06, 600, 200);
    }

    // Kick impact
    playKickHit() {
        this._tone(120, 'sine', 0.15, 0.18, 40);
        this._tone(350, 'sawtooth', 0.06, 0.05, 100);
        this._noise(0.07, 0.1, 500, 100);
    }

    // Shuriken throw whoosh
    playShurikenThrow() {
        this._tone(1200, 'sine', 0.15, 0.06, 2400);
        this._noise(0.1, 0.04, 3000, 1200);
    }

    // Shuriken hit
    playShurikenHit() {
        this._tone(2000, 'square', 0.04, 0.08, 800);
        this._noise(0.03, 0.06, 5000, 2000);
    }

    // Shadow magic burst
    playShadowMagic() {
        this._ensure();
        const t = this.ctx.currentTime;
        [100, 150, 200, 300].forEach((f, i) => {
            setTimeout(() => {
                this._tone(f, 'sawtooth', 0.4, 0.12, f * 3);
                this._noise(0.3, 0.08, 800, 50);
            }, i * 60);
        });
    }

    // Block / parry
    playBlock() {
        this._tone(400, 'square', 0.05, 0.08, 200);
        this._noise(0.04, 0.06, 2000, 600);
    }

    // Fighter grunt (randomized)
    playGrunt() {
        const base = 100 + Math.random() * 60;
        this._tone(base, 'sawtooth', 0.12, 0.06, base * 0.5);
    }

    // K.O. dramatic impact
    playKO() {
        this._ensure();
        this._tone(60, 'sine', 0.5, 0.25, 20);
        this._noise(0.3, 0.15, 300, 30);
        setTimeout(() => {
            this._tone(800, 'sine', 0.8, 0.08, 200);
        }, 200);
    }

    // Round start gong
    playGong() {
        this._ensure();
        const freqs = [220, 330, 440, 550];
        freqs.forEach((f, i) => {
            const t = this.ctx.currentTime;
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(f, t);
            g.gain.setValueAtTime((0.08 / (i + 1)) * this.masterVol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
            o.connect(g); g.connect(this.ctx.destination);
            o.start(t); o.stop(t + 2.5);
        });
    }

    // UI click
    playClick() {
        this._tone(700, 'triangle', 0.04, 0.06, 350);
    }

    // Victory fanfare
    playVictory() {
        const notes = [
            { f: 440, d: 0.15, t: 0 }, { f: 440, d: 0.15, t: 120 },
            { f: 440, d: 0.15, t: 240 }, { f: 554, d: 0.35, t: 400 },
            { f: 494, d: 0.15, t: 800 }, { f: 660, d: 0.5, t: 960 }
        ];
        notes.forEach(n => {
            setTimeout(() => this._tone(n.f, 'triangle', n.d, 0.12), n.t);
        });
    }

    // Background Taiko-style rhythmic loop
    startBGM() {
        if (!this.musicEnabled) return;
        this._ensure();
        if (this._bgmLoop) return;
        let step = 0;
        const pattern = [1, 0, 0, 0.5, 0, 1, 0, 0.5]; // taiko pattern
        this._bgmLoop = setInterval(() => {
            if (!this.musicEnabled || !this.ctx) return;
            const vol = pattern[step % pattern.length];
            if (vol > 0) {
                const t = this.ctx.currentTime;
                // Taiko drum hit
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(80, t);
                o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
                g.gain.setValueAtTime(0.06 * vol * this.masterVol, t);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
                o.connect(g); g.connect(this.musicGain);
                o.start(t); o.stop(t + 0.2);
                // Noise hit
                const sr = this.ctx.sampleRate;
                const buf = this.ctx.createBuffer(1, sr * 0.08, sr);
                const d = buf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
                const ns = this.ctx.createBufferSource();
                ns.buffer = buf;
                const ng = this.ctx.createGain();
                ng.gain.setValueAtTime(0.03 * vol * this.masterVol, t);
                ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
                const lp = this.ctx.createBiquadFilter();
                lp.type = 'lowpass'; lp.frequency.value = 500;
                ns.connect(lp); lp.connect(ng); ng.connect(this.musicGain);
                ns.start(t); ns.stop(t + 0.08);
            }
            // Atmospheric drone
            if (step % 16 === 0) {
                const t = this.ctx.currentTime;
                const dr = this.ctx.createOscillator();
                const dg = this.ctx.createGain();
                dr.type = 'sine';
                dr.frequency.value = 55;
                dg.gain.setValueAtTime(0.03 * this.masterVol, t);
                dg.gain.exponentialRampToValueAtTime(0.0001, t + 3);
                dr.connect(dg); dg.connect(this.musicGain);
                dr.start(t); dr.stop(t + 3);
            }
            step++;
        }, 280);
    }

    stopBGM() {
        if (this._bgmLoop) { clearInterval(this._bgmLoop); this._bgmLoop = null; }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) this.stopBGM(); else this.startBGM();
        return this.musicEnabled;
    }
    toggleSFX() {
        this.sfxEnabled = !this.sfxEnabled;
        return this.sfxEnabled;
    }
}
window.shadowAudio = new ShadowAudio();
