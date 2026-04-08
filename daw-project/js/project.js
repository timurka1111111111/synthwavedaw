/* ═══════════════════════════════════════
   PROJECT — Save / Load / MIDI Export
   ═══════════════════════════════════════ */

const Project = (() => {
  const LS_PREFIX = 'synthwave_save_';

  function getState() {
    const tracks = Sequencer.getTracks();
    return {
      version: '2.0',
      name: document.getElementById('proj-name')?.value || 'My Track',
      bpm: parseInt(document.getElementById('bpm-input')?.value || 120),
      swing: parseFloat(document.getElementById('swing')?.value || 0),
      tracks: tracks.map(t => ({
        name: t.name, type: t.type, drum: t.drum,
        color: t.color, steps: [...t.steps], vels: [...t.vels],
        muted: t.muted, solo: t.solo, vol: t.vol, note: t.note,
      })),
      synth: {
        oscType:    document.getElementById('osc-type')?.value,
        octave:     document.getElementById('osc-octave')?.value,
        detune:     document.getElementById('detune')?.value,
        unison:     document.getElementById('osc-unison')?.value,
        spread:     document.getElementById('unison-spread')?.value,
        attack:     document.getElementById('env-attack')?.value,
        decay:      document.getElementById('env-decay')?.value,
        sustain:    document.getElementById('env-sustain')?.value,
        release:    document.getElementById('env-release')?.value,
        filterFreq: document.getElementById('filter-freq')?.value,
        filterRes:  document.getElementById('filter-res')?.value,
        lfoRate:    document.getElementById('lfo-rate')?.value,
        lfoDepth:   document.getElementById('lfo-depth')?.value,
      },
      fx: {
        reverbOn:   document.getElementById('reverb-on')?.checked,
        reverbSize: document.getElementById('reverb-size')?.value,
        reverbWet:  document.getElementById('reverb-wet')?.value,
        delayOn:    document.getElementById('delay-on')?.checked,
        delayTime:  document.getElementById('delay-time')?.value,
        delayFeed:  document.getElementById('delay-feed')?.value,
        delayWet:   document.getElementById('delay-wet')?.value,
        distOn:     document.getElementById('dist-on')?.checked,
        distDrive:  document.getElementById('dist-drive')?.value,
        chorusOn:   document.getElementById('chorus-on')?.checked,
        eqLo:       document.getElementById('eq-lo')?.value,
        eqMid:      document.getElementById('eq-mid')?.value,
        eqHi:       document.getElementById('eq-hi')?.value,
      },
      tempoMap: [],
      savedAt: new Date().toISOString(),
    };
  }

  function applyState(state) {
    if (!state || state.version !== '2.0') {
      // try basic compat
    }
    if (state.name && document.getElementById('proj-name'))
      document.getElementById('proj-name').value = state.name;

    if (state.bpm) {
      const inp = document.getElementById('bpm-input');
      if (inp) { inp.value = state.bpm; Sequencer.setBPM(state.bpm); }
    }

    // Apply synth
    if (state.synth) {
      const s = state.synth;
      setVal('osc-type', s.oscType); setVal('osc-octave', s.octave);
      setVal('detune', s.detune); setVal('osc-unison', s.unison);
      setVal('unison-spread', s.spread);
      setVal('env-attack', s.attack); setVal('env-decay', s.decay);
      setVal('env-sustain', s.sustain); setVal('env-release', s.release);
      setVal('filter-freq', s.filterFreq); setVal('filter-res', s.filterRes);
      setVal('lfo-rate', s.lfoRate); setVal('lfo-depth', s.lfoDepth);
    }

    // Apply FX
    if (state.fx) {
      const f = state.fx;
      setCheck('reverb-on', f.reverbOn); setVal('reverb-size', f.reverbSize); setVal('reverb-wet', f.reverbWet);
      setCheck('delay-on', f.delayOn); setVal('delay-time', f.delayTime);
      setVal('delay-feed', f.delayFeed); setVal('delay-wet', f.delayWet);
      setCheck('dist-on', f.distOn); setVal('dist-drive', f.distDrive);
      setCheck('chorus-on', f.chorusOn);
      setVal('eq-lo', f.eqLo); setVal('eq-mid', f.eqMid); setVal('eq-hi', f.eqHi);
    }

    setStatus(`Project "${state.name}" loaded`);
    toast(`✅ Loaded: ${state.name}`);
  }

  function setVal(id, val) {
    if (val === undefined || val === null) return;
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  function setCheck(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  }

  // ── SAVE TO FILE ──
  function saveToFile() {
    const state = getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.name || 'project').replace(/\s+/g, '-') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    setStatus(`Saved "${state.name}" to file`);
    toast(`💾 Project saved!`);
  }

  // ── LOAD FROM FILE ──
  function loadFromFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const state = JSON.parse(e.target.result);
        applyState(state);
      } catch(err) {
        toast('❌ Invalid project file');
      }
    };
    reader.readAsText(file);
  }

  // ── LOCALSTORAGE ──
  function saveToLocal() {
    const state = getState();
    const key = LS_PREFIX + Date.now();
    try {
      localStorage.setItem(key, JSON.stringify(state));
      renderSavesList();
      toast(`🗂 Saved to browser: "${state.name}"`);
    } catch(e) {
      toast('❌ LocalStorage full');
    }
  }

  function listLocalSaves() {
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(LS_PREFIX)) continue;
      try {
        const data = JSON.parse(localStorage.getItem(key));
        saves.push({ key, name: data.name, savedAt: data.savedAt, bpm: data.bpm });
      } catch(e) {}
    }
    return saves.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  function renderSavesList() {
    const cont = document.getElementById('proj-saves-list');
    if (!cont) return;
    const saves = listLocalSaves();
    cont.innerHTML = '';
    if (!saves.length) {
      cont.innerHTML = '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-dim);padding:8px">No browser saves yet</div>';
      return;
    }
    saves.forEach(s => {
      const row = document.createElement('div');
      row.className = 'save-item';
      row.innerHTML = `
        <span class="save-item-name">${s.name} <span style="color:var(--accent3)">${s.bpm}bpm</span></span>
        <span class="save-item-date">${new Date(s.savedAt).toLocaleDateString()}</span>
        <button class="save-item-del" title="Delete">✕</button>
      `;
      row.addEventListener('click', e => {
        if (e.target.classList.contains('save-item-del')) {
          localStorage.removeItem(s.key);
          renderSavesList();
          toast('Deleted save');
          return;
        }
        try {
          applyState(JSON.parse(localStorage.getItem(s.key)));
        } catch(e) { toast('❌ Corrupt save'); }
      });
      cont.appendChild(row);
    });
  }

  // ── MIDI EXPORT ──
  function exportMIDI() {
    const tracks = Sequencer.getTracks();
    const bpm = parseInt(document.getElementById('bpm-input')?.value || 120);
    const ticksPerBeat = 96;
    const tempo = Math.round(60000000 / bpm);

    // Build MIDI bytes
    const bytes = [];

    function writeUint32(arr, val) {
      arr.push((val >> 24) & 0xFF, (val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF);
    }
    function writeUint16(arr, val) {
      arr.push((val >> 8) & 0xFF, val & 0xFF);
    }
    function writeVLQ(arr, val) {
      if (val < 128) { arr.push(val); return; }
      const chunks = [];
      while (val > 0) { chunks.unshift(val & 0x7F); val >>= 7; }
      for (let i = 0; i < chunks.length - 1; i++) arr.push(chunks[i] | 0x80);
      arr.push(chunks[chunks.length - 1]);
    }

    // Header chunk
    bytes.push(0x4D,0x54,0x68,0x64); // MThd
    writeUint32(bytes, 6);
    writeUint16(bytes, 1); // format 1
    writeUint16(bytes, tracks.length + 1); // nTracks
    writeUint16(bytes, ticksPerBeat);

    // Tempo track
    const tempoTrack = [];
    tempoTrack.push(0x00, 0xFF, 0x51, 0x03);
    tempoTrack.push((tempo >> 16)&0xFF, (tempo>>8)&0xFF, tempo&0xFF);
    tempoTrack.push(0x00, 0xFF, 0x2F, 0x00); // end of track

    bytes.push(0x4D,0x54,0x72,0x6B); // MTrk
    writeUint32(bytes, tempoTrack.length);
    bytes.push(...tempoTrack);

    const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const drumNotes = { kick:36, snare:38, hihat:42, openhat:46, clap:39, tom:45 };

    tracks.forEach((track, ti) => {
      const trackBytes = [];
      const ticksPerStep = ticksPerBeat / 4;
      const channel = track.type === 'drum' ? 9 : Math.min(ti, 8);

      let events = [];
      track.steps.forEach((on, si) => {
        if (!on) return;
        const tick = si * ticksPerStep;
        const noteNum = track.type === 'drum'
          ? (drumNotes[track.drum] || 36)
          : midiNote(track.note || 'C4');
        const vel = Math.round((track.vels[si] || 0.7) * 127);
        events.push({ tick, type: 'noteOn',  note: noteNum, vel, channel });
        events.push({ tick: tick + ticksPerStep - 2, type: 'noteOff', note: noteNum, vel: 0, channel });
      });
      events.sort((a, b) => a.tick - b.tick);

      let lastTick = 0;
      events.forEach(ev => {
        const delta = ev.tick - lastTick;
        lastTick = ev.tick;
        writeVLQ(trackBytes, delta);
        if (ev.type === 'noteOn')
          trackBytes.push(0x90 | (ev.channel & 0xF), ev.note & 0x7F, ev.vel & 0x7F);
        else
          trackBytes.push(0x80 | (ev.channel & 0xF), ev.note & 0x7F, 0);
      });
      trackBytes.push(0x00, 0xFF, 0x2F, 0x00);

      bytes.push(0x4D,0x54,0x72,0x6B);
      writeUint32(bytes, trackBytes.length);
      bytes.push(...trackBytes);
    });

    const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/midi' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'synthwave-export.mid';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('🎹 MIDI exported!');
    setStatus('MIDI exported successfully');
  }

  function midiNote(noteStr) {
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const m = noteStr.match(/^([A-G]#?)(\d+)$/);
    if (!m) return 60;
    const n = names.indexOf(m[1]);
    return (parseInt(m[2]) + 1) * 12 + n;
  }

  function init() {
    document.getElementById('btn-save-proj')?.addEventListener('click', saveToFile);
    document.getElementById('btn-load-proj')?.addEventListener('click', () => {
      document.getElementById('file-load-proj')?.click();
    });
    document.getElementById('file-load-proj')?.addEventListener('change', e => {
      if (e.target.files[0]) loadFromFile(e.target.files[0]);
    });
    document.getElementById('btn-save-local')?.addEventListener('click', saveToLocal);
    document.getElementById('btn-export-midi')?.addEventListener('click', exportMIDI);
    document.getElementById('btn-export-wav2')?.addEventListener('click', () => {
      document.getElementById('modal-project')?.classList.add('hidden');
      AudioEngine.resume();
      Exporter.toggle();
    });

    // Ctrl+S, Ctrl+O
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveToFile(); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); document.getElementById('file-load-proj')?.click(); }
    });

    renderSavesList();
  }

  return { init, saveToFile, loadFromFile, exportMIDI, renderSavesList };
})();
