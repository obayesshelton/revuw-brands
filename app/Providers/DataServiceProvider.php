<?php

namespace App\Providers;

use App\Services\Data\DatabaseDataProvider;
use App\Services\Data\DataProvider;
use App\Services\Data\EodhdPriceProvider;
use App\Services\Data\MockDataProvider;
use App\Services\Data\MockPriceProvider;
use App\Services\Data\PriceProvider;
use Illuminate\Support\ServiceProvider;

class DataServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(DataProvider::class, function (): DataProvider {
            return config('services.data.provider') === 'database'
                ? new DatabaseDataProvider
                : new MockDataProvider;
        });

        $this->app->singleton(PriceProvider::class, function (): PriceProvider {
            if (config('services.eodhd.provider') === 'eodhd') {
                return new EodhdPriceProvider(
                    (string) config('services.eodhd.key'),
                    (string) config('services.eodhd.base_url'),
                );
            }

            return new MockPriceProvider;
        });
    }
}
