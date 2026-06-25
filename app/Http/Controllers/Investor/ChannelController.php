<?php

namespace App\Http\Controllers\Investor;

use App\Brand\Brand;
use App\Http\Controllers\Controller;
use App\Services\Data\DataProvider;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ChannelController extends Controller
{
    /**
     * Channel search.
     */
    public function index(Request $request, Brand $brand, DataProvider $data): Response
    {
        $q = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));

        return Inertia::render('investor/channels', [
            'result' => $data->searchChannels($brand, $q, $page, 24),
            'filters' => ['q' => $q],
        ]);
    }

    /**
     * Channel profile.
     */
    public function show(Brand $brand, DataProvider $data, string $handle): Response
    {
        $channel = $data->channel($brand, $handle);

        abort_if($channel === null, 404);

        return Inertia::render('investor/channel', [
            'channel' => $channel,
            'videos' => $data->channelVideos($brand, $channel['id'], 30),
        ]);
    }
}
