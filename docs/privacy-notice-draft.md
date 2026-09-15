# Privacy Notice — DRAFT

> **Status:** draft v2, 2026-09-15. **Not published** — there is still **no privacy policy
> anywhere on the site** (`/privacy` does not exist; the footer links only `/terms`). This is
> the live legal gap, and it got sharper on 2026-09-15: **PROD now takes real payments.** The
> Service already collects personal data (email addresses, children's profile names, study
> records) and sends free-text answers to a third-party AI provider; a notice is required for
> UK/EU users under GDPR Art 13 and expected under HK PDPO (PCPD guidance on personal data
> collection statements). **Publishing this notice should not wait for the Terms to be
> finalised** — §5 and §8 are the only sections that genuinely need counsel, and both can be
> published with those flags resolved rather than the whole notice withheld.
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
> essential cookie"** — measured on the live origin with `scripts/verify-checkout-cookies.mjs`
> and rewritten: Stripe.js sets `__stripe_mid`/`__stripe_sid` on our own domain on *every*
> page, so §12 now lists all three cookies and the third-party ones inside the checkout iframe.

Operator details filled in as supplied: the controller is **Octav Learning**, Central, Hong
Kong. Two caveats carried forward from the Terms (see its checklist): a sole proprietorship
has no separate legal personality, and "Central, Hong Kong" is not a deliverable postal
address — both need settling before publication, the second one because it is the address any
data-protection authority or data subject would write to.

Still needed at publication: `[[EFFECTIVE DATE]]`. The privacy contact is
`info@octavlearning.com`, already filled in below.

---

## Privacy Notice

**Last updated: [[EFFECTIVE DATE]]**

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

**If you are in the UK, the EU or the EEA:** we are established outside the Union, so
[[GDPR Art 27 and UK GDPR Art 27 require us to designate a representative in the EU and in the
UK and to name them here with contact details. **Not yet appointed** — this is a live
requirement and it arises directly from the controller being an individual established in Hong
Kong. Checklist item 10.]]

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

**5.4 Who may hold an account (decided 2026-09-15).** **An account must be held by someone
aged 16 or over, or by a parent or legal guardian on a younger student's behalf**, and a
student under 16 uses the Service through a child profile inside that adult's account. The
same rule is stated in §3.3 of our Terms of Use.

**We do not verify age, and we do not ask for proof of parental consent, at signup** — we rely
on the account holder's confirmation, and we may ask for evidence and close an account if a
confirmation turns out to be untrue. We state the model rather than implying a check we do not
perform. [[Counsel to confirm two things, both checklist items 1 and 2: (a) that relying on
performance of a contract rather than consent is the right basis for the under-16s who use the
Service through a parent-held account, given that GDPR Art 8's parental-consent rule attaches
specifically to consent; and (b) that the ICO's Age Appropriate Design Code — which applies to
services likely to be accessed by children in the UK whatever the lawful basis — is satisfied
by the design as it stands, or which high-privacy defaults it calls for.]]

**5.5 AI marking and children's free text.** Answers a child submits are sent to a
third-party AI provider (§6.3, §7). Because that is free text written by a child, it must
be covered by the DPIA in checklist item 2, and the in-app prompt should tell the user not
to include personal details.

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
it. This can involve processing IP addresses and request patterns; see also §9 of the
Terms of Use.

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
| **AI marking provider** (`OPENAI_COMPATIBLE_BASE_URL`; **currently DeepSeek, a provider established in the PRC**) | Generates the feedback for "Mark with AI" | The question, markscheme/model answer and your answer text — never your identity |
| **Cloudflare Email Routing** | Forwards mail sent to our `info@` address | Sender address and message content |
| **GitHub** | Code hosting and automated deployment. No customer data is stored here. | Build and deployment metadata only |
| **IndexNow / search engines** | Tells search engines when pages change, so new content can be found | URLs only |

We may also disclose data if compelled by law, to enforce our Terms of Use, to protect
the rights and safety of users or the public, or as part of a reorganisation of the
business — including the incorporation described in §1 — in which case we would tell you
and your data would remain subject to this notice.

