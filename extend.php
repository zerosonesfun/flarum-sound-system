<?php

/*
 * This file is part of zerosonesfun/flarum-sound-system.
 *
 * (c) zerosonesfun
 *
 * For the full copyright and license information,
 * please view the LICENSE file that was distributed with this source code.
 */

use Flarum\Extend;
use Zerosonesfun\SoundSystem\Api\Controller\AppSoundController;
use Zerosonesfun\SoundSystem\Api\Controller\DeleteTrackController;
use Zerosonesfun\SoundSystem\Api\Controller\UploadTrackController;

$forumJs = __DIR__.'/js/dist/forum.js';
$adminJs = __DIR__.'/js/dist/admin.js';
$forumLess = __DIR__.'/resources/less/forum.less';
$adminLess = __DIR__.'/resources/less/admin.less';

$forumFrontend = new Extend\Frontend('forum');
// Flarum 1.x: forum bundle uses webpack runtime that expects flarum.reg._webpack_runtimes (2.0). Polyfill so it exists.
$forumFrontend->content(function (\Flarum\Frontend\Document $document) {
    $document->head[] = '<script>(function(){'
        .'if(typeof window.flarum==="undefined")window.flarum={};'
        .'if(typeof window.flarum.reg==="undefined")window.flarum.reg={};'
        .'if(typeof window.flarum.reg._webpack_runtimes==="undefined")window.flarum.reg._webpack_runtimes={};'
        .'})();</script>';
});
if (file_exists($forumJs)) {
    $forumFrontend->js($forumJs);
}
if (file_exists($forumLess)) {
    $forumFrontend->css($forumLess);
}

$adminFrontend = new Extend\Frontend('admin');
if (file_exists($adminJs)) {
    $adminFrontend->js($adminJs);
}
if (file_exists($adminLess)) {
    $adminFrontend->css($adminLess);
}

return [
    $forumFrontend,
    $adminFrontend,
    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Settings())
        ->default('zerosonesfun-sound-system.dev_console_debug', '0')
        ->default('zerosonesfun-sound-system.app_sounds', '0')
        ->default('zerosonesfun-sound-system.inline_enabled', '1')
        ->default('zerosonesfun-sound-system.global_enabled', '0')
        ->serializeToForum('soundSystemAppSounds', 'zerosonesfun-sound-system.app_sounds', function ($value): bool {
            return (bool) $value;
        })
        ->serializeToForum('soundSystemInlineEnabled', 'zerosonesfun-sound-system.inline_enabled', function ($value): bool {
            return (bool) $value;
        })
        ->serializeToForum('soundSystemGlobalEnabled', 'zerosonesfun-sound-system.global_enabled', function ($value): bool {
            return (bool) $value;
        })
        ->serializeToForum('soundSystemDevConsoleDebug', 'zerosonesfun-sound-system.dev_console_debug', function ($value): bool {
            return (bool) $value;
        })
        ->serializeToForum('soundSystemTracks', 'zerosonesfun-sound-system.tracks', function ($value): array {
            if (!is_string($value) || $value === '') {
                return [];
            }

            $decoded = json_decode($value, true);

            return is_array($decoded) ? $decoded : [];
        }),

    (new Extend\Routes('api'))
        ->get('/sound-system-app-sound', 'sound-system.app-sound', AppSoundController::class)
        ->post('/sound-system-upload', 'sound-system.upload', UploadTrackController::class)
        ->post('/sound-system-delete', 'sound-system.delete', DeleteTrackController::class),
];

