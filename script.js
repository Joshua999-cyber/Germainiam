// Pixel Shooter - simple canvas shooter with pixel scaling
(() => {
  const canvas = document.getElementById('game');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const startBtn = document.getElementById('start');

  // Logical resolution (keeps pixels crisp). The canvas will be scaled via CSS.
  const LOGICAL_W = 96;
  const LOGICAL_H = 128;
  const SCALE = 3; // displayed size multiplier

  canvas.width = LOGICAL_W;
  canvas.height = LOGICAL_H;
  canvas.style.width = LOGICAL_W * SCALE + 'px';
  canvas.style.height = LOGICAL_H * SCALE + 'px';

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Game state
  let player, bullets, enemies, lastSpawn, score, lives, keys, running, lastFrame;

  // Touch / on-screen controls state
  const controls = { left: false, right: false, up: false, down: false, shoot: false };

  function reset() {
    player = { x: Math.floor(LOGICAL_W / 2), y: LOGICAL_H - 12, w: 7, h: 6, cooldown: 0 };
    bullets = [];
    enemies = [];
    lastSpawn = 0;
    score = 0;
    lives = 3;
    keys = {};
    running = false;
    updateHUD();
  }

  function start() {
    reset();
    running = true;
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  function updateHUD() {
    scoreEl.textContent = 'Score: ' + score;
    livesEl.textContent = 'Lives: ' + lives;
  }

  // Controls
  window.addEventListener('keydown', e => { keys[e.code] = true; if (['Space','ArrowUp','KeyW'].includes(e.code)) e.preventDefault(); });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  startBtn.addEventListener('click', () => start());

  // Bind on-screen control buttons (pointer events for mouse & touch)
  function bindControlButton(selector, name) {
    const el = document.querySelector(selector);
    if (!el) return;
    const down = (e) => { e.preventDefault(); controls[name] = true; };
    const up = (e) => { e.preventDefault(); controls[name] = false; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // also prevent ghost clicks on touch
    el.addEventListener('click', e => e.preventDefault());
  }

  bindControlButton('#btn-left', 'left');
  bindControlButton('#btn-right', 'right');
  bindControlButton('#btn-up', 'up');
  bindControlButton('#btn-down', 'down');
  bindControlButton('#btn-shoot', 'shoot');

  // Entities helpers
  function spawnEnemy() {
    // enemy shapes: simple 1-3 block wide ships
    const w = Math.random() < 0.2 ? 6 : (Math.random() < 0.5 ? 4 : 3);
    const x = Math.floor(Math.random() * (LOGICAL_W - w - 2)) + 1;
    const speed = 0.25 + Math.random() * 0.6;
    enemies.push({ x, y: -8, w, h: 6, speed, hp: w > 4 ? 2 : 1 });
  }

  function fire() {
    if (player.cooldown > 0) return;
    bullets.push({ x: player.x + Math.floor(player.w / 2), y: player.y - 2, vy: -3, from: 'player' });
    player.cooldown = 14; // frames
  }

  function rectsOverlap(a, b) {
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }

  function loop(now) {
    const dt = Math.min(40, now - lastFrame); // ms
    lastFrame = now;

    if (!running) { draw(); return; }

    // Input (keyboard OR on-screen controls)
    const left = keys['ArrowLeft'] || keys['KeyA'] || controls.left;
    const right = keys['ArrowRight'] || keys['KeyD'] || controls.right;
    const up = keys['ArrowUp'] || keys['KeyW'] || controls.up;
    const down = keys['ArrowDown'] || keys['KeyS'] || controls.down;
    const shoot = keys['Space'] || controls.shoot;

    if (left) player.x -= (1.5 * dt / 16);
    if (right) player.x += (1.5 * dt / 16);
    if (up) player.y -= (1 * dt / 16);
    if (down) player.y += (1 * dt / 16);

    // clamp
    player.x = Math.max(1, Math.min(LOGICAL_W - player.w - 1, player.x));
    player.y = Math.max( LOGICAL_H/2, Math.min(LOGICAL_H - player.h - 1, player.y));

    if (shoot) fire();
    if (player.cooldown > 0) player.cooldown--;

    // Spawn enemies
    lastSpawn += dt;
    if (lastSpawn > 700 - Math.min(500, score * 3)) {
      spawnEnemy();
      lastSpawn = 0;
    }

    // Move bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy * (dt / 16);
      if (b.y < -10 || b.y > LOGICAL_H + 10) bullets.splice(i, 1);
    }

    // Move enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.speed * (dt / 16) * 2;
      // enemy shooting (rare)
      if (Math.random() < 0.002) {
        bullets.push({ x: e.x + Math.floor(e.w / 2), y: e.y + e.h + 1, vy: 2, from: 'enemy' });
      }
      if (e.y > LOGICAL_H + 10) {
        enemies.splice(i, 1);
        // lose a life when an enemy passes
        lives--;
        updateHUD();
        if (lives <= 0) { running = false; }
      }
    }

    // Collisions: bullets <-> enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.from !== 'player') continue;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (rectsOverlap({ x: b.x - 1, y: b.y - 2, w: 2, h: 4 }, { x: e.x, y: e.y, w: e.w, h: e.h })) {
          bullets.splice(i, 1);
          e.hp--;
          if (e.hp <= 0) {
            enemies.splice(j, 1);
            score += 10;
            updateHUD();
          }
          break;
        }
      }
    }

    // Collisions: enemy bullets or enemies <-> player
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.from === 'enemy') {
        if (rectsOverlap({ x: b.x - 1, y: b.y - 2, w: 2, h: 4 }, { x: player.x, y: player.y, w: player.w, h: player.h })) {
          bullets.splice(i, 1);
          lives--;
          updateHUD();
          if (lives <= 0) running = false;
        }
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (rectsOverlap(e, player)) {
        enemies.splice(i, 1);
        lives--;
        updateHUD();
        if (lives <= 0) running = false;
      }
    }

    draw();
    if (running) requestAnimationFrame(loop);
  }

  function clearScreen() {
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function draw() {
    clearScreen();

    // stars background (simple)
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#2b3a4a' : '#0f2030';
      ctx.fillRect((i * 7) % LOGICAL_W, (i * 13) % LOGICAL_H, 1, 1);
    }

    // player
    drawPixelRect(player.x, player.y, player.w, player.h, '#66ffcc');
    // small cockpit
    drawPixelRect(player.x + 2, player.y - 2, 3, 2, '#33cc99');

    // bullets
    bullets.forEach(b => {
      ctx.fillStyle = b.from === 'player' ? '#fff1a8' : '#ff9a9a';
      ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 3);
    });

    // enemies
    enemies.forEach(e => {
      ctx.fillStyle = e.hp > 1 ? '#ffcc66' : '#ff6666';
      ctx.fillRect(Math.round(e.x), Math.round(e.y), e.w, e.h);
      // tiny detail
      ctx.fillStyle = '#220';
      ctx.fillRect(Math.round(e.x + 1), Math.round(e.y + 1), Math.max(1, e.w - 2), 2);
    });

    // overlays
    if (!running) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, LOGICAL_H / 2 - 18, LOGICAL_W, 36);
      ctx.fillStyle = '#fff';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PRESS START TO PLAY', LOGICAL_W / 2, LOGICAL_H / 2 + 2);
      ctx.fillText('SCORE: ' + score + '  LIVES: ' + lives, LOGICAL_W / 2, LOGICAL_H / 2 + 12);
    }
  }

  // Start paused
  reset();
  draw();

  // Expose for debugging in console
  window.__pixelShooter = { start, reset, state: () => ({ score, lives, enemies: enemies.length }), controls };
})();
