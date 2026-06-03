# Data Model — ERD & Data Dictionary — Asset Declaration Portal (ADLA)

> Closes audit-checklist item **D3**. Authoritative source is
> `app/prisma/schema.prisma` (camelCase Prisma fields map to snake_case Postgres
> columns via `@map`/`@@map`). Classification tiers reference
> [`data-classification-policy.md`](./data-classification-policy.md):
> **Restricted-PII**, **Confidential**, **Internal**, **Public**.
>
> ERDs are grouped by domain cluster. Each is inline Mermaid + an SVG export
> under [`docs/diagrams/`](./diagrams/). Only key fields are shown per entity;
> the data dictionary below each diagram flags sensitive columns.

---

## 1. Identity & Authentication

```mermaid
erDiagram
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : grants
  USER ||--o{ REFRESH_TOKEN : owns
  USER ||--o{ PASSWORD_RESET_TOKEN : owns
  USER ||--o{ EMAIL_VERIFICATION_TOKEN : owns
  USER ||--o{ PHONE_VERIFICATION_TOKEN : owns
  USER ||--o| APPLICANT_PROFILE : "has (1:1)"

  USER {
    uuid id PK
    string email "PII, unique"
    string passwordHash "secret (bcrypt)"
    string phone "PII, unique, optional"
    bool emailVerified
    bool phoneVerified
    bool isActive
  }
  ROLE {
    int id PK
    string name "applicant|schedule_officer|legal_unit|admin"
  }
  USER_ROLE {
    uuid userId FK
    int roleId FK
  }
  REFRESH_TOKEN {
    uuid id PK
    uuid userId FK
    string token "secret, unique"
    uuid familyId "rotation family"
    datetime consumedAt "replay detection"
    datetime expiresAt
  }
  PASSWORD_RESET_TOKEN {
    uuid id PK
    string token "secret"
  }
  EMAIL_VERIFICATION_TOKEN {
    uuid id PK
    string token "secret"
  }
  PHONE_VERIFICATION_TOKEN {
    uuid id PK
    string code "secret (OTP)"
    int attempts
  }
```

[SVG export »](./diagrams/erd-identity-auth.svg)

| Entity.field | Tier | Notes |
| --- | --- | --- |
| User.email, User.phone | Confidential (PII) | Unique; contact identifiers |
| User.passwordHash | Restricted (secret) | bcrypt hash, never returned |
| RefreshToken.token, *Token.token/code | Restricted (secret) | Session/verification secrets; `familyId`/`consumedAt` drive replay detection |
| Role.name, UserRole.* | Internal | RBAC reference data |

## 2. Applicant Profile & Verification

```mermaid
erDiagram
  USER ||--o| APPLICANT_PROFILE : has
  APPLICANT_PROFILE ||--o{ APPLICANT_VERIFICATION_REVIEW : "reviewed by"
  APPLICANT_PROFILE ||--o{ APPLICANT_OFFICE : declares
  PUBLIC_OFFICE_CATEGORY ||--o{ APPLICANT_OFFICE : categorizes
  INSTITUTION ||--o{ APPLICANT_OFFICE : "employer (optional)"
  USER ||--o{ APPLICANT_VERIFICATION_REVIEW : "reviewer"

  APPLICANT_PROFILE {
    uuid id PK
    uuid userId FK "unique"
    string fullName "PII"
    enum idType "GHANA_CARD|PASSPORT|..."
    string ghanaCardNumberCipher "PII, AES-256-GCM"
    string ghanaCardNumberHash "PII, HMAC, unique"
    string ghanaCardFrontUrl "PII, image"
    string ghanaCardBackUrl "PII, image"
    string alternateIdNumberCipher "PII, encrypted"
    string alternateIdNumberHash "PII, HMAC"
    string alternateIdScanUrl "PII, image"
    enum verificationStatus
  }
  APPLICANT_VERIFICATION_REVIEW {
    uuid id PK
    uuid applicantId FK
    uuid reviewerId FK
    enum status
    string reason
  }
  APPLICANT_OFFICE {
    uuid id PK
    uuid profileId FK
    string designation "PII"
    int officeCategoryId FK
    uuid institutionId FK
  }
  PUBLIC_OFFICE_CATEGORY {
    int id PK
    string name
    string articleReference
  }
  INSTITUTION {
    uuid id PK
    string name
    string type
  }
```

