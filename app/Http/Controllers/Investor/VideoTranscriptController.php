<?php

namespace App\Http\Controllers\Investor;

use App\Http\Controllers\Controller;
use App\Services\Data\DataProvider;
use Illuminate\Http\JsonResponse;

/**
 * Async JSON transcript endpoint consumed by the chatter card on first
 * expand. Returns the discriminated VideoTranscript shape — `timestamped`
 * for YouTube, `prose` for EOD news — or 404 when no transcript is
 * available yet (e.g. the extraction pipeline hasn't run).
 */
class VideoTranscriptController extends Controller
{
    public function show(DataProvider $data, string $video): JsonResponse
    {
        $transcript = $data->transcriptForVideo($video);

        if ($transcript === null) {
            return response()->json(null, 404);
        }

        return response()->json($transcript);
    }
}
