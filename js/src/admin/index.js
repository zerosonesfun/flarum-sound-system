import app from 'flarum/admin/app';
export { default as extend } from './extend.js';
const m = window.m;

app.initializers.add('zerosonesfun-sound-system-admin', () => {
  const TracksSetting = {
    oninit(vnode) {
      const settingKey = 'zerosonesfun-sound-system.tracks';
      const raw = app.data.settings[settingKey] || '[]';
      let tracks;

      try {
        tracks = JSON.parse(raw);
        if (!Array.isArray(tracks)) tracks = [];
      } catch (e) {
        tracks = [];
      }

      vnode.state.settingKey = settingKey;
      vnode.state.tracks = tracks;
      vnode.state.mode = 'idle'; // idle | uploading | meta
      vnode.state.uploadError = null;
      vnode.state.draft = {
        filename: null,
        url: null,
        title: '',
        artist: '',
        file: null,
        progress: 0,
      };
    },

    view(vnode) {
      const { settingKey } = vnode.state;
      const tracks = vnode.state.tracks;
      const mode = vnode.state.mode;
      const draft = vnode.state.draft;

      function persistTracks() {
        const value = JSON.stringify(tracks);

        // Keep local settings in sync (admin UI reads from here)
        app.data.settings[settingKey] = value;

        const body = {};
        body[settingKey] = value;

        app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/settings',
          body,
        }).catch(() => {});
      }

      function resetDraft() {
        vnode.state.mode = 'idle';
        vnode.state.draft = {
          filename: null,
          url: null,
          title: '',
          artist: '',
          file: null,
          progress: 0,
        };
      }

      function createTrackFromDraft() {
        if (!draft.url || !draft.filename || !draft.title || !draft.artist) return null;
        return {
          url: draft.url,
          filename: draft.filename,
          title: draft.title,
          artist: draft.artist,
        };
      }

      function startAddTrack() {
        if (vnode.state.mode !== 'idle') return;
        vnode.state.uploadError = null;
        vnode.state.mode = 'uploading';
        vnode.state.draft.progress = 0;
      }

      function isDebug() {
        const v = app.data.settings['zerosonesfun-sound-system.dev_console_debug'];
        return v === '1' || v === 1 || v === true || v === 'true';
      }
      function log(msg, data) {
        if (!isDebug() || typeof console === 'undefined' || !console.log) return;
        if (typeof data !== 'undefined') console.log('[Sound System]', msg, data);
        else console.log('[Sound System]', msg);
      }

      function uploadFile(file) {
        if (!file) return;
        vnode.state.uploadError = null;
        draft.file = file;
        draft.progress = 0;
        vnode.state.mode = 'uploading';

        const apiUrl = app.forum.attribute('apiUrl') + '/sound-system-upload';
        log('Upload starting', { url: apiUrl, fileName: file.name, fileSize: file.size, fileType: file.type, hasCsrfToken: !!app.session.csrfToken });

        const formData = new FormData();
        formData.append('file', file);
        if (app.session.csrfToken) formData.append('csrfToken', app.session.csrfToken);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl, true);
        xhr.withCredentials = true;
        if (app.session.csrfToken) xhr.setRequestHeader('X-CSRF-Token', app.session.csrfToken);
        // Do NOT set Content-Type: browser must set multipart/form-data with boundary for FormData

        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          draft.progress = Math.round((evt.loaded / evt.total) * 100);
          m.redraw();
        };

        xhr.onload = () => {
          log('Response received', { status: xhr.status, statusText: xhr.statusText });

          if (xhr.status < 200 || xhr.status >= 300) {
            let msg = 'Upload failed';
            let body = {};
            try {
              body = JSON.parse(xhr.responseText || '{}');
              if (body.message) msg = body.message;
              else if (body.error) msg = body.error;
            } catch (_) {}
            log('Error response body', body);
            if (body.debug) log('Server debug info', body.debug);
            vnode.state.uploadError = msg;
            resetDraft();
            m.redraw();
            return;
          }
          vnode.state.uploadError = null;

          try {
            const json = JSON.parse(xhr.responseText);
            if (!json || !json.url || !json.filename) {
              log('Unexpected success body', json);
              resetDraft();
              m.redraw();
              return;
            }
            log('Upload success', { url: json.url, filename: json.filename });
            draft.url = json.url;
            draft.filename = json.filename;
            vnode.state.mode = 'meta';
            m.redraw();
          } catch (e) {
            log('Parse error on success', e);
            resetDraft();
            m.redraw();
          }
        };

        xhr.onerror = () => {
          log('XHR network error (no response received)');
          resetDraft();
          m.redraw();
        };

        xhr.send(formData);
      }

      function saveTrack() {
        const track = createTrackFromDraft();
        if (!track) return;
        tracks.push(track);
        persistTracks();
        resetDraft();
      }

      function removeTrack(index) {
        const track = tracks[index];
        if (!track) return;

        tracks.splice(index, 1);
        persistTracks();
        m.redraw();

        if (track.filename) {
          fetch(app.forum.attribute('apiUrl') + '/sound-system-delete', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': app.session.csrfToken,
            },
            body: JSON.stringify({ filename: track.filename }),
          }).catch(() => {});
        }
      }

      function onDragStart(e, index) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      }

      function onDrop(e, index) {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isNaN(from) || from === index) return;
        const [moved] = tracks.splice(from, 1);
        tracks.splice(index, 0, moved);
        persistTracks();
        m.redraw();
      }

      function onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }

      return m('.Form-group', [
        m('label', app.translator.trans('zerosonesfun-sound-system.admin.settings.tracks_label')),
        m('p.helpText', app.translator.trans('zerosonesfun-sound-system.admin.settings.tracks_help')),

        m('.SoundSystemTracksLayout', [
          m('.SoundSystemTracksAdd', [
            vnode.state.mode === 'idle' &&
              m(
                'button.Button.Button--primary',
                {
                  type: 'button',
                  onclick: startAddTrack,
                },
                app.translator.trans('zerosonesfun-sound-system.admin.settings.add_track')
              ),

            vnode.state.uploadError &&
              m('p.helpText', { style: { color: 'var(--alert-error-color, #c0392b)' } }, vnode.state.uploadError),

            vnode.state.mode === 'uploading' &&
              m('.SoundSystemTrack.SoundSystemTrack--draft', [
                m('.SoundSystemTrack-fields', [
                  m('label.Button.SoundSystemTrack-upload', [
                    app.translator.trans('zerosonesfun-sound-system.admin.settings.upload'),
                    m('input', {
                      type: 'file',
                      accept: '.mp3,.wav,.ogg,audio/*',
                      style: { display: 'none' },
                      onchange: (e) => {
                        const file = e.target.files && e.target.files[0];
                        e.target.value = '';
                        uploadFile(file);
                      },
                    }),
                  ]),

                  draft.file &&
                    m('progress', {
                      max: 100,
                      value: draft.progress,
                      style: { width: '100%' },
                      'aria-label': app.translator.trans('zerosonesfun-sound-system.admin.settings.uploading'),
                    }),
                ]),
              ]),

            vnode.state.mode === 'meta' &&
              m('.SoundSystemTrack.SoundSystemTrack--draft', [
                m('.SoundSystemTrack-fields', [
                  m('input.FormControl', {
                    type: 'text',
                    placeholder: app.translator.trans('zerosonesfun-sound-system.admin.settings.track_artist'),
                    value: draft.artist,
                    oninput: (e) => {
                      draft.artist = e.target.value;
                    },
                  }),
                  m('input.FormControl', {
                    type: 'text',
                    placeholder: app.translator.trans('zerosonesfun-sound-system.admin.settings.track_title'),
                    value: draft.title,
                    oninput: (e) => {
                      draft.title = e.target.value;
                    },
                  }),
                ]),
                m(
                  'button.Button.Button--primary',
                  {
                    type: 'button',
                    onclick: saveTrack,
                    disabled: !draft.title || !draft.artist,
                  },
                  app.translator.trans('zerosonesfun-sound-system.admin.settings.save_track')
                ),
              ]),
          ]),

          m('.SoundSystemTracksList', [
            tracks.length === 0 &&
              m('p.helpText', app.translator.trans('zerosonesfun-sound-system.admin.settings.empty_tracks')),
            tracks.map((track, index) =>
              m(
                '.SoundSystemTrack',
                {
                  key: track.filename || index,
                  draggable: true,
                  ondragstart: (e) => onDragStart(e, index),
                  ondragover: onDragOver,
                  ondrop: (e) => onDrop(e, index),
                },
                [
                  m('.SoundSystemTrack-fields', [
                    m('div.SoundSystemTrack-artist', [track.artist]),
                    m('div.SoundSystemTrack-title', [track.title]),
                  ]),
                  m(
                    'button.Button.Button--icon Button--danger',
                    {
                      type: 'button',
                      title: app.translator.trans('zerosonesfun-sound-system.admin.settings.delete_track'),
                      'aria-label': app.translator.trans('zerosonesfun-sound-system.admin.settings.delete_track'),
                      onclick: () => removeTrack(index),
                    },
                    m('i.icon fas fa-trash')
                  ),
                ]
              )
            ),
          ]),
        ]),
      ]);
    },
  };

  app.registry
    .for('zerosonesfun-sound-system')
    .registerSetting({
      setting: 'zerosonesfun-sound-system.inline_enabled',
      type: 'boolean',
      label: app.translator.trans('zerosonesfun-sound-system.admin.settings.inline_label'),
      help: app.translator.trans('zerosonesfun-sound-system.admin.settings.inline_help'),
    })
    .registerSetting({
      setting: 'zerosonesfun-sound-system.global_enabled',
      type: 'boolean',
      label: app.translator.trans('zerosonesfun-sound-system.admin.settings.global_label'),
      help: app.translator.trans('zerosonesfun-sound-system.admin.settings.global_help'),
    })
    .registerSetting({
      setting: 'zerosonesfun-sound-system.app_sounds',
      type: 'boolean',
      label: app.translator.trans('zerosonesfun-sound-system.admin.settings.app_sounds_label'),
      help: app.translator.trans('zerosonesfun-sound-system.admin.settings.app_sounds_help'),
    })
    .registerSetting({
      setting: 'zerosonesfun-sound-system.dev_console_debug',
      type: 'boolean',
      label: app.translator.trans('zerosonesfun-sound-system.admin.settings.dev_console_debug_label'),
      help: app.translator.trans('zerosonesfun-sound-system.admin.settings.dev_console_debug_help'),
    })
    .registerSetting(() => m(TracksSetting));
});