[SVG export »](./diagrams/erd-applicant-profile.svg)

| Entity.field | Tier | Notes |
| --- | --- | --- |
| ApplicantProfile.ghanaCardNumberCipher / Hash | **Restricted-PII** | National ID: AES-256-GCM cipher + HMAC lookup hash (`pii-encryption.ts`) |
| ApplicantProfile.alternateIdNumberCipher / Hash | **Restricted-PII** | Alternate ID, same scheme |
| ApplicantProfile.ghanaCardFrontUrl / BackUrl / alternateIdScanUrl | **Restricted-PII** | Identity-document images in MinIO (presigned access) |
| ApplicantProfile.fullName, ApplicantOffice.designation | Confidential (PII) | Name + declared public office |
| PublicOfficeCategory.*, Institution.* | Public / Internal | Reference data |

## 3. Declaration Workflow

```mermaid
erDiagram
  APPLICANT_PROFILE ||--o{ DECLARATION : files
  DECLARATION ||--o{ DECLARATION_STATUS_HISTORY : tracks
  DECLARATION ||--o{ FORM_COLLECTION : "form collected"
  DECLARATION ||--o{ FORM_REISSUE_REQUEST : "reissue requests"
  DECLARATION ||--o{ REVIEW : reviewed
  DECLARATION ||--o{ DECLARATION_SECTION_REVIEW : "section reviews"
  DECLARATION ||--o{ RECEIPT : issues
  DECLARATION |o--o| DECLARATION : "previous (chain)"
  COLLECTION_OFFICE ||--o{ FORM_COLLECTION : "collected at"
  COLLECTION_OFFICE ||--o{ DECLARATION : "return office"
  COLLECTION_OFFICE ||--o{ USER_COLLECTION_OFFICE : scopes
  USER ||--o{ USER_COLLECTION_OFFICE : "assigned (officer)"

  DECLARATION {
    uuid id PK
    uuid applicantId FK
    string uniqueCode "unique"
    enum status "CODE_GENERATED..SEALED"
    uuid returnOfficeId FK
    uuid previousDeclarationId FK "unique"
  }
  DECLARATION_STATUS_HISTORY {
    uuid id PK
    uuid declarationId FK
    enum status
    uuid changedById FK
  }
  COLLECTION_OFFICE {
    uuid id PK
    string name
    enum type "HEADQUARTERS|REGIONAL"
    string region
  }
  USER_COLLECTION_OFFICE {
    uuid userId FK
    uuid collectionOfficeId FK
  }
  FORM_COLLECTION {
    uuid id PK
    uuid declarationId FK
    uuid recordedBy FK
    uuid collectionOfficeId FK
  }
  FORM_REISSUE_REQUEST {
    uuid id PK
    uuid declarationId FK
    enum status "PENDING|APPROVED|DECLINED"
    enum approverType
    string letterScanUrl "scanned letter"
  }
  REVIEW {
    uuid id PK
    uuid declarationId FK
    enum status "APPROVED|REJECTED"
  }
  DECLARATION_SECTION_REVIEW {
    uuid id PK
    uuid declarationId FK
    enum section
    bool isAcceptable
  }
  RECEIPT {
    uuid id PK
    uuid declarationId FK
    string receiptNumber "unique"
    string pdfUrl
  }
```

[SVG export »](./diagrams/erd-declaration-workflow.svg)

| Entity.field | Tier | Notes |
| --- | --- | --- |
| Declaration.uniqueCode | Confidential | Identifier used for authenticity verification |
| Declaration.previousDeclarationId | Internal | Self-referential chain on rejection→reissue |
| UserCollectionOffice.* | Internal | Officer-to-office scoping (enforced by `officer-scope.ts`) |
| FormReissueRequest.letterScanUrl, Receipt.pdfUrl | Confidential | Documents in MinIO (presigned) |
| Declaration/Review/Section/History records | Confidential | Asset-declaration workflow data; long statutory retention |

## 4. Notifications & Preferences

