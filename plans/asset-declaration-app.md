# Asset Declaration Application (ADLA) - Development Plan

## Overview

A web application for Ghana's Asset Declaration system under Article 286(5) of the Constitution, enabling public officials to declare assets through a structured workflow.

---

## 1. Flowchart Analysis

### Actors

| Role                     | Responsibilities                                    |
| ------------------------ | --------------------------------------------------- |
| **Applicant**            | Register, initiate declaration (generate code), receive notifications |
| **GAS Schedule Officer** | Record form collection, record returned form, record submissions, review, generate receipts |
| **Legal Unit**           | Verify authenticity, recall applicant info          |

### Process Flow

```
1. Applicant registers on portal with:
   - Name (as on Ghana Card)
   - Ghana Card number
   - Mobile phone number
   - Email
   - Ghana Card upload (front and back)
   - Public office category (Article 286(5))
   - Institution name
   - Designation

2. System generates Unique Code → sent via Email (declaration is initiated; status CODE_GENERATED)

3. Applicant collects the physical declaration form from a GAS collection office
   (headquarters or any regional office). GAS Schedule Officer records the form
   collection against the code, capturing which collection office (status FORM_COLLECTED)

4. Applicant fills and returns the form. GAS Schedule Officer records the
   returned form (status SUBMITTED)

5. Legal Unit verifies code and recalls applicant info

6. GAS Schedule Officer records submission date/time (status UNDER_REVIEW)

7. Review process:
   - SUCCESS → Move to Seal → Generate Receipt → Email to applicant
   - FAILURE → Reject with reason → Issue new unique code (new CODE_GENERATED declaration)

8. Pick-up notification sent to applicant (supports third-party pickup)
```

---

## 2. Tech Stack

| Layer         | Technology                             |
| ------------- | -------------------------------------- |
| Frontend      | Nuxt 3 (Vue 3 + TypeScript)            |
| UI Library    | **shadcn-vue** + Tailwind CSS          |
| Backend       | Nuxt Server Routes (Nitro)             |
| Database      | PostgreSQL 16                          |
| ORM           | Prisma                                 |
| Auth          | JWT + Refresh Tokens                   |
| Email         | Nodemailer / SendGrid                  |
| SMS           | Hubtel / Arkesel (Ghana SMS providers) |
| File Storage  | MinIO (S3-compatible)                  |
| Cache         | Redis                                  |
| Queue         | BullMQ (for async jobs)                |
| Container     | Docker + Docker Compose                |
| Orchestration | Kubernetes                             |

### shadcn-vue Setup

```bash
# Install Tailwind CSS
pnpm add tailwindcss @tailwindcss/vite -D

# Add shadcn-nuxt module
pnpm dlx nuxi@latest module add shadcn-nuxt

# Initialize shadcn-vue
pnpm dlx shadcn-vue@latest init

# Add components as needed
pnpm dlx shadcn-vue@latest add button card form input table dialog
```

### nuxt.config.ts

```typescript
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  css: ["~/assets/css/tailwind.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  modules: ["shadcn-nuxt"],
  shadcn: {
    prefix: "",
    componentDir: "./components/ui",
  },
});
```

---

## 3. Database Schema

### Core Tables

