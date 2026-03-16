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
use Flarum\Http\UrlGenerator;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Http\Server\RequestHandlerInterface;

class UploadTrackController implements RequestHandlerInterface
{
    /** @var UrlGenerator */
    protected $url;
    /** @var Paths */
    protected $paths;

    public function __construct(UrlGenerator $url, Paths $paths)
    {
        $this->url = $url;
        $this->paths = $paths;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertAdmin();

        $uploadedFiles = $request->getUploadedFiles();
        // Accept single 'file' (our form) or 'files' array (FoF-style); normalize to one UploadedFile
        $file = $this->getSingleFile($uploadedFiles);

        if ($file === null) {
            return new JsonResponse([
                'error' => 'upload_failed',
                'message' => 'No file in request. Use form field "file" or "files".',
            ], 400);
        }

        if ($file->getError() !== UPLOAD_ERR_OK) {
            $msg = $this->uploadErrorMessage($file->getError());
            $payload = [
                'error' => 'upload_failed',
                'upload_error_code' => $file->getError(),
                'message' => $msg,
            ];
            if (in_array($file->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
                $payload['max_upload_size'] = ini_get('upload_max_filesize');
                $payload['max_post_size'] = ini_get('post_max_size');
                $payload['message'] = $msg . ' Server limit: ' . $payload['max_upload_size'] . ' (post_max_size: ' . $payload['max_post_size'] . ').';
            }
            return new JsonResponse($payload, 400);
        }

        $clientFilename = $file->getClientFilename() ?? '';
        $extension = strtolower(pathinfo($clientFilename, PATHINFO_EXTENSION));

        if (!in_array($extension, ['mp3', 'wav', 'ogg'], true)) {
            return new JsonResponse([
                'error' => 'invalid_type',
                'message' => 'Only .mp3, .wav, and .ogg are allowed.',
            ], 400);
        }

        $targetDir = $this->paths->public.DIRECTORY_SEPARATOR.'assets'.DIRECTORY_SEPARATOR.'tracks';

        if (!is_dir($targetDir) && !mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
            return new JsonResponse(['error' => 'cannot_create_directory'], 500);
        }

        try {
            $basename = bin2hex(random_bytes(16));
        } catch (\Exception) {
            $basename = uniqid('sound', true);
        }

        $filename = $basename.'.'.$extension;
        $targetPath = $targetDir.DIRECTORY_SEPARATOR.$filename;

        $file->moveTo($targetPath);

        $publicPath = 'assets/tracks/'.$filename;
        $url = $this->url->to('forum')->path($publicPath);

        return new JsonResponse([
            'url' => $url,
            'filename' => $filename,
        ]);
    }

    /**
     * Get a single uploaded file from request. Supports 'file' (single) or 'files' (array, first item).
     */
    private function getSingleFile(array $uploadedFiles): ?UploadedFileInterface
    {
        if (isset($uploadedFiles['file']) && $uploadedFiles['file'] instanceof UploadedFileInterface) {
            return $uploadedFiles['file'];
        }
        if (isset($uploadedFiles['files']) && is_array($uploadedFiles['files'])) {
            $first = $uploadedFiles['files'][0] ?? null;

            return $first instanceof UploadedFileInterface ? $first : null;
        }

        return null;
    }

    private function uploadErrorMessage($code)
    {
        switch ($code) {
            case UPLOAD_ERR_INI_SIZE:
                return 'File exceeds server upload_max_filesize.';
            case UPLOAD_ERR_FORM_SIZE:
                return 'File exceeds form MAX_FILE_SIZE.';
            case UPLOAD_ERR_PARTIAL:
                return 'File was only partially uploaded.';
            case UPLOAD_ERR_NO_FILE:
                return 'No file was uploaded.';
            case UPLOAD_ERR_NO_TMP_DIR:
                return 'Missing temporary folder.';
            case UPLOAD_ERR_CANT_WRITE:
                return 'Failed to write file to disk.';
            case UPLOAD_ERR_EXTENSION:
                return 'A PHP extension stopped the upload.';
            default:
                return 'Upload failed (error '.$code.').';
        }
    }
}

