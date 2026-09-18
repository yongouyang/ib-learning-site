# Privacy Notice — DRAFT

> **Status: PUBLISHED 15 September 2026** (DEV and PROD); **revised 17 September 2026** (§9
> backups). `src/app/privacy/page.tsx` renders the document body below **verbatim**; this
> preamble and the review checklist at the end are internal notes and are **not** part of the
> published page.
>
> **Not legal advice.** Every remaining open point is marked `[[ ]]`. The two sections that
> genuinely need a lawyer are §5 (children — a minors' product with an AI feature that
> ingests free text, a DPIA trigger) and §8 (international transfers, since the primary data
> store is in Hong Kong and the AI provider is in the PRC).
>
> **Accuracy is the whole point.** A privacy notice that does not match what the code does is
> worse than none: it is evidence of a misrepresentation. §3, §6, §7 and §9 were written from
> the actual implementation (file paths inline) and **every processor, field and retention
> period must be re-checked whenever any of them changes.** A stale notice is a defect to fix,
> not a document to leave alone.
>
> **Decisions taken 2026-09-15:** (1) the controller is a **sole proprietor in Hong Kong**, to
> be replaced by a HK limited company as revenue justifies it; (2) **age: accounts are 16+,
> or parent/guardian-held for younger students, with no signup age gate** — §5.4 now states
> that instead of leaving the model open; (3) the seller-of-record question is **answered from
> Stripe's documentation** (§7), not inferred.
>
> **Verified 2026-09-15** (checklist item 5 — the full field/TTL re-check): the 30/1000 AI
> quotas, the 14-day trial, the free split (1 paper set per course, ladder levels 1–2), the
> 90d/400d analytics TTLs, 365d contact, leaderboard week-end +14d, the 40d AI-mark bucket,
> the 30d sessions, `HttpOnly; SameSite=Lax; Secure` on the session cookie and the three
> `localStorage` keys all still match the code. **One claim did not survive: §12's "one
> essential cookie"** — measured with `scripts/verify-checkout-cookies.mjs` and rewritten:
> Stripe.js set `__stripe_mid`/`__stripe_sid` on our own domain on *every* page, so §12 now
> lists all three cookies plus the third-party ones inside the checkout iframe — **and the
> loading itself was fixed** (`ensureStripeScript()` in `BillingPanel`), so those two cookies
> now exist only on `/pricing` + `/account`, which is what §12 now claims.
>
> **Revised 2026-09-18 (the premium marker) — the first notice change that ADDS a purpose rather
> than correcting a fact.** Premium paper sets are now delivered with a leak-tracing marker: a
> masked sign-in address, a short reference derived from the account, and the issue time, shown on
> the paper and carried in the response data. §6.5 describes it and §9 states that nothing about it
> is stored. The paired implementation is `handlePremiumPaperGet` in
> `src/lib/content/http-handler.ts` (premium sets only — the free set 1 is deliberately unmarked,
> being neither the paid asset nor reachable through that route in the UI) with the visible line in
> `src/app/papers/[courseId]/[setId]/PaperRunnerClient.tsx`. **Do not oversell it in review:** a
> determined leaker can crop or edit the line, so it buys attribution in the ordinary case (an
> unscrubbed screenshot or paste) and the deterrence of being visible — not un-copyability (§8 of
> `docs/premium-content-protection-plan.md`). A same-day correction rode with it: §6.5 pointed at
> **§9** of the Terms for acceptable use; the correct section is **§6**.
>
> **Revised 2026-09-17 (§9 backup row) — the first change driven by an ops decision rather
> than a measurement.** The notice previously said we kept no backup copy of your data at all.
> Point-in-time recovery was enabled on the five tables whose contents are not regenerable
> (`octav-users`, `octav-progress`, `octav-analytics-events`, `octav-leaderboard`,
> `octav-contact`) and deletion protection on all eight application tables, so §9 now states
> the **35-day** window and what it means for erasure. The two moved together deliberately:
> §9's old sentence — *"deleting your data is not resurrected by an earlier snapshot"* —
> became **false** the moment PITR was switched on. The paired change is
> `terraform/modules/dynamodb/main.tf`; re-verify with `aws dynamodb describe-continuous-backups`
> if either side is touched. Note that this trades a privacy-framing benefit ("we cannot
> resurrect your data") for durability — a deliberate choice, not a drift.

Operator details filled in as supplied: the controller is **Octav Learning**, Central, Hong
Kong. Two caveats carried forward from the Terms (see its checklist): a sole proprietorship
has no separate legal personality, and "Central, Hong Kong" is not a deliverable postal
address — both need settling before publication, the second one because it is the address any
data-protection authority or data subject would write to.

Effective **15 September 2026**. The privacy contact is `info@octavlearning.com`.

---

## Privacy Notice

**Last updated: 18 September 2026**

This notice explains what personal data Octav Learning collects, why, who it is shared
with, how long it is kept, and what you can ask us to do with it.

### 1. Who is responsible for your data

Octav Learning ("we", "us", "our"), of Central, Hong Kong, is the data controller — the person
who decides why and how your personal data is used — for the Service at octavlearning.com and
its subdomains. We have not appointed a data protection officer; privacy questions, requests
and complaints go to the contact below and we aim to answer within 30 days.

We intend to bring the Service into a Hong Kong limited company as it grows. If we do, that
company becomes the data controller, we will tell you before it happens, and this notice will
name it. Your rights and the way we handle your data do not change because of it.

### 2. The short version

- We collect what we need to run a study service: your email address, the names and
  stages you enter for your child profiles, and your study activity (what you practised
  and how you scored).
- **We do not sell your data, we do not share it with advertisers, and we do not run
  third-party advertising or cross-site tracking.** Our analytics are first-party: they
  are collected by our own API and viewed by us in our own admin dashboard.
- **We do not use your data, or your children's data, to train AI models.**
- We use a small number of service providers to run the Service (hosting, email, payments
  and — when you use it — AI marking). They are listed in §7.
- **AI marking sends the text of your answer to a third-party AI provider**, together
  with the question and the markscheme. Do not submit personal information in an answer.
- You can ask for a copy of your data, correct it, or delete your account and data at any
  time (§10).

### 3. What we collect

**3.1 Information you give us**

| Data | When | Why |
|---|---|---|
| Email address | Signing in (we email a one-time code — there is no password) | To sign you in, to send service and billing emails, to identify your account |
| Display name | Creating your account | To address you in the app |
| Child-profile name(s) and stage (KS3 / IGCSE / IB DP) | Adding a profile | So one account can track several students separately and show stage-appropriate material |
| Leaderboard handle and opt-in state | Turning the leaderboard on | To show you on the leaderboard — only if you opt in |
| Free-response answers you submit for AI marking | Using "Mark with AI" | To mark the answer (see §6.3) |
| Message, name and email address | Using the contact form | To reply to you |
| Billing details | Subscribing to Premium | Handled directly by Stripe — we never receive your card number (§7) |

**3.2 Information we collect automatically**

| Data | Detail |
|---|---|
| Study activity | Quiz attempts, answers, marks, exam and ladder results, flashcard reviews, stars, XP |
| Progress records | Keyed per account and per child profile, so progress syncs across your devices |
| Session cookie | A single essential, first-party cookie holding an opaque session token (the token is stored server-side only in hashed form). It keeps you signed in. It is not used for advertising or analytics. |
| Technical request data | The path you visited, the site you arrived from (host only), the site host you are on (our live or development site), and your browser's user-agent string |
| IP address | Used to enforce abuse and rate limits (for example, limiting sign-in-code requests and contact-form submissions from one source). It is stored only as part of short-lived counters in a rate-limit table with an expiry, not as part of your study record. |
| Payment and subscription status | Plan, status, renewal date and a Stripe customer reference. Card data never reaches us. |

**3.3 Local storage on your device.** Progress for signed-out use, your theme preference,
and a small amount of synchronisation state are stored in your browser's `localStorage`
(keys `iblearn_progress`, `octav_progress:<userId>:<profileId>`, `octav_anon_claimed`,
plus the theme key). This stays on your device until you clear it or sign out. The
installable web app also keeps a cache of pages and assets on your device so it works
offline.

**3.4 What we do not collect.** We do not ask for your date of birth, address, phone
number, school, photographs, or any special-category data (such as health, ethnicity or
religious belief). Please do not put any of that — or anyone else's personal data — into
a display name, a profile name, an answer submitted for marking, or a contact message.

### 4. Why we use it, and our lawful bases (UK/EU GDPR)

If you are in the UK, the EU or the EEA, we must have a lawful basis for each use. HK
PDPO does not use this framework but we apply the same standards, and the purpose
limitation in §4 is the substantive promise either way.

| Purpose | Lawful basis |
|---|---|
| Creating and securing your account; signing you in | Performance of a contract |
| Providing notes, quizzes, diagnostics and progress sync | Performance of a contract |
| Marking your answers with AI, and enforcing the free monthly quota | Performance of a contract (where you have used the free or paid allowance we promised) |
| Taking payment, managing subscriptions and refunds | Performance of a contract |
| Sending service emails (sign-in codes, receipts, trial-ending and renewal reminders) | Performance of a contract |
| Keeping the Service available, secure and free of abuse (rate limits, fraud and scraping defence, blocking malicious traffic) | Legitimate interests (running a safe, working service), and in some cases legal obligation |
| Understanding which parts of the Service are used, in aggregate, to improve it | Legitimate interests (improving the Service) — you can object (§10) |
| Meeting tax, accounting and legal obligations | Legal obligation |
| Handling a complaint, a dispute or an enforcement matter | Legitimate interests / legal obligation |

We do not use your data for automated decisions that produce legal or similarly
significant effects. The free AI-mark quota is counted automatically (§6.3) but has no
legal or similarly significant effect — it is a usage limit, and it is restored each
calendar month.

### 5. Children's privacy — please read

**5.1 The Service is built for secondary-school students, so much of the data we hold
relates to children.** Accounts are created by, and normally owned by, a parent or
guardian (or a student old enough to hold an account themselves). Child profiles are
entries inside an adult's account and cannot be signed into separately.

**5.2 Parental responsibility.** If you add a child profile, you confirm that you are the
child's parent or legal guardian, or that you have their guardian's permission to create
the profile and to let the child use the Service under your account. You are responsible
for what is entered into that profile.

**5.3 What we hold about a child** is deliberately minimal: a first name or nickname, a
stage, and their study activity. We do not ask for a child's email address, date of birth,
school or address.

**5.4 Who may hold an account.** **An account must be held by someone
aged 16 or over, or by a parent or legal guardian on a younger student's behalf**, and a
student under 16 uses the Service through a child profile inside that adult's account. The
same rule is stated in §3.3 of our Terms of Use.

**We do not verify age, and we do not ask for proof of parental consent, at signup** — we rely
on the account holder's confirmation, and we may ask for evidence and close an account if a
confirmation turns out to be untrue. We state the model rather than implying a check we do not
perform.

**5.5 AI marking and children's free text.** Answers a child submits are sent to a
third-party AI provider (§6.3, §7). What we send is the question, the markscheme or model
answer and the text of the answer — **no name, no email address, nothing that identifies the
child.** It is still free text written by a child, so please do not put personal details in an
answer: that text leaves our system and we cannot recall it once it has.

**5.6 The leaderboard is opt-in and off by default.** It shows a generated or chosen
handle and a score, not a real name, and is never enabled for a child profile unless the
account holder turns it on for that profile.

### 6. How we use your data in more detail

**6.1 Sign-in.** We email a one-time code to the address you enter. Codes expire quickly
and are single-use. The email is sent through our email provider (§7).

**6.2 Progress sync.** Your device sends study events to our API, which stores them
against your account and child profile. This is what makes progress appear on your other
devices.

**6.3 AI marking.** When you use "Mark with AI", we send **the question, the markscheme
or model answer, and the text of your answer** to a third-party AI provider to generate
feedback, which we store against the attempt. We do **not** send your name, email address
or account identifier with it, and we do not permit the provider to use the content to
train models. **Because the answer text leaves our system, do not write personal or
sensitive information in an answer.** We count marks used per account per calendar month
to apply the free-tier quota.

**6.4 Analytics.** We record first-party usage events (for example, that a quiz was
started, a diagnostic completed or the leaderboard viewed) with the path, host, referrer
host, a random session identifier and user-agent string. These events are used by us, in
aggregate, to see what is working. They are not used to build a profile of you across
other sites, and there is no advertising or cross-site tracking anywhere in the Service.

**6.5 Security and abuse prevention.** We use rate limits, session validation and access
controls to prevent abuse, protect the Service, and detect attempts to scrape or overload
it. This can involve processing IP addresses and request patterns; see also §6 of the
Terms of Use.

Premium papers also carry a **marker** naming the account they were issued to. It has three
parts: a masked form of that account's sign-in address (the first character and the domain,
never the whole address), a short reference derived from the account, and the time of issue.
It is shown on the paper as a date, and all three parts are included in the data sent to your
browser. Its
purpose is to trace unauthorised redistribution of paid content, which the Terms of Use
prohibit. Two limits are worth stating plainly: the reference cannot be turned back into an
account without our own records, so the marker identifies an account rather than a person,
and it is not used to build a profile of you, nor sold or shared with anyone else. We keep
no separate record of it — it is created when a paper is delivered and exists only in that
response and on that page, which is why §9 lists no retention period for it.