```sql
-- Users & Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL, -- applicant, schedule_officer, legal_unit, admin
  description TEXT
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role_id INT REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

-- Applicant Profiles
CREATE TABLE applicant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id),
  full_name VARCHAR(255) NOT NULL,
  ghana_card_number VARCHAR(20) UNIQUE NOT NULL,
  ghana_card_image_url TEXT NOT NULL,
  institution_id UUID REFERENCES institutions(id),
  designation VARCHAR(255) NOT NULL,
  office_category_id INT REFERENCES public_office_categories(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reference Data
CREATE TABLE public_office_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  article_reference VARCHAR(50) -- e.g., "Article 286(5)(a)"
);

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE
);

-- Declarations & Workflow
CREATE TABLE declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES applicant_profiles(id),
  unique_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'code_generated', -- code_generated, form_collected, submitted, under_review, approved, rejected, sealed, completed
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID REFERENCES declarations(id),
  recorded_by UUID REFERENCES users(id), -- GAS officer
  submission_date TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID REFERENCES declarations(id),
  reviewed_by UUID REFERENCES users(id),
  review_date TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL, -- approved, rejected
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID REFERENCES declarations(id),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  generated_by UUID REFERENCES users(id),
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pickup Management
CREATE TABLE pickup_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID REFERENCES declarations(id),
  authorized_name VARCHAR(255),
  authorized_phone VARCHAR(20),
  is_self_pickup BOOLEAN DEFAULT TRUE,
  pickup_date TIMESTAMP,
  picked_up BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Trail (Government Compliance)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notification System (Email + SMS + In-app)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- email, sms, in_app
  channel VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id),
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id),
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, sent, delivered, failed
  provider_response JSONB,
  retry_count INT DEFAULT 0,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Data Retention & Compliance
CREATE TABLE data_retention_policies (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  retention_period_days INT NOT NULL,
  archive_after_days INT,
  delete_after_days INT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE archived_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  archived_data JSONB NOT NULL,
  archived_by UUID REFERENCES users(id),
  archived_at TIMESTAMP DEFAULT NOW(),
  scheduled_deletion_date DATE
);
```

---

## 4. Project Structure

