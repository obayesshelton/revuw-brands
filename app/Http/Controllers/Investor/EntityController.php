<?php

namespace App\Http\Controllers\Investor;

use App\Brand\Brand;
use App\Http\Controllers\Controller;
use App\Services\Data\DataProvider;
use Inertia\Inertia;
use Inertia\Response;

class EntityController extends Controller
{
    /**
     * Screener — a brand-scoped feed of the most recent mentions. The
     * MentionsTable handles its own filter/sort/group/search state via the
     * URL, so no server-side filter parsing is needed here.
     */
    public function index(Brand $brand, DataProvider $data): Response
    {
        return Inertia::render('investor/screener', [
            'recentMentions' => $data->latestMentions($brand, 30),
        ]);
    }

    /**
     * Entity research. The slug is resolved within the brand's entity type and
     * the matching per-type page is rendered (research/stocks|startups).
     */
    public function show(Brand $brand, DataProvider $data, string $slug): Response
    {
        $entity = $data->entity($brand, $slug);

        abort_if($entity === null, 404);

        return Inertia::render("investor/research/{$brand->entityType}", [
            'entity' => $entity,
            'timeline' => $data->entityTimeline($brand, $entity['id']),
            'videos' => $data->entityVideos($brand, $entity['id'], 30),
        ]);
    }
}
