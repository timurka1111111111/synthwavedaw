/* ═══════════════════════════════════════
   UI v2 — All interactions & bindings
   ═══════════════════════════════════════ */

function setStatus(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.textContent = msg;
}

function toast(msg, duration = 2200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

const UI = (() => {
  let isPlaying = false;
  let elapsed = 0;
  let timerStart = null;
  let bpm = 120;
  let bar = 1, beat = 1, tick16 = 1;

  function init() {
    bindTransport();
    bindBPM();
    bindTabs();
    bindFX();
    bindSynth();
    bindMasterVol();
    bindExport();
    bindModals();
    bindSequencerExtras();
    startTimerDisplay();
    startCPUMeter();
  }

  // ── TRANSPORT ──
  function bindTransport() {
    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');
    const btnRew  = document.getElementById('btn-rewind');
    const btnRec  = document.getElementById('btn-record');

    btnPlay?.addEventListener('click', togglePlay);
    btnStop?.addEventListener('click', stopAll);
    btnRew?.addEventListener('click', () => {
      elapsed = 0; timerStart = isPlaying ? performance.now() : null;
      bar = 1; beat = 1; tick16 = 1;
      updateTimeDisplay(0); updateBarCounter();
    });
    btnRec?.addEventListener('click', () => {
      const armed = btnRec.classList.toggle('armed');
      setStatus(armed ? '⏺ ARM RECORD — Play to start recording' : 'READY');
    });

    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      switch(e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break;
        case 'Escape': stopAll(); break;
        case 'KeyR': document.getElementById('btn-rewind')?.click(); break;
        case 'KeyE': document.getElementById('export-rec-btn')?.click(); break;
        case 'KeyS':
          if (!e.ctrlKey) { toggleSoloCurrent(); }
          break;
        case 'KeyM': toggleMuteCurrent(); break;
        case 'KeyZ':
          if (e.ctrlKey) { e.preventDefault(); document.getElementById('seq-undo')?.click(); }
          break;
      }
    });
  }

  function togglePlay() {
    AudioEngine.resume();
    if (!isPlaying) {
      isPlaying = true;
      const btnPlay = document.getElementById('btn-play');
      btnPlay?.classList.add('playing');
      if (btnPlay) btnPlay.textContent = '⏸';
      Sequencer.start();
      timerStart = performance.now() - elapsed * 1000;
      if (document.getElementById('btn-record')?.classList.contains('armed')) {
        Exporter.toggle();
      }
    } else {
      isPlaying = false;
      const btnPlay = document.getElementById('btn-play');
      btnPlay?.classList.remove('playing');
      if (btnPlay) btnPlay.textContent = '▶';
      Sequencer.stop();
    }
  }

  function stopAll() {
    isPlaying = false;
    const btnPlay = document.getElementById('btn-play');
    btnPlay?.classList.remove('playing');
    if (btnPlay) btnPlay.textContent = '▶';
    Sequencer.stop();
    if (Exporter.getIsRecording()) Exporter.toggle();
    elapsed = 0; timerStart = null;
    bar = 1; beat = 1; tick16 = 1;
    updateTimeDisplay(0); updateBarCounter();
    setStatus('STOPPED ■');
  }

  function toggleSoloCurrent() {}
  function toggleMuteCurrent() {}

  // ── TIMER / BAR COUNTER ──
  function startTimerDisplay() {
    function tick() {
      if (isPlaying && timerStart !== null) {
        elapsed = (performance.now() - timerStart) / 1000;
        // Update bar/beat
        const secPerBeat = 60 / bpm;
        const totalBeats = elapsed / secPerBeat;
        const timesigNum = parseInt(document.getElementById('timesig-num')?.value || 4);
        bar = Math.floor(totalBeats / timesigNum) + 1;
        beat = Math.floor(totalBeats % timesigNum) + 1;
        tick16 = Math.floor((totalBeats * 4) % 4) + 1;
        updateBarCounter();
      }
      updateTimeDisplay(elapsed);
      requestAnimationFrame(tick);
    }
    tick();
  }

  function updateTimeDisplay(secs) {
    const mins = Math.floor(secs / 60);
    const s    = Math.floor(secs % 60);
    const ms   = Math.floor((secs % 1) * 1000);
    const el   = document.getElementById('time-display');
    if (el) el.textContent = `${pad(mins,2)}:${pad(s,2)}:${pad(ms,3)}`;
  }

  function updateBarCounter() {
    const el = document.getElementById('bar-counter');
    if (el) el.textContent = `${bar}.${beat}.${tick16}`;
  }

  function pad(n, len) { return String(n).padStart(len, '0'); }

  // ── BPM ──
  function bindBPM() {
    const input = document.getElementById('bpm-input');
    const up = document.getElementById('bpm-up');
    const dn = document.getElementById('bpm-dn');

    function updateBPM(v) {
      bpm = Math.max(40, Math.min(240, v));
      if (input) input.value = bpm;
      Sequencer.setBPM(bpm);
      setStatus(`BPM: ${bpm}`);
    }

    input?.addEventListener('change', e => updateBPM(parseInt(e.target.value)));
    up?.addEventListener('click', () => updateBPM(bpm + 1));
    dn?.addEventListener('click', () => updateBPM(bpm - 1));
    input?.addEventListener('wheel', e => { e.preventDefault(); updateBPM(bpm + (e.deltaY < 0 ? 1 : -1)); });
  }

  // ── TABS ──
  function bindTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.classList.add('active');
        if (tab.dataset.tab === 'piano-roll') PianoRoll.init();
        if (tab.dataset.tab === 'patterns') Patterns.render?.();
        if (tab.dataset.tab === 'mixer') Project.renderSavesList?.();
      });
    });
  }

  // ── FX ──
  function bindFX() {
    const bind = (id, valId, fmt, cb) => {
      document.getElementById(id)?.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        if (valId) { const el = document.getElementById(valId); if(el) el.textContent = fmt ? fmt(v) : v; }
        if (cb) cb(v);
      });
    };
    const bindCheck = (id, cb) => {
      document.getElementById(id)?.addEventListener('change', e => cb(e.target.checked));
    };

    bindCheck('reverb-on', v => { AudioEngine.reverbEnabled = v; });
    bind('reverb-size', 'val-reverb-size', v => v.toFixed(2), v => AudioEngine.updateReverb(v));
    bind('reverb-wet', 'val-reverb-wet', v => v.toFixed(2));

    bindCheck('delay-on', v => { AudioEngine.delayEnabled = v; });
    bind('delay-time', 'val-delay-time', v => v.toFixed(2), v => AudioEngine.updateDelay(v, undefined));
    bind('delay-feed', 'val-delay-feed', v => v.toFixed(2), v => AudioEngine.updateDelay(undefined, v));
    bind('delay-wet', 'val-delay-wet', v => v.toFixed(2));

    bindCheck('dist-on', v => { AudioEngine.distEnabled = v; });
    bind('dist-drive', 'val-dist-drive', v => Math.round(v), v => AudioEngine.updateDistortion(v));
    bind('dist-wet', 'val-dist-wet', v => v.toFixed(2));

    bindCheck('chorus-on', v => { AudioEngine.chorusEnabled = v; });
    bind('chorus-rate', 'val-chorus-rate', v => v.toFixed(1), v => AudioEngine.updateChorus(v, undefined));
    bind('chorus-depth', 'val-chorus-depth', v => v.toFixed(3), v => AudioEngine.updateChorus(undefined, v));

    bindCheck('comp-on', () => {});
    bind('comp-thresh', 'val-comp-thresh', v => Math.round(v));
    bind('comp-ratio', 'val-comp-ratio', v => v.toFixed(1));

    bind('eq-lo',  'val-eq-lo',  v => v, v => AudioEngine.updateEQ(v, undefined, undefined));
    bind('eq-mid', 'val-eq-mid', v => v, v => AudioEngine.updateEQ(undefined, v, undefined));
    bind('eq-hi',  'val-eq-hi',  v => v, v => AudioEngine.updateEQ(undefined, undefined, v));
  }

  // ── SYNTH ──
  function bindSynth() {
    const sliders = [
      { id: 'env-attack',  val: 'val-attack',  fmt: v => v.toFixed(2) },
      { id: 'env-decay',   val: 'val-decay',   fmt: v => v.toFixed(2) },
      { id: 'env-sustain', val: 'val-sustain', fmt: v => v.toFixed(2) },
      { id: 'env-release', val: 'val-release', fmt: v => v.toFixed(2) },
      { id: 'detune',      val: 'val-detune',  fmt: v => Math.round(v) },
      { id: 'filter-freq', val: 'val-filter',  fmt: v => Math.round(v) },
    ];
    sliders.forEach(s => {
      document.getElementById(s.id)?.addEventListener('input', e => {
        const el = document.getElementById(s.val);
        if (el) el.textContent = s.fmt(parseFloat(e.target.value));
      });
    });
  }

  // ── MASTER VOL ──
  function bindMasterVol() {
    document.getElementById('master-vol')?.addEventListener('input', e => {
      AudioEngine.setMasterVolume(parseFloat(e.target.value));
    });
  }

  // ── EXPORT ──
  function bindExport() {
    document.getElementById('export-rec-btn')?.addEventListener('click', () => {
      AudioEngine.resume();
      Exporter.toggle();
    });
  }

  // ── MODALS ──
  function bindModals() {
    document.getElementById('menu-project')?.addEventListener('click', () => openModal('project'));
    document.getElementById('menu-arp')?.addEventListener('click', () => { openModal('arp'); Arpeggiator.init?.(); });
    document.getElementById('menu-help')?.addEventListener('click', () => openModal('help'));

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id.replace('modal-', '')); });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    });
  }

  function openModal(name) {
    const modal = document.getElementById('modal-' + name);
    if (!modal) return;
    modal.classList.remove('hidden');
    if (name === 'project') Project.renderSavesList?.();
  }

  function closeModal(name) {
    document.getElementById('modal-' + name)?.classList.add('hidden');
  }

  // ── SEQUENCER EXTRAS ──
  function bindSequencerExtras() {
    document.getElementById('seq-clear-all')?.addEventListener('click', () => {
      if (!confirm('Clear all steps?')) return;
      Sequencer.getTracks().forEach(t => { t.steps.fill(false); });
      document.querySelectorAll('.step-btn').forEach(b => {
        b.classList.remove('on'); b.style.background = '';
      });
      setStatus('All steps cleared');
      toast('Steps cleared');
    });

    document.getElementById('seq-random')?.addEventListener('click', () => {
      Sequencer.getTracks().forEach((track, ti) => {
        for (let si = 0; si < track.steps.length; si++) {
          track.steps[si] = Math.random() > 0.75;
          if (track.steps[si]) track.vels[si] = 0.4 + Math.random() * 0.6;
        }
      });
      // Refresh buttons
      document.querySelectorAll('.step-btn').forEach(btn => {
        const ti = parseInt(btn.dataset.track);
        const si = parseInt(btn.dataset.step);
        const track = Sequencer.getTracks()[ti];
        if (!track) return;
        if (track.steps[si]) {
          btn.classList.add('on'); btn.style.background = track.color;
        } else {
          btn.classList.remove('on'); btn.style.background = '';
        }
        const vb = btn.querySelector('.vel-bar');
        if (vb) vb.style.width = (track.vels[si] * 100) + '%';
      });
      setStatus('Random pattern generated');
      toast('🎲 Random pattern!');
    });

    document.getElementById('seq-undo')?.addEventListener('click', () => {
      toast('↩ Undo not yet tracked in v2');
    });

    document.getElementById('swing')?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-swing').textContent = Math.round(v * 333) + '%';
      Sequencer.swing = v;
    });

    document.getElementById('humanize')?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-humanize').textContent = v.toFixed(3);
      Sequencer.humanize = v;
    });

    document.querySelectorAll('.seq-steps-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.seq-steps-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Sequencer.setNumSteps(parseInt(btn.dataset.steps));
      });
    });

    // Add track with type selector
    document.getElementById('btn-add-track')?.addEventListener('click', () => {
      const type = document.getElementById('add-track-type')?.value || 'kick';
      const isDrum = !['synth','bass','pad','lead'].includes(type);
      Sequencer.addTrack(type.toUpperCase(), isDrum ? 'drum' : 'synth', type);
      const count = Sequencer.getTracks().length;
      const el = document.getElementById('track-count');
      if (el) el.textContent = count;
    });
  }

  // ── CPU METER ──
  function startCPUMeter() {
    let lastTime = performance.now();
    let frames = 0;
    function tick() {
      frames++;
      const now = performance.now();
      if (now - lastTime > 1000) {
        const ctx = AudioEngine.getContext();
        const latency = ctx ? Math.round(ctx.baseLatency * 1000) : '--';
        document.getElementById('status-latency').textContent = `Latency: ${latency}ms`;
        document.getElementById('status-cpu').textContent = `FPS: ${frames}`;
        frames = 0; lastTime = now;
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  return { init };
})();
