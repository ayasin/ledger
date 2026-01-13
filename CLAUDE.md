# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal accounting application built with SvelteKit 2.x and Svelte 5 (with runes API). The project uses TypeScript with strict mode enabled and includes a full backend with SQLite database and RESTful API.

## Development Commands

```bash
# Start development server
npm run dev

# Start dev server and open in browser
npm run dev -- --open

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Type checking in watch mode
npm run check:watch

# Database operations
npm run db:generate    # Generate migrations from schema
npm run db:migrate     # Apply migrations to database
npm run db:push        # Push schema changes (dev only)
npm run db:studio      # Open Drizzle Studio GUI

# User management
npm run user-cli add-user         # Add a new user
npm run user-cli change-password  # Change a user's password
npm run user-cli help             # Show CLI help
```

## Architecture

### Framework Stack
- **SvelteKit 2.x**: Full-stack framework for routing, SSR, and build tooling
- **Svelte 5**: UI framework using the modern runes API (`$props()`, `$state()`, etc.)
- **Vite**: Build tool and dev server
- **TypeScript**: Type-safe development with strict mode
- **SQLite + Drizzle ORM**: Database with type-safe ORM
- **Zod**: Runtime validation for API requests

### Project Structure
- `src/routes/`: File-based routing (SvelteKit convention)
  - `+page.svelte`: Route pages
  - `+layout.svelte`: Layout components
  - `+server.ts`: API endpoints
- `src/lib/`: Reusable components and utilities (aliased as `$lib`)
  - `server/`: Server-only code (not bundled for client)
    - `db/`: Database schema and connection
    - `repositories/`: Data access layer (CRUD operations)
    - `services/`: Business logic layer
- `src/app.html`: HTML template wrapper
- `src/app.d.ts`: TypeScript global type definitions for SvelteKit
- `src/hooks.server.ts`: Server-side middleware

### Backend Architecture

**Three-Layer Architecture:**
1. **API Routes** (`src/routes/api/`): Handle HTTP requests/responses, validation
2. **Services** (`src/lib/server/services/`): Business logic (e.g., double-entry validation)
3. **Repositories** (`src/lib/server/repositories/`): Database operations (CRUD)

**Server Hooks** (`src/hooks.server.ts`):
- Attaches database to `event.locals.db`
- Adds request ID and timing
- Centralizes error handling
- Logs API requests

### Database Schema

**Core Tables:**
- `accounts`: Chart of accounts (asset, liability, equity, revenue, expense)
- `transactions`: Transaction headers (date, reference, memo, status)
- `transaction_lines`: Double-entry line items (debits/credits)
- `categories`: Transaction categorization (hierarchical)
- `tags`: Flexible tagging system
- `attachments`: Document metadata for receipts

**Key Features:**
- Foreign key relationships with cascade/restrict rules
- Indexed columns for performance
- Timestamps (created_at, updated_at) on all tables
- Enums for status fields and account types

### API Endpoints

**Health Check:**
- `GET /api/health` - Database connection test

**Accounts:**
- `GET /api/accounts` - List accounts (filterable, paginated)
- `POST /api/accounts` - Create account
- `GET /api/accounts/[id]` - Get single account
- `PATCH /api/accounts/[id]` - Update account
- `DELETE /api/accounts/[id]` - Delete account

**Transactions:**
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction (validates double-entry)
- `GET /api/transactions/[id]` - Get transaction with lines
- `PATCH /api/transactions/[id]` - Update transaction
- `DELETE /api/transactions/[id]` - Delete transaction

**Categories:**
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `GET /api/categories/[id]` - Get category
- `PATCH /api/categories/[id]` - Update category
- `DELETE /api/categories/[id]` - Delete category

**Query Parameters (GET endpoints):**
- `page`, `limit`: Pagination
- `sort`, `order`: Sorting
- Filters: `type`, `status`, `from_date`, `to_date`, etc.

### Environment Variables

Create `.env` file (see `.env.example`):
```
DATABASE_URL=./data/accounting.db
NODE_ENV=development
```

### Database Workflow

**Initial Setup:**
```bash
npm run db:generate  # Generate migration from schema
npm run db:migrate   # Apply migration to database
```

**After Schema Changes:**
```bash
npm run db:generate  # Generate new migration
npm run db:migrate   # Apply migration
```

**Development (Quick Prototyping):**
```bash
npm run db:push  # Push schema changes without migrations
```

### User Management CLI

A command-line interface for managing users (adding users and changing passwords):

**Add a new user:**
```bash
npm run user-cli add-user
# or
npx tsx scripts/user-cli.ts add-user
```

**Change a user's password:**
```bash
npm run user-cli change-password
# or
npx tsx scripts/user-cli.ts change-password
```

**Features:**
- Interactive prompts for user information
- Email validation and duplicate checking
- Password confirmation with minimum length requirement (8 characters)
- Password hashing with bcrypt
- Set user active/inactive status

**Location:** `scripts/user-cli.ts`

### Key Configuration Files
- `svelte.config.js`: SvelteKit configuration with adapter-auto
- `vite.config.ts`: Vite configuration with SvelteKit plugin
- `tsconfig.json`: TypeScript configuration extending `.svelte-kit/tsconfig.json`
- `drizzle.config.ts`: Drizzle ORM configuration for migrations

## Svelte 5 Runes API

This project uses Svelte 5's modern runes API:
- Use `$props()` for component props
- Use `$state()` for reactive state
- Use `{@render children()}` syntax for slot content
- Refer to Svelte 5 documentation for migration patterns

## Important Patterns

### Repository Pattern
Always use repositories for database access:
```typescript
const repo = new AccountRepository(locals.db);
const account = await repo.findById(id);
```

### API Response Format
Standard responses:
```typescript
// Success
{ data: T }

// Paginated
{ data: T[], meta: { total, page, limit, pages } }

// Error
{ error: { message: string, code?: string, details?: unknown } }
```

### Validation
All API endpoints use Zod schemas from `src/lib/server/services/validation.ts`

### Multi-Currency Support
Transaction lines support multi-currency transactions (e.g., spending pesos charged in USD):

**Fields:**
- `debit`/`credit`: Amount in base currency (USD) - what actually posts to the account
- `original_amount`: Amount in foreign currency (e.g., 500 MXN)
- `original_currency`: Currency code (e.g., "MXN", "EUR")
- `exchange_rate`: Exchange rate used (e.g., 0.055 for MXN→USD)

**Example: Credit card charge in Mexico**
```json
{
  "account_id": 5,
  "category_id": 3,
  "description": "Dinner in Mexico City",
  "credit": 27.50,
  "debit": 0,
  "original_amount": 500,
  "original_currency": "MXN",
  "exchange_rate": 0.055
}
```

**Validation:**
- If any multi-currency field is provided, all three must be provided
- Exchange rate is calculated as: `exchange_rate = usd_amount / original_amount`
- Helper methods in `AccountingService`: `calculateExchangeRate()`, `convertCurrency()`