The AI provider row above matters more than its one line suggests: **answer text written by a
child leaves Hong Kong for a provider in the PRC**, which is the most sensitive transfer in
this notice. See §8, and checklist item 4.

**We do not sell personal data, and we do not share it with advertising networks or data
brokers.**

### 8. Where your data goes (international transfers)

Our primary data store and application infrastructure are in **Hong Kong**
(AWS `ap-east-1`). Some of the providers in §7 are in the United States, the United
Kingdom, the EU or elsewhere, so using the Service can involve transferring your data
outside your country.

[[Operator/counsel: the instrument that actually covers each transfer must be named here
before publication — checklist item 4.]] Where UK/EU GDPR applies to a transfer to a
country without an adequacy decision (Hong Kong does not have one for the UK/EU), the transfer
needs a lawful mechanism: an adequacy regulation, the UK International Data Transfer Agreement
/ EU Standard Contractual Clauses, or a valid derogation. Each provider's standard terms in §7
must be checked for which mechanism it relies on, and **that mechanism must be named here**
rather than described vaguely. The transfers that actually matter, in order of sensitivity:

1. **Hong Kong → PRC (the AI provider, currently DeepSeek)** — the free-text answer of a
   child (§6.3). No adequacy decision, and this is the transfer a parent is most likely to
   object to. It needs the chosen mechanism named, and it belongs in the DPIA.
2. **Hong Kong → United States (Resend for email; Stripe Payments Company if it is the
   acquiring entity)** — SCCs/IDTA plus a transfer-risk assessment.
3. **Hong Kong → EU/UK (Stripe Technology Europe, if it is the acquiring entity)** — covered
   by the EU's own framework where the processor is in the Union.

The same exercise is needed under HK PDPO s.33 — **not yet in force in Hong Kong, but the PCPD
expects equivalent safeguards and it could commence.** Finally, a controller established
outside the UK/EU and offering services to people there must also have a **representative** in
those jurisdictions; see §1 and checklist item 10.

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
| Backups | Replaced on a rolling basis [[confirm the actual window with counsel — do not state a number we cannot verify]] |

You can delete your account and its data yourself from your account page, or by asking
us at info@octavlearning.com. Deleting an account removes profiles, progress, exam and
leaderboard records. We may keep limited records where the law requires it (for example
tax records of a payment) or to establish, exercise or defend a legal claim.

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

**These are all the cookies we set, measured rather than assumed** (see the method note
below):

