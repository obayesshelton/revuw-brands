<?php

namespace App\Http\Controllers\Investor;

use App\Http\Controllers\Controller;
use App\Services\Data\PriceProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Async JSON price endpoints consumed by the price tag and chart. Kept under
 * /api/* so they render JSON, and lightweight so the entity page loads fast.
 */
class PriceController extends Controller
{
    public function quote(PriceProvider $price, string $ticker): JsonResponse
    {
        return response()->json([
            'quote' => $price->quote($ticker),
        ]);
    }

    public function history(Request $request, PriceProvider $price, string $ticker): JsonResponse
    {
        $range = in_array($request->query('range'), ['1m', '3m', '6m', '1y', '5y'], true)
            ? (string) $request->query('range')
            : '1y';

        return response()->json([
            'range' => $range,
            'candles' => $price->history($ticker, $range),
        ]);
    }
}
