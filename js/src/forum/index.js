import app from 'flarum/forum/app';

import { initInlineAudio, initGlobalPlayer } from './logic';

function appSoundLog(msg, data) {
  if (!app.forum?.attribute('soundSystemDevConsoleDebug') || typeof console?.log !== 'function') return;
  if (data !== undefined) console.log('[Sound System] App sound:', msg, data);
  else console.log('[Sound System] App sound:', msg);
}

function isDiscussionLink(el, _log) {
  const row = el?.closest?.('.DiscussionListItem-main');
  const link = row
    ? row.tagName === 'A'
      ? row
      : row.querySelector?.('a[href]')
    : el?.closest?.('a[href]') || (el?.tagName === 'A' ? el : null);
  if (!link?.href) {
    if (_log) appSoundLog('isDiscussionLink: no link', { hasRow: !!row, targetTag: el?.tagName, targetClass: el?.className });
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
  const apiUrl = app.forum?.attribute('apiUrl');
  const appSoundsOn = !!app.forum?.attribute('soundSystemAppSounds');
  appSoundLog('init', { apiUrl, appSoundsOn, clickSoundUrl: apiUrl ? apiUrl.replace(/\/$/, '') + '/sound-system-app-sound' : null });
  if (!apiUrl) return;

  function getClickSoundUrl() {
    return apiUrl.replace(/\/$/, '') + '/sound-system-app-sound';
  }

  let lastPlayed = 0;
  function playClickSound() {
    if (!app.forum?.attribute('soundSystemAppSounds')) {
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

// Initializers run before app.forum is set and before DOM content exists.
// Run both inits from beforeMount so app.forum and the page DOM are ready.
app.initializers.add('zerosonesfun-sound-system-forum', () => {
  app.beforeMount(() => {
    if (app.forum?.attribute('soundSystemDevConsoleDebug') && typeof console !== 'undefined' && console.log) {
      console.log('[Sound System] beforeMount running (forum + DOM ready)');
    }
    initInlineAudio(app);
    initGlobalPlayer(app);
    initAppSounds();
  });
});