**6.6 Service emails.** We send sign-in codes, receipts and subscription notices (trial
ending, upcoming renewal, payment failure, cancellation confirmation). These are part of
the Service and are not marketing. **We do not send marketing email, and we do not sell
or rent contact details to anyone.**

### 7. Who we share it with

We share personal data only with the providers that make the Service work. Each is bound
by a data-processing agreement and may use your data only to provide its service to us.

| Provider | Role | What it receives |
|---|---|---|
| **Amazon Web Services** (`ap-east-1` — Hong Kong) | Hosting: static site delivery (S3 + CloudFront), and the databases and functions behind accounts, progress, analytics, leaderboard, contact and subscriptions | Everything we hold, at rest and in transit |
| **Resend** | Delivers sign-in codes and service emails | Your email address and the content of the email |
| **Stripe** (and its consumer product **Link**) | **Merchant of record** for Managed Payments transactions: checkout, billing, invoices, receipts, trial and renewal emails, refunds, disputes, fraud prevention and payment support. Because it is the merchant of record it is **not merely our processor** for the payment itself — Stripe's and Link's own terms and privacy notice govern that part of the transaction (§4.5 of the Terms of Use). | Your email address, name, billing address, payment method details, subscription state, and the transaction history Link keeps so you can manage orders at <https://link.com>. You can also ask Stripe to delete your transaction data and Link account: that cancels any subscription and prompts Stripe to tell us. |
| **AI marking provider** — the AI service we use; **currently DeepSeek, a provider established in the PRC** | Generates the feedback for "Mark with AI" | The question, markscheme/model answer and your answer text — never your identity |
| **Cloudflare Email Routing** | Forwards mail sent to our `info@` address | Sender address and message content |
| **GitHub** | Code hosting and automated deployment. No customer data is stored here. | Build and deployment metadata only |
| **IndexNow / search engines** | Tells search engines when pages change, so new content can be found | URLs only |

