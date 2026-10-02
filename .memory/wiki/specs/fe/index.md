# FE Layer: Frontend Specifications

> **IA Source**: [ia/index.md](../ia/index.md)
> **BE Source**: [be/index.md](../be/index.md)

## Reading Order

All 43 frontend shard specifications are complete and independently ambiguity-passed. Read Shard 00 first, then Shards 01–42 in dependency order.

## Conventions

Every FE specification defines typed component props and named variants, complete IA-flow ownership, server/URL/local state, all async and error states, guarded routes with metadata, three-breakpoint behavior, WCAG 2.2 AA interaction rules, numeric performance budgets, form/auth security, exhaustive BE field/error ownership, and full source maps. Inheritance cites Shard 00 or the design system; implicit behavior is not accepted.

## Shard Mapping

| IA Shard | FE Specification | Status |
|---|---|---|
| [00 Cross-cutting platform foundation](../ia/00-infrastructure.md) | [00-infrastructure.md](00-infrastructure.md) | complete |
| [01 Identity authority and party governance](../ia/01-identity-authority.md) | [01-identity-authority.md](01-identity-authority.md) | complete |
| [02 Profiles, claiming and qualifications](../ia/02-profiles-verification.md) | [02-profiles-verification.md](02-profiles-verification.md) | complete |
| [03 CMS content modeling and authoring](../ia/03-cms-content-modeling.md) | [03-cms-content-modeling.md](03-cms-content-modeling.md) | complete |
| [04 CMS navigation, media and delivery](../ia/04-cms-delivery-media.md) | [04-cms-delivery-media.md](04-cms-delivery-media.md) | complete |
| [05 Platform configuration, admin and quality](../ia/05-platform-configuration-admin.md) | [05-platform-configuration-admin.md](05-platform-configuration-admin.md) | complete |
| [06 Trust, safety, disputes and evidence](../ia/06-trust-safety.md) | [06-trust-safety.md](06-trust-safety.md) | complete |
| [07 Credit graph, capture and confidence](../ia/07-credits-core.md) | [07-credits-core.md](07-credits-core.md) | complete |
| [08 Credit reporting, exchange and disclosure](../ia/08-credit-reporting-disclosure.md) | [08-credit-reporting-disclosure.md](08-credit-reporting-disclosure.md) | complete |
| [09 Music projects and collaboration](../ia/09-projects-collaboration.md) | [09-projects-collaboration.md](09-projects-collaboration.md) | complete |
| [10 Rights and ownership](../ia/10-rights-ownership.md) | [10-rights-ownership.md](10-rights-ownership.md) | complete |
| [11 Social graph and collaborator network](../ia/11-community-graph.md) | [11-community-graph.md](11-community-graph.md) | complete |
| [12 Communities, participatory spaces and events](../ia/12-community-spaces-events.md) | [12-community-spaces-events.md](12-community-spaces-events.md) | complete |
| [13 Opportunities and casting lifecycle](../ia/13-opportunities-casting.md) | [13-opportunities-casting.md](13-opportunities-casting.md) | complete |
| [14 Services marketplace lifecycle](../ia/14-services-marketplace.md) | [14-services-marketplace.md](14-services-marketplace.md) | complete |
| [15 Lessons, practice and mentorship delivery](../ia/15-education-delivery.md) | [15-education-delivery.md](15-education-delivery.md) | complete |
| [16 Courses, credentials, institutions and special practice](../ia/16-education-credentials-institutions.md) | [16-education-credentials-institutions.md](16-education-credentials-institutions.md) | complete |
| [17 Real-time jamming and remote sessions](../ia/17-realtime-sessions.md) | [17-realtime-sessions.md](17-realtime-sessions.md) | complete |
| [18 Royalty registration, ingestion, calculation and payout](../ia/18-royalty-accounting.md) | [18-royalty-accounting.md](18-royalty-accounting.md) | complete |
| [19 Performance reporting, money-in-flight and forecasting](../ia/19-royalty-reporting-forecasting.md) | [19-royalty-reporting-forecasting.md](19-royalty-reporting-forecasting.md) | complete |
| [20 Licensing core and instrument lifecycle](../ia/20-licensing-core.md) | [20-licensing-core.md](20-licensing-core.md) | complete |
| [21 Specialized clearances and licensing](../ia/21-specialized-licensing.md) | [21-specialized-licensing.md](21-specialized-licensing.md) | complete |
| [22 Release and distribution lifecycle](../ia/22-release-distribution.md) | [22-release-distribution.md](22-release-distribution.md) | complete |
| [23 Gear identity, provenance and recovery](../ia/23-gear-provenance-registry.md) | [23-gear-provenance-registry.md](23-gear-provenance-registry.md) | complete |
| [24 Gear collections, rigs, custody and manifests](../ia/24-gear-holdings-operations.md) | [24-gear-holdings-operations.md](24-gear-holdings-operations.md) | complete |
| [25 Gear catalog, listings and market data](../ia/25-gear-market-catalog.md) | [25-gear-market-catalog.md](25-gear-market-catalog.md) | complete |
| [26 Gear transactions, fulfilment and possession models](../ia/26-gear-commerce-fulfilment.md) | [26-gear-commerce-fulfilment.md](26-gear-commerce-fulfilment.md) | complete |
| [27 Digital catalog, entitlement, delivery and vendor QA](../ia/27-digital-catalog-delivery.md) | [27-digital-catalog-delivery.md](27-digital-catalog-delivery.md) | complete |
| [28 Digital licensing, commerce, revocation and revenue](../ia/28-digital-licensing-commerce.md) | [28-digital-licensing-commerce.md](28-digital-licensing-commerce.md) | complete |
| [29 Venues, studios and spaces](../ia/29-venues-spaces.md) | [29-venues-spaces.md](29-venues-spaces.md) | complete |
| [30 Booking, negotiation and contracts](../ia/30-booking-contracts.md) | [30-booking-contracts.md](30-booking-contracts.md) | complete |
| [31 Agency, settlement and live-market intelligence](../ia/31-live-settlement-intelligence.md) | [31-live-settlement-intelligence.md](31-live-settlement-intelligence.md) | complete |
| [32 Event production planning and advancing](../ia/32-show-production-planning.md) | [32-show-production-planning.md](32-show-production-planning.md) | complete |
| [33 Show-day execution and recovery](../ia/33-show-day-operations.md) | [33-show-day-operations.md](33-show-day-operations.md) | complete |
| [34 Tour routing, logistics, finance and reporting](../ia/34-touring-operations.md) | [34-touring-operations.md](34-touring-operations.md) | complete |
| [35 Ticket products, sales, access packages and delivery](../ia/35-ticket-products-sales.md) | [35-ticket-products-sales.md](35-ticket-products-sales.md) | complete |
| [36 Door access, box office, reconciliation and ticketing risk](../ia/36-box-office-risk.md) | [36-box-office-risk.md](36-box-office-risk.md) | complete |
| [37 Fanbase and direct-to-fan](../ia/37-fanbase-direct-to-fan.md) | [37-fanbase-direct-to-fan.md](37-fanbase-direct-to-fan.md) | complete |
| [38 Promotion and marketing](../ia/38-promotion-marketing.md) | [38-promotion-marketing.md](38-promotion-marketing.md) | complete |
| [39 Analytics ingestion, matching and reporting](../ia/39-analytics-ingestion-reporting.md) | [39-analytics-ingestion-reporting.md](39-analytics-ingestion-reporting.md) | complete |
| [40 Market intelligence, fraud and scouting signals](../ia/40-market-intelligence-signals.md) | [40-market-intelligence-signals.md](40-market-intelligence-signals.md) | complete |
| [41 Career finance and business operations](../ia/41-career-finance.md) | [41-career-finance.md](41-career-finance.md) | complete |
| [42 Career planning, insurance and sustainability](../ia/42-career-planning-risk.md) | [42-career-planning-risk.md](42-career-planning-risk.md) | complete |

## Quality Gate

- [FE ambiguity audit: remediated, fresh rerun required](../audits/2026-08-29-fe-ambiguity-report.md)
- [FE audit scope: 43 scored specifications + 1 supporting index](../audits/audit-scope.md)

## Amendment Note

FE shard 03 carries the owner-approved DEC-108 CMS activation-producer cascade
(successor, dry-run, frozen CMS review, bounded assignment and independent
reviewer-decision commands CMS-03A-09..14, plus the safe display-only context
evidence and the `schemaReviewAssigned` review-only variant). The cascade is a
frontend selection over the locked IA/BE contracts and changes no product,
permission, security or data-placement decision; a fresh FE ambiguity pass is
required before `/plan-phase` treats the amended shard as complete.

The next valid pipeline stage is `/plan-phase`.


<!-- spec-graph: auto-generated -->
## Related Specs

### Derives from
- [[specs/ia/index|IA Layer — Information Architecture]]

### References
- [[specs/ia/index|IA Layer — Information Architecture]]
