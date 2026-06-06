# Azure AKS Cost Estimates for ALDA

> Estimated 2026-05-28. Based on US East region pay-as-you-go pricing.
> Use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for your target region.
> South Africa North is the closest Azure region to Ghana.

## Infrastructure Summary

| Workload | Staging | Production |
|---|---|---|
| App pods | 2 replicas (fixed) | 3 baseline, HPA 2–5 |
| Worker pods | 1 replica | 2 replicas |
| Pod CPU request/limit | 256m / 500m (app), 128m / 256m (worker) | same |
| Pod memory request/limit | 512Mi / 1Gi (app), 256Mi / 512Mi (worker) | same |
| Namespace quota | 4 CPU, 8Gi memory, 20 pods | same |
| PostgreSQL | Burstable B1ms, 32 GB | GP D2ds_v5, 128 GB, zone-redundant HA |
| Redis | Basic C0 (250 MB) | Standard C1 (1 GB, replicated) |
| Blob Storage | Standard_LRS | Standard_ZRS |

---

## Staging Environment (~$254/month | ~$3,048/year)

| Component | Spec | Monthly |
|---|---|---|
| AKS Control Plane | Free tier (no SLA) | $0 |
| Compute Nodes | 2x Standard_D2ds_v5 (2 vCPU, 8 GiB each) | $176 |
| PostgreSQL Flexible Server | Burstable B1ms, 1 vCore, 32 GB storage | $25 |
| Azure Cache for Redis | Basic C0, 250 MB | $16 |
| Blob Storage | Standard_LRS, ~100 GB Hot | $10 |
| Container Registry | Basic tier (shared with prod) | $5 |
| Load Balancer + Public IP | Standard LB + static IP | $22 |
| Monitoring | Free tier (first 5 GB) | $0 |
| **Total** | | **~$254** |

---

## Production Environment (~$593/month | ~$7,116/year)

| Component | Spec | Monthly |
|---|---|---|
| AKS Control Plane | Standard tier (99.95% SLA) | $73 |
| Compute Nodes | 3x Standard_D2ds_v5 (2 vCPU, 8 GiB each) | $264 |
| PostgreSQL Flexible Server | GP D2ds_v5, 2 vCore, 128 GB, zone-redundant HA | $150 |
| Azure Cache for Redis | Standard C1, 1 GB (replicated) | $55 |
| Blob Storage | Standard_ZRS, ~100 GB Hot | $10 |
| Container Registry | Basic tier (shared with staging) | $5 |
| Load Balancer + Public IP | Standard LB + static IP | $22 |
| Monitoring | ~5 GB Log Analytics | $14 |
| **Total** | | **~$593** |

---

## Combined Totals

| | Monthly | Annual |
|---|---|---|
| Staging | $254 | $3,048 |
| Production | $593 | $7,116 |
| **Combined** | **~$847** | **~$10,164** |

---

## With Reserved Instance Savings

### 1-Year Commitment (~40% savings on compute + DB)

| | Monthly | Annual |
|---|---|---|
| Staging | ~$170 | ~$2,040 |
| Production | ~$390 | ~$4,680 |
| **Combined** | **~$560** | **~$6,720** |

### 3-Year Commitment (~60% savings on compute + DB)

| | Monthly | Annual |
|---|---|---|
| Staging | ~$135 | ~$1,620 |
| Production | ~$310 | ~$3,720 |
| **Combined** | **~$445** | **~$5,340** |

---

## Cost Optimization Levers

### Single AKS Cluster

Run both staging and production in one cluster using namespace isolation (`adla-staging` / `adla-production`). The Kustomize overlays already support this.

- **Saves:** ~$176/month (shared node pool) + $73/month (single control plane)
- **Trade-off:** Reduced blast-radius isolation between environments

### Stop Staging Off-Hours

PostgreSQL Flexible Server supports start/stop. Turning off nights and weekends cuts staging DB cost ~65%.

- **Saves:** ~$16/month on DB compute

### Spot Nodes for Staging

Azure Spot VMs offer up to 90% savings. Acceptable for non-production workloads that tolerate eviction.

- **Saves:** up to ~$158/month on staging compute

### Use Azure Blob Storage Instead of MinIO

Eliminates the need for a persistent volume and in-cluster MinIO deployment. Provides 99.999999999% durability at ~$3–6/month for the expected storage volume.

---

## Key References

- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- [AKS Pricing Tiers](https://learn.microsoft.com/azure/aks/free-standard-pricing-tiers)
- [AKS Cost Optimization Best Practices](https://learn.microsoft.com/azure/aks/best-practices-cost)
- [AKS Baseline Architecture](https://learn.microsoft.com/azure/architecture/reference-architectures/containers/aks/baseline-aks)
- [PostgreSQL Flexible Server Compute](https://learn.microsoft.com/azure/postgresql/compute-storage/concepts-compute)
- [Azure Cache for Redis Tiers](https://learn.microsoft.com/azure/azure-cache-for-redis/cache-overview#service-tiers)

---

## Node Sizing Rationale

The namespace quota caps at 4 CPU / 8 GiB requests. Three D2ds_v5 nodes provide 6 vCPU / 24 GiB total. After ~20% consumed by AKS system pods (kube-proxy, CoreDNS, etc.), ~4.8 vCPU / 19 GiB remains usable — fitting the quota with headroom for rolling updates (`maxSurge: 1, maxUnavailable: 0`).
