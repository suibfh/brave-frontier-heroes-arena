# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 dashboard application for Brave Frontier Heroes, using OAuth2 authentication to interact with the BFH Forge API. The application provides user information display, hero unit metadata, and battle replay functionality.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 3500)
npm run dev

# Generate TypeScript API client from OpenAPI spec
npm run generate:api

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

## Environment Setup

### Configuration File

All environment variables are centralized in `src/config/env.ts`. This file provides default values for BFH API endpoints, so the app can run without setting these environment variables.

**Default values included**:
- `BFH_API_BASE_URL`: `https://api.bravefrontierheroes.com`
- `BFH_AUTH_URL`: `https://auth.bravefrontierheroes.com/oauth2/auth`
- `BFH_TOKEN_URL`: `https://auth.bravefrontierheroes.com/oauth2/token`

### Environment Variables

Environment variables (see `.env.example`):

```
NEXT_PUBLIC_CLIENT_ID=<OAuth2 client ID - exposed to client>
CLIENT_SECRET=<OAuth2 client secret - server-side only>
NEXT_PUBLIC_BFH_API_BASE_URL=https://api.bravefrontierheroes.com (optional, has default)
NEXT_PUBLIC_BFH_AUTH_URL=https://auth.bravefrontierheroes.com/oauth2/auth (optional, has default)
NEXT_PUBLIC_BFH_TOKEN_URL=https://auth.bravefrontierheroes.com/oauth2/token (optional, has default)
```

**Important**:
- `NEXT_PUBLIC_CLIENT_ID` is required for OAuth2 authentication and is exposed to the client (this is standard for OAuth2 public clients)
- `CLIENT_SECRET` is required for server-side token exchange and must NEVER be exposed to the client
- API endpoint URLs have default values and are optional
- When modifying default values, edit `src/config/env.ts` instead of scattered across files

## API Client Generation

This project uses Orval to auto-generate TypeScript API clients from the BFH OpenAPI spec:

- **Config**: `orval.config.ts`
- **Source**: `https://api.bravefrontierheroes.com/swagger/doc.json`
- **Output**: `src/api/generated/` (React Query hooks, split by tags)
- **Models**: `src/api/model/`
- **Custom Axios Instance**: `src/api/mutator/custom-instance.ts`

After changing the OpenAPI spec or configuration, run:
```bash
npm run generate:api
```

### Using Generated API Hooks

**IMPORTANT**: Always use Orval-generated React Query hooks for BFH API calls. Do NOT create custom API routes or use fetch directly.

```typescript
// ✅ CORRECT - Use Orval generated hooks
import { useGetV1Me } from '@/src/api/generated/user/user';
import { useGetV1MeUnits } from '@/src/api/generated/assets/assets';

const { data: userData, isLoading, error } = useGetV1Me();
const { data: units } = useGetV1MeUnits();

// ❌ WRONG - Don't create intermediate API routes
const response = await fetch('/api/user/me');
```

**Benefits of using Orval hooks**:
- Automatic authentication (token injection via custom-instance.ts)
- Type-safe API calls with full TypeScript support
- Built-in caching, refetching, and error handling via React Query
- Automatic 401 error handling (redirects to login)
- React Query DevTools integration for debugging
- Optimistic updates and background refetching
- Request deduplication and cancellation

**Generated hooks follow React Query patterns**:
```typescript
// Query hooks (GET requests)
const { data, isLoading, error, refetch } = useGetV1Me();

// Mutation hooks (POST/PUT/DELETE requests)
const { mutate, isPending } = usePostV1Heroes({
  mutation: {
    onSuccess: (data) => { /* handle success */ },
    onError: (error) => { /* handle error */ },
  }
});
```

The generated hooks use TanStack Query v5 and are automatically typed with inference.

## Architecture

### Authentication Flow

1. User clicks login → redirects to BFH OAuth2 authorization page (`NEXT_PUBLIC_BFH_AUTH_URL`)
2. After authorization, BFH redirects to `/api/auth/callback` with authorization code
3. Server-side route handler exchanges code for access token using `CLIENT_SECRET` (Basic Auth)
4. Access token stored in cookie (`bfh_access_token`, httpOnly: false for client-side access)
5. Refresh token stored if provided (`bfh_refresh_token`, httpOnly: true)
6. User redirected to `/dashboard`

**Key files**:
- Login UI: `app/login/page.tsx`
- OAuth callback: `app/api/auth/callback/route.ts`
- Logout: `app/api/auth/logout/route.ts`

**Note**: Access token is stored with `httpOnly: false` to allow Orval-generated hooks to access it via `js-cookie` in the custom Axios instance. Refresh token remains httpOnly for security.

### API Request Flow

1. Orval-generated hooks use the custom Axios instance from `src/api/mutator/custom-instance.ts`
2. Request interceptor automatically reads `bfh_access_token` cookie via `js-cookie`
3. Request interceptor adds `Authorization: Bearer <token>` header to all requests
4. Response interceptor handles 401 errors by:
   - Removing the cookie
   - Redirecting to `/login`

All authentication is handled transparently by the custom instance - no manual token management needed.

### Route Structure

