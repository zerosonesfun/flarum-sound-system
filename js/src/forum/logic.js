import { Howl, Howler } from 'howler';
import AudioManager from './audioManager';

// Increase HTML5 audio pool and avoid suspend so multiple players stay responsive
if (typeof Howler !== 'undefined') {
  if (Howler.html5PoolSize !== undefined) Howler.html5PoolSize = 24;
  Howler.autoSuspend = false;
}

/**
 * Wrapper around Howl. Use html5: false for reliable pause/resume when the server
 * does not send Accept-Ranges: bytes (Chromium then ignores seek with html5: true).
 */
export function createHowlerPlayer(url, opts = {}) {
  const useHtml5 = opts.html5 !== false;
  const howl = new Howl({
    src: [url],
    html5: useHtml5,
    volume: opts.volume ?? 1,
    onload: opts.onload,
    onloaderror: opts.onloaderror,
    onplayerror: opts.onplayerror,
  });

  let id = null;
  const debugLog = opts.debugLog;

  return {
    /** @param {number} [startPosition] - When id is null (first play), seek to this position after starting. */
    play(startPosition) {
      const pos = id != null ? (howl.seek(id) ?? 0) : (startPosition ?? 0);
      const soundsBefore = howl._sounds?.length ?? 0;
      if (debugLog) debugLog('wrapper.play() before', { idBefore: id, pos, soundsCount: soundsBefore });
      AudioManager.register(this);
      if (id == null) howl.stop();
      id = howl.play(id ?? undefined);
      const soundsAfter = howl._sounds?.length ?? 0;
      if (debugLog) debugLog('wrapper.play() after', { idAfter: id, soundsCount: soundsAfter });
      if (pos > 0 && id != null) howl.seek(pos, id);
      return id;
    },
    pause() {
      if (debugLog) debugLog('wrapper.pause()', { id });
      if (id != null) howl.pause(id);
      AudioManager.clear(this);
    },
    stop() {
      if (id != null) howl.stop(id);
      id = null;
      AudioManager.clear(this);
    },
    seek(pos) {
      if (id != null) howl.seek(pos, id);
    },
    position() {
      if (id != null) return howl.seek(id) ?? 0;
      return 0;
    },
    duration() {
      return howl.duration() || 0;
    },
    playing() {
      return id != null && howl.playing(id);
    },
    volume(v) {
      if (v !== undefined) howl.volume(v);
      return howl.volume();
    },
    raw() {
      return howl;
    },
  };
}

/** One shared requestAnimationFrame loop for all inline progress bars. */
const ProgressClock = {
  activePlayers: new Set(),
  running: false,

  register(player) {
    this.activePlayers.add(player);
    if (!this.running) this.start();
  },

  unregister(player) {
    this.activePlayers.delete(player);
  },

  start() {
    this.running = true;
    const tick = () => {
      for (const player of this.activePlayers) {
        player.updateProgress?.();
      }
      if (this.activePlayers.size > 0) {
        requestAnimationFrame(tick);
      } else {
        this.running = false;
      }
    };
    requestAnimationFrame(tick);
  },
};

/** Inline player: wrapper + progress element + ProgressClock. One per URL (shared across links). */
function createInlinePlayer(url, progressElement, opts = {}) {
  const player = createHowlerPlayer(url, opts);
  player._progressElement = progressElement;

  player.setProgressElement = (el) => {
    player._progressElement = el;
  };

  player.updateProgress = () => {
    const pos = player.position();
    const dur = player.duration();
    if (!player._progressElement) return;
    if (dur > 0) {
      player._progressElement.style.minWidth = '';
      player._progressElement.style.width = `${Math.min(1, pos / dur) * 100}%`;
    } else if (player.playing()) {
      player._progressElement.style.minWidth = '4px';
      player._progressElement.style.width = pos > 0 ? '8%' : '4%';
    } else if (pos > 0) {
      player._progressElement.style.minWidth = '2px';
      player._progressElement.style.width = '1%';
    }
  };

  player.raw().once('load', () => {
    player.updateProgress?.();
  });

  const originalPlay = player.play.bind(player);
  player.play = () => {
    ProgressClock.register(player);
    const id = originalPlay();
    requestAnimationFrame(() => player.updateProgress?.());
    return id;
  };

  const originalPause = player.pause.bind(player);
  player.pause = () => {
    ProgressClock.unregister(player);
    return originalPause();
  };

  return player;
}

