/* ═══════════════════════════════════════
   AUDIO ENGINE — Web Audio API
   ═══════════════════════════════════════ */

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let analyserL = null, analyserR = null;
  let analyserMono = null;
  let splitter = null;
  let merger = null;
  let reverbNode = null, delayNode = null, distNode = null, chorusNode = null;
  let eqLo = null, eqMid = null, eqHi = null;
  let fxChain = []; // ordered list of fx nodes
  let fxWetGains = {};
  let fxDryGains = {};

  const state = {
    masterVolume: 0.8,
    reverbEnabled: true,
    delayEnabled: false,
    distEnabled: false,
    chorusEnabled: false,
  };

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = ctx.createGain();
    masterGain.gain.value = state.masterVolume;

    // EQ
    eqLo = ctx.createBiquadFilter();
    eqLo.type = 'lowshelf'; eqLo.frequency.value = 200;
    eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking'; eqMid.frequency.value = 1000; eqMid.Q.value = 1;
    eqHi = ctx.createBiquadFilter();
    eqHi.type = 'highshelf'; eqHi.frequency.value = 5000;

    // Analysers
    splitter = ctx.createChannelSplitter(2);
    analyserL = ctx.createAnalyser(); analyserL.fftSize = 2048;
    analyserR = ctx.createAnalyser(); analyserR.fftSize = 2048;
    analyserMono = ctx.createAnalyser(); analyserMono.fftSize = 2048;

    // Build chain: masterGain → EQ chain → analyser → destination
    masterGain.connect(eqLo);
    eqLo.connect(eqMid);
    eqMid.connect(eqHi);
    eqHi.connect(analyserMono);
    eqHi.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    eqHi.connect(ctx.destination);

    // Reverb (convolver-style with feedback)
    reverbNode = createReverb();
    delayNode  = createDelay();
    distNode   = createDistortion();
    chorusNode = createChorus();

    // Wire up FX as parallel wet/dry to masterGain input
    // We intercept before masterGain using a pre-gain
    return ctx;
  }

  function createReverb(size = 0.5) {
    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulseResponse(size * 3 + 0.5, size);
    return convolver;
  }

  function buildImpulseResponse(duration, decay) {
    const sr = ctx.sampleRate;
    const len = sr * duration;
    const buf = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay * 2);
      }
    }
    return buf;
  }

  function createDelay(time = 0.25, feedback = 0.4) {
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = time;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    delay.connect(fb);
    fb.connect(delay);
    return { delay, fb };
  }

  function createDistortion(amount = 50) {
    const dist = ctx.createWaveShaper();
    dist.curve = makeDistortionCurve(amount);
    dist.oversample = '4x';
    return dist;
  }

  function makeDistortionCurve(amount) {
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function createChorus(rate = 1.5, depth = 0.003) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    lfo.type = 'sine';
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = depth;
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();
    return { lfo, lfoGain, delay };
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── SYNTH NOTE ──
  function playNote(note, duration, opts = {}) {
    resume();
    const freq = noteToFreq(note);
    if (!freq) return;

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const env = ctx.createGain();
    const vel = opts.velocity || 0.7;
    const type = opts.oscType || 'sawtooth';
    const detune = opts.detune || 0;
    const attack = opts.attack || 0.01;
    const decay = opts.decay || 0.1;
    const sustain = opts.sustain || 0.5;
    const release = opts.release || 0.3;
    const filterFreq = opts.filterFreq || 8000;

    osc.type = type;
    osc2.type = type;
    osc.frequency.value = freq;
    osc2.frequency.value = freq;
    osc2.detune.value = detune;

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(env);

    // FX routing
    const dry = ctx.createGain(); dry.gain.value = 0.7;
    const fxSend = ctx.createGain(); fxSend.gain.value = 0.3;

    env.connect(dry);
    dry.connect(masterGain);

    // Optional FX
    if (state.reverbEnabled && reverbNode) {
      env.connect(fxSend);
      fxSend.connect(reverbNode);
      reverbNode.connect(masterGain);
    }
    if (state.delayEnabled && delayNode) {
      const ds = ctx.createGain(); ds.gain.value = 0.25;
      env.connect(ds); ds.connect(delayNode.delay);
      delayNode.delay.connect(masterGain);
    }
    if (state.distEnabled && distNode) {
      const dg = ctx.createGain(); dg.gain.value = 0.5;
      env.connect(dg); dg.connect(distNode); distNode.connect(masterGain);
    }
    if (state.chorusEnabled && chorusNode) {
      const cg = ctx.createGain(); cg.gain.value = 0.4;
      env.connect(cg); cg.connect(chorusNode.delay); chorusNode.delay.connect(masterGain);
    }

    // Envelope
    const now = ctx.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vel, now + attack);
    env.gain.linearRampToValueAtTime(vel * sustain, now + attack + decay);
    env.gain.setValueAtTime(vel * sustain, now + duration - release);
    env.gain.linearRampToValueAtTime(0, now + duration);

    osc.start(now); osc2.start(now);
    osc.stop(now + duration + 0.1);
    osc2.stop(now + duration + 0.1);

    return { osc, env, stop: () => {
      const t = ctx.currentTime;
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(env.gain.value, t);
      env.gain.linearRampToValueAtTime(0, t + release);
      osc.stop(t + release + 0.05);
      osc2.stop(t + release + 0.05);
    }};
  }

  // ── DRUM SOUNDS ──
  function playDrum(type, velocity = 0.8) {
    resume();
    const t = ctx.currentTime;
    switch(type) {
      case 'kick':    playKick(t, velocity);    break;
      case 'snare':   playSnare(t, velocity);   break;
      case 'hihat':   playHihat(t, velocity, false); break;
      case 'openhat': playHihat(t, velocity, true);  break;
      case 'clap':    playClap(t, velocity);    break;
      case 'tom':     playTom(t, velocity);     break;
      default:        playKick(t, velocity);
    }
  }

  function playKick(t, vel) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    env.gain.setValueAtTime(vel * 1.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(env); env.connect(masterGain);
    osc.start(t); osc.stop(t + 0.4);
  }

  function playSnare(t, vel) {
    // Tone
    const osc = ctx.createOscillator();
    const oscEnv = ctx.createGain();
    osc.frequency.value = 180;
    oscEnv.gain.setValueAtTime(vel * 0.6, t);
    oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(oscEnv); oscEnv.connect(masterGain);
    osc.start(t); osc.stop(t + 0.2);
    // Noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nEnv = ctx.createGain();
    const nFilt = ctx.createBiquadFilter();
    nFilt.type = 'highpass'; nFilt.frequency.value = 2000;
    nEnv.gain.setValueAtTime(vel * 0.8, t);
    nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    noise.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(masterGain);
    noise.start(t); noise.stop(t + 0.2);
  }

  function playHihat(t, vel, open) {
    const dur = open ? 0.4 : 0.06;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 8000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vel * 0.5, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(filt); filt.connect(env); env.connect(masterGain);
    noise.start(t); noise.stop(t + dur);
  }

  function playClap(t, vel) {
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.012;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = buf;
      const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 0.5;
      const env = ctx.createGain();
      env.gain.setValueAtTime(vel * 0.7, t + offset);
      env.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1);
      noise.connect(filt); filt.connect(env); env.connect(masterGain);
      noise.start(t + offset); noise.stop(t + offset + 0.12);
    }
  }

  function playTom(t, vel) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    env.gain.setValueAtTime(vel, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(env); env.connect(masterGain);
    osc.start(t); osc.stop(t + 0.4);
  }

  // ── FREQ ──
  function noteToFreq(note) {
    const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const match = note.match(/^([A-G]#?)(\d+)$/);
    if (!match) return null;
    const semitones = notes.indexOf(match[1]);
    if (semitones === -1) return null;
    const octave = parseInt(match[2]);
    return 440 * Math.pow(2, (semitones - 9 + (octave - 4) * 12) / 12);
  }

  // ── FX UPDATES ──
  function updateReverb(size) {
    if (!ctx) return;
    reverbNode.buffer = buildImpulseResponse(size * 3 + 0.5, size);
  }

  function updateDelay(time, feedback) {
    if (!ctx || !delayNode) return;
    if (time !== undefined) delayNode.delay.delayTime.value = time;
    if (feedback !== undefined) delayNode.fb.gain.value = feedback;
  }

  function updateDistortion(amount) {
    if (!ctx || !distNode) return;
    distNode.curve = makeDistortionCurve(amount);
  }

  function updateChorus(rate, depth) {
    if (!ctx || !chorusNode) return;
    if (rate !== undefined) chorusNode.lfo.frequency.value = rate;
    if (depth !== undefined) chorusNode.lfoGain.gain.value = depth;
  }

  function updateEQ(lo, mid, hi) {
    if (!ctx) return;
    if (lo  !== undefined) eqLo.gain.value  = lo;
    if (mid !== undefined) eqMid.gain.value = mid;
    if (hi  !== undefined) eqHi.gain.value  = hi;
  }

  function setMasterVolume(v) {
    state.masterVolume = v;
    if (masterGain) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.01);
  }

  function getAnalysers() { return { mono: analyserMono, L: analyserL, R: analyserR }; }
  function getContext() { return ctx; }
  function getState() { return state; }

  return {
    init, resume, playNote, playDrum, noteToFreq,
    updateReverb, updateDelay, updateDistortion, updateChorus, updateEQ,
    setMasterVolume, getAnalysers, getContext, getState,
    get reverbEnabled()  { return state.reverbEnabled; },
    set reverbEnabled(v) { state.reverbEnabled = v; },
    get delayEnabled()   { return state.delayEnabled; },
    set delayEnabled(v)  { state.delayEnabled = v; },
    get distEnabled()    { return state.distEnabled; },
    set distEnabled(v)   { state.distEnabled = v; },
    get chorusEnabled()  { return state.chorusEnabled; },
    set chorusEnabled(v) { state.chorusEnabled = v; },
  };
})();
