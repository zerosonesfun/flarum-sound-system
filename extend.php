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

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/resources/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/resources/less/admin.less'),

    new Extend\Locales(__DIR__.'/resources/locale'),

    (new Extend\Settings())
        ->default('zerosonesfun-sound-system.dev_console_debug', false)
        ->default('zerosonesfun-sound-system.app_sounds', false)
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

    (new Extend\Csrf())
        ->exemptRoute('sound-system.upload'),
];

