export interface GifUrls {
  sd: string;
  hd?: string;
  poster?: string;
  thumbnail: string;
  vthumbnail?: string;
}

export interface Gif {
  id: string;
  userName?: string;
  description?: string;
  urls: GifUrls;
  type: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hls?: boolean;
  createDate: number;
  tags: string[];
  likes?: number;
  views?: number;
  verified?: boolean;
  duration?: number;
  avgColor?: string;
  published?: boolean;
  promoted?: boolean;
  sexuality?: string[];
  hideHome?: boolean;
  hideTrending?: boolean;
  niches?: string[];
  contentType?: string;
  canBoost?: boolean;
  gallery?: any;
}

export interface Creator {
  username: string;
  image?: string;
  verified: boolean;
  views?: number;
  gifs?: number;
  followers?: number;
  description?: string;
  profileImageUrl?: string;
  profileUrl?: string;
  creationtime?: number;
}

export interface User {
  username: string;
  name?: string;
  profileImageUrl?: string;
  profileUrl?: string;
  followers: number;
  following: number;
  gifs: number;
  verified: boolean;
  description?: string;
  views?: number;
  likes?: number;
  creationtime?: number;
  publishedGifs: number;
  publishedCollections?: number;
  status?: string;
  subscription?: number;
  studio?: boolean;
  url?: string;
  ageVerified?: boolean;
  kycVerified?: boolean;
  can_boost?: boolean;
  blockedTags?: string[];
  links?: { domain: string; url: string }[];
  // socialUrl1 through socialUrl18
  socialUrl1?: string;
  socialUrl2?: string;
  socialUrl3?: string;
  socialUrl4?: string;
  socialUrl5?: string;
  socialUrl6?: string;
  socialUrl7?: string;
  socialUrl8?: string;
  socialUrl9?: string;
  socialUrl10?: string;
  socialUrl11?: string;
  socialUrl12?: string;
  socialUrl13?: string;
  socialUrl14?: string;
  socialUrl15?: string;
  socialUrl16?: string;
  socialUrl17?: string;
  socialUrl18?: string;
}

export interface Niche {
  id: string;
  name: string;
  image?: string;
  gifs?: number;
}

export interface TagSuggestion {
  text: string;
  type: string;
  gifs: number;
}

export interface SearchResult {
  gifs: Gif[];
  page: number;
  pages: number;
  total: number;
  users?: User[];
  tags?: string[];
  niches?: string[];
  boosted_gifs?: Gif[];
  promoted_gifs?: Gif[];
  cursor?: string;
  feed_id?: string;
  prefetch?: string[];
}

export interface CreatorResult {
  gifs: Gif[];
  user?: User;
  page: number;
  pages: number;
}

export interface NicheResult {
  niches: Niche[];
  page: number;
  pages: number;
  total: number;
}

export interface TempToken {
  token: string;
  addr: string;
  agent: string;
}

export interface ContentViewedEvent {
  gif: string;
  event: string;
  client: string;
}

export interface ViewedDurationEvent {
  gif: string;
  event: string;
  duration: number;
  client: string;
}

export interface RefreshResult {
  gifs: Gif[];
}

export interface NicheInfo {
  niche: Niche;
  gifs?: Gif[];
}

export interface Tag {
  name: string;
  count: number;
}
