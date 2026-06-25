export type BrandKey = 'stocks' | 'startups';

export interface BrandCopy {
    tagline: string;
    entityNoun: string;
    entityNounPlural: string;
}

export interface Brand {
    key: BrandKey;
    name: string;
    logo: string;
    entityType: string;
    hasPrice: boolean;
    copy: BrandCopy;
}
