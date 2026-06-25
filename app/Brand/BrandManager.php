<?php

namespace App\Brand;

use Illuminate\Http\Request;

class BrandManager
{
    public function resolve(Request $request): Brand
    {
        return $this->make($this->resolveKey($request));
    }

    public function make(string $key): Brand
    {
        $brands = config('brands.brands');
        $config = $brands[$key] ?? $brands[config('brands.default')];

        return Brand::fromConfig($config);
    }

    protected function resolveKey(Request $request): string
    {
        $brands = config('brands.brands');

        // Dev-only override: ?brand=<key> flips the brand on localhost and
        // sticks for the rest of the session.
        if (app()->environment('local')) {
            $override = $request->query('brand');

            if (is_string($override) && isset($brands[$override])) {
                $request->session()->put('brand_override', $override);

                return $override;
            }

            $sticky = $request->session()->get('brand_override');

            if (is_string($sticky) && isset($brands[$sticky])) {
                return $sticky;
            }
        }

        $host = strtolower($request->getHost());

        return config('brands.domains')[$host] ?? config('brands.default');
    }
}
