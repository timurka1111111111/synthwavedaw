/* ═══════════════════════════════════════
   PIANO ROLL — с воспроизведением
   Играет вместе с drum sequencer-ом
   ═══════════════════════════════════════ */

const PianoRoll = (() => {

  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const NOTE_H = 16;
  const OCTAVES = 5;
  const TOTAL_NOTES = OCTAVES * 12;

  let canvas, ctx2d, wrapper, sidebar;
  let tool = 'draw';
  let zoom = 2;
  let octaveOffset = 2;

  // Сетка: 1 клетка = 1/16 доля. 32 клетки = 2 такта по умолчанию
  let gridCells = 32;

  let notes = [];       // { row, col, len, vel, note }
  let dragging = null;
  let isMouseDown = false;
  let initialized = false;

  // ── PLAYBACK ──
  let playheadCol = -1;       // текущая позиция воспроизведения (в клетках)
  let isPlaying = false;
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let currentCol = 0;
  let loopLen = 32;           // сколько клеток в петле (= gridCells)
  let activeVoices = [];      // { noteStr, stopFn, endCol }

  // ── INIT ──
  function init() {
    if (initialized) { resyncLoop(); return; }
    initialized = true;

    canvas  = document.getElementById('piano-roll-canvas');
    wrapper = document.getElementById('piano-roll-canvas-wrap');
    sidebar = document.getElementById('piano-keys-sidebar');
    if (!canvas) return;
    ctx2d = canvas.getContext('2d');

    buildSidebar();
    resize();
    bindEvents();
    drawLoop();
  }

  // ── SIDEBAR (piano keys) ──
  function buildSidebar() {
    sidebar.innerHTML = '';
    for (let o = OCTAVES + octaveOffset - 1; o >= octaveOffset; o--) {
      for (let n = 11; n >= 0; n--) {
        const name = NOTE_NAMES[n];
        const isBlack = name.includes('#');
        const key = document.createElement('div');
        key.className = `pk-key ${isBlack ? 'black' : 'white'}`;
        key.style.height = NOTE_H + 'px';
        const noteStr = name + o;
        key.dataset.note = noteStr;
        if (n === 0) key.textContent = `C${o}`;
        key.addEventListener('mousedown', () => {
          AudioEngine.resume();
          AudioEngine.playNote(noteStr, 0.4, getSynthOpts());
          key.classList.add('pressed');
        });
        key.addEventListener('mouseup',    () => key.classList.remove('pressed'));
        key.addEventListener('mouseleave', () => key.classList.remove('pressed'));
        sidebar.appendChild(key);
      }
    }
  }

  function resize() {
    const cellW = zoom * 20;
    canvas.width  = gridCells * cellW;
    canvas.height = TOTAL_NOTES * NOTE_H;
  }

  // ── DRAW LOOP ──
  function drawLoop() {
    drawFrame();
    requestAnimationFrame(drawLoop);
  }

  function drawFrame() {
    if (!canvas || !ctx2d) return;
    const cellW = zoom * 20;
    const W = canvas.width, H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);

    // Row backgrounds
    for (let r = 0; r < TOTAL_NOTES; r++) {
      const idx = TOTAL_NOTES - 1 - r;
      const name = NOTE_NAMES[idx % 12];
      const isBlack = name.includes('#');
      ctx2d.fillStyle = isBlack ? '#090912' : '#0d0d1c';
      ctx2d.fillRect(0, r * NOTE_H, W, NOTE_H);
      if (idx % 12 === 0) {
        ctx2d.fillStyle = 'rgba(0,245,255,0.05)';
        ctx2d.fillRect(0, r * NOTE_H, W, NOTE_H);
      }
    }

    // Vertical grid lines
    for (let c = 0; c <= gridCells; c++) {
      const x = c * cellW;
      const isBeat    = c % 4 === 0;
      const isMeasure = c % 16 === 0;
      ctx2d.strokeStyle = isMeasure ? 'rgba(0,245,255,0.3)'
                        : isBeat    ? 'rgba(255,255,255,0.1)'
                        :             'rgba(255,255,255,0.03)';
      ctx2d.lineWidth = isMeasure ? 1.5 : 1;
      ctx2d.beginPath(); ctx2d.moveTo(x, 0); ctx2d.lineTo(x, H); ctx2d.stroke();
      if (isMeasure && c > 0) {
        ctx2d.fillStyle = 'rgba(0,245,255,0.45)';
        ctx2d.font = '9px Share Tech Mono';
        ctx2d.fillText(`${c/16 + 1}`, x + 3, 9);
      }
    }

    // Horizontal lines
    for (let r = 0; r <= TOTAL_NOTES; r++) {
      ctx2d.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx2d.lineWidth = 1;
      ctx2d.beginPath(); ctx2d.moveTo(0, r*NOTE_H); ctx2d.lineTo(W, r*NOTE_H); ctx2d.stroke();
    }

    // PLAYHEAD — подсветка текущей колонки
    if (isPlaying && playheadCol >= 0) {
      const px = playheadCol * cellW;
      // Column highlight
      ctx2d.fillStyle = 'rgba(255,255,255,0.06)';
      ctx2d.fillRect(px, 0, cellW, H);
      // Line
      ctx2d.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx2d.lineWidth = 2;
      ctx2d.shadowBlur = 8; ctx2d.shadowColor = '#fff';
      ctx2d.beginPath(); ctx2d.moveTo(px, 0); ctx2d.lineTo(px, H); ctx2d.stroke();
      ctx2d.shadowBlur = 0;
    }

    // Notes
    notes.forEach(note => {
      const x = note.col * cellW;
      const y = note.row * NOTE_H;
      const w = Math.max(cellW - 2, note.len * cellW - 2);
      const h = NOTE_H - 2;
      const alpha = 0.55 + note.vel * 0.45;

      // Active note glow when playing
      const isActive = isPlaying && playheadCol >= note.col && playheadCol < note.col + note.len;

      const grad = ctx2d.createLinearGradient(x, y, x, y + h);
      if (isActive) {
        grad.addColorStop(0, `rgba(255,255,180,${alpha})`);
        grad.addColorStop(1, `rgba(255,200,0,${alpha * 0.8})`);
        ctx2d.shadowBlur = 12; ctx2d.shadowColor = '#ffdd00';
      } else {
        grad.addColorStop(0, `rgba(0,245,255,${alpha})`);
        grad.addColorStop(1, `rgba(123,0,255,${alpha * 0.7})`);
        ctx2d.shadowBlur = 0;
      }

      ctx2d.fillStyle = grad;
      ctx2d.beginPath();
      ctx2d.roundRect(x + 1, y + 1, w, h, 2);
      ctx2d.fill();

      ctx2d.strokeStyle = isActive ? `rgba(255,220,0,${alpha})` : `rgba(0,245,255,${alpha * 0.7})`;
      ctx2d.lineWidth = 1;
      ctx2d.stroke();
      ctx2d.shadowBlur = 0;

      if (w > 18) {
        ctx2d.fillStyle = isActive ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.75)';
        ctx2d.font = '8px Share Tech Mono';
        ctx2d.fillText(note.note, x + 3, y + NOTE_H - 4);
      }
    });
  }

  // ── PLAYBACK ENGINE ──
  // Вызывается из Sequencer.schedule() при каждом 16-м шаге
  function onStep(step, time) {
    if (!isPlaying) return;
    const col = step % loopLen;
    playheadCol = col;

    // Найти ноты, которые начинаются на этом шаге
    const toPlay = notes.filter(n => n.col === col);
    toPlay.forEach(note => {
      const opts = getSynthOpts();
      const secPerStep = 60 / getCurrentBPM() / 4;
      const duration = note.len * secPerStep * 0.95;
      const ctx = AudioEngine.getContext();
      const wait = Math.max(0, time - ctx.currentTime);
      setTimeout(() => {
        AudioEngine.playNote(note.note, duration, { ...opts, velocity: note.vel });
      }, wait * 1000);
    });
  }

  function startPlayback() {
    isPlaying = true;
    playheadCol = 0;
    loopLen = gridCells;
  }

  function stopPlayback() {
    isPlaying = false;
    playheadCol = -1;
  }

  // ── NOTE EDITING ──
  function posToCell(x, y) {
    const cellW = zoom * 20;
    return {
      col: Math.max(0, Math.min(gridCells - 1, Math.floor(x / cellW))),
      row: Math.max(0, Math.min(TOTAL_NOTES - 1, Math.floor(y / NOTE_H))),
    };
  }

  function rowToNote(row) {
    const idx = TOTAL_NOTES - 1 - row;
    return NOTE_NAMES[idx % 12] + (Math.floor(idx / 12) + octaveOffset);
  }

  function addNote(col, row) {
    notes = notes.filter(n => !(n.col === col && n.row === row));
    const noteStr = rowToNote(row);
    notes.push({ col, row, len: 1, vel: 0.8, note: noteStr });
    AudioEngine.resume();
    AudioEngine.playNote(noteStr, 0.25, getSynthOpts());
  }

  function eraseNote(col, row) {
    notes = notes.filter(n => !(n.col <= col && col < n.col + n.len && n.row === row));
  }

  function resyncLoop() {
    loopLen = gridCells;
  }

  // ── EVENTS ──
  function bindEvents() {
    document.getElementById('pr-draw')?.addEventListener('click',  () => { tool='draw';  updateToolbar(); });
    document.getElementById('pr-erase')?.addEventListener('click', () => { tool='erase'; updateToolbar(); });
    document.getElementById('pr-clear')?.addEventListener('click', () => {
      if (confirm('Clear all piano roll notes?')) {
        notes = [];
        setStatus('Piano roll cleared');
      }
    });

    document.getElementById('pr-zoom')?.addEventListener('input', e => {
      zoom = parseFloat(e.target.value);
      resize();
    });

    document.getElementById('pr-oct-up')?.addEventListener('click', () => {
      octaveOffset = Math.min(octaveOffset + 1, 7);
      document.getElementById('pr-oct-label').textContent = 'OCT ' + (octaveOffset + 2);
      buildSidebar();
    });
    document.getElementById('pr-oct-dn')?.addEventListener('click', () => {
      octaveOffset = Math.max(octaveOffset - 1, 0);
      document.getElementById('pr-oct-label').textContent = 'OCT ' + (octaveOffset + 2);
      buildSidebar();
    });

    // Длина петли = количество шагов секвенсера
    document.querySelectorAll('.seq-steps-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        gridCells = parseInt(btn.dataset.steps);
        loopLen = gridCells;
        resize();
      });
    });

    // Mouse
    canvas.addEventListener('mousedown', e => {
      isMouseDown = true;
      const rect = canvas.getBoundingClientRect();
      const { col, row } = posToCell(
        e.clientX - rect.left + wrapper.scrollLeft,
        e.clientY - rect.top  + wrapper.scrollTop
      );
      if (tool === 'draw') {
        addNote(col, row);
        dragging = { col, row };
      } else {
        eraseNote(col, row);
      }
    });

    canvas.addEventListener('mousemove', e => {
      if (!isMouseDown) return;
      const rect = canvas.getBoundingClientRect();
      const { col, row } = posToCell(
        e.clientX - rect.left + wrapper.scrollLeft,
        e.clientY - rect.top  + wrapper.scrollTop
      );
      if (tool === 'draw' && dragging) {
        const note = notes.find(n => n.col === dragging.col && n.row === dragging.row);
        if (note) note.len = Math.max(1, col - dragging.col + 1);
      } else if (tool === 'erase') {
        eraseNote(col, row);
      }
    });

    canvas.addEventListener('mouseup',    () => { isMouseDown = false; dragging = null; });
    canvas.addEventListener('mouseleave', () => { isMouseDown = false; dragging = null; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  function updateToolbar() {
    document.querySelectorAll('.pr-tool').forEach(b => b.classList.remove('active'));
    document.getElementById(tool === 'draw' ? 'pr-draw' : 'pr-erase')?.classList.add('active');
  }

  function getSynthOpts() {
    return {
      oscType:    document.getElementById('osc-type')?.value    || 'sawtooth',
      attack:     parseFloat(document.getElementById('env-attack')?.value   || 0.01),
      decay:      parseFloat(document.getElementById('env-decay')?.value    || 0.1),
      sustain:    parseFloat(document.getElementById('env-sustain')?.value  || 0.5),
      release:    parseFloat(document.getElementById('env-release')?.value  || 0.3),
      detune:     parseFloat(document.getElementById('detune')?.value       || 0),
      filterFreq: parseFloat(document.getElementById('filter-freq')?.value  || 8000),
    };
  }

  function getCurrentBPM() {
    return parseFloat(document.getElementById('bpm-input')?.value || 120);
  }

  function getNotes() { return notes; }

  return { init, getNotes, onStep, startPlayback, stopPlayback };
})();