We may also disclose data if compelled by law, to enforce our Terms of Use, to protect
the rights and safety of users or the public, or as part of a reorganisation of the
business — including the incorporation described in §1 — in which case we would tell you
and your data would remain subject to this notice.

The AI provider row above matters more than its one line suggests: **answer text written by a
child leaves Hong Kong for a provider in the PRC**, which is the most sensitive transfer in
this notice. See §8.

**We do not sell personal data, and we do not share it with advertising networks or data
brokers.**

### 8. Where your data goes (international transfers)

Our primary data store and application infrastructure are in **Hong Kong**
(AWS `ap-east-1`). Some of the providers in §7 are in the United States, the United
Kingdom, the EU or elsewhere, so using the Service can involve transferring your data
outside your country.

Where UK/EU data-protection law applies, a transfer to a country without an adequacy decision
(Hong Kong does not have one for the UK/EU) needs a lawful mechanism. The transfers that matter,
and what covers them:

1. **To the AI provider, currently DeepSeek, established in the PRC** — the free-text answer
   of a child (§6.3). Because no adequacy decision covers the PRC, this is the transfer a parent
   is most likely to ask about. It is made under that provider's standard terms, and we do not
   claim a data-processing addendum with that provider that we cannot point to.
2. **To the United States — Resend for email, and Stripe Payments Company where it is the
   acquiring entity** — covered by the **Standard Contractual Clauses** in Resend's
   data-processing addendum, and by Stripe's data-processing addendum and Data Transfers
   Addendum, which also rely on the **EU–US Data Privacy Framework** where it applies.
