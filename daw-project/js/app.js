/* ═══════════════════════════════════════
   APP v2 — Entry Point
   ═══════════════════════════════════════ */

window.addEventListener('DOMContentLoaded', () => {
  runSplash(async () => {
    splashMsg('Initializing audio engine...');    await delay(200);
    AudioEngine.init();
    splashMsg('Building sequencer...');           await delay(150);
    Sequencer.init();
    splashMsg('Loading mixer...');                await delay(100);
    Mixer.init(Sequencer.getTracks());
    splashMsg('Starting visualizer...');          await delay(100);
    Visualizer.init();
    splashMsg('Setting up export module...');     await delay(100);
    Exporter.init();
    splashMsg('Loading project manager...');      await delay(100);
    Project.init();
    splashMsg('Initializing arpeggiator...');     await delay(100);
    Arpeggiator.init();
    splashMsg('Setting up scene manager...');     await delay(100);
    Patterns.init();
    splashMsg('Building synth UI...');            await delay(100);
    SynthUI.init();
    splashMsg('Binding controls...');             await delay(150);
    UI.init();
    splashMsg('Ready!');                          await delay(300);
    hideSplash();
    setStatus('READY — Press SPACE to play · Click steps to toggle · Right-click for velocity');
    setTimeout(() => toast('SYNTHWAVE DAW v2.0 🎛️ — All systems go'), 400);
  });
});

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function runSplash(fn) {
  const bar = document.getElementById('splash-bar');
  let progress = 0;
  const steps = 12;
  let step = 0;

  const origFn = fn;
  let resolveAll;
  const done = new Promise(r => { resolveAll = r; });

  // Animate bar while loading
  const tick = () => {
    if (step < steps) {
      progress = (step / steps) * 100;
      if (bar) bar.style.width = progress + '%';
      step++;
      setTimeout(tick, 120);
    }
  };
  tick();

  origFn().then(() => {
    if (bar) bar.style.width = '100%';
    resolveAll();
  });
}

function splashMsg(msg) {
  const el = document.getElementById('splash-status');
  if (el) el.textContent = msg;
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.opacity = '0';
  splash.style.transition = 'opacity 0.6s ease';
  setTimeout(() => { splash.style.display = 'none'; }, 650);
}