```mermaid
erDiagram
  USER ||--o{ NOTIFICATION : receives
  NOTIFICATION ||--o{ NOTIFICATION_DELIVERY_LOG : "delivery attempts"
  USER ||--o| NOTIFICATION_PREFERENCE : "channels (1:1)"
  USER ||--o{ NOTIFICATION_TYPE_PREFERENCE : "per-type opt-in"
  USER ||--o| ACCESSIBILITY_PREFERENCE : "a11y (1:1)"

  NOTIFICATION {
    uuid id PK
    uuid userId FK
    enum type
    enum channel "EMAIL|SMS|IN_APP"
    string title
    string message "no Restricted-PII"
    string dedupeKey
    datetime readAt
  }
  NOTIFICATION_DELIVERY_LOG {
    uuid id PK
    uuid notificationId FK
    enum channel
    enum status "PENDING|SENT|DELIVERED|FAILED"
    json providerResponse
    int retryCount
  }
  NOTIFICATION_PREFERENCE {
    uuid id PK
    uuid userId FK "unique"
    bool emailEnabled
    bool smsEnabled
    bool inAppEnabled
  }
  NOTIFICATION_TYPE_PREFERENCE {
    uuid id PK
    uuid userId FK
    enum type
  }
  ACCESSIBILITY_PREFERENCE {
    uuid id PK
    uuid userId FK "unique"
    string textSize
    bool reduceMotion
  }
```

[SVG export »](./diagrams/erd-notifications.svg)

| Entity.field | Tier | Notes |
| --- | --- | --- |
| Notification.title/message | Confidential | **Policy: no Restricted-PII in bodies** |
| NotificationDeliveryLog.providerResponse | Internal | Delivery metadata from email/SMS provider |
| *Preference.* , AccessibilityPreference.* | Internal | Per-user settings (a11y may be health-adjacent → Confidential) |

## 5. Audit, Retention & Contact

```mermaid
erDiagram
  USER |o--o{ AUDIT_LOG : "actor (optional)"
  USER |o--o{ ARCHIVED_RECORD : "archived by"

  AUDIT_LOG {
    uuid id PK
    uuid userId FK "optional"
    string action
    string entityType
    string entityId
    json oldValues "no raw PII"
    json newValues "no raw PII"
    string ipAddress
    string sessionId
  }
  DATA_RETENTION_POLICY {
    int id PK
    string entityType
    int retentionPeriodDays
    int archiveAfterDays
    int deleteAfterDays
  }
  ARCHIVED_RECORD {
    uuid id PK
    string entityType
    string entityId
    json archivedData "snapshot"
    datetime scheduledDeletionDate
  }
  CONTACT_SUBMISSION {
    uuid id PK
    string name "PII"
    string email "PII"
    string phone "PII, optional"
    enum category
    enum status
    string ipAddress
  }
```

[SVG export »](./diagrams/erd-governance.svg)

| Entity.field | Tier | Notes |
| --- | --- | --- |
| AuditLog.oldValues / newValues | Confidential | **Policy: no raw Ghana Card numbers/names** (RR-04) |
| AuditLog.ipAddress, ContactSubmission.ipAddress | Confidential | Source IP (subject to trusted-proxy resolution) |
| ArchivedRecord.archivedData | Inherits source | Full entity snapshot for retention/deletion |
| ContactSubmission.name/email/phone | Confidential (PII) | Public enquiry data |

## 6. Analytics, Abuse & Access Control

