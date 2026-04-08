/* ═══════════════════════════════════════
   STEP SEQUENCER
   ═══════════════════════════════════════ */

const Sequencer = (() => {

  const COLORS = ['#ff006e','#00f5ff','#7b00ff','#ffdd00','#00ff9d','#ff6b00'];

  const DEFAULT_TRACKS = [
    { name: 'KICK',    type: 'drum',  drum: 'kick',    color: COLORS[0], steps: Array(16).fill(false), vels: Array(16).fill(0.8) },
    { name: 'SNARE',   type: 'drum',  drum: 'snare',   color: COLORS[1], steps: Array(16).fill(false), vels: Array(16).fill(0.7) },
    { name: 'HI-HAT',  type: 'drum',  drum: 'hihat',   color: COLORS[2], steps: Array(16).fill(false), vels: Array(16).fill(0.5) },
    { name: 'OPEN HAT',type: 'drum',  drum: 'openhat', color: COLORS[3], steps: Array(16).fill(false), vels: Array(16).fill(0.5) },
    { name: 'CLAP',    type: 'drum',  drum: 'clap',    color: COLORS[4], steps: Array(16).fill(false), vels: Array(16).fill(0.6) },
    { name: 'SYNTH 1', type: 'synth', note: 'C4',      color: COLORS[5], steps: Array(16).fill(false), vels: Array(16).fill(0.7) },
  ];

  let tracks = DEFAULT_TRACKS.map(t => ({ ...t, steps: [...t.steps], vels: [...t.vels], muted: false, solo: false, vol: 1.0 }));
  let currentStep = -1;
  let numSteps = 16;
  let swing = 0;
  let activeTrack = 0;
  let isPlaying = false;
  let timerId = null;
  let stepInterval = null;

  // Scheduling
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let currentBeat = 0;
  let bpm = 120;

  function init() {
    renderGrid();
    renderBeatNumbers();
    bindEvents();
    // Default pattern - classic 4x4
    tracks[0].steps[0] = true;
    tracks[0].steps[4] = true;
    tracks[0].steps[8] = true;
    tracks[0].steps[12] = true;
    tracks[1].steps[4] = true;
    tracks[1].steps[12] = true;
    tracks[2].steps[0] = true; tracks[2].steps[2] = true;
    tracks[2].steps[4] = true; tracks[2].steps[6] = true;
    tracks[2].steps[8] = true; tracks[2].steps[10] = true;
    tracks[2].steps[12] = true; tracks[2].steps[14] = true;
    refreshAllSteps();
  }

  function renderGrid() {
    const grid = document.getElementById('sequencer-grid');
    grid.innerHTML = '';
    tracks.forEach((track, ti) => {
      const row = document.createElement('div');
      row.className = 'seq-row';
      row.dataset.track = ti;

      // Label
      const lbl = document.createElement('div');
      lbl.className = 'seq-row-label';
      lbl.innerHTML = `<span style="color:${track.color}">${track.name}</span>`;
      row.appendChild(lbl);

      // Volume
      const volWrap = document.createElement('div');
      volWrap.className = 'seq-row-vol';
      const volSlider = document.createElement('input');
      volSlider.type = 'range'; volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.01; volSlider.value = track.vol;
      volSlider.addEventListener('input', e => { tracks[ti].vol = parseFloat(e.target.value); });
      volWrap.appendChild(volSlider);
      row.appendChild(volWrap);

      // Steps
      const stepsWrap = document.createElement('div');
      stepsWrap.className = 'seq-steps';
      stepsWrap.id = `seq-steps-${ti}`;
      for (let si = 0; si < numSteps; si++) {
        stepsWrap.appendChild(createStepBtn(ti, si, track));
      }
      row.appendChild(stepsWrap);

      grid.appendChild(row);
    });
    renderInstrumentList();
  }

  function createStepBtn(ti, si, track) {
    const btn = document.createElement('div');
    btn.className = 'step-btn' + (si % 4 === 0 ? ' group-start' : '');
    btn.dataset.track = ti;
    btn.dataset.step  = si;
    if (track.steps[si]) { btn.classList.add('on'); btn.style.background = track.color; }

    const velBar = document.createElement('div');
    velBar.className = 'vel-bar';
    velBar.style.width = (track.vels[si] * 100) + '%';
    btn.appendChild(velBar);

    btn.addEventListener('click', () => toggleStep(ti, si));
    btn.addEventListener('contextmenu', e => { e.preventDefault(); showVelMenu(ti, si, btn); });
    return btn;
  }

  function toggleStep(ti, si) {
    tracks[ti].steps[si] = !tracks[ti].steps[si];
    refreshStep(ti, si);
    if (tracks[ti].steps[si]) {
      // preview sound
      triggerTrack(ti);
    }
    setStatus(`Track ${tracks[ti].name} — Step ${si+1} ${tracks[ti].steps[si] ? 'ON' : 'OFF'}`);
  }

  function showVelMenu(ti, si, btn) {
    // Cycle velocity: 0.3 → 0.5 → 0.7 → 1.0
    const vels = [0.3, 0.5, 0.7, 1.0];
    const cur = tracks[ti].vels[si];
    const idx = vels.findIndex(v => v >= cur);
    tracks[ti].vels[si] = vels[(idx + 1) % vels.length];
    const velBar = btn.querySelector('.vel-bar');
    if (velBar) velBar.style.width = (tracks[ti].vels[si] * 100) + '%';
    setStatus(`Velocity set to ${Math.round(tracks[ti].vels[si]*100)}%`);
  }

  function refreshStep(ti, si) {
    const btn = document.querySelector(`.step-btn[data-track="${ti}"][data-step="${si}"]`);
    if (!btn) return;
    const track = tracks[ti];
    if (track.steps[si]) {
      btn.classList.add('on');
      btn.style.background = track.color;
    } else {
      btn.classList.remove('on');
      btn.style.background = '';
    }
    const velBar = btn.querySelector('.vel-bar');
    if (velBar) velBar.style.width = (track.vels[si] * 100) + '%';
  }

  function refreshAllSteps() {
    tracks.forEach((t, ti) => {
      for (let si = 0; si < numSteps; si++) refreshStep(ti, si);
    });
  }

  function renderBeatNumbers() {
    const cont = document.getElementById('seq-beat-numbers');
    if (!cont) return;
    cont.innerHTML = '';
    for (let i = 0; i < numSteps; i++) {
      const span = document.createElement('span');
      span.className = 'seq-beat-num' + (i % 4 === 0 ? ' beat-marker' : '');
      span.textContent = i % 4 === 0 ? (i/4+1) : '·';
      cont.appendChild(span);
    }
  }

  // ── PLAYBACK ──
  function start() {
    if (isPlaying) return;
    isPlaying = true;
    currentBeat = 0;
    const ctx = AudioEngine.getContext();
    nextNoteTime = ctx.currentTime + 0.05;
    if (typeof PianoRoll !== 'undefined') PianoRoll.startPlayback();
    schedule();
    setStatus('PLAYING ▶');
  }

  function stop() {
    isPlaying = false;
    clearTimeout(schedulerTimer);
    clearPlayhead();
    currentBeat = 0;
    if (typeof PianoRoll !== 'undefined') PianoRoll.stopPlayback();
    setStatus('STOPPED ■');
  }

  function schedule() {
    const ctx = AudioEngine.getContext();
    const secPerBeat = 60.0 / bpm / 4; // 16th note

    while (nextNoteTime < ctx.currentTime + 0.1) {
      const step = currentBeat % numSteps;
      scheduleStep(step, nextNoteTime);
      updatePlayhead(step, nextNoteTime);
      // Swing on odd 8th notes
      const swingOffset = (currentBeat % 2 === 1) ? swing * secPerBeat : 0;
      nextNoteTime += secPerBeat + swingOffset;
      currentBeat++;
    }
    if (isPlaying) schedulerTimer = setTimeout(schedule, 25);
  }

  function scheduleStep(step, time) {
    // Piano Roll plays together with drums
    if (typeof PianoRoll !== 'undefined') PianoRoll.onStep(step, time);

    const hasSolo = tracks.some(t => t.solo);
    tracks.forEach((track, ti) => {
      if (!track.steps[step]) return;
      if (track.muted) return;
      if (hasSolo && !track.solo) return;
      const vel = track.vels[step] * track.vol;
      const ctx = AudioEngine.getContext();
      const wait = time - ctx.currentTime;
      if (wait < 0) {
        triggerTrack(ti, vel);
      } else {
        setTimeout(() => triggerTrack(ti, vel), wait * 1000);
      }
    });
  }

  function triggerTrack(ti, vel) {
    const track = tracks[ti];
    vel = vel || track.vol;
    if (track.type === 'drum') {
      AudioEngine.playDrum(track.drum, vel);
    } else {
      const synthOpts = getSynthOpts();
      AudioEngine.playNote(track.note || 'C4', 60 / bpm, { ...synthOpts, velocity: vel });
    }
  }

  function updatePlayhead(step, time) {
    const ctx = AudioEngine.getContext();
    const wait = (time - ctx.currentTime) * 1000;
    setTimeout(() => {
      if (!isPlaying) return;
      clearPlayhead();
      document.querySelectorAll(`.step-btn[data-step="${step}"]`).forEach(b => b.classList.add('playing'));
    }, wait);
  }

  function clearPlayhead() {
    document.querySelectorAll('.step-btn.playing').forEach(b => b.classList.remove('playing'));
  }

  // ── STEPS COUNT ──
  function setNumSteps(n) {
    numSteps = n;
    tracks.forEach(t => {
      while (t.steps.length < n) { t.steps.push(false); t.vels.push(0.7); }
    });
    renderGrid();
    renderBeatNumbers();
    setStatus(`Step count: ${n}`);
  }

  // ── ADD TRACK ──
  function addTrack(name, type = 'drum', drum = 'kick') {
    const color = COLORS[tracks.length % COLORS.length];
    tracks.push({
      name: name || `TRACK ${tracks.length+1}`,
      type, drum, color,
      steps: Array(numSteps).fill(false),
      vels:  Array(numSteps).fill(0.7),
      muted: false, solo: false, vol: 1.0,
    });
    renderGrid();
    renderBeatNumbers();
    Mixer.addChannel(tracks[tracks.length-1]);
    toast(`Added track: ${name}`);
  }

  // ── INSTRUMENT LIST (left panel) ──
  function renderInstrumentList() {
    const list = document.getElementById('instrument-list');
    if (!list) return;
    list.innerHTML = '';
    tracks.forEach((t, ti) => {
      const row = document.createElement('div');
      row.className = 'instrument-row' + (ti === activeTrack ? ' active' : '');
      row.dataset.track = ti;

      const dot = document.createElement('div');
      dot.className = 'inst-color-dot';
      dot.style.background = t.color;
      dot.style.boxShadow = `0 0 6px ${t.color}`;

      const name = document.createElement('div');
      name.className = 'inst-name';
      name.textContent = t.name;

      const solo = document.createElement('button');
      solo.className = 'inst-solo' + (t.solo ? ' active' : '');
      solo.textContent = 'S';
      solo.addEventListener('click', e => { e.stopPropagation(); toggleSolo(ti); });

      const mute = document.createElement('button');
      mute.className = 'inst-mute' + (t.muted ? ' active' : '');
      mute.textContent = 'M';
      mute.addEventListener('click', e => { e.stopPropagation(); toggleMute(ti); });

      row.appendChild(dot); row.appendChild(name); row.appendChild(solo); row.appendChild(mute);
      row.addEventListener('click', () => selectTrack(ti));
      list.appendChild(row);
    });
  }

  function selectTrack(ti) {
    activeTrack = ti;
    renderInstrumentList();
    setStatus(`Selected: ${tracks[ti].name}`);
  }

  function toggleSolo(ti) {
    tracks[ti].solo = !tracks[ti].solo;
    renderInstrumentList();
  }

  function toggleMute(ti) {
    tracks[ti].muted = !tracks[ti].muted;
    renderInstrumentList();
  }

  function bindEvents() {
    // Step count buttons
    document.querySelectorAll('.seq-steps-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.seq-steps-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setNumSteps(parseInt(btn.dataset.steps));
      });
    });
    // Swing
    const swingSlider = document.getElementById('swing');
    if (swingSlider) {
      swingSlider.addEventListener('input', e => {
        swing = parseFloat(e.target.value);
        document.getElementById('val-swing').textContent = Math.round(swing * 333) + '%';
      });
    }
    // Add track
    const addBtn = document.getElementById('btn-add-track');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const types = ['kick','snare','hihat','clap','tom','openhat'];
        const existing = tracks.filter(t=>t.type==='drum').length;
        const drum = types[existing % types.length];
        addTrack(drum.toUpperCase(), 'drum', drum);
      });
    }
  }

  function getSynthOpts() {
    return {
      oscType:   document.getElementById('osc-type')?.value || 'sawtooth',
      attack:    parseFloat(document.getElementById('env-attack')?.value || 0.01),
      decay:     parseFloat(document.getElementById('env-decay')?.value || 0.1),
      sustain:   parseFloat(document.getElementById('env-sustain')?.value || 0.5),
      release:   parseFloat(document.getElementById('env-release')?.value || 0.3),
      detune:    parseFloat(document.getElementById('detune')?.value || 0),
      filterFreq:parseFloat(document.getElementById('filter-freq')?.value || 8000),
    };
  }

  function getTracks() { return tracks; }
  function setBPM(b)   { bpm = b; }
  function getActiveTrack() { return tracks[activeTrack]; }

  return { init, start, stop, getTracks, setBPM, setNumSteps, addTrack, renderInstrumentList, selectTrack, getActiveTrack, refreshAllSteps, renderGrid };
})();
