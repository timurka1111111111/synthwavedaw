/* ═══════════════════════════════════════
   PATTERNS / SCENES
   ═══════════════════════════════════════ */

const Patterns = (() => {
  let scenes = [];
  let activeScene = -1;

  function init() {
    // Pre-load 4 demo scenes
    scenes = [];
    render();
    bindEvents();
  }

  function saveCurrentAsScene() {
    const tracks = Sequencer.getTracks();
    const name = prompt('Scene name:', `Scene ${scenes.length + 1}`) || `Scene ${scenes.length + 1}`;
    scenes.push({
      name,
      tracks: tracks.map(t => ({ steps: [...t.steps], vels: [...t.vels] })),
      bpm: parseInt(document.getElementById('bpm-input')?.value || 120),
      createdAt: Date.now(),
    });
    render();
    toast(`💾 Scene "${name}" saved`);
  }

  function loadScene(idx) {
    const scene = scenes[idx];
    if (!scene) return;
    activeScene = idx;

    const tracks = Sequencer.getTracks();
    scene.tracks.forEach((s, i) => {
      if (!tracks[i]) return;
      tracks[i].steps = [...s.steps];
      tracks[i].vels  = [...s.vels];
    });

    // Refresh sequencer UI
    if (typeof Sequencer.refreshAllSteps === 'function') {
      Sequencer.refreshAllSteps();
    } else {
      // Rebuild grid
      Sequencer.init && Sequencer.renderGrid && Sequencer.renderGrid();
    }

    render();
    setStatus(`Scene "${scene.name}" loaded`);
    toast(`▶ Scene "${scene.name}"`);
  }

  function deleteScene(idx) {
    scenes.splice(idx, 1);
    if (activeScene >= scenes.length) activeScene = -1;
    render();
  }

  function render() {
    const grid = document.getElementById('patterns-grid');
    if (!grid) return;
    grid.innerHTML = '';

    scenes.forEach((scene, i) => {
      const card = document.createElement('div');
      card.className = 'scene-card' + (i === activeScene ? ' active' : '');

      const num = document.createElement('div');
      num.className = 'scene-num';
      num.textContent = String(i + 1).padStart(2, '0');

      const name = document.createElement('div');
      name.className = 'scene-name';
      name.textContent = scene.name;

      const bpmBadge = document.createElement('div');
      bpmBadge.style.cssText = 'font-family:var(--font-mono);font-size:8px;color:var(--accent3);margin-bottom:4px;';
      bpmBadge.textContent = `${scene.bpm} BPM`;

      // Mini dot preview (first track steps)
      const preview = document.createElement('div');
      preview.className = 'scene-preview';
      const firstTrack = scene.tracks[0];
      if (firstTrack) {
        firstTrack.steps.slice(0, 16).forEach(on => {
          const dot = document.createElement('div');
          dot.className = 'scene-dot' + (on ? ' on' : '');
          preview.appendChild(dot);
        });
      }

      const btns = document.createElement('div');
      btns.className = 'scene-btns';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'scene-btn';
      loadBtn.textContent = 'LOAD';
      loadBtn.addEventListener('click', e => { e.stopPropagation(); loadScene(i); });

      const delBtn = document.createElement('button');
      delBtn.className = 'scene-btn del';
      delBtn.textContent = 'DEL';
      delBtn.addEventListener('click', e => { e.stopPropagation(); deleteScene(i); });

      btns.appendChild(loadBtn); btns.appendChild(delBtn);
      card.appendChild(num); card.appendChild(name); card.appendChild(bpmBadge);
      card.appendChild(preview); card.appendChild(btns);
      card.addEventListener('click', () => loadScene(i));
      grid.appendChild(card);
    });

    // Add button
    const addCard = document.createElement('div');
    addCard.className = 'scene-add-card';
    addCard.innerHTML = '<span style="font-size:22px">+</span><span>SAVE SCENE</span>';
    addCard.addEventListener('click', saveCurrentAsScene);
    grid.appendChild(addCard);
  }

  function bindEvents() {
    document.getElementById('pat-save')?.addEventListener('click', saveCurrentAsScene);
  }

  return { init, saveCurrentAsScene, loadScene };
})();