- **App Router**: Uses Next.js 16 App Router
- **API Routes**: Minimal server-side handlers in `app/api/`
  - `auth/callback/route.ts` - OAuth2 callback handler
  - `auth/logout/route.ts` - Session cleanup
  - `auth/refresh/route.ts` - Token refresh endpoint
  - `auth/token-status/route.ts` - Check token validity
  - `hero/metadata/[id]/route.ts` - Hero metadata proxy
  - `sphere/metadata/[id]/route.ts` - Sphere metadata proxy
- **Pages**:
  - `app/page.tsx` - Root (redirects to login)
  - `app/login/page.tsx` - Login page with OAuth2 flow
  - `app/dashboard/page.tsx` - Main dashboard (uses Orval hooks)
  - `app/units/page.tsx` - Units listing page
  - `app/spheres/page.tsx` - Spheres listing page
  - `app/auth-debug/page.tsx` - Debug page for auth testing
  - `app/env-warning/page.tsx` - Warning page for missing env vars

### Key Components

- **QueryProvider** (`src/components/providers/query-provider.tsx`):
  - TanStack Query client configuration
  - React Query DevTools integration (dev mode only)
  - Global query defaults (staleTime, retry, etc.)
- **UnitCard** (`src/components/unit-card.tsx`): Displays hero metadata
- **SphereCard** (`src/components/sphere-card.tsx`): Displays sphere metadata
- **BattleReplayLink** (`src/components/battle-replay-link.tsx`): Generates battle replay URLs
- **UI Components** (`src/components/ui/`): shadcn/ui components with glassmorphism styling

### Pages

- **Dashboard** (`app/dashboard/page.tsx`): User overview with navigation cards
- **Units** (`app/units/page.tsx`): Grid view of owned units using `useGetV1MeUnits()`
- **Spheres** (`app/spheres/page.tsx`): Grid view of owned spheres using `useGetV1MeSpheres()`
- **Auth Debug** (`app/auth-debug/page.tsx`): Token status and manual refresh for debugging

### Utility Functions

Located in `src/lib/utils.ts`:

```typescript
// Tailwind class merging
cn(...inputs: ClassValue[]): string

// Generate battle log JSON URL
getBattleLogUrl(battleId: number | string): string
// Returns: https://rsc.bravefrontierheroes.com/battle/duel/{first_6_digits}/{battleId}.json

// Generate battle replay page URL
getBattleReplayUrl(battleId: number | string, lang?: string): string
// Returns: https://bravefrontierheroes.com/{lang}/battle/{battleId}

// Generate hero metadata URL
getHeroMetadataUrl(heroId: number | string): string
// Returns: https://core.bravefrontierheroes.com/metadata/units/{heroId}
```

## Styling

- **Framework**: Tailwind CSS 4 with PostCSS
- **Design System**: Custom glassmorphism theme
- **Component Library**: shadcn/ui (configured via `components.json`)
- **Custom Classes**: `.glass`, `.glass-card`, `.glass-hover` for glassmorphism effects

## Best Practices

### Code Quality

1. **Type Safety**
   - Use Orval-generated types - don't create manual type assertions
   - Avoid `as any` - use proper type guards or type narrowing
   - Leverage TypeScript's strict mode

2. **API Calls**
   - ✅ ALWAYS use Orval-generated React Query hooks
   - ❌ NEVER create intermediate API routes for BFH API calls
   - ❌ NEVER use raw `fetch()` or `axios.get()` directly
   - The custom Axios instance handles auth automatically

3. **Error Handling**
   - React Query provides built-in error handling
   - 401 errors automatically redirect to `/login`
   - Use the `error` property from hooks for user-facing errors

4. **Performance**
   - React Query caches by default (staleTime: 60s)
   - Use React Query DevTools to debug cache behavior
   - Avoid unnecessary re-renders with proper dependencies

5. **Code Generation**
   - Never edit files in `src/api/generated/` or `src/api/model/`
   - After OpenAPI spec changes: `npm run generate:api`
   - Prettier automatically formats generated code

### Development Workflow

1. **Adding New API Endpoints**
   ```bash
   # API spec is updated on server
   npm run generate:api
   # Import and use the new hooks
   ```

2. **Debugging API Issues**
   - Open React Query DevTools (bottom right in dev mode)
   - Check `/auth-debug` for token status
   - Inspect Network tab for raw requests

3. **Testing Changes**
   ```bash
   npm run build  # Ensures no TypeScript errors
   npm run dev    # Test in browser with DevTools
   ```

## Important Notes

- The app runs on **port 3500** (not the default 3000)
- All OAuth2 redirect URIs must use `{origin}/api/auth/callback`
- **ALWAYS use Orval-generated hooks** for BFH API calls - never create custom fetch wrappers or intermediate API routes
- Access tokens are stored in cookies with `httpOnly: false` to allow client-side access by Orval hooks
- Refresh tokens remain `httpOnly: true` for security
- The custom Axios instance (`src/api/mutator/custom-instance.ts`) handles automatic token injection and 401 redirects
- Generated API code should not be manually edited - regenerate with `npm run generate:api`
- When adding new API endpoints, regenerate the client and import the new hooks directly
- React Query DevTools are available in development mode for debugging queries
