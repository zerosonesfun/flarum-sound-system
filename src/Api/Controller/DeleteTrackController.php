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

use Flarum\Foundation\Paths;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class DeleteTrackController implements RequestHandlerInterface
{
    /** @var Paths */
    protected $paths;

    public function __construct(Paths $paths)
    {
        $this->paths = $paths;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $body = $request->getParsedBody();
        $filename = is_array($body) ? ($body['filename'] ?? null) : null;

        if (!is_string($filename) || $filename === '') {
            return new JsonResponse(['error' => 'missing_filename'], 400);
        }

        // Prevent path traversal: only allow plain filenames.
        if (basename($filename) !== $filename) {
            return new JsonResponse(['error' => 'invalid_filename'], 400);
        }

        $tracksDir = $this->paths->public.DIRECTORY_SEPARATOR.'assets'.DIRECTORY_SEPARATOR.'tracks';
        $targetPath = $tracksDir.DIRECTORY_SEPARATOR.$filename;

        $realTracksDir = realpath($tracksDir);
        $realTarget = realpath($targetPath);

        // If the file doesn't exist, treat as already deleted.
        if ($realTarget === false) {
            return new JsonResponse(['ok' => true]);
        }

        if ($realTracksDir === false || strncmp($realTarget, $realTracksDir.DIRECTORY_SEPARATOR, strlen($realTracksDir) + 1) !== 0) {
            return new JsonResponse(['error' => 'invalid_path'], 400);
        }

        @unlink($realTarget);

        return new JsonResponse(['ok' => true]);
    }
}

