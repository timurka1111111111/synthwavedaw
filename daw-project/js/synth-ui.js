/* ═══════════════════════════════════════
   SYNTH UI — canvas previews & sub-tabs
   ═══════════════════════════════════════ */

const SynthUI = (() => {

  function init() {
    bindSynthTabs();
    bindPreviews();
    initPreviews();
  }

  function bindSynthTabs() {
    document.querySelectorAll('.stab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.stab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById('stab-' + btn.dataset.stab);
        if (target) target.classList.add('active');
        initPreviews(); // redraw on tab switch
      });
    });
  }

  function bindPreviews() {
    // OSC type → redraw osc preview
    document.getElementById('osc-type')?.addEventListener('change', drawOscPreview);
    // ENV sliders → redraw ADSR
    ['env-attack','env-decay','env-sustain','env-release'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', drawADSR);
    });
    // LFO → redraw
    ['lfo-rate','lfo-depth','lfo-shape'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', drawLFOPreview);
      document.getElementById(id)?.addEventListener('change', drawLFOPreview);
    });
    // Filter → redraw
    ['filter-freq','filter-res','filter-type'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', drawFilterCurve);
      document.getElementById(id)?.addEventListener('change', drawFilterCurve);
    });
    // Val display updates
    document.getElementById('lfo-rate')?.addEventListener('input', e => {
      document.getElementById('val-lfo-rate').textContent = parseFloat(e.target.value).toFixed(1);
    });
    document.getElementById('lfo-depth')?.addEventListener('input', e => {
      document.getElementById('val-lfo-depth').textContent = parseFloat(e.target.value).toFixed(2);
    });
    document.getElementById('filter-res')?.addEventListener('input', e => {
      document.getElementById('val-filter-res').textContent = parseFloat(e.target.value).toFixed(1);
    });
    document.getElementById('filter-env')?.addEventListener('input', e => {
      document.getElementById('val-filter-env').textContent = parseFloat(e.target.value).toFixed(2);
    });
    document.getElementById('unison-spread')?.addEventListener('input', e => {
      document.getElementById('val-spread').textContent = e.target.value;
    });
  }

  function initPreviews() {
    drawOscPreview();
    drawADSR();
    drawLFOPreview();
    drawFilterCurve();
  }

  // ── OSC WAVEFORM PREVIEW ──
  function drawOscPreview() {
    const canvas = document.getElementById('osc-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const type = document.getElementById('osc-type')?.value || 'sawtooth';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

    const cycles = 2;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#00f5ff'); grad.addColorStop(1, '#7b00ff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6; ctx.shadowColor = '#00f5ff';
    ctx.beginPath();

    for (let x = 0; x < W; x++) {
      const t = (x / W) * cycles;
      const phase = (t % 1);
      let y;
      switch(type) {
        case 'sine':     y = Math.sin(phase * Math.PI * 2); break;
        case 'square':   y = phase < 0.5 ? 1 : -1; break;
        case 'sawtooth': y = 2 * phase - 1; break;
        case 'triangle': y = phase < 0.5 ? 4*phase - 1 : 3 - 4*phase; break;
        default:         y = 0;
      }
      const py = H/2 - y * (H/2 - 4);
      if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = 'rgba(0,245,255,0.5)';
    ctx.font = '9px Share Tech Mono';
    ctx.fillText(type.toUpperCase(), 4, H - 3);
  }

  // ── ADSR ENVELOPE ──
  function drawADSR() {
    const canvas = document.getElementById('adsr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const A = parseFloat(document.getElementById('env-attack')?.value || 0.01);
    const D = parseFloat(document.getElementById('env-decay')?.value || 0.1);
    const S = parseFloat(document.getElementById('env-sustain')?.value || 0.5);
    const R = parseFloat(document.getElementById('env-release')?.value || 0.3);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    const pad = 6;
    const total = A + D + 0.3 + R + 0.1; // sustain hold fixed
    const scale = (t) => pad + (t / total) * (W - pad * 2);
    const amp = (v) => H - pad - v * (H - pad * 2);

    const tA = A, tD = A + D, tS = tD + 0.3, tR = tS + R;

    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#00f5ff'); grad.addColorStop(0.5, '#7b00ff'); grad.addColorStop(1, '#ff006e');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 5; ctx.shadowColor = '#00f5ff';
    ctx.beginPath();
    ctx.moveTo(scale(0), amp(0));
    ctx.lineTo(scale(tA), amp(1));
    ctx.lineTo(scale(tD), amp(S));
    ctx.lineTo(scale(tS), amp(S));
    ctx.lineTo(scale(tR), amp(0));
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill
    ctx.fillStyle = 'rgba(0,245,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(scale(0), amp(0));
    ctx.lineTo(scale(tA), amp(1));
    ctx.lineTo(scale(tD), amp(S));
    ctx.lineTo(scale(tS), amp(S));
    ctx.lineTo(scale(tR), amp(0));
    ctx.closePath(); ctx.fill();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '7px Share Tech Mono';
    ['A','D','S','R'].forEach((label, i) => {
      const xs = [scale(tA/2), scale(tA + D/2), scale(tD + 0.15), scale(tS + R/2)];
      ctx.fillText(label, xs[i], H - 2);
    });
  }

  // ── LFO PREVIEW ──
  function drawLFOPreview() {
    const canvas = document.getElementById('lfo-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const shape = document.getElementById('lfo-shape')?.value || 'sine';
    const depth = parseFloat(document.getElementById('lfo-depth')?.value || 0);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    const cycles = 3;
    ctx.strokeStyle = `rgba(255,221,0,${0.3 + depth * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = depth > 0 ? 6 : 0;
    ctx.shadowColor = '#ffdd00';
    ctx.beginPath();

    for (let x = 0; x < W; x++) {
      const t = (x / W) * cycles;
      const phase = t % 1;
      let y;
      switch(shape) {
        case 'sine':     y = Math.sin(phase * Math.PI * 2); break;
        case 'triangle': y = phase < 0.5 ? 4*phase - 1 : 3 - 4*phase; break;
        case 'sawtooth': y = 2*phase - 1; break;
        case 'square':   y = phase < 0.5 ? 1 : -1; break;
        default:         y = 0;
      }
      const py = H/2 - y * depth * (H/2 - 3);
      if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (depth === 0) {
      ctx.fillStyle = 'rgba(255,221,0,0.3)';
      ctx.font = '8px Share Tech Mono';
      ctx.fillText('DEPTH = 0 (inactive)', 4, H/2 + 3);
    }
  }

  // ── FILTER CURVE ──
  function drawFilterCurve() {
    const canvas = document.getElementById('filter-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const freq = parseFloat(document.getElementById('filter-freq')?.value || 8000);
    const res  = parseFloat(document.getElementById('filter-res')?.value || 1);
    const type = document.getElementById('filter-type')?.value || 'lowpass';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    const minHz = 20, maxHz = 20000;
    const normFreq = (Math.log10(freq) - Math.log10(minHz)) / (Math.log10(maxHz) - Math.log10(minHz));

    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 5; ctx.shadowColor = '#00f5ff';
    ctx.beginPath();

    const pad = 4;
    for (let x = 0; x < W; x++) {
      const fx = Math.pow(10, Math.log10(minHz) + (x / W) * (Math.log10(maxHz) - Math.log10(minHz)));
      const ratio = fx / freq;
      let db = 0;
      switch(type) {
        case 'lowpass':
          db = fx > freq ? -12 * Math.log2(ratio) - res * (ratio > 0.9 && ratio < 1.5 ? 6 : 0) : 0;
          break;
        case 'highpass':
          db = fx < freq ? -12 * Math.log2(1/ratio) : 0;
          break;
        case 'bandpass':
          db = -Math.abs(Math.log2(ratio)) * 6;
          break;
        case 'notch':
          db = Math.abs(Math.log2(ratio)) < 0.3 ? -40 : 0;
          break;
      }
      // Resonance bump
      if ((type === 'lowpass' || type === 'highpass') && Math.abs(Math.log2(ratio)) < 0.15) {
        db += res * 2;
      }
      const amp = Math.max(-40, Math.min(6, db));
      const y = H/2 - (amp / 46) * (H - pad * 2);
      if (x === 0) ctx.moveTo(x, Math.max(pad, Math.min(H-pad, y)));
      else ctx.lineTo(x, Math.max(pad, Math.min(H-pad, y)));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Freq marker line
    const fx = normFreq * W;
    ctx.strokeStyle = 'rgba(255,221,0,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, H); ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = 'rgba(0,245,255,0.5)';
    ctx.font = '8px Share Tech Mono';
    ctx.fillText(type.toUpperCase(), 2, H - 2);
    ctx.fillStyle = 'rgba(255,221,0,0.6)';
    ctx.fillText(`${freq}Hz`, fx + 2, 10);
  }

  return { init, drawOscPreview, drawADSR, drawLFOPreview, drawFilterCurve };
})();