```mermaid
erDiagram
  ABUSE_EVENT |o--o{ ENFORCEMENT_ACTION : "may trigger"

  TRAFFIC_EVENT {
    uuid id PK
    datetime occurredAt
    string routePattern
    int statusCode
    string ipHash "pseudonymized (salted)"
    string ipTruncated
    enum visitorClass "HUMAN|SEARCH_BOT|AI_AGENT|OTHER_BOT"
    string sessionId
    string visitorId
  }
  TRAFFIC_ROLLUP_HOURLY {
    uuid id PK
    datetime bucket
    int requests
    int uniqueVisitors
    int p95DurationMs
  }
  TRAFFIC_ROLLUP_DAILY {
    uuid id PK
    date bucket
    int requests
    int uniqueVisitors
  }
  ABUSE_EVENT {
    uuid id PK
    datetime detectedAt
    enum actorType "IP|SESSION|USER"
    string actorKey
    enum severity "LOW|MEDIUM|HIGH|CRITICAL"
    int score
    json signals
  }
  ENFORCEMENT_ACTION {
    uuid id PK
    uuid abuseEventId FK "optional"
    enum type "LOG_ONLY|THROTTLE|BLOCK"
    string reason
    datetime expiresAt
    bool active
  }
  ACTOR_ACCESS_RULE {
    uuid id PK
    enum actorType "IP|SESSION|USER"
    string actorValue "IP/CIDR/session/user"
    enum ruleType "ALLOW|BLOCK"
  }
```

[SVG export »](./diagrams/erd-analytics-abuse.svg)

| Entity.field | Tier | Notes |
| --- | --- | --- |
| TrafficEvent.ipHash / ipTruncated | Internal (pseudonymized) | IP salted-hashed via `ANALYTICS_IP_SALT`; raw IP not stored |
| TrafficEvent.sessionId / visitorId | Internal | Cookieless fingerprint identifiers |
| AbuseEvent / EnforcementAction / ActorAccessRule | Internal | Security operations; pruned per analytics retention |

> Full analytics/abuse design: [`analytics-abuse-ratelimit.md`](./analytics-abuse-ratelimit.md).

---

## 7. Enumerations (reference)

| Enum | Values |
| --- | --- |
| DeclarationStatus | CODE_GENERATED, FORM_COLLECTED, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, SEALED |
| VerificationStatus | PENDING_VERIFICATION, VERIFIED, ON_HOLD, MORE_INFO_REQUIRED, REJECTED |
| FormReissueStatus | PENDING, APPROVED, DECLINED |
| ReissueApproverType | AUDITOR_GENERAL, REGIONAL_AUDITOR |
| IdDocumentType | GHANA_CARD, PASSPORT, VOTER_ID, DRIVERS_LICENSE, NIA_RECEIPT |
| AlternateIdReason | PENDING_NIA_REGISTRATION, FOREIGN_NATIONAL, LOST_AWAITING_REISSUE, DAMAGED_AWAITING_REISSUE, OTHER |
| ReviewStatus | APPROVED, REJECTED |
| FormSection | PERSONAL_PARTICULARS, PROPERTIES, EMPLOYMENT_BUSINESS, SECURITIES_BANK, ALIASES_PROPERTIES, LIABILITIES, VOLUNTARY_INFO, DECLARANT_CERTIFICATE |
| CollectionOfficeType | HEADQUARTERS, REGIONAL |
| NotificationType | UNIQUE_CODE_GENERATED, FORM_COLLECTED, FORM_RETURNED, FORM_REISSUE_* , SECTION_REVIEW_COMMENTS, REVIEW_APPROVED/REJECTED, RECEIPT_READY, PASSWORD_RESET, EMAIL_VERIFICATION, VERIFICATION_* |
| NotificationChannel | EMAIL, SMS, IN_APP |
| DeliveryStatus | PENDING, SENT, DELIVERED, FAILED |
| ContactCategory / ContactStatus | GENERAL_INQUIRY, TECHNICAL_SUPPORT, DECLARATION_HELP, FEEDBACK, COMPLAINT, OTHER / NEW, IN_PROGRESS, RESOLVED, CLOSED |
| VisitorClass / AiCategory | HUMAN, SEARCH_BOT, AI_AGENT, OTHER_BOT / TRAINING_CRAWLER, SEARCH_INDEXER, LIVE_RETRIEVAL, UNKNOWN_SCRAPER |
| AbuseSeverity / EnforcementType | LOW, MEDIUM, HIGH, CRITICAL / LOG_ONLY, THROTTLE, BLOCK |
| AccessActorType / AccessRuleType | IP, SESSION, USER / ALLOW, BLOCK |

---

*Generated from `app/prisma/schema.prisma`. Regenerate diagrams with the
`.mmd` sources in `docs/diagrams/`. See the build note in
[`architecture.md`](./architecture.md).*
