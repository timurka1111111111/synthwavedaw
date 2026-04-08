/* ═══════════════════════════════════════
   VISUALIZER
   ═══════════════════════════════════════ */

const Visualizer = (() => {
  let canvas, ctx2d;
  let mode = 'wave';
  let animId = null;
  let analyser = null;
  let bufSize = 1024;
  let dataArr, freqArr;

  function init() {
    canvas = document.getElementById('visualizer');
    if (!canvas) return;
    ctx2d = canvas.getContext('2d');

    const analysers = AudioEngine.getAnalysers();
    analyser = analysers.mono;
    analyser.fftSize = 2048;
    bufSize = analyser.frequencyBinCount;
    dataArr = new Uint8Array(bufSize);
    freqArr = new Uint8Array(bufSize);

    bindEvents();
    animate();
    initSpectrum();
  }

  function bindEvents() {
    document.querySelectorAll('.viz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.viz;
      });
    });
  }

  const freqHistory = [];
  const HISTORY = 40;

  function animate() {
    animId = requestAnimationFrame(animate);
    const W = canvas.width, H = canvas.height;

    analyser.getByteTimeDomainData(dataArr);
    analyser.getByteFrequencyData(freqArr);

    ctx2d.clearRect(0, 0, W, H);
    ctx2d.fillStyle = '#1a1a1a';
    ctx2d.fillRect(0, 0, W, H);

    switch(mode) {
      case 'wave':   drawWave(W, H);   break;
      case 'freq':   drawFreq(W, H);   break;
      case 'circle': drawCircle(W, H); break;
      case '3d':     draw3D(W, H);     break;
    }
  }

  function draw3D(W, H) {
    const snap = new Uint8Array(32);
    const step = Math.floor(freqArr.length / 32);
    for (let i = 0; i < 32; i++) {
      let s = 0; for (let j = 0; j < step; j++) s += freqArr[i*step+j]; snap[i] = s/step;
    }
    freqHistory.unshift([...snap]);
    if (freqHistory.length > HISTORY) freqHistory.pop();
    const rowH = H / HISTORY;
    freqHistory.forEach((row, ri) => {
      const y = ri * rowH, alpha = 1 - ri / HISTORY;
      const barW = W / row.length;
      row.forEach((v, bi) => {
        const barH = (v/255) * rowH * 3;
        const hue = (bi/row.length)*200+160;
        ctx2d.fillStyle = `hsla(${hue},100%,60%,${alpha*0.85})`;
        ctx2d.fillRect(bi*barW, y+rowH-barH, barW-1, barH);
      });
    });
    ctx2d.fillStyle='rgba(0,245,255,0.3)'; ctx2d.font='8px Share Tech Mono';
    ctx2d.fillText('WATERFALL', 2, 10);
  }

  function initSpectrum() {
    const sc = document.getElementById('spectrum-meter');
    if (!sc) return;
    const sCtx = sc.getContext('2d');
    const W = sc.width, H = sc.height;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      analyser.getByteFrequencyData(buf);
      sCtx.clearRect(0,0,W,H); sCtx.fillStyle='#1a1a1a'; sCtx.fillRect(0,0,W,H);
      const bands=22, bw=W/bands, step=Math.floor(buf.length/bands);
      for(let i=0;i<bands;i++){
        let s=0; for(let j=0;j<step;j++) s+=buf[i*step+j];
        const h=(s/step/255)*H, hue=(i/bands)*180+170;
        sCtx.fillStyle=`hsl(${hue},100%,55%)`; sCtx.fillRect(i*bw+1,H-h,bw-2,h);
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  function drawWave(W, H) {
    const grad = ctx2d.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#00f5ff');
    grad.addColorStop(0.5, '#7b00ff');
    grad.addColorStop(1, '#ff006e');

    ctx2d.lineWidth = 1.5;
    ctx2d.strokeStyle = grad;
    ctx2d.shadowBlur = 8;
    ctx2d.shadowColor = '#00f5ff';
    ctx2d.beginPath();

    const sliceW = W / bufSize;
    let x = 0;
    for (let i = 0; i < bufSize; i++) {
      const v = dataArr[i] / 128.0;
      const y = (v * H) / 2;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
      x += sliceW;
    }
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;

    // Center line
    ctx2d.strokeStyle = 'rgba(0,245,255,0.1)';
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(0, H/2); ctx2d.lineTo(W, H/2);
    ctx2d.stroke();
  }

  function drawFreq(W, H) {
    const barW = Math.max(1, W / 64);
    const step = Math.floor(bufSize / 64);

    for (let i = 0; i < 64; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += freqArr[i * step + j];
      const avg = sum / step;
      const barH = (avg / 255) * H;

      const hue = (i / 64) * 220 + 180; // cyan → purple → pink
      ctx2d.fillStyle = `hsl(${hue}, 100%, 60%)`;
      ctx2d.shadowBlur = 6;
      ctx2d.shadowColor = `hsl(${hue}, 100%, 70%)`;
      ctx2d.fillRect(i * barW + 1, H - barH, barW - 1, barH);
    }
    ctx2d.shadowBlur = 0;
  }

  function drawCircle(W, H) {
    const cx = W / 2, cy = H / 2;
    const radius = Math.min(W, H) * 0.3;
    const step = Math.floor(bufSize / 128);

    ctx2d.lineWidth = 1.5;

    for (let i = 0; i < 128; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += dataArr[i * step + j];
      const v = (sum / step / 128) - 1;
      const angle = (i / 128) * Math.PI * 2 - Math.PI / 2;
      const r = radius + v * radius * 0.8;

      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      const hue = (i / 128) * 360;
      ctx2d.strokeStyle = `hsla(${hue}, 100%, 65%, 0.8)`;
      ctx2d.shadowColor = `hsl(${hue}, 100%, 65%)`;
      ctx2d.shadowBlur = 4;

      if (i === 0) { ctx2d.beginPath(); ctx2d.moveTo(x, y); }
      else ctx2d.lineTo(x, y);
    }
    ctx2d.closePath();
    ctx2d.stroke();

    // Inner circle
    ctx2d.shadowBlur = 0;
    ctx2d.strokeStyle = 'rgba(0,245,255,0.15)';
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx2d.stroke();
  }

  return { init };
})();
