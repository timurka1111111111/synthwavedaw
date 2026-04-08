/* ═══════════════════════════════════════
   SITE JS — cursor, reveal, canvas, burger
   ═══════════════════════════════════════ */

// ── CURSOR ──
const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursor-dot');

if (cursor && cursorDot) {
  let mx = 0, my = 0, cx = 0, cy = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursorDot.style.left = mx + 'px';
    cursorDot.style.top  = my + 'px';
  });

  // Smooth cursor lag
  function animateCursor() {
    cx += (mx - cx) * 0.15;
    cy += (my - cy) * 0.15;
    cursor.style.left = cx + 'px';
    cursor.style.top  = cy + 'px';
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  document.querySelectorAll('a, button, .project-card, .feature-card, .contact-card, .about-block').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
}

// ── SCROLL REVEAL ──
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 60);
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── HERO CANVAS PARTICLES ──
const heroCanvas = document.getElementById('hero-canvas');
if (heroCanvas) {
  const ctx = heroCanvas.getContext('2d');
  let W, H, particles = [];

  function resizeCanvas() {
    W = heroCanvas.width  = window.innerWidth;
    H = heroCanvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Particles
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 1200 - 600,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.6 + 0.1,
      color: ['#4ecdc4','#a78bfa','#ff6b6b'][Math.floor(Math.random()*3)],
    });
  }

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    const cx = W/2, cy = H/2;

    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      const px = cx + p.x, py = cy + p.y;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2,'0');
      ctx.fill();
      // Wrap
      if (Math.abs(p.x) > W) p.x = -p.x * 0.9;
      if (Math.abs(p.y) > H) p.y = -p.y * 0.9;
    });

    // Connect nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const ax = cx + a.x, ay = cy + a.y;
        const bx = cx + b.x, by = cy + b.y;
        const dist = Math.hypot(ax-bx, ay-by);
        if (dist < 120) {
          ctx.strokeStyle = `rgba(0,245,255,${(1-dist/120)*0.08})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
        }
      }
    }
    requestAnimationFrame(drawParticles);
  }
  drawParticles();
}

// ── NAV SCROLL EFFECT ──
window.addEventListener('scroll', () => {
  const nav = document.querySelector('nav');
  if (nav) {
    if (window.scrollY > 40) {
      nav.style.background = 'rgba(7,7,15,0.96)';
      nav.style.borderBottomColor = 'rgba(0,245,255,0.15)';
    } else {
      nav.style.background = 'rgba(7,7,15,0.88)';
      nav.style.borderBottomColor = 'rgba(0,245,255,0.08)';
    }
  }
});

// ── BURGER MENU ──
const burger = document.getElementById('nav-burger');
const navLinks = document.getElementById('nav-links');
if (burger && navLinks) {
  burger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
  });
  // Закрыть при клике на ссылку
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      burger.classList.remove('open');
    });
  });
  // Закрыть при клике вне меню
  document.addEventListener('click', e => {
    if (!burger.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      burger.classList.remove('open');
    }
  });
}