3. **To AWS** — this is where the Service's data is stored and processed. AWS's data-processing
   addendum applies to our use of it automatically.

Deleting your account (below) removes personal data from our store, but it cannot recall an
answer that has already been sent for marking — which is one more reason not to put anything
personal into an answer.

### 9. How long we keep it

| Data | Retention |
|---|---|
| Account and child profiles | Until you delete your account |
| Sign-in codes | Minutes — they expire and are deleted automatically |
| Sessions | Deleted on sign-out, and they expire automatically after a period of inactivity |
| Study activity (progress, exam results, ladder, flashcards) | Until you delete the account or the profile |
| AI-mark quota counters | Until the end of the month they cover, plus a short tail (about 40 days) |
| Leaderboard entries | Per weekly season; previous seasons expire about 14 days after the week ends. Opting out removes your row immediately. |
| Analytics events | Raw events: 90 days. Daily aggregates: about 400 days. |
| Contact-form messages | 365 days |
| Billing and tax records | Held by **Stripe**, as merchant of record, under its own notice and its own legal retention duties (we hold only the Stripe customer and subscription identifiers needed to know who is entitled to Premium). Deleting your Link account or asking Stripe to erase your transaction data cancels your subscription and does not depend on us. |
| Rate-limit counters (including IP-keyed abuse counters) | Minutes to hours, expiring automatically |
| Backups | Our main application tables have **point-in-time recovery** enabled, keeping a rolling **35-day** recovery window. It is a resilience measure: if data is lost to a fault or an accident, we can restore it. One consequence you should know: after you delete your account or a profile, a copy of that data can remain inside these backups for **up to 35 days** before it rolls off and is permanently deleted. **Deletion protection** is also enabled, so our tables cannot be dropped by accident. We do not keep a separate scheduled backup, and we do not keep a copy in another region. |

