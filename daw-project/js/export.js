/* ═══════════════════════════════════════
   EXPORT — Record & Download WAV
   ═══════════════════════════════════════ */

const Exporter = (() => {

  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;
  let recStartTime = null;
  let recTimerRaf = null;
  let destination = null; // MediaStreamAudioDestinationNode

  // ── INIT: wire masterGain → MediaStreamDestination ──
  function init() {
    const ctx = AudioEngine.getContext();
    destination = ctx.createMediaStreamDestination();
    // Tap off the master EQ output
    const analysers = AudioEngine.getAnalysers();
    // Re-connect master output to our recorder destination too
    // We patch into the analyserMono node which sits at the end of the chain
    analysers.mono.connect(destination);
  }

  // ── START RECORDING ──
  function startRecording() {
    if (isRecording) return;
    if (!destination) init();

    recordedChunks = [];
    const stream = destination.stream;

    // Pick best supported format
    const mimeType = getSupportedMime();
    const options = mimeType ? { mimeType } : {};

    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch(e) {
      mediaRecorder = new MediaRecorder(stream);
    }

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      isRecording = false;
      cancelAnimationFrame(recTimerRaf);
      buildAndDownload();
    };

    mediaRecorder.start(100); // collect chunks every 100ms
    isRecording = true;
    recStartTime = performance.now();

    updateRecBtn(true);
    tickTimer();
    setStatus('⏺ RECORDING TO WAV... Press EXPORT again to stop & download');
    toast('⏺ Recording started!');
  }

  // ── STOP & EXPORT ──
  function stopAndExport() {
    if (!isRecording || !mediaRecorder) return;
    mediaRecorder.stop();
    updateRecBtn(false);
    setStatus('💾 Encoding WAV... please wait');
    toast('Processing audio...');
  }

  // ── BUILD WAV / WEBM → DOWNLOAD ──
  function buildAndDownload() {
    const mimeType = mediaRecorder.mimeType || 'audio/webm';
    const blob = new Blob(recordedChunks, { type: mimeType });

    // Try to convert to WAV if we recorded WebM, otherwise just download as-is
    if (mimeType.includes('webm') || mimeType.includes('ogg')) {
      // Decode via AudioContext → encode to WAV PCM
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const arrayBuf = e.target.result;
          const decodeCtx = new AudioContext();
          const audioBuf = await decodeCtx.decodeAudioData(arrayBuf);
          const wavBlob = audioBufferToWav(audioBuf);
          downloadBlob(wavBlob, 'synthwave-export.wav');
          setStatus('✅ WAV exported! Check your downloads.');
          toast('✅ WAV downloaded!');
        } catch(err) {
          // Fallback: download raw
          downloadBlob(blob, 'synthwave-export.webm');
          setStatus('✅ Audio exported (webm). Use VLC or Audacity to convert.');
          toast('✅ Audio downloaded!');
        }
      };
      reader.readAsArrayBuffer(blob);
    } else {
      // Already WAV
      downloadBlob(blob, 'synthwave-export.wav');
      setStatus('✅ WAV exported!');
      toast('✅ WAV downloaded!');
    }
  }

  // ── PCM WAV ENCODER ──
  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate  = buffer.sampleRate;
    const format      = 1; // PCM
    const bitDepth    = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign  = numChannels * bytesPerSample;
    const numSamples  = buffer.length;
    const dataSize    = numSamples * blockAlign;
    const wavSize     = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(wavSize);
    const view        = new DataView(arrayBuffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);           // chunk size
    view.setUint16(20, format, true);       // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = buffer.getChannelData(ch);
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, pcm, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function getSupportedMime() {
    const types = [
      'audio/wav',
      'audio/webm;codecs=pcm',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  // ── TIMER ──
  function tickTimer() {
    if (!isRecording) return;
    const elapsed = (performance.now() - recStartTime) / 1000;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const ms   = Math.floor((elapsed % 1) * 10);
    const recBtn = document.getElementById('export-rec-btn');
    if (recBtn) recBtn.querySelector('.rec-time').textContent =
      `${pad(mins,2)}:${pad(secs,2)}.${ms}`;
    recTimerRaf = requestAnimationFrame(tickTimer);
  }

  function pad(n, len) { return String(n).padStart(len, '0'); }

  // ── UI ──
  function updateRecBtn(recording) {
    const btn = document.getElementById('export-rec-btn');
    if (!btn) return;
    if (recording) {
      btn.classList.add('recording');
      btn.querySelector('.rec-label').textContent = 'STOP & EXPORT';
    } else {
      btn.classList.remove('recording');
      btn.querySelector('.rec-label').textContent = 'EXPORT WAV';
      btn.querySelector('.rec-time').textContent = '';
    }
  }

  function toggle() {
    if (!isRecording) startRecording();
    else stopAndExport();
  }

  function getIsRecording() { return isRecording; }

  return { init, toggle, getIsRecording };
})();