```
adla/
├── plans/                          # This plan
├── docs/                           # Documentation & flowcharts
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.dev.yml
├── k8s/
│   ├── base/
│   │   ├── namespace.yaml
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── ingress.yaml
│   │   ├── configmap.yaml
│   │   ├── secrets.yaml
│   │   ├── pvc.yaml
│   │   └── hpa.yaml
│   ├── overlays/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   └── kustomization.yaml
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── assets/
│   │   └── css/
│   ├── components/
│   │   ├── ui/                     # shadcn-vue components
│   │   ├── forms/                  # Form components
│   │   ├── notifications/          # Notification center & bell
│   │   ├── applicant/              # Applicant-specific components
│   │   ├── officer/                # GAS Officer components
│   │   └── legal/                  # Legal Unit components
│   ├── composables/
│   │   ├── useAuth.ts
│   │   ├── useDeclaration.ts
│   │   └── useNotification.ts
│   ├── layouts/
│   │   ├── default.vue
│   │   ├── auth.vue
│   │   └── dashboard.vue
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── role.ts
│   ├── pages/
│   │   ├── index.vue               # Landing page
│   │   ├── auth/
│   │   │   ├── login.vue
│   │   │   ├── register.vue
│   │   │   └── forgot-password.vue
│   │   ├── applicant/
│   │   │   ├── dashboard.vue
│   │   │   ├── declaration/
│   │   │   │   ├── new.vue
│   │   │   │   └── [id].vue
│   │   │   └── status.vue
│   │   ├── officer/
│   │   │   ├── dashboard.vue
│   │   │   ├── submissions.vue
│   │   │   ├── review/[id].vue
│   │   │   └── receipts.vue
│   │   ├── legal/
│   │   │   ├── dashboard.vue
│   │   │   └── verify.vue
│   │   ├── notifications.vue       # In-app notification center
│   │   ├── settings/
│   │   │   └── preferences.vue     # Notification preferences
│   │   └── admin/
│   │       ├── users.vue
│   │       ├── institutions.vue
│   │       ├── audit-logs.vue      # Audit trail viewer
│   │       └── reports.vue
│   ├── plugins/
│   │   └── prisma.ts
│   ├── server/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login.post.ts
│   │   │   │   ├── register.post.ts
│   │   │   │   └── refresh.post.ts
│   │   │   ├── declarations/
│   │   │   │   ├── index.get.ts
│   │   │   │   ├── index.post.ts
│   │   │   │   ├── [id].get.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── submit.post.ts
│   │   │   │       ├── review.post.ts
│   │   │   │       └── receipt.get.ts
│   │   │   ├── verify/
│   │   │   │   └── [code].get.ts
│   │   │   ├── notifications/
│   │   │   │   ├── index.get.ts
│   │   │   │   ├── [id]/read.patch.ts
│   │   │   │   └── preferences.ts
│   │   │   └── upload/
│   │   │       └── ghana-card.post.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   ├── services/
│   │   │   ├── email.service.ts
│   │   │   ├── sms.service.ts
│   │   │   ├── notification.service.ts
│   │   │   ├── pdf.service.ts
│   │   │   ├── code.service.ts
│   │   │   ├── audit.service.ts
│   │   │   └── storage.service.ts
│   │   └── utils/
│   │       ├── jwt.ts
│   │       └── validators.ts
│   ├── stores/
│   │   ├── auth.ts
│   │   ├── declaration.ts
│   │   └── notifications.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── helpers.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .gitignore
├── nuxt.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 5. API Endpoints

### Authentication

| Method | Endpoint                    | Description            |
| ------ | --------------------------- | ---------------------- |
| POST   | `/api/auth/register`        | Register new user      |
| POST   | `/api/auth/login`           | User login             |
| POST   | `/api/auth/refresh`         | Refresh access token   |
| POST   | `/api/auth/logout`          | User logout            |
| POST   | `/api/auth/forgot-password` | Request password reset |

### Declarations (Applicant)

| Method | Endpoint                       | Description              |
| ------ | ------------------------------ | ------------------------ |
| GET    | `/api/declarations`            | List user's declarations |
| POST   | `/api/declarations`            | Create new declaration   |
| GET    | `/api/declarations/:id`        | Get declaration details  |
| GET    | `/api/declarations/:id/status` | Get declaration status   |

### Officer Operations

| Method | Endpoint                       | Description                 |
| ------ | ------------------------------ | --------------------------- |
| POST   | `/api/submissions`             | Record submission           |
| GET    | `/api/submissions`             | List all submissions        |
| POST   | `/api/reviews`                 | Submit review decision      |
| POST   | `/api/receipts/:declarationId` | Generate receipt            |
| POST   | `/api/pickup/:declarationId`   | Record pickup authorization |

### Legal Unit

| Method | Endpoint                      | Description        |
| ------ | ----------------------------- | ------------------ |
| GET    | `/api/verify/:code`           | Verify unique code |
| GET    | `/api/verify/:code/applicant` | Get applicant info |

### Admin

| Method | Endpoint                  | Description              |
| ------ | ------------------------- | ------------------------ |
| CRUD   | `/api/admin/users`        | Manage users             |
| CRUD   | `/api/admin/institutions` | Manage institutions      |
| CRUD   | `/api/admin/categories`   | Manage office categories |
| GET    | `/api/admin/reports`      | Generate reports         |

---

## 6. Suggested Improvements (Included in Plan)

### A. Process Improvements

| Current               | Improvement                    | Benefit          |
| --------------------- | ------------------------------ | ---------------- |
| No real-time tracking | Status dashboard with timeline | Transparency     |
| Manual code entry     | QR code scanning               | Speed & accuracy |
| Single review step    | Multi-level approval workflow  | Better oversight |
| No deadlines          | SLA tracking with alerts       | Compliance       |
| Basic audit           | Comprehensive audit logging    | Accountability   |

### B. Technical Enhancements

1. **Ghana Card API Integration** (Future) - Architecture designed to support NIA API integration later
2. **Two-Factor Authentication** - SMS OTP for sensitive operations
3. **Digital Signatures** - Sign documents cryptographically
4. **Progressive Web App** - Offline capability, push notifications
5. **Analytics Dashboard** - Charts, metrics, trends for admins
6. **Bulk Operations** - Import institutions, batch processing
7. **Multi-channel Notifications** - Email + SMS + In-app notifications
8. **Document Versioning** - Track declaration revisions

### C. Government Compliance Requirements

1. **Enhanced Audit Trail**

   - Log all user actions with IP, user agent, session ID
   - Immutable audit records (no updates/deletes)
   - Exportable audit reports for investigations

2. **Data Retention Policies**

   - Configurable retention periods per data type
   - Automated archival of old records
   - Secure deletion with audit trail
   - Compliance reporting

3. **Access Control**

   - Role-based access with principle of least privilege
   - Session timeout and forced re-authentication
   - Failed login attempt tracking and lockout

4. **Data Sovereignty**

   - All data stored in Ghana-based infrastructure
   - Encrypted at rest and in transit
   - No third-party data sharing without authorization

5. **Backup & Recovery**
   - Daily automated backups
   - Point-in-time recovery capability
   - Disaster recovery plan

---

## 7. Development Phases

### Phase 1: Foundation - COMPLETED

- [x] `docker-compose.dev.yml` - Development environment
- [x] `app/docker/Dockerfile.dev` - Development Dockerfile
- [x] `app/docker/Dockerfile` - Production Dockerfile
- [x] `app/prisma/schema.prisma` - Database schema (15 tables)
- [x] `app/prisma/seed.ts` - Seed data (roles, categories, institutions)
- [x] `app/nuxt.config.ts` - Nuxt configuration with shadcn-vue
- [x] `app/server/utils/jwt.ts` - JWT utilities
- [x] `app/server/utils/prisma.ts` - Prisma client singleton
- [x] `app/server/utils/validators.ts` - Zod validation schemas
- [x] `app/server/utils/audit.ts` - Audit logging utility
- [x] `app/server/utils/code-generator.ts` - Unique code generation
- [x] `app/server/middleware/auth.ts` - Server-side auth middleware
- [x] `app/server/api/auth/register.post.ts` - User registration
- [x] `app/server/api/auth/login.post.ts` - User login
- [x] `app/server/api/auth/logout.post.ts` - User logout
- [x] `app/server/api/auth/refresh.post.ts` - Token refresh
- [x] `app/server/api/auth/forgot-password.post.ts` - Password reset request
- [x] `app/server/api/auth/reset-password.post.ts` - Password reset
- [x] `app/server/api/auth/me.get.ts` - Get current user
- [x] `app/server/api/health.get.ts` - Health check endpoint
- [x] `app/pages/index.vue` - Landing page
- [x] `app/pages/auth/login.vue` - Login page
- [x] `app/pages/auth/register.vue` - Registration page
- [x] `app/pages/auth/forgot-password.vue` - Forgot password page
- [x] `app/pages/applicant/dashboard.vue` - Applicant dashboard
- [x] `app/layouts/default.vue` - Default layout
- [x] `app/layouts/auth.vue` - Auth layout
- [x] `app/layouts/dashboard.vue` - Dashboard layout
- [x] `app/stores/auth.ts` - Pinia auth store
- [x] `app/middleware/auth.ts` - Client-side auth middleware
- [x] `app/assets/css/main.css` - Tailwind CSS with Ghana theme colors

### Phase 2: Core Features - COMPLETED

- [x] `app/server/services/storage.service.ts` - MinIO file upload service
- [x] `app/server/services/email.service.ts` - Email service with Nodemailer (templates for welcome, unique-code, declaration-status, receipt-ready, pickup)
- [x] `app/server/services/sms.service.ts` - SMS service (Hubtel/Arkesel with Ghana phone validation)
- [x] `app/server/services/notification.service.ts` - Unified notification service (multi-channel dispatch)
- [x] `app/server/api/profile/index.post.ts` - Create/update applicant profile
- [x] `app/server/api/profile/index.get.ts` - Get applicant profile
- [x] `app/server/api/institutions/index.get.ts` - List institutions
- [x] `app/server/api/categories/index.get.ts` - List public office categories
- [x] `app/server/api/upload/ghana-card.post.ts` - Ghana Card upload endpoint
- [x] `app/server/api/declarations/index.get.ts` - List declarations
- [x] `app/server/api/declarations/index.post.ts` - Create declaration (generates unique code)
- [x] `app/server/api/declarations/[id].get.ts` - Get declaration details
- [x] `app/server/api/declarations/[id]/submit.post.ts` - Submit declaration
- [x] `app/server/api/declarations/[id]/status.get.ts` - Get declaration status with timeline
- [x] `app/server/api/notifications/index.get.ts` - List notifications with pagination
- [x] `app/server/api/notifications/[id]/read.patch.ts` - Mark notification as read
- [x] `app/server/api/notifications/read-all.post.ts` - Mark all notifications as read
- [x] `app/server/api/notifications/preferences.get.ts` - Get notification preferences
- [x] `app/server/api/notifications/preferences.patch.ts` - Update notification preferences
- [x] `app/pages/applicant/profile/setup.vue` - 3-step profile setup wizard (personal info, Ghana Card upload, office details)
- [x] `app/pages/applicant/declarations.vue` - Declarations list page with filtering and pagination
- [x] `app/pages/applicant/declaration/new.vue` - Create new declaration (unique code generation, submit flow)
- [x] `app/pages/applicant/declaration/[id].vue` - Declaration detail page with status timeline
- [x] `app/pages/notifications.vue` - Notification center with read/unread filtering
- [x] `app/stores/notifications.ts` - Pinia store for notifications state management

### Phase 3: Admin Features - COMPLETED

**PDF Generation Service:**
- [x] `app/server/services/pdf.service.ts` - PDF receipt generation with PDFKit (Ghana government branding, seal, official formatting)

**Submission APIs (GAS Officers):**
- [x] `app/server/api/submissions/index.get.ts` - List recorded submissions
- [x] `app/server/api/submissions/index.post.ts` - Record a new submission (updates status to UNDER_REVIEW)
- [x] `app/server/api/submissions/pending.get.ts` - List declarations awaiting recording (SUBMITTED status)

**Review APIs:**
- [x] `app/server/api/reviews/index.get.ts` - List reviews
- [x] `app/server/api/reviews/index.post.ts` - Submit review (APPROVED/REJECTED, auto-generates new code on rejection)
- [x] `app/server/api/reviews/pending.get.ts` - List declarations awaiting review (UNDER_REVIEW status)

**Receipt APIs:**
- [x] `app/server/api/receipts/index.get.ts` - List generated receipts
- [x] `app/server/api/receipts/[declarationId].post.ts` - Generate PDF receipt (updates status to SEALED)
- [x] `app/server/api/receipts/pending.get.ts` - List declarations ready for receipt (APPROVED status)

**Pickup APIs:**
- [x] `app/server/api/pickup/[declarationId].post.ts` - Schedule pickup authorization (self or third-party)
- [x] `app/server/api/pickup/[declarationId].patch.ts` - Record pickup completion (updates status to COMPLETED)
- [x] `app/server/api/pickup/pending.get.ts` - List pending pickups

**Legal Unit APIs:**
- [x] `app/server/api/verify/[code].get.ts` - Verify unique code and recall applicant information

**GAS Officer Pages:**
- [x] `app/pages/officer/dashboard.vue` - Officer dashboard with stats and quick actions
- [x] `app/pages/officer/submissions.vue` - Record submissions page with search and modal
- [x] `app/pages/officer/reviews.vue` - Review declarations page (approve/reject with reason)
- [x] `app/pages/officer/receipts.vue` - Generate receipts page
- [x] `app/pages/officer/pickups.vue` - Manage pickups page (record collection)

**Legal Unit Pages:**
- [x] `app/pages/legal/dashboard.vue` - Legal Unit dashboard with workflow info
- [x] `app/pages/legal/verify.vue` - Code verification page with full applicant details and timeline

**Validators Added:**
- [x] `submissionRecordSchema` - Validate submission recording

**Storage Service Updated:**
- [x] `uploadBuffer()` - Upload PDF buffers to MinIO

### Phase 4: Production Readiness

- [ ] `k8s/base/*` - Kubernetes manifests
- [ ] `k8s/overlays/*` - Environment overlays
- [ ] `docker/Dockerfile` - Production Dockerfile
- [ ] `tests/*` - Unit, integration, e2e tests
- [ ] Security hardening (rate limiting, CORS, CSP)

---

## 8. Docker Development Setup

```yaml
# docker-compose.dev.yml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - DATABASE_URL=postgresql://adla:adla@db:5432/adla
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
    depends_on:
      - db
      - redis
      - minio

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: adla
      POSTGRES_PASSWORD: adla
      POSTGRES_DB: adla
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  postgres_data:
  minio_data:
```

---

## 9. Kubernetes Deployment Overview

```
Namespace: adla-prod

Deployments:
  - adla-app (3 replicas, HPA enabled)

StatefulSets:
  - postgresql (1 replica with PVC)
  - redis (1 replica)
  - minio (1 replica with PVC)

Services:
  - adla-app (ClusterIP)
  - postgresql (ClusterIP)
  - redis (ClusterIP)
  - minio (ClusterIP)

Ingress:
  - adla.example.com → adla-app:3000

Secrets:
  - db-credentials
  - jwt-secret
  - minio-credentials
  - smtp-credentials

ConfigMaps:
  - app-config (env vars)
```

---

## 10. Verification Plan

1. **Unit Tests**: Run `pnpm test:unit`
2. **Integration Tests**: Run `pnpm test:integration`
3. **E2E Tests**: Run `pnpm test:e2e`
4. **Manual Testing**:
   - Register as applicant → verify email received
   - Submit declaration → verify unique code generated
   - Login as officer → verify submission workflow
   - Login as legal → verify code verification
   - Complete full cycle → verify receipt generation
5. **Docker**: `docker-compose -f docker-compose.dev.yml up`
6. **K8s**: Deploy to staging cluster and verify all pods healthy

---

## 11. Getting Started (Phase 1)

### Prerequisites
- Docker and Docker Compose
- Node.js 22+ (for local development)
- pnpm package manager

### Quick Start with Docker

```bash
# From project root
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Access the application
# App: http://localhost:3000
# MailHog (email testing): http://localhost:8025
# MinIO Console: http://localhost:9001
```

### Local Development (without Docker)

```bash
# Navigate to app folder
cd app

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL, Redis, MinIO (via Docker)
docker-compose -f ../docker-compose.dev.yml up -d db redis minio mailhog

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:push

# Seed the database
pnpm db:seed

# Start development server
pnpm dev
```

### Default Admin Credentials (Development Only)
- Email: `admin@adla.gov.gh`
- Password: `admin123`

### Project Structure (app folder)

```
app/
├── assets/css/main.css       # Tailwind CSS with Ghana theme
├── docker/                   # Docker configurations
├── layouts/                  # Vue layouts (default, auth, dashboard)
├── middleware/               # Client-side route middleware
├── pages/                    # Vue pages (file-based routing)
│   ├── auth/                 # Login, register, forgot-password
│   ├── applicant/            # Applicant dashboard
│   └── index.vue             # Landing page
├── prisma/                   # Database schema and seeds
├── server/                   # Nuxt server (Nitro)
│   ├── api/auth/             # Authentication endpoints
│   ├── middleware/           # Server middleware
│   └── utils/                # Utilities (JWT, Prisma, validators)
├── stores/                   # Pinia stores
├── nuxt.config.ts            # Nuxt configuration
└── package.json              # Dependencies
```

---

## 13. Clarified Decisions

| Decision              | Choice               | Notes                                                    |
| --------------------- | -------------------- | -------------------------------------------------------- |
| NIA API Integration   | Plan for future      | Design abstraction layer; start with manual verification |
| Notification Channels | Email + SMS + In-app | Full notification system with preferences                |
| UI Library            | shadcn-vue           | Tailwind-based, follows documentation at shadcn-vue.com  |
| Compliance Level      | Government           | Enhanced audit, data retention, access controls          |

---

## 14. Notification API Endpoints

| Method | Endpoint                         | Description                  |
| ------ | -------------------------------- | ---------------------------- |
| GET    | `/api/notifications`             | Get user's notifications     |
| PATCH  | `/api/notifications/:id/read`    | Mark notification as read    |
| POST   | `/api/notifications/read-all`    | Mark all as read             |
| GET    | `/api/notifications/preferences` | Get notification preferences |
| PATCH  | `/api/notifications/preferences` | Update preferences           |
