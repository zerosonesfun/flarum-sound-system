import app from 'flarum/forum/app';

import { initInlineAudio, initGlobalPlayer } from './logic';

function appSoundLog(msg, data) {
  if (!app.forum || !app.forum.attribute('soundSystemDevConsoleDebug') || typeof console === 'undefined' || typeof console.log !== 'function') return;
  if (data !== undefined) console.log('[Sound System] App sound:', msg, data);
  else console.log('[Sound System] App sound:', msg);
}

function isDiscussionLink(el, _log) {
  const row = el && el.closest ? el.closest('.DiscussionListItem-main') : null;
  const link = row
    ? row.tagName === 'A'
      ? row
      : (row.querySelector && row.querySelector('a[href]'))
    : (el && el.closest ? el.closest('a[href]') : null) || (el && el.tagName === 'A' ? el : null);
  if (!link || !link.href) {
    if (_log) appSoundLog('isDiscussionLink: no link', { hasRow: !!row, targetTag: el && el.tagName, targetClass: el && el.className });
    return false;
  }
  try {
    const url = new URL(link.href, window.location.origin);
    const path = url.pathname + url.hash;
    const match = /\/d\/\d+/.test(path);
    if (_log) appSoundLog('isDiscussionLink', { href: link.href, path, match });
    return match;
  } catch (err) {
    if (_log) appSoundLog('isDiscussionLink URL error', err);
    return false;
  }
}

function initAppSounds() {
  const apiUrl = app.forum && app.forum.attribute('apiUrl');
  const appSoundsOn = !!(app.forum && app.forum.attribute('soundSystemAppSounds'));
  appSoundLog('init', { apiUrl, appSoundsOn, clickSoundUrl: apiUrl ? apiUrl.replace(/\/$/, '') + '/sound-system-app-sound' : null });
  if (!apiUrl) return;

  function getClickSoundUrl() {
    return apiUrl.replace(/\/$/, '') + '/sound-system-app-sound';
  }

  let lastPlayed = 0;
  function playClickSound() {
    if (!app.forum || !app.forum.attribute('soundSystemAppSounds')) {
      appSoundLog('playClickSound skipped', { reason: 'setting off' });
      return;
    }
    const now = Date.now();
    if (now - lastPlayed < 400) {
      appSoundLog('playClickSound skipped', { reason: 'throttle' });
      return;
    }
    lastPlayed = now;
    const url = getClickSoundUrl();
    appSoundLog('playing', { url });
    const audio = new Audio(url);
    audio.volume = 1;
    audio.play().catch((err) => {
      appSoundLog('play failed', err);
    });
  }

  document.body.addEventListener(
    'click',
    (e) => {
      const ok = isDiscussionLink(e.target, true);
      if (ok) playClickSound();
    },
    true
  );

  document.body.addEventListener(
    'touchend',
    (e) => {
      const ok = isDiscussionLink(e.target, true);
      if (ok) playClickSound();
    },
    { capture: true, passive: true }
  );
}

// Flarum 1.x: run inits when app is ready (no beforeMount in 1.x).
app.initializers.add('zerosonesfun-sound-system-forum', () => {
  const run = () => {
    if (app.forum && app.forum.attribute('soundSystemDevConsoleDebug') && typeof console !== 'undefined' && console.log) {
      console.log('[Sound System] running (forum + DOM ready)');
    }
    initInlineAudio(app);
    initGlobalPlayer(app);
    initAppSounds();
  };
  if (typeof app.beforeMount === 'function') {
    app.beforeMount(run);
  } else {
    // Flarum 1.x: defer so app.forum and DOM are ready
    setTimeout(run, 0);
  }
});

