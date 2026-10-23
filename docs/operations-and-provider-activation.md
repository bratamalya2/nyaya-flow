# Operations and provider activation

NyayaFlow starts in a safe manual mode. A source, payment, signing, stamp, corpus, or email integration is not live merely because its adapter or queue exists. Store credentials in the deployment secret manager, never in `.env` committed to source control.

## Required activation checks

- Razorpay: use separate test and production key IDs, key secrets, webhook secrets, and provider plan IDs. Configure the webhook for the raw `/api/webhooks/razorpay` endpoint. Test duplicate IDs, delayed events, refunds, cancellation, and a failed payment before production.
- Email: configure SMTP and verify the sender domain. Delivery records must be retried by the worker and must not expose restricted matter names in an email subject.
- Court sources: each forum connector needs written authorization, source URL, parser version, freshness threshold, and a visible manual fallback. Never mark a manually entered date as official.
- Corpus vendors: record licence, edition, checksum, attribution, allowed use, and expiry before ingestion. The Neo4j projection may contain only the approved shared authority corpus, never firm or matter data.
- Aadhaar eSign and e-stamp: configure only contracted providers. Provider confirmation is required before a signature or stamp is shown as complete. Native DSC token support is intentionally absent.

## Recovery drills

At least quarterly, restore PostgreSQL, private document storage, and commercial records into an isolated environment. Reconcile Razorpay provider events against `provider_events`, `payment_transactions`, and `subscription_events`; do not repair a mismatch by editing immutable events. Preserve subscription invoices and payment records under the organization’s configured commercial retention policy—automatic commercial deletion defaults to off.

## Incident handling

- Invalid or duplicate webhooks: retain the verified event identifier and make no duplicate state transition.
- Provider outage: keep subscriptions read/export-preserving; do not infer payment success from a browser callback.
- Payment failure: mark past due and preserve access during the seven-day grace period; then block new restricted/billable actions while retaining export/read access.
- Source outage: display freshness and manual-source state instead of fabricating a court result.
