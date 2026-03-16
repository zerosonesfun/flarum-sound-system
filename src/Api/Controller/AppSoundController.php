<?php

/*
 * This file is part of zerosonesfun/flarum-sound-system.
 *
 * (c) zerosonesfun
 *
 * For the full copyright and license information,
 * please view the LICENSE file that was distributed with this source code.
 */

namespace Zerosonesfun\SoundSystem\Api\Controller;

use Laminas\Diactoros\Response;
use Laminas\Diactoros\Stream;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class AppSoundController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $path = dirname(__DIR__, 3).'/resources/sounds/tongue.mp3';

        if (!is_file($path) || !is_readable($path)) {
            return new Response('php://temp', 404);
        }

        $stream = new Stream($path);

        return (new Response($stream, 200))
            ->withHeader('Content-Type', 'audio/mpeg')
            ->withHeader('Content-Length', (string) filesize($path));
    }
}
