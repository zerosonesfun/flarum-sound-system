# Sound System

**Sound System** adds audio to your Flarum forum: inline playable links in posts and an optional bottom bar player. For Flarum 2.x.

- **Inline audio** — Links to `.mp3`, `.wav`, or `.ogg` in posts become click-to-play players.
- **Global player** — A bar at the bottom of the page with play/pause, previous/next, progress, and volume. You upload the tracks in the admin.
- **App sounds** — Optional short sound when users open a discussion (e.g. a click).

---

## Requirements

- Flarum **2.x**
- PHP **8.2** or higher

---

## Installation

From your Flarum root (where `composer.json` lives), run:

```bash
composer require zerosonesfun/flarum-sound-system
```

Then in the admin panel, go to **Extensions**, find **Sound System**, and enable it.

---

## Updating

From your Flarum root:

```bash
composer update zerosonesfun/flarum-sound-system
```

Then clear the Flarum cache (admin → **Clear cache** or `php flarum cache:clear`). Reload the forum so the browser picks up any changed assets.

---

## Removal

1. In the admin, go to **Extensions**, find **Sound System**, and **Disable** it.
2. From your Flarum root, run:
   ```bash
   composer remove zerosonesfun/flarum-sound-system
   ```
3. Clear the cache and reload the forum.

---

## Settings

All settings are under **Administration** → **Extensions** → **Sound System** (click the gear).

| Setting | What it does |
|--------|----------------|
| **Enable inline audio link player** | Turns links to audio files (e.g. `.mp3`) in post content into a small play/pause button. Users click to play or pause. |
| **Enable global bottom audio bar** | Shows a bar at the bottom of the forum with a playlist. You add tracks in the **Tracks** section below. Users get play/pause, previous/next, progress bar, and volume. |
| **Tracks** | The playlist for the global bar. Use **Add track** to upload files and set title/artist. You can reorder by dragging. |
| **App sounds** | When on, a short click sound plays when someone opens a discussion by clicking or tapping a discussion in the list. The sound file is included in the extension. |
| **Dev console debugging** | For troubleshooting. When on, the extension logs extra messages in the browser console. Leave **off** for normal use. |

---

## Repository

Source code and issue tracker:  
[https://github.com/zerosonesfun/flarum-sound-system](https://github.com/zerosonesfun/flarum-sound-system)

License: MIT.
