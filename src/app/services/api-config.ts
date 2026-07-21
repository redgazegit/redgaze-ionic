import { InjectionToken, Provider } from '@angular/core';

export interface ApiConfig {
  baseUrl: string;
  cdnDomain: string;
  embedDomain: string;
  redgifsDomain: string;
  userpicDomain: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');

export const DEV_API_CONFIG: ApiConfig = {
  baseUrl: '/api',
  cdnDomain: '/cdn',
  embedDomain: 'https://i.redgifs.com',
  redgifsDomain: 'https://www.redgifs.com',
  userpicDomain: '/userpic',
};

export const PROD_API_CONFIG: ApiConfig = {
  baseUrl: 'https://api.redgifs.com',
  cdnDomain: 'https://media.redgifs.com',
  embedDomain: 'https://i.redgifs.com',
  redgifsDomain: 'https://www.redgifs.com',
  userpicDomain: 'https://userpic.redgifs.com',
};

export function provideApiConfig(useProd: boolean): Provider {
  return {
    provide: API_CONFIG,
    useValue: useProd ? PROD_API_CONFIG : DEV_API_CONFIG,
  };
}
