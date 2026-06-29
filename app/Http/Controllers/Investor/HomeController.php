<?php

namespace App\Http\Controllers\Investor;

use App\Brand\Brand;
use App\Http\Controllers\Controller;
use App\Services\Data\DataProvider;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function index(Brand $brand, DataProvider $data): Response
    {
        return Inertia::render('investor/home', [
            'trendingEntities' => $data->trendingEntities($brand, 12),
            'trendingChannels' => $data->trendingChannels($brand, 8),
            'latestVideos' => $data->latestVideos($brand, 30),
        ]);
    }
}
