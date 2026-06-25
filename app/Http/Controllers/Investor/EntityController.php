<?php

namespace App\Http\Controllers\Investor;

use App\Brand\Brand;
use App\Http\Controllers\Controller;
use App\Services\Data\DataProvider;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EntityController extends Controller
{
    /**
     * Entity screener. Filters live in the URL; the brand fixes the type, so
     * there is no type filter exposed to the user.
     */
    public function index(Request $request, Brand $brand, DataProvider $data): Response
    {
        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'minMentions' => $this->intOrNull($request->query('minMentions')),
            'maxMentions' => $this->intOrNull($request->query('maxMentions')),
            'sort' => in_array($request->query('sort'), ['mentionCount', 'name', 'contentCount'], true)
                ? (string) $request->query('sort')
                : 'mentionCount',
            'dir' => $request->query('dir') === 'asc' ? 'asc' : 'desc',
            'page' => max(1, (int) $request->query('page', 1)),
            'perPage' => 12,
        ];

        return Inertia::render('investor/screener', [
            'result' => $data->screenEntities($brand, $filters),
            'filters' => $filters,
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
            'topSources' => $data->entityTopSources($brand, $entity['id']),
            'videos' => $data->entityVideos($brand, $entity['id'], 30),
        ]);
    }

    private function intOrNull(mixed $value): ?int
    {
        return ($value === null || $value === '') ? null : (int) $value;
    }
}
