// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Used for absolute links in feeds. Switch to https://nammablr.org once the domain is live.
  site: 'https://nammablr.vercel.app',
  // Pages merged in the 2026-09 redesign; old links people have shared keep working.
  redirects: {
    '/changes': '/updates',
    '/changelog': '/updates?type=sweep',
    '/corrections': '/updates?type=correction',
    '/coverage': '/about#data-quality',
    '/about-the-data': '/about',
  },
});
