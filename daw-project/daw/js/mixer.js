/* ═══════════════════════════════════════
   MIXER
   ═══════════════════════════════════════ */

const Mixer = (() => {
  let channels = [];
  let vuAnimId = null;

  const DEFAULT_NAMES = ['KICK','SNARE','HIHAT','OPEN','CLAP','SYNTH'];
  const COLORS = ['#ff006e','#00f5ff','#7b00ff','#ffdd00','#00ff9d','#ff6b00'];

  function init(tracks) {
    channels = (tracks || DEFAULT_NAMES.map((n,i) => ({ name: n, color: COLORS[i] }))).map(t => ({
      name: t.name, color: t.color,
      volume: 1.0, pan: 0, muted: false, solo: false,
      eqLo: 0, eqMid: 0, eqHi: 0,
      sends: { reverb: 0, delay: 0 },
    }));
    render();
    animateVU();
  }

  function addChannel(track) {
    channels.push({
      name: track.name, color: track.color,
      volume: 1.0, pan: 0, muted: false, solo: false,
      eqLo: 0, eqMid: 0, eqHi: 0,
      sends: { reverb: 0, delay: 0 },
    });
    render();
  }

  function render() {
    const cont = document.getElementById('mixer-channels');
    if (!cont) return;
    cont.innerHTML = '';
    channels.forEach((ch, i) => {
      cont.appendChild(buildStrip(ch, i));
    });
  }

  function buildStrip(ch, i) {
    const strip = document.createElement('div');
    strip.className = 'mixer-channel';
    strip.dataset.ch = i;

    // Color accent top
    const topBar = document.createElement('div');
    topBar.style.cssText = `height:3px;width:100%;background:${ch.color};border-radius:2px;box-shadow:0 0 8px ${ch.color};`;
    strip.appendChild(topBar);

    // Label
    const lbl = document.createElement('div');
    lbl.className = 'ch-label';
    lbl.textContent = ch.name;
    strip.appendChild(lbl);

    // EQ mini
    const eq = document.createElement('div');
    eq.className = 'ch-eq';
    ['LO','MD','HI'].forEach(e => {
      const k = document.createElement('div');
      k.className = 'ch-eq-knob';
      k.title = e; strip.appendChild(k);
    });
    strip.appendChild(eq);

    // Pan
    const panWrap = document.createElement('div');
    panWrap.className = 'ch-pan-wrap';
    const panLbl = document.createElement('label'); panLbl.textContent = 'PAN';
    const pan = document.createElement('input');
    pan.type='range'; pan.className='ch-pan'; pan.min=-1; pan.max=1; pan.step=0.01; pan.value=ch.pan;
    pan.addEventListener('input', e => { channels[i].pan = parseFloat(e.target.value); });
    panWrap.appendChild(panLbl); panWrap.appendChild(pan);
    strip.appendChild(panWrap);

    // Fader + VU
    const faderWrap = document.createElement('div');
    faderWrap.className = 'ch-fader-wrap';

    const vuPair = document.createElement('div'); vuPair.className = 'ch-vu-pair';
    const vuL = document.createElement('div'); vuL.className = 'ch-vu'; vuL.id = `mx-vu-${i}-l`;
    const vuR = document.createElement('div'); vuR.className = 'ch-vu'; vuR.id = `mx-vu-${i}-r`;
    vuPair.appendChild(vuL); vuPair.appendChild(vuR);

    const fader = document.createElement('input');
    fader.type='range'; fader.className='ch-fader'; fader.orient='vertical';
    fader.min=0; fader.max=1.5; fader.step=0.01; fader.value=ch.volume;
    fader.addEventListener('input', e => {
      channels[i].volume = parseFloat(e.target.value);
      const db = volToDb(channels[i].volume);
      strip.querySelector('.ch-db').textContent = db === -Infinity ? '-∞ dB' : db.toFixed(1) + ' dB';
    });

    faderWrap.appendChild(vuPair); faderWrap.appendChild(fader);
    strip.appendChild(faderWrap);

    // dB label
    const dbLbl = document.createElement('span'); dbLbl.className = 'ch-db'; dbLbl.textContent = '0.0 dB';
    strip.appendChild(dbLbl);

    // Sends
    const sendWrap = document.createElement('div');
    sendWrap.className = 'ch-send';
    const sendLbl = document.createElement('label'); sendLbl.textContent = 'REV';
    const sendSlider = document.createElement('input');
    sendSlider.type='range'; sendSlider.min=0; sendSlider.max=1; sendSlider.step=0.01; sendSlider.value=0;
    sendWrap.appendChild(sendLbl); sendWrap.appendChild(sendSlider);
    strip.appendChild(sendWrap);

    // Buttons
    const btns = document.createElement('div'); btns.className = 'ch-buttons';
    const solo = document.createElement('button'); solo.className='ch-btn solo'; solo.textContent='S';
    const mute = document.createElement('button'); mute.className='ch-btn mute'; mute.textContent='M';
    solo.addEventListener('click', () => {
      channels[i].solo = !channels[i].solo;
      solo.classList.toggle('active', channels[i].solo);
    });
    mute.addEventListener('click', () => {
      channels[i].muted = !channels[i].muted;
      mute.classList.toggle('active', channels[i].muted);
    });
    btns.appendChild(solo); btns.appendChild(mute);
    strip.appendChild(btns);

    return strip;
  }

  function volToDb(v) {
    if (v <= 0) return -Infinity;
    return 20 * Math.log10(v);
  }

  // VU animation — random for demo since we don't have per-channel analysers
  function animateVU() {
    const analysers = AudioEngine.getAnalysers();
    if (analysers && analysers.L) {
      const bufL = new Uint8Array(analysers.L.frequencyBinCount);
      const bufR = new Uint8Array(analysers.R?.frequencyBinCount || analysers.mono.frequencyBinCount);

      function tick() {
        analysers.L.getByteTimeDomainData(bufL);
        const levelL = getRMS(bufL);
        (analysers.R || analysers.mono).getByteTimeDomainData(bufR);
        const levelR = getRMS(bufR);

        // Master VU
        const vuML = document.getElementById('vu-l');
        const vuMR = document.getElementById('vu-r');
        if (vuML) vuML.style.transform = `scaleY(${Math.min(levelL * 2, 1)})`;
        if (vuMR) vuMR.style.transform = `scaleY(${Math.min(levelR * 2, 1)})`;

        // Channel VUs (simulated)
        channels.forEach((ch, i) => {
          const vuL = document.getElementById(`mx-vu-${i}-l`);
          const vuR = document.getElementById(`mx-vu-${i}-r`);
          if (vuL) {
            const lv = (levelL * ch.volume * (0.7 + Math.random() * 0.3));
            vuL.querySelector ? null : (vuL.style.setProperty('--h', lv));
            const bar = vuL.querySelector('::after') || vuL;
            vuL.style.setProperty('--lv', lv);
            // Direct style hack
            vuL.setAttribute('style', vuL.getAttribute('style') || '');
            if (vuL._after === undefined) {
              // Inject inline pseudo via a child div
              if (!vuL.firstChild) {
                const inner = document.createElement('div');
                inner.style.cssText = `position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,#00ff9d,#ffdd00,#ff006e);border-radius:1px;transition:height 0.05s;`;
                vuL.appendChild(inner);
                vuR.appendChild(inner.cloneNode());
              }
            }
            const lvl = Math.min(lv * 150, 100);
            if (vuL.firstChild) vuL.firstChild.style.height = lvl + '%';
            if (vuR.firstChild) vuR.firstChild.style.height = (lvl * (0.8 + Math.random()*0.4)) + '%';
          }
        });

        // Also master header VU
        const hVUL = document.getElementById('vu-l');
        const hVUR = document.getElementById('vu-r');
        if (hVUL) hVUL.style.transform = `scaleY(${Math.min(levelL * 3, 1)})`;
        if (hVUR) hVUR.style.transform = `scaleY(${Math.min(levelR * 3, 1)})`;

        vuAnimId = requestAnimationFrame(tick);
      }
      tick();
    }
  }

  function getRMS(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] / 128) - 1;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  function getChannels() { return channels; }

  return { init, addChannel, getChannels };
})();
