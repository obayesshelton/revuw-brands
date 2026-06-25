<?php

namespace App\Brand;

/**
 * The active brand for the current request. A deployment serves multiple
 * brands; the brand is resolved from the request host and fixes which entity
 * type is exposed everywhere downstream.
 */
final readonly class Brand
{
    /**
     * @param  array{tagline: string, entityNoun: string, entityNounPlural: string}  $copy
     * @param  list<string>  $types  mind-jam entity types mapped to this brand
     */
    public function __construct(
        public string $key,
        public string $name,
        public string $logo,
        public string $entityType,
        public array $copy,
        public array $types = [],
        public string $tldrContext = 'all',
    ) {}

    /**
     * @param  array<string, mixed>  $config
     */
    public static function fromConfig(array $config): self
    {
        return new self(
            key: $config['key'],
            name: $config['name'],
            logo: $config['logo'],
            entityType: $config['entityType'],
            copy: $config['copy'],
            types: $config['types'] ?? [$config['entityType']],
            tldrContext: $config['tldrContext'] ?? 'all',
        );
    }

    /**
     * Only stocks have a public share price; startups degrade to a headline
     * stat (valuation, last round, ...).
     */
    public function hasPrice(): bool
    {
        return $this->entityType === 'stocks';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'name' => $this->name,
            'logo' => $this->logo,
            'entityType' => $this->entityType,
            'hasPrice' => $this->hasPrice(),
            'copy' => $this->copy,
        ];
    }
}
