<?php

use Inertia\Testing\AssertableInertia as Assert;

it('renders the homepage with trending data for the default stocks brand', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('investor/home')
            ->where('brand.key', 'stocks')
            ->where('brand.hasPrice', true)
            ->has('trendingEntities')
            ->has('trendingChannels')
        );
});

it('resolves the startups brand from its domain', function () {
    $this->get('http://startups.revuw.test/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('investor/home')
            ->where('brand.key', 'startups')
            ->where('brand.hasPrice', false)
        );
});

it('renders the stocks research page for a stock slug', function () {
    $this->get('/entities/apple')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('investor/research/stocks')
            ->where('entity.name', 'Apple')
            ->where('entity.ticker', 'AAPL.US')
            ->has('timeline')
            ->has('videos')
        );
});

it('renders the startups research page under the startups brand', function () {
    $this->get('http://startups.revuw.test/entities/openai')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('investor/research/startups')
            ->where('entity.name', 'OpenAI')
            ->where('entity.ticker', null)
        );
});

it('404s when the slug is not in the active brand type', function () {
    // openai is a startup; the default brand only exposes stocks.
    $this->get('/entities/openai')->assertNotFound();
});

it('renders the screener', function () {
    $this->get('/screener?q=apple')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('investor/screener')
            ->has('result.data')
            ->has('filters')
        );
});

it('renders channel search and a channel profile', function () {
    $this->get('/channels')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('investor/channels'));

    $this->get('/channels/@meetkevin')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('investor/channel')
            ->where('channel.title', 'Meet Kevin')
            ->has('videos')
        );
});

it('returns an EODHD-shaped price quote', function () {
    $this->getJson('/api/price/AAPL.US/quote')
        ->assertOk()
        ->assertJsonStructure([
            'quote' => [
                'code', 'timestamp', 'open', 'high', 'low', 'close',
                'volume', 'previousClose', 'change', 'change_p',
            ],
        ]);
});
