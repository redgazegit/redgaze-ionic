// Test utility functions for creating mock data
import { Gif, GifUrls, Creator, User, SearchResult, CreatorResult, NicheResult, Niche, Tag, TagSuggestion } from './models/gif.model';

/**
 * Create a mock GifUrls object
 */
export function fakeGifUrls(overrides: Partial<GifUrls> = {}): GifUrls {
  return {
    sd: 'https://media.redgifs.com/SdPreview.mp4',
    hd: 'https://media.redgifs.com/HdPreview.mp4',
    poster: 'https://media.redgifs.com/poster.jpg',
    thumbnail: 'https://media.redgifs.com/thumbnail.jpg',
    vthumbnail: 'https://media.redgifs.com/vthumb.jpg',
    ...overrides
  };
}

/**
 * Create a mock Gif object
 */
export function fakeGif(overrides: Partial<Gif> = {}): Gif {
  return {
    id: 'fake-gif-id',
    userName: 'fakeuser',
    description: 'A fake GIF for testing',
    urls: fakeGifUrls(),
    type: 'gif',
    width: 400,
    height: 300,
    hasAudio: false,
    hls: 'https://media.redgifs.com/stream.m3u8',
    createDate: Date.now() / 1000,
    tags: ['funny', 'test'],
    likes: 100,
    views: 1000,
    verified: 'y',
    duration: 5,
    avgColor: '#ff0000',
    published: true,
    promoted: false,
    sexuality: ['straight'],
    hideHome: false,
    hideTrending: false,
    niches: [{ id: '1', name: 'Test', image: '' }],
    contentType: 'standard',
    canBoost: false,
    gallery: [],
    ...overrides
  };
}

/**
 * Create a mock Creator object
 */
export function fakeCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    username: 'fakecreator',
    image: 'https://example.com/creator.jpg',
    verified: 'y',
    views: 5000,
    gifs: [fakeGif()],
    followers: 1000,
    description: 'A fake creator',
    profileImageUrl: 'https://example.com/profile.jpg',
    profileUrl: 'https://example.com/profile',
    creationtime: Date.now() / 1000 - 86400 * 30,
    ...overrides
  };
}

/**
 * Create a mock User object
 */
export function fakeUser(overrides: Partial<User> = {}): User {
  return {
    username: 'fakeuser',
    name: 'Fake User',
    profileImageUrl: 'https://example.com/user.jpg',
    profileUrl: 'https://example.com/user',
    followers: 500,
    following: 300,
    gifs: [fakeGif()],
    verified: 'y',
    description: 'A fake user',
    views: 2000,
    likes: 500,
    creationtime: Date.now() / 1000 - 86400 * 10,
    publishedGifs: 5,
    publishedCollections: 2,
    status: 'active',
    subscription: 'none',
    studio: '',
    url: 'https://example.com',
    ageVerified: 'y',
    kycVerified: 'y',
    can_boost: true,
    blockedTags: [],
    links: [],
    socialUrl1: '',
    socialUrl2: '',
    socialUrl3: '',
    socialUrl4: '',
    socialUrl5: '',
    socialUrl6: '',
    socialUrl7: '',
    socialUrl8: '',
    socialUrl9: '',
    socialUrl10: '',
    socialUrl11: '',
    socialUrl12: '',
    socialUrl13: '',
    socialUrl14: '',
    socialUrl15: '',
    socialUrl16: '',
    socialUrl17: '',
    socialUrl18: '',
    ...overrides
  };
}

/**
 * Create a mock SearchResult object
 */
export function fakeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    gifs: [fakeGif(), fakeGif({ id: 'fake-gif-2' })],
    page: 1,
    pages: 5,
    total: 42,
    users: [fakeUser()],
    tags: [{ name: 'funny', count: 100 }, { name: 'test', count: 50 }],
    niches: [{ id: '1', name: 'Test Niches', image: '', gifs: [fakeGif()] }],
    boosted_gifs: [],
    promoted_gifs: [],
    cursor: 'abc123',
    feed_id: 'feed-123',
    prefetch: ['next-gif-id'],
    ...overrides
  };
}

/**
 * Create a mock CreatorResult object
 */
export function fakeCreatorResult(overrides: Partial<CreatorResult> = {}): CreatorResult {
  return {
    gifs: [fakeGif(), fakeGif({ id: 'creator-gif-2' })],
    user: fakeCreator(),
    page: 1,
    pages: 3,
    ...overrides
  };
}

/**
 * Create a mock NicheResult object
 */
export function fakeNicheResult(overrides: Partial<NicheResult> = {}): NicheResult {
  return {
    niches: [fakeNiche(), fakeNiche({ id: 'niche-2' })],
    page: 1,
    pages: 2,
    total: 15,
    ...overrides
  };
}

/**
 * Create a mock Niche object
 */
export function fakeNiche(overrides: Partial<Niche> = {}): Niche {
  return {
    id: 'test-niche',
    name: 'Test Niche',
    image: 'https://example.com/niche.jpg',
    gifs: [fakeGif()],
    ...overrides
  };
}

/**
 * Create a mock Tag object
 */
export function fakeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    name: 'test-tag',
    count: 42,
    ...overrides
  };
}

/**
 * Create a mock TagSuggestion object
 */
export function fakeTagSuggestion(overrides: Partial<TagSuggestion> = {}): TagSuggestion {
  return {
    text: 'funny cats',
    type: 'tag',
    gifs: [fakeGif(), fakeGif({ id: 'suggestion-gif-2' })],
    ...overrides
  };
}

/**
 * Create a mock Settings object
 */
export function fakeSettings(overrides: Partial<{ playbackMode: 'hls' | 'mp4'; quality: 'hd' | 'sd'; rateLimitEnabled: boolean; storiesNavigation: boolean; gridAutoplay: boolean }> = {}): { playbackMode: 'hls' | 'mp4'; quality: 'hd' | 'sd'; rateLimitEnabled: boolean; storiesNavigation: boolean; gridAutoplay: boolean } {
  return {
    playbackMode: 'mp4',
    quality: 'hd',
    rateLimitEnabled: true,
    storiesNavigation: true,
    gridAutoplay: true,
    ...overrides
  };
}

/**
 * Create a mock ThemeMode
 */
export function fakeThemeMode(): 'system' | 'light' | 'dark' {
  return 'system';
}

// Export all factory functions for easy import
export const testFactories = {
  fakeGifUrls,
  fakeGif,
  fakeCreator,
  fakeUser,
  fakeSearchResult,
  fakeCreatorResult,
  fakeNicheResult,
  fakeNiche,
  fakeTag,
  fakeTagSuggestion,
  fakeSettings,
  fakeThemeMode
};