| Cookie | Set by | Lifetime | Flags | Why it exists |
|---|---|---|---|---|
| `octav_session` | us | 30 days; cleared when you sign out | `HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS | Keeps you signed in. Set only when you sign in. |
| `__stripe_mid` | Stripe.js | 12 months | `SameSite=Strict`, not `HttpOnly` | Stripe's fraud-prevention device identifier. **Set on every page**, because Stripe.js is loaded site-wide for the embedded checkout — including pages where you are not paying. |
| `__stripe_sid` | Stripe.js | 30 minutes | `SameSite=Strict`, not `HttpOnly` | Stripe's short-lived counterpart to the above. |

If you are not signed in and Stripe.js is blocked, the site sets **no cookies at all**. We do
not use advertising cookies, and we run no third-party analytics.

**Third-party cookies.** Nothing third-party is set while you browse. When you actually open
the checkout, Stripe's embedded iframe — and the hCaptcha challenge it uses for bot and risk
detection — set their own cookies in that iframe's own context: `m` on `m.stripe.com`, and
`__cf_bm`, `hmt_id` and `__cflb` on `hcaptcha.com`. Those are set by Stripe in its own
context rather than by us on our domain, and they do not follow you around our site; but they
are not nothing, so they are listed here.

**Do we need a consent banner?** Every cookie above is **strictly necessary** for something
you asked for: `octav_session` to stay signed in, the two Stripe cookies to take a payment
safely, and the checkout-flow cookies to process that payment at all. There is no advertising
or analytics cookie to opt into, so there is nothing to consent to. [[Counsel to confirm one
point, because it is an argument we could lose: `__stripe_mid` and `__stripe_sid` are set on
**every page**, not only on the pages where a payment is being made, which weakens the
"essential to the service you requested" position. The fix is technical and small — load
Stripe.js only on `/pricing` and `/account` (one script tag in `src/app/layout.tsx`, already
listed as optional polish in `STRIPE_INTEGRATION_TODO.md` §8) — and it would let this section
be simpler and the strictly-necessary claim much stronger. Decide before publishing this
section, and keep it in step with whatever the browser actually does.]]

**How this was measured, so it can be re-checked:** `node scripts/verify-checkout-cookies.mjs`
drives a real Chromium against the live origin with the `js.stripe.com` request blocked and
then allowed, and against a local server with a real test-mode checkout mounted, printing
`document.cookie` and the full cookie jar at each step. Run on **2026-09-15**: zero cookies
signed out with Stripe.js blocked; `__stripe_mid`/`__stripe_sid` present on `/pricing` *and*
on the homepage once Stripe.js loads; no further first-party cookie when the checkout mounts;
third-party cookies only inside the checkout. **Re-run it after any change to payments,
analytics or the script tags, and update the table above.**

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
4. **Transfer mechanism (§8).** Name the actual instrument per provider and confirm each
   provider's DPA is signed and current. Do not publish "we use appropriate safeguards". The
   PRC transfer of children's answer text is the one to settle first.
5. **Re-verify the whole field list against the code** — **done 2026-09-15**, results at the
   top of this file. Sources: `src/lib/auth/types.ts`, `src/lib/progress/*`,
   `src/lib/analytics/http-handler.ts`, `src/lib/leaderboard/*`, `src/lib/contact/*`,
   `src/lib/subscriptions/*`, `terraform/modules/dynamodb/main.tf` (retention/TTLs),
   `src/lib/auth/session.ts` (cookie). Repeat after any change to auth, progress, analytics,
   leaderboard, contact or subscriptions.
6. **Confirm the retention numbers (§9)** — in particular the backup window (still unstated,
   correctly) and the interaction between deleting an account and Stripe's own record-keeping
   as merchant of record.
7. **Decide whether the AI provider can be named.** This draft names DeepSeek because that is
   the configured provider; if the provider can change without notice, either name the current
   one in-app or keep a dated list. Either way the user must be able to find out who receives
   their answer text — and if the answer is "a provider in the PRC", say so.
8. **Verify the cookies (§12)** — **done 2026-09-15** with
   `node scripts/verify-checkout-cookies.mjs`, and **the claim failed**: Stripe.js sets
   `__stripe_mid` (12 months) and `__stripe_sid` (30 minutes) on our own domain on **every
   page**, not only at checkout, on top of our own `octav_session`. §12 has been rewritten
   around the measurement, including the third-party cookies that appear inside the checkout
   iframe (`m.stripe.com`, hCaptcha). **Follow-up worth doing before publishing:** scope the
   Stripe.js `<script>` in `src/app/layout.tsx` to `/pricing` + `/account`, which confines
   those cookies to the payment pages and makes the strictly-necessary argument much
   stronger (and §12 simpler). Whatever is decided, re-run the script and update the table.
9. **Publish route.** A `/privacy` page linked from the footer, the signup screen, the
   checkout screen and the account page; sitemap/indexable per the SEO conventions in
   `src/lib/seo/*`. The checkout link is a **Dashboard setting** (Stripe → Settings →
   Checkout accepts custom terms-of-service and privacy URLs), not code. Note that
   `src/app/layout.tsx` currently links only `/terms` in the footer.
10. **Appoint and name an EU and UK representative (§1).** Newly required because the
    controller is an individual established in Hong Kong offering services to people in the
    UK/EU: GDPR Art 27 and UK GDPR Art 27 both require a representative in those territories,
    named in this notice. This is a concrete task with a real deadline, not a wording choice.
11. **Incorporation is a planned event — prepare the swap.** On incorporation, the controller
    clause (§1), the Stripe account's business details, the AWS/domain ownership, the Terms'
    §1/§15.3/§16 and the effective date all change together. Decide the revenue threshold in
    advance so this is a scheduled edit rather than a drift.
12. **Consistency sweep** against `docs/terms-of-use-draft.md`, `docs/entitlement-policy.md`
    and `src/app/pricing/page.tsx` — student-data wording, quota numbers, trial length and the
    premium split must match everywhere.