const InlineAudioEngine = {
  players: new Map(),

  get(url, progressElement, opts) {
    if (!this.players.has(url)) {
      this.players.set(url, createInlinePlayer(url, progressElement, opts));
    } else {
      this.players.get(url).setProgressElement(progressElement);
    }
    return this.players.get(url);
  },
};

const AUDIO_HREF_RE = /\.(mp3|wav|ogg|flac|m4a|mpeg|mpg|mp4|wave|aac|webm)(\?[^#]*)?(#.*)?$/i;

function isAudioHref(href) {
  return !!href && AUDIO_HREF_RE.test(href);
}

// Inline audio: engine + DOM binder + MutationObserver. One player per URL; shared ProgressClock.
export function initInlineAudio(app) {
  const debug = () => !!(app.forum && app.forum.attribute('soundSystemDevConsoleDebug'));

  function bindInlineAudio(anchor) {
    if (anchor.dataset.soundSystemAp === '1') return;
    const url = anchor.getAttribute('href');
    if (!isAudioHref(url)) return;

    anchor.dataset.soundSystemAp = '1';
    anchor.classList.add('SoundSystem-inline-audio');
    anchor.setAttribute('role', 'button');
    anchor.setAttribute('aria-pressed', 'false');
    anchor.setAttribute('aria-label', app.translator.trans('zerosonesfun-sound-system.forum.inline.play'));

    const originalText = (anchor.textContent || url || '').trim();
    anchor.textContent = '';

    const icon = document.createElement('span');
    icon.className = 'SoundSystem-inline-icon';
    icon.textContent = '▶';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'SoundSystem-inline-label';
    labelSpan.textContent = originalText;

    const progress = document.createElement('span');
    progress.className = 'SoundSystem-inline-progress';
    const progressBar = document.createElement('span');
    progressBar.className = 'SoundSystem-inline-progressBar';
    progress.appendChild(progressBar);

    anchor.appendChild(icon);
    anchor.appendChild(labelSpan);
    anchor.appendChild(progress);

    const opts = {
      onloaderror: debug()
        ? (_id, err) => (typeof console !== 'undefined' && console.warn && console.warn('[Sound System] inline load error', url, err))
        : undefined,
      onplayerror: debug()
        ? (_id, err) => (typeof console !== 'undefined' && console.warn && console.warn('[Sound System] inline play error', url, err))
        : undefined,
    };
    const player = InlineAudioEngine.get(url, progressBar, opts);

    anchor.addEventListener('click', (e) => {
      const forum = app?.forum && typeof app.forum.attribute === 'function' ? app.forum : null;
      if (!forum || !forum.attribute('soundSystemInlineEnabled')) return;

      e.preventDefault();
      e.stopPropagation();

      if (player.playing()) {
        player.pause();
        anchor.classList.remove('playing');
        anchor.setAttribute('aria-pressed', 'false');
        anchor.setAttribute('aria-label', app.translator.trans('zerosonesfun-sound-system.forum.inline.play'));
        icon.textContent = '▶';
      } else {
        player.setProgressElement(progressBar);
        player.play();
        anchor.classList.add('playing');
        anchor.setAttribute('aria-pressed', 'true');
        anchor.setAttribute('aria-label', app.translator.trans('zerosonesfun-sound-system.forum.inline.pause'));
        icon.textContent = '⏸';
      }
    });
  }

  function processNode(node) {
    if (!(node instanceof HTMLElement)) return;
    const links = node.querySelectorAll?.('a[href]') ?? [];
    links.forEach((a) => {
      if (a.closest('.Post-body') && isAudioHref(a.getAttribute('href'))) bindInlineAudio(a);
    });
  }

  function runInitialScan() {
    document.querySelectorAll('.Post-body a[href]').forEach((a) => {
      if (isAudioHref(a.getAttribute('href'))) bindInlineAudio(a);
    });
    if (debug() && typeof console?.log === 'function') {
      console.log('[Sound System] Inline audio: initial scan done');
    }
  }

  setTimeout(runInitialScan, 0);
  setTimeout(runInitialScan, 300);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => processNode(node));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Singleton: bar is created once and reused. Skip re-init if still in DOM so it stays persistent.
let globalPlayerBar = null;

export function initGlobalPlayer(app) {
  const forum = app && app.forum && typeof app.forum.attribute === 'function' ? app.forum : null;
  const log = (msg, data) => {
    if (!forum || !forum.attribute('soundSystemDevConsoleDebug') || typeof console === 'undefined' || !console.log) return;
    if (data !== undefined) console.log('[Sound System]', msg, data);
    else console.log('[Sound System]', msg);
  };

  log('Global player check', { hasForum: !!forum });

  if (!forum) {
    log('Global player: skipped (no app.forum)');
    return;
  }

  const globalEnabled = forum.attribute('soundSystemGlobalEnabled');
  log('Global player', { soundSystemGlobalEnabled: globalEnabled });

  if (!globalEnabled) {
    log('Global player: skipped (setting off)');
    return;
  }

  const tracks = forum.attribute('soundSystemTracks') || [];
  const tracksOk = Array.isArray(tracks) && tracks.length > 0;
  log('Global player tracks', { tracksLength: tracks?.length, tracksOk });

  if (!tracksOk) {
    log('Global player: skipped (no tracks)');
    return;
  }

  if (globalPlayerBar && document.body.contains(globalPlayerBar)) {
    log('Global player: already mounted, skipping (persistent across route changes)');
    return;
  }

  const stateKey = 'zerosonesfun-sound-system-state';

  function loadState() {
    try {
      const raw = localStorage.getItem(stateKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        stateKey,
        JSON.stringify({
          index: currentIndex,
          position: currentPosition,
          playing: isPlaying,
          volume,
        })
      );
    } catch (e) {}
  }

  const state = loadState();
  let currentIndex =
    typeof state.index === 'number' && state.index >= 0 && state.index < tracks.length ? state.index : 0;
  let currentPosition = typeof state.position === 'number' && state.position >= 0 ? state.position : 0;
  let isPlaying = !!state.playing;
  let volume = typeof state.volume === 'number' && state.volume >= 0 && state.volume <= 1 ? state.volume : 1;

  let player = null;
  let nextPlayer = null;
  const elements = {};
  let lastSaveTime = 0;
  let progressUpdateFromTick = false;
  let isScrubbing = false;
  let isSwitchingTrack = false;

  function createUI() {
    const bar = document.createElement('div');
    bar.className = 'SoundSystemPlayer SoundSystemPlayer--hidden';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Sound System player');

    const buttons = document.createElement('div');
    buttons.className = 'SoundSystemPlayer-buttons';

    function makeButton(iconText, labelKey) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'Button SoundSystemPlayer-button';
      btn.setAttribute('aria-label', app.translator.trans(labelKey));
      btn.textContent = iconText;
      return btn;
    }

    const prevBtn = makeButton('⏮', 'zerosonesfun-sound-system.forum.player.previous');
    const playBtn = makeButton('▶', 'zerosonesfun-sound-system.forum.player.play');
    const nextBtn = makeButton('⏭', 'zerosonesfun-sound-system.forum.player.next');

    buttons.appendChild(prevBtn);
    buttons.appendChild(playBtn);
    buttons.appendChild(nextBtn);

    const title = document.createElement('div');
    title.className = 'SoundSystemPlayer-title';

    const progressWrap = document.createElement('div');
    progressWrap.className = 'SoundSystemPlayer-progress';
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.min = '0';
    progress.max = '1000';
    progress.value = '0';
    progress.setAttribute('aria-label', app.translator.trans('zerosonesfun-sound-system.forum.player.progress'));
    progressWrap.appendChild(progress);

    const volumeWrap = document.createElement('div');
    volumeWrap.className = 'SoundSystemPlayer-volume';
    const volumeRange = document.createElement('input');
    volumeRange.type = 'range';
    volumeRange.min = '0';
    volumeRange.max = '100';
    volumeRange.value = String(Math.round(volume * 100));
    volumeRange.setAttribute('aria-label', app.translator.trans('zerosonesfun-sound-system.forum.player.volume'));
    volumeWrap.appendChild(volumeRange);

    const barArea = document.createElement('div');
    barArea.className = 'SoundSystemPlayer-barArea';
    const resumeHint = document.createElement('div');
    resumeHint.className = 'SoundSystemPlayer-resumeHint';
    resumeHint.setAttribute('role', 'status');
    resumeHint.setAttribute('aria-live', 'polite');
    resumeHint.textContent = app.translator.trans('zerosonesfun-sound-system.forum.player.click_play_to_resume');
    barArea.appendChild(resumeHint);
    barArea.appendChild(buttons);
    barArea.appendChild(title);
    barArea.appendChild(progressWrap);
    barArea.appendChild(volumeWrap);
    bar.appendChild(barArea);

    document.body.appendChild(bar);
    globalPlayerBar = bar;
    log('Global player: bar appended to body');

    elements.bar = bar;
    elements.prevBtn = prevBtn;
    elements.playBtn = playBtn;
    elements.nextBtn = nextBtn;
    elements.title = title;
    elements.progress = progress;
    elements.volume = volumeRange;

    bar.classList.remove('SoundSystemPlayer--hidden');
    log('Global player: visible');

    prevBtn.addEventListener('click', () => {
      previousTrack();
    });
    nextBtn.addEventListener('click', () => {
      nextTrack();
    });
    playBtn.addEventListener('click', () => {
      togglePlay();
    });

    function startScrubbing() {
      isScrubbing = true;
      if (player) player.raw().mute(true);
    }
    function endScrubbing() {
      if (!isScrubbing) return;
      isScrubbing = false;
      if (player) {
        player.raw().mute(false);
        if (isPlaying) tick();
      }
    }

    progress.addEventListener('mousedown', startScrubbing);
    progress.addEventListener('pointerdown', startScrubbing);
    document.addEventListener('mouseup', endScrubbing);
    document.addEventListener('pointerup', endScrubbing);

    progress.addEventListener('input', () => {
      if (progressUpdateFromTick || !player) return;
      const ratio = parseInt(progress.value, 10) / 1000;
      const dur = player.duration() || 0;
      if (dur > 0) {
        const seekTo = ratio * dur;
        player.seek(seekTo);
        currentPosition = seekTo;
        saveState();
      }
    });

    volumeRange.addEventListener('input', () => {
      const v = parseInt(volumeRange.value, 10) / 100;
      volume = Math.min(1, Math.max(0, v));
      if (player) player.volume(volume);
      saveState();
    });

    updateUI();
  }

  function trackLabel(track) {
    const title = String(track.title || '').trim();
    const artist = String(track.artist || '').trim();
    if (title || artist) {
      return title && artist ? title + ' — ' + artist : title || artist;
    }
    return track.url || app.translator.trans('zerosonesfun-sound-system.forum.player.no_tracks');
  }

  function updateUI() {
    if (!elements.title) return;

    const track = tracks[currentIndex];
    if (track) {
      elements.title.textContent = trackLabel(track);
    } else {
      elements.title.textContent = app.translator.trans('zerosonesfun-sound-system.forum.player.no_tracks');
    }

    elements.playBtn.textContent = isPlaying ? '⏸' : '▶';
    elements.playBtn.setAttribute(
      'aria-label',
      isPlaying
        ? app.translator.trans('zerosonesfun-sound-system.forum.player.pause')
        : app.translator.trans('zerosonesfun-sound-system.forum.player.play')
    );
  }

  function preloadNext(index) {
    const nextIndex = (index + 1) % tracks.length;
    const nextTrack = tracks[nextIndex];
    if (!nextTrack) return;
    nextPlayer = createHowlerPlayer(nextTrack.url, { volume, html5: false });
    nextPlayer.raw().load();
  }

  function playNextTrack() {
    currentIndex = (currentIndex + 1) % tracks.length;
    if (nextPlayer) {
      if (player) player.raw().unload();
      player = nextPlayer;
      nextPlayer = null;
      player.play();
      preloadNext(currentIndex);
      isPlaying = true;
      saveState();
      updateUI();
      tick();
    } else {
      loadTrack(currentIndex, () => {
        player.play();
        isPlaying = true;
        saveState();
        updateUI();
        tick();
      });
    }
  }

  function saveProgress() {
    const now = Date.now();
    if (now - lastSaveTime < 1000) return;
    lastSaveTime = now;
    if (player) {
      const pos = player.position();
      if (typeof pos === 'number' && pos >= 0) currentPosition = pos;
    }
    saveState();
  }

  function tick() {
    if (!player || !elements.progress) return;
    const dur = player.duration() || 0;
    const pos = player.position();
    if (dur > 0) {
      progressUpdateFromTick = true;
      elements.progress.value = String(Math.round((pos / dur) * 1000));
      progressUpdateFromTick = false;
      if (player.playing()) {
        saveProgress();
        requestAnimationFrame(tick);
      }
    } else {
      progressUpdateFromTick = true;
      elements.progress.value = '0';
      progressUpdateFromTick = false;
      if (player.playing()) requestAnimationFrame(tick);
    }
  }

  function loadTrack(index, callback, resetPosition = true) {
    if (!tracks[index]) return;
    log('loadTrack start', { index, hasCallback: !!callback, isPlayingBefore: isPlaying });
    currentIndex = index;
    if (resetPosition) currentPosition = 0;
    isSwitchingTrack = true;

    if (player) {
      player.raw().unload();
      player = null;
    }

    const track = tracks[index];
    const clearSwitching = () => {
      isSwitchingTrack = false;
    };
    const switchingFallback = setTimeout(clearSwitching, 5000);
    let loadLogicRun = false;
    const runWhenLoaded = (p) => {
      if (loadLogicRun) return;
      loadLogicRun = true;
      clearTimeout(switchingFallback);
      log('load ready', { playerIsThis: player === p });
      if (player !== p) return;
      if (currentPosition > 0) p.seek(currentPosition);
      const dur = p.duration();
      if (elements.progress && dur > 0) {
        elements.progress.value = String(Math.round((currentPosition / dur) * 1000));
      }
      updateUI();
      if (callback) setTimeout(() => {
        log('load callback running', { playerIsThis: player === p, isPlaying, isSwitchingTrack });
        if (player !== p) return;
        callback();
        log('load callback done', { isSwitchingTrackBeforeClear: isSwitchingTrack });
        clearSwitching();
      }, 0);
      if (!callback) clearSwitching();
    };

    const thisPlayer = createHowlerPlayer(track.url, {
      volume,
      html5: false,
      debugLog: log,
      onload: () => runWhenLoaded(thisPlayer),
    });
    player = thisPlayer;

    log('loadTrack: created player', { index, url: track.url, hasCallback: !!callback });
    thisPlayer.raw().load();
    thisPlayer.raw().once('end', () => playNextTrack());
    thisPlayer.raw().once('load', () => runWhenLoaded(thisPlayer));

    thisPlayer.raw().on('play', () => {
      isPlaying = true;
      if (elements.bar) elements.bar.removeAttribute('data-autoplay-blocked');
      saveState();
      updateUI();
      tick();
    });

    player.raw().on('pause', () => {
      log('pause event', { isSwitchingTrack, isPlayingBefore: isPlaying });
      if (isSwitchingTrack) {
        log('pause ignored (switching track)');
        return;
      }
      isPlaying = false;
      const pos = player.position();
      if (typeof pos === 'number' && pos >= 0) currentPosition = pos;
      saveState();
      updateUI();
    });

    preloadNext(index);
    saveState();
    updateUI();
  }

  window.addEventListener('beforeunload', () => {
    if (player) {
      const pos = player.position();
      if (typeof pos === 'number' && pos >= 0) currentPosition = pos;
    }
    saveState();
  });

  function playCurrent() {
    isSwitchingTrack = false;
    log('playCurrent()', { hasPlayer: !!player, isPlaying: player?.playing?.(), currentPosition });
    if (!player) {
      loadTrack(currentIndex, () => {
        if (!player) return;
        log('playCurrent() from load callback', { isPlaying: player.playing() });
        if (!player.playing()) {
          player.play(currentPosition);
        }
        tick();
      });
      return;
    }
    if (!player.playing()) {
      player.play(currentPosition);
    } else {
      log('playCurrent() skipped – already playing');
    }
    tick();
  }

  function pauseCurrent() {
    isSwitchingTrack = false;
    log('pauseCurrent()', { hasPlayer: !!player });
    if (player) player.pause();
  }

  function togglePlay() {
    if (!player) {
      playCurrent();
      return;
    }
    if (player.playing()) {
      pauseCurrent();
    } else {
      playCurrent();
    }
  }

  function nextTrack() {
    if (tracks.length === 0) return;
    log('nextTrack', { isPlaying });
    const next = (currentIndex + 1) % tracks.length;
    loadTrack(next, () => {
      log('nextTrack load callback', { isPlaying, hasPlayer: !!player });
      if (isPlaying) {
        player.play(0);
        tick();
      } else {
        log('nextTrack: skipped play (isPlaying false)');
      }
    });
  }

  function previousTrack() {
    if (tracks.length === 0) return;
    log('previousTrack', { isPlaying });
    const prev = (currentIndex - 1 + tracks.length) % tracks.length;
    loadTrack(prev, () => {
      log('previousTrack load callback', { isPlaying, hasPlayer: !!player });
      if (isPlaying) {
        player.play(0);
        tick();
      } else {
        log('previousTrack: skipped play (isPlaying false)');
      }
    });
  }

  log('Global player: creating UI');
  createUI();
  loadTrack(currentIndex, () => {
    log('init load callback', { isPlaying, currentPosition, playerPlaying: player?.playing?.() });
    if (isPlaying) {
      const resumeOnGesture = (e) => {
        if (e.type === 'click' && elements.playBtn && e.target && elements.playBtn.contains(e.target)) return;
        playCurrent();
        document.removeEventListener('click', resumeOnGesture, true);
        document.removeEventListener('keydown', resumeOnGesture, true);
      };
      document.addEventListener('click', resumeOnGesture, { once: true, capture: true });
      document.addEventListener('keydown', resumeOnGesture, { once: true, capture: true });

      // Do NOT play here – no user gesture yet, so AudioContext would be blocked and can
      // leave Howler in a state that causes double playback when user later clicks play.
      if (elements.bar) elements.bar.setAttribute('data-autoplay-blocked', '1');
      updateUI();
      tick();
    }
  }, false);
  log('Global player: init complete');
}

