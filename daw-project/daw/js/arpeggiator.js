/* ═══════════════════════════════════════
   ARPEGGIATOR
   ═══════════════════════════════════════ */

const Arpeggiator = (() => {
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  let chord = []; // array of note strings e.g. ["C4","E4","G4"]
  let mode = 'up';
  let rate = 16;  // subdivisions per beat
  let octaves = 1;
  let gate = 0.7;
  let enabled = false;
  let arpIndex = 0;
  let arpDirection = 1;
  let schedulerTimer = null;
  let nextTime = 0;
  let currentNote = null;

  function init() {
    buildArpKeyboard();
    bindEvents();
  }

  function buildArpKeyboard() {
    const kb = document.getElementById('arp-keyboard');
    if (!kb) return;
    kb.innerHTML = '';
    const octave = 4;
    // One octave C4-B4 + C5
    const noteOrder = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B','C'];
    noteOrder.forEach((n, i) => {
      const isBlack = n.includes('#');
      const oct = i === 12 ? octave + 1 : octave;
      const noteStr = n + oct;
      const key = document.createElement('div');
      key.className = `arp-key ${isBlack ? 'black' : 'white'}`;
      key.dataset.note = noteStr;
      key.textContent = i % 12 === 0 || i === 12 ? n + oct : '';
      key.addEventListener('click', () => toggleChordNote(noteStr, key));
      kb.appendChild(key);
    });
  }

  function toggleChordNote(note, keyEl) {
    const idx = chord.indexOf(note);
    if (idx >= 0) {
      chord.splice(idx, 1);
      keyEl?.classList.remove('selected');
    } else {
      chord.push(note);
      keyEl?.classList.add('selected');
    }
    updateChordDisplay();
    AudioEngine.resume();
    AudioEngine.playNote(note, 0.2);
  }

  function updateChordDisplay() {
    const el = document.getElementById('arp-chord-display');
    if (el) el.textContent = chord.length ? chord.join(' – ') : 'No notes selected';
  }

  function getArpNotes() {
    if (!chord.length) return [];
    const notes = [];
    for (let o = 0; o < octaves; o++) {
      chord.forEach(n => {
        const m = n.match(/^([A-G]#?)(\d+)$/);
        if (!m) return;
        notes.push(m[1] + (parseInt(m[2]) + o));
      });
    }
    return notes;
  }

  function nextNote(notes) {
    if (!notes.length) return null;
    let note;
    switch(mode) {
      case 'up':
        arpIndex = arpIndex % notes.length;
        note = notes[arpIndex++];
        break;
      case 'down':
        if (arpIndex < 0) arpIndex = notes.length - 1;
        note = notes[arpIndex--];
        break;
      case 'updown':
        note = notes[arpIndex];
        arpIndex += arpDirection;
        if (arpIndex >= notes.length)   { arpIndex = notes.length - 2; arpDirection = -1; }
        if (arpIndex < 0)               { arpIndex = 1; arpDirection = 1; }
        break;
      case 'random':
        note = notes[Math.floor(Math.random() * notes.length)];
        break;
      default:
        note = notes[0];
    }
    return note;
  }

  function tick() {
    if (!enabled || !chord.length) return;
    const ctx = AudioEngine.getContext();
    const bpm = parseInt(document.getElementById('bpm-input')?.value || 120);
    const secPerStep = (60 / bpm) / (rate / 4);

    while (nextTime < ctx.currentTime + 0.1) {
      const notes = getArpNotes();
      const note = nextNote(notes);
      if (note) {
        const wait = Math.max(0, nextTime - ctx.currentTime);
        setTimeout(() => {
          const synthOpts = {
            oscType:    document.getElementById('osc-type')?.value || 'sawtooth',
            attack:     0.005,
            decay:      parseFloat(document.getElementById('env-decay')?.value || 0.1),
            sustain:    parseFloat(document.getElementById('env-sustain')?.value || 0.5),
            release:    parseFloat(document.getElementById('env-release')?.value || 0.3),
            filterFreq: parseFloat(document.getElementById('filter-freq')?.value || 8000),
            velocity:   0.7,
          };
          AudioEngine.playNote(note, secPerStep * gate, synthOpts);
        }, wait * 1000);
      }
      nextTime += secPerStep;
    }
    schedulerTimer = setTimeout(tick, 20);
  }

  function start() {
    if (!enabled) return;
    const ctx = AudioEngine.getContext();
    nextTime = ctx.currentTime + 0.05;
    arpIndex = 0; arpDirection = 1;
    tick();
  }

  function stop() {
    clearTimeout(schedulerTimer);
  }

  function bindEvents() {
    document.getElementById('arp-enabled')?.addEventListener('change', e => {
      enabled = e.target.checked;
      if (enabled) { AudioEngine.resume(); start(); }
      else stop();
    });

    document.querySelectorAll('#arp-mode .arp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#arp-mode .arp-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.val;
        arpIndex = 0; arpDirection = 1;
      });
    });

    document.querySelectorAll('#arp-rate .arp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#arp-rate .arp-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rate = parseInt(btn.dataset.val);
      });
    });

    document.getElementById('arp-octaves')?.addEventListener('input', e => {
      octaves = parseInt(e.target.value);
      document.getElementById('val-arp-oct').textContent = octaves;
    });
    document.getElementById('arp-gate')?.addEventListener('input', e => {
      gate = parseFloat(e.target.value);
      document.getElementById('val-arp-gate').textContent = gate.toFixed(2);
    });
  }

  return { init, start, stop };
})();
