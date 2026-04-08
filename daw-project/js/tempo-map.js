/* ═══════════════════════════════════════
   TEMPO MAP
   ═══════════════════════════════════════ */

const TempoMap = (() => {
  let markers = [{ bar: 1, bpm: 120 }]; // always starts with one
  let canvas, ctx2d;
  const BARS = 32;
  const H = 160;

  function init() {
    canvas = document.getElementById('tempo-map-canvas');
    if (!canvas) return;
    ctx2d = canvas.getContext('2d');
    resize();
    bindEvents();
    draw();
    renderList();
  }

  function resize() {
    const w = canvas.parentElement?.clientWidth || 600;
    canvas.width = Math.max(w - 24, 400);
  }

  function draw() {
    if (!canvas || !ctx2d) return;
    const W = canvas.width;
    ctx2d.clearRect(0, 0, W, H);

    // Background
    ctx2d.fillStyle = '#06060f';
    ctx2d.fillRect(0, 0, W, H);

    // Grid lines
    for (let b = 0; b <= BARS; b++) {
      const x = (b / BARS) * W;
      ctx2d.strokeStyle = b % 4 === 0 ? 'rgba(0,245,255,0.2)' : 'rgba(255,255,255,0.04)';
      ctx2d.lineWidth = b % 4 === 0 ? 1.5 : 1;
      ctx2d.beginPath(); ctx2d.moveTo(x, 0); ctx2d.lineTo(x, H); ctx2d.stroke();
      if (b % 4 === 0 && b > 0) {
        ctx2d.fillStyle = 'rgba(0,245,255,0.4)';
        ctx2d.font = '9px Share Tech Mono';
        ctx2d.fillText(`Bar ${b + 1}`, x + 2, 10);
      }
    }

    // BPM range lines
    const bpmVals = markers.map(m => m.bpm);
    const minBPM = Math.min(40, ...bpmVals);
    const maxBPM = Math.max(240, ...bpmVals);

    [60, 80, 100, 120, 140, 160, 180, 200].forEach(bpm => {
      const y = H - ((bpm - minBPM) / (maxBPM - minBPM)) * (H - 20) - 10;
      ctx2d.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx2d.lineWidth = 1;
      ctx2d.setLineDash([4, 4]);
      ctx2d.beginPath(); ctx2d.moveTo(0, y); ctx2d.lineTo(W, y); ctx2d.stroke();
      ctx2d.setLineDash([]);
      ctx2d.fillStyle = 'rgba(255,255,255,0.15)';
      ctx2d.font = '8px Share Tech Mono';
      ctx2d.fillText(bpm, 2, y - 2);
    });

    // Draw BPM curve
    if (markers.length < 2) {
      // Flat line
      const m = markers[0];
      const y = H - ((m.bpm - minBPM) / (maxBPM - minBPM)) * (H - 20) - 10;
      ctx2d.strokeStyle = 'rgba(0,245,255,0.6)';
      ctx2d.lineWidth = 2;
      ctx2d.beginPath(); ctx2d.moveTo(0, y); ctx2d.lineTo(W, y); ctx2d.stroke();
    } else {
      const sorted = [...markers].sort((a, b) => a.bar - b.bar);
      ctx2d.strokeStyle = 'rgba(0,245,255,0.7)';
      ctx2d.lineWidth = 2;
      ctx2d.shadowBlur = 8; ctx2d.shadowColor = 'rgba(0,245,255,0.4)';
      ctx2d.beginPath();
      sorted.forEach((m, i) => {
        const x = ((m.bar - 1) / (BARS - 1)) * W;
        const y = H - ((m.bpm - minBPM) / (maxBPM - minBPM)) * (H - 20) - 10;
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
      });
      ctx2d.stroke();
      ctx2d.shadowBlur = 0;
    }

    // Marker dots
    const sorted = [...markers].sort((a, b) => a.bar - b.bar);
    sorted.forEach(m => {
      const x = ((m.bar - 1) / (BARS - 1)) * W;
      const y = H - ((m.bpm - minBPM) / (maxBPM - minBPM)) * (H - 20) - 10;

      ctx2d.fillStyle = 'var(--accent)';
      ctx2d.shadowBlur = 10; ctx2d.shadowColor = '#00f5ff';
      ctx2d.beginPath(); ctx2d.arc(x, y, 5, 0, Math.PI * 2); ctx2d.fill();
      ctx2d.shadowBlur = 0;

      ctx2d.fillStyle = '#fff';
      ctx2d.font = 'bold 9px Share Tech Mono';
      ctx2d.fillText(`${m.bpm}`, x + 7, y - 4);
      ctx2d.fillStyle = 'rgba(0,245,255,0.5)';
      ctx2d.font = '8px Share Tech Mono';
      ctx2d.fillText(`B${m.bar}`, x + 7, y + 8);
    });
  }

  function addMarker(bar, bpm) {
    // Remove existing at same bar
    markers = markers.filter(m => m.bar !== bar);
    markers.push({ bar, bpm });
    draw();
    renderList();
    setStatus(`Tempo marker: Bar ${bar} → ${bpm} BPM`);
  }

  function removeMarker(bar) {
    if (markers.length <= 1) { toast('Need at least one marker'); return; }
    markers = markers.filter(m => m.bar !== bar);
    draw();
    renderList();
  }

  function renderList() {
    const cont = document.getElementById('tempomap-list');
    if (!cont) return;
    cont.innerHTML = '';
    const sorted = [...markers].sort((a, b) => a.bar - b.bar);
    sorted.forEach(m => {
      const chip = document.createElement('div');
      chip.className = 'tempo-marker-chip';
      chip.innerHTML = `Bar ${m.bar}: <strong>${m.bpm} BPM</strong>`;
      const del = document.createElement('button');
      del.textContent = '✕';
      del.addEventListener('click', () => removeMarker(m.bar));
      chip.appendChild(del);
      cont.appendChild(chip);
    });
  }

  function bindEvents() {
    canvas?.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const bar = Math.max(1, Math.round((x / canvas.width) * (BARS - 1)) + 1);
      const bpm = parseInt(prompt(`BPM at Bar ${bar}:`, '120') || '0');
      if (bpm >= 40 && bpm <= 300) addMarker(bar, bpm);
    });

    document.getElementById('tm-add')?.addEventListener('click', () => {
      const bar = parseInt(prompt('At which bar?', '1') || '0');
      const bpm = parseInt(prompt('BPM:', '120') || '0');
      if (bar >= 1 && bpm >= 40 && bpm <= 300) addMarker(bar, bpm);
    });

    document.getElementById('tm-clear')?.addEventListener('click', () => {
      const defaultBPM = parseInt(document.getElementById('bpm-input')?.value || 120);
      markers = [{ bar: 1, bpm: defaultBPM }];
      draw();
      renderList();
      toast('Tempo map cleared');
    });

    window.addEventListener('resize', () => { resize(); draw(); });
  }

  function getBPMAt(bar) {
    const sorted = [...markers].sort((a, b) => a.bar - b.bar);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].bar <= bar) return sorted[i].bpm;
    }
    return sorted[0]?.bpm || 120;
  }

  function getMarkers() { return [...markers]; }

  return { init, getMarkers, getBPMAt, addMarker };
})();