You can delete your account and its data yourself from your account page, or by asking
us at info@octavlearning.com. Deleting an account removes profiles, progress, exam and
leaderboard records. That data also leaves the 35-day recovery window described above as
the window rolls forward, so nothing of it remains recoverable after 35 days. We may keep
limited records where the law requires it (for example tax records of a payment) or to
establish, exercise or defend a legal claim.

One item the table does not list, because we do not keep it: the **premium marker**
described in §6.5 is computed when a paper is delivered and exists only in that response and
on that page. Nothing about it is stored, so there is no retention period to state.

### 10. Your rights

You have the right to:

- **access** the personal data we hold about you, and to receive a copy;
- **correct** data that is wrong or incomplete (most of it you can edit yourself);
- **delete** your data (available in-product, from your account page);
- **portability** — receive the data you gave us in a structured, machine-readable form;
- **object** to processing based on our legitimate interests, including analytics, and to
  ask us to restrict processing while a concern is investigated;
- **withdraw consent** where we rely on consent (for example, leaderboard participation —
  just turn it off);
- **complain** to a supervisory authority. In the UK that is the Information
  Commissioner's Office (ico.org.uk); in the EU/EEA, your national authority; in Hong
  Kong, the Privacy Commissioner for Personal Data (PCPD, pcpd.org.hk). We would prefer
  you came to us first — write to info@octavlearning.com — but you do not have to.

