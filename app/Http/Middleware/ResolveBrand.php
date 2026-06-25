<?php

namespace App\Http\Middleware;

use App\Brand\Brand;
use App\Brand\BrandManager;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

class ResolveBrand
{
    public function __construct(protected BrandManager $manager) {}

    public function handle(Request $request, Closure $next): Response
    {
        $brand = $this->manager->resolve($request);

        // Bind for controllers/providers (type-hint App\Brand\Brand) and
        // expose the key to the root Blade view for <html data-brand>.
        app()->instance(Brand::class, $brand);
        View::share('brand', $brand->key);

        return $next($request);
    }
}
