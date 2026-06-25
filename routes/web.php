<?php

use App\Http\Controllers\Investor\ChannelController;
use App\Http\Controllers\Investor\EntityController;
use App\Http\Controllers\Investor\HomeController;
use App\Http\Controllers\Investor\PriceController;
use Illuminate\Support\Facades\Route;

// Homepage
Route::get('/', [HomeController::class, 'index'])->name('home');

// Entities (the active brand fixes the entity type, so it never appears in URLs)
Route::get('/screener', [EntityController::class, 'index'])->name('entities.index');
Route::get('/entities/{slug}', [EntityController::class, 'show'])->name('entities.show');

// Channels
Route::get('/channels', [ChannelController::class, 'index'])->name('channels.index');
Route::get('/channels/{handle}', [ChannelController::class, 'show'])
    ->where('handle', '@?[A-Za-z0-9_.-]+')
    ->name('channels.show');

// Price (async JSON; brand-aware via the web middleware group)
Route::get('/api/price/{ticker}/quote', [PriceController::class, 'quote'])->name('price.quote');
Route::get('/api/price/{ticker}/history', [PriceController::class, 'history'])->name('price.history');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
