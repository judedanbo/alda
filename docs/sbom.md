# Software Bill of Materials (SBOM) — Asset Declaration Portal (ADLA)

> Closes audit-checklist items **D8** (SBOM & dependency inventory) and **L4**
> (open-source license compliance). The machine-readable SBOMs are the
> authoritative artifacts; this page summarizes them and explains how to
> regenerate. Ties to [`vulnerability-patch-management-policy.md`](./vulnerability-patch-management-policy.md)
> and [`risk-register.md`](./risk-register.md) (RR-15, supply chain).

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (generated) |
| Owner | `[TBD]` (Engineering lead / ISO) |
| Generated | 2026-06-03 |
| Source | `app/package.json` + `app/package-lock.json` (lockfileVersion 3) |
| Regenerate | On any dependency change (see §5) |

---

## 1. Artifacts

| File | Format | Notes |
| --- | --- | --- |
| [`sbom/adla-sbom.cyclonedx.json`](./sbom/adla-sbom.cyclonedx.json) | **CycloneDX 1.5** | Primary; widely consumed by SCA/scanners |
| [`sbom/adla-sbom.spdx.json`](./sbom/adla-sbom.spdx.json) | **SPDX 2.3** | Alternative standard for license/compliance tooling |

Both were produced by `npm sbom` (npm CLI 10.9.7) from the committed lockfile, so
they are **reproducible** and exactly reflect the resolved dependency tree.

## 2. Inventory summary

| Metric | Value |
| --- | --- |
| Total components (resolved) | **982** |
| Direct production dependencies | 25 |
| Direct dev dependencies | 16 |
| Lockfile | `package-lock.json`, lockfileVersion 3 (deterministic) |
| Application | `adla@1.0.0` (Nuxt 4) |

Notable direct dependencies (full list in `app/package.json`): `nuxt`,
`@prisma/client` / `prisma`, `ioredis`, `bullmq`, `minio`, `nodemailer`,
`pdf-lib`, `bcrypt`/`bcryptjs`, `jsonwebtoken`, `zod`, `pinia`, `shadcn` UI deps,
`apexcharts` (+ `vue3-apexcharts`), `@tanstack/vue-table`, `@vueuse/core`.

## 3. License compliance (L4)

Distribution across the 982 resolved components:

| License | Count | Type |
| --- | ---: | --- |
| MIT | 809 | Permissive |
| Apache-2.0 | 53 | Permissive |
| ISC | 51 | Permissive |
| BSD-2-Clause | 20 | Permissive |
| BSD-3-Clause | 16 | Permissive |
| BlueOak-1.0.0 | 14 | Permissive |
| CC0-1.0 | 4 | Public-domain-equivalent |
| MPL-2.0 | 3 | Weak copyleft (file-level) |
| 0BSD | 2 | Permissive |
| MIT OR Apache-2.0 / MIT-0 / (MIT AND Zlib) / (MIT OR CC0-1.0) | 4 | Permissive |
| Python-2.0 / CC-BY-4.0 / CC-BY-3.0 | 3 | Permissive/attribution |
| (BSD-3-Clause OR GPL-2.0) | 1 | Dual — use under BSD-3-Clause |
| **UNKNOWN** | **2** | Needs manual confirmation |

**Assessment:** ~99% permissive (MIT/Apache/ISC/BSD). No strong-copyleft (GPL/AGPL)
obligation is imposed: the single GPL appearance is a **dual** license usable
under BSD-3-Clause. `MPL-2.0` (×3) is weak/file-level copyleft — acceptable for
use without source-disclosure of ADLA's own code.

**Action items:**
- **`apexcharts@5.13.0`** and **`vue3-apexcharts@1.11.1`** report no license in
  npm metadata (the `UNKNOWN` rows). ApexCharts ships under a custom permissive
  license — **confirm and record the license terms** `[TBD]` before relying on
  them in production.

## 4. Vulnerability snapshot

`npm audit` at generation time:

| Severity | Count |
| --- | ---: |
| Critical | 1 |
| High / Moderate / Low | 0 |

**The single critical advisory:**

| Item | Detail |
| --- | --- |
| Package | `vitest` (`< 4.1.0`) — **dev dependency** |
| Advisory | GHSA-5xrq-8626-4rwp — Vitest UI server can read/execute arbitrary files when listening |
| Exposure | **Dev/test only** — Vitest and its UI server are not part of the production build (`.output`); not internet-exposed |
| Fix | Upgrade to `vitest@4.1.8` (semver-major) |
| Tracking | Triage under [`vulnerability-patch-management-policy.md`](./vulnerability-patch-management-policy.md); risk in `risk-register.md` RR-15. Schedule the major bump and re-test |

> This snapshot is point-in-time. The SBOM exists so SCA tooling can re-evaluate
> against advisory feeds continuously — wire it into CI (vuln/patch policy §2).

## 5. How to (re)generate

Run from `app/` after `npm ci` (so the resolved tree matches the lockfile):

```bash
cd app
npm ci
npm sbom --sbom-format cyclonedx --sbom-type application > ../docs/sbom/adla-sbom.cyclonedx.json
npm sbom --sbom-format spdx      --sbom-type application > ../docs/sbom/adla-sbom.spdx.json
npm audit                        # vulnerability snapshot
```

**Regeneration triggers:** any change to `package.json`/`package-lock.json`
(adding, removing, or upgrading a dependency). Treat the SBOM as a generated
artifact — do not hand-edit the JSON. Consider automating generation + an SCA
scan in CI so the SBOM and vulnerability posture stay current.

## 6. Open items

1. Confirm and record the **apexcharts / vue3-apexcharts** license terms (the 2 `UNKNOWN`).
2. Schedule the **`vitest` → 4.1.8** upgrade and re-test (RR-15).
3. **Automate** SBOM generation + SCA scanning in CI (vuln/patch policy §2).
4. Assign an **owner** for ongoing dependency/license review.

---

*SBOMs generated by `npm sbom` from the committed lockfile. Not legal advice —
confirm license obligations with counsel where a component's terms are unclear.*