We will respond within one month (HK PDPO: 40 days), and we will not charge you for a
reasonable request.

### 11. How we protect your data

- Data is encrypted in transit (HTTPS/TLS) and at rest by our cloud provider.
- Sign-in uses short-lived one-time codes rather than passwords, so there is no password
  database to breach.
- Session tokens are stored server-side only as hashes; the cookie is first-party,
  essential, and `HttpOnly`/`SameSite`-restricted.
- Access to production data is limited to the smallest set of people who need it, and
  infrastructure permissions follow the same least-privilege rule.
- We scan our code and dependencies for security issues on every change and on a nightly
  schedule.

No system is perfectly secure. If a breach affects your rights, we will tell you and the
relevant authority as required by law.

### 12. Cookies

**These are all the cookies we set:**

| Cookie | Set by | Lifetime | Why it exists, and its flags |
|---|---|---|---|
| `octav_session` | us | 30 days; cleared when you sign out | Keeps you signed in. `HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS. Set only when you sign in. |
| `__stripe_mid` | Stripe.js | 12 months | Stripe's fraud-prevention device identifier. `SameSite=Strict`, not `HttpOnly`. **Set only on `/pricing` and `/account`**, the two pages that can show a payment form. |
| `__stripe_sid` | Stripe.js | 30 minutes | Stripe's short-lived counterpart to the one above. `SameSite=Strict`, not `HttpOnly`. |

**On every other page — the notes, the quizzes, the exams, the homepage — the site sets no
cookies at all unless you are signed in**, in which case only `octav_session`. We do not use
advertising cookies and we run no third-party analytics.

**Third-party cookies.** Nothing third-party is set while you browse. When you actually open
the checkout, Stripe's embedded iframe — and the hCaptcha challenge it uses for bot and risk
detection — set their own cookies in that iframe's own context: `m` on `m.stripe.com`, and
`__cf_bm`, `hmt_id` and `__cflb` on `hcaptcha.com`. Those are set by Stripe in its own
context rather than by us on our domain, and they do not follow you around our site; but they
are not nothing, so they are listed here.

**Do we need a consent banner?** Every cookie above is **strictly necessary** for something
you asked for: `octav_session` to stay signed in, the two Stripe cookies to take a payment
safely, and the checkout-flow cookies to process that payment at all. There is no advertising or analytics cookie to opt into, so there is nothing to consent to, and
we show no cookie banner.

Theme preference and offline progress use `localStorage`, described in §3.3 — that is not a
cookie and is not sent to us.

### 13. Automated processing and AI

We use AI to mark free-response answers (§6.3). It produces study feedback and a
provisional mark; it does not make decisions about you that have legal or similarly
significant effects, and it is not used to build a profile of you. Marks recorded from
AI feedback are for study purposes only and carry no official standing.

### 14. Changes to this notice

If we change how we handle personal data we will update this notice, change the date at
the top, and — if the change is material — tell you by email or in the app before it
takes effect. Previous versions are kept so you can see what changed and when.

### 15. Contact

Octav Learning
Central, Hong Kong

Privacy contact (no DPO has been appointed; this is the data controller directly):
info@octavlearning.com

---

## Before publication — review checklist

A privacy notice is only worth publishing if it is true. Work through these; items 1–4 are the
ones that can fail an audit.

1. **Age and parental consent (§5.4)** — **decided 2026-09-15: accounts are 16+, or
   parent/guardian-held for younger students, with no signup age gate.** What is left is the
   confirmation, not the decision: that contract (not consent) is the right basis for the
   under-16s reached through a parent-held account, and that the UK's Age Appropriate Design
   Code is satisfied by the design as it stands. §5.2, §5.3 and the Terms §3.3 already match.
2. **DPIA (data protection impact assessment).** Still required, and not started: children's
   data plus an AI feature that processes free text. It should cover the AI-marking data flow
   (including the PRC transfer), the leaderboard's child-visibility question and the analytics
   events. Keep it with this notice so the two can be read together.
3. **Who is the seller of record** — **answered 2026-09-15 from Stripe's documentation**
   (`docs.stripe.com/payments/managed-payments/how-it-works`): Link is the merchant of record,
   purchases show as "Sold through Link", and Stripe owns support, refunds, disputes and the
   tax filing. §7 and §9 were rewritten from that. **What is left:** counsel to confirm whether
   Stripe is a processor or an independent controller for that transaction — it changes the
   analysis, not the wording.
4. **Transfer mechanism (§8) — partially resolved for publication.** The published §8 names
   only instruments we can point to: the **Standard Contractual Clauses** in Resend's DPA, and
   Stripe's DPA + Data Transfers Addendum (which also rely on the EU–US DPF), plus AWS's DPA
   for storage in Hong Kong. **The AI-marking transfer to DeepSeek (PRC) has no instrument we
   can name**, so §8 says it is made under the provider's standard terms and does not claim an
   addendum. That is the honest position, not a resolved one: **obtain a DPA/SCCs from that
   provider or replace it** — this is the most sensitive transfer in the notice (a child's free
   text into the PRC) and it belongs in the DPIA.
5. **Re-verify the whole field list against the code** — **done 2026-09-15**, results at the
   top of this file. Sources: `src/lib/auth/types.ts`, `src/lib/progress/*`,
   `src/lib/analytics/http-handler.ts`, `src/lib/leaderboard/*`, `src/lib/contact/*`,
   `src/lib/subscriptions/*`, `terraform/modules/dynamodb/main.tf` (retention/TTLs),
   `src/lib/auth/session.ts` (cookie). Repeat after any change to auth, progress, analytics,
   leaderboard, contact or subscriptions.
6. **Retention numbers (§9) — the backup position, stated as a fact each time it changed.**
   **2026-09-15 (first measurement):** no DynamoDB point-in-time recovery and no AWS Backup plan
   existed for any application table, so §9 said there was no separate backup copy rather than
   leaving a number out. Recorded at the time as two-sided — a strong privacy statement and a
   durability risk, since a bad write or a deleted table had no recovery path — together with
   the rule that *if PITR were ever enabled, §9 must state the window*.
   **2026-09-17 (the ops decision, taken):** the durability risk was accepted. PITR was enabled
   on the five tables whose contents are not regenerable (`octav-users`, `octav-progress`,
   `octav-analytics-events`, `octav-leaderboard`, `octav-contact`) and deletion protection on
   all eight application tables (`terraform/modules/dynamodb/main.tf`); the bootstrap
   state-lock table is deliberately excluded from both. §9's Backups row was rewritten in the
   same change to state the 35-day window and the erasure consequence, because the old
   sentence *"deleting your data is not resurrected by an earlier snapshot"* became false the
   moment PITR was switched on. **Keep the Terraform and this row in step** — changing either
   alone makes the notice a misrepresentation.
7. **Decide whether the AI provider can be named.** This draft names DeepSeek because that is
   the configured provider; if the provider can change without notice, either name the current
   one in-app or keep a dated list. Either way the user must be able to find out who receives
   their answer text — and if the answer is "a provider in the PRC", say so.
8. **Verify the cookies (§12)** — **done 2026-09-15**, in two steps. First the claim **failed**:
   Stripe.js set `__stripe_mid` (12 months) and `__stripe_sid` (30 minutes) on our own domain
   on **every page**, not only at checkout. Then it was **fixed**: `ensureStripeScript()` in
   `BillingPanel` injects Stripe.js on the two pages that can mount a payment form, and the
   re-measure shows `/` clean while `/pricing` + `/account` still get Stripe.js and the
   embedded checkout still mounts. §12 was rewritten around both measurements, including the
   third-party cookies inside the checkout iframe (`m.stripe.com`, hCaptcha). Re-run
   `node scripts/verify-checkout-cookies.mjs` — it now fails if a page without a billing panel
   pulls Stripe.js.
9. **Publish route.** A `/privacy` page linked from the footer, the signup screen, the
   checkout screen and the account page; sitemap/indexable per the SEO conventions in
   `src/lib/seo/*`. The checkout link is a **Dashboard setting** (Stripe → Settings →
   Checkout accepts custom terms-of-service and privacy URLs), not code. Note that
   `src/app/layout.tsx` now links **both** `/terms` and `/privacy` in the footer, and
   `/privacy` is in `coreEntries()` of `scripts/generate-sitemaps.ts`. **Still missing, and
   legally the more important half:** a link on the signup screen and at checkout (the
   checkout link is a Stripe Dashboard setting — Checkout → custom terms-of-service and
   privacy URLs), because that is where the email address and the payment are collected.
10. **Appoint and name an EU and UK representative (§1) — STILL OPEN, and now deliberately
    NOT claimed in the published notice.** GDPR Art 27 and UK GDPR Art 27 require a
    representative in those territories for a controller established outside them. None is
    appointed. The published §1 therefore says nothing about one rather than naming a
    representative we do not have — omission keeps the notice true, but **the obligation
    itself is unmet** and is the highest-priority compliance item on this list.
11. **Incorporation is a planned event — prepare the swap.** On incorporation, the controller
    clause (§1), the Stripe account's business details, the AWS/domain ownership, the Terms'
    §1/§15.3/§16 and the effective date all change together. Decide the revenue threshold in
    advance so this is a scheduled edit rather than a drift.
12. **Consistency sweep** against `docs/terms-of-use-draft.md`, `docs/entitlement-policy.md`
    and `src/app/pricing/page.tsx` — student-data wording, quota numbers, trial length and the
    premium split must match everywhere.
13. **The cookie table's source of truth (§12) — re-check it with
    `node scripts/verify-checkout-cookies.mjs`.** That script drives a real Chromium with
    `js.stripe.com` blocked and then allowed, against the live origin and against a local
    server with a real test-mode checkout mounted, printing `document.cookie` and the full
    cookie jar at each step. Measured 2026-09-15: before the Stripe.js scoping fix
    `__stripe_mid`/`__stripe_sid` appeared on the homepage; after it `/` reports no Stripe
    cookies while `/pricing` + `/account` still do and the checkout still mounts. The script
    **fails** if a page with no billing panel pulls Stripe.js, or if `/account` stops pulling
    it — so re-run it after any change to payments, analytics or the script tags, and update
    the §12 table. *(This runbook used to sit inside §12 itself; it was moved here because a
    published notice is not a place for maintainer instructions — see the copy-hygiene item at
    the end of the Terms checklist.)*
14. **Add the in-app note the notice used to promise.** §5.5 was drafted when an in-app prompt
    on the marking screen was an intention (“the in-app prompt should tell the user not to
    include personal details”); no such copy exists in the UI, so the published text now only
    *advises* the reader. Adding that note to the marking screen is a small, real improvement
    in a children's product that sends free text to a third party.
15. **The premium marker (§6.5, §9) must move with the code.** Re-check it by reading
    `handlePremiumPaperGet` in `src/lib/content/http-handler.ts`: which sets are marked (premium
    only), what the marker holds (`maskEmail` + `accountRef` + `issuedAt` in
    `src/lib/content/types.ts`), and that **nothing is persisted** — if a marker is ever stored
    (to answer "who pulled this set on Tuesday?" from our side), §9 gains a retention row and the
    "we keep no separate record of it" sentence must go. Both halves are pinned:
    `tests/unit/content-handler.test.ts` (shape, masking, premium-only, ref stability) and
    `tests/unit/paper-runner.test.tsx` (the visible line, its UTC date, and its absence on free
    set 1). `tests/unit/legal-pages.test.tsx` probes this clause so it cannot vanish from the
    published page silently.
