# Privacy Notice — DRAFT

> **Status:** draft for review, 2026-09-14. **Not published** — there is currently
> **no privacy policy anywhere on the site** (`/privacy` does not exist; the footer links
> only `/terms`). That is a live gap: the Service already collects personal data
> (email addresses, children's profile names, study records) and already sends free-text
> answers to a third-party AI provider, and a privacy notice is a legal requirement for
> UK/EU users under GDPR Art 13 and expected practice under HK PDPO (PCPD guidance on
> personal data collection statements).
>
> **Not legal advice.** Every decision point is marked `[[ ]]`. The two sections that
> genuinely need a lawyer are §5 (children — this is a minors' product with an AI feature
> that ingests free text, which is a DPIA trigger) and §8 (international transfers, since
> the primary data store is in Hong Kong).
>
> **Accuracy is the whole point.** A privacy notice that does not match what the code
> does is worse than none: it is evidence of a misrepresentation. §3, §6, §7 and §9 below
> were written from the actual implementation (file paths given inline) and **every
> processor, field and retention period must be re-checked against the code whenever any
> of them changes.** A stale privacy notice is a defect to fix, not a document to leave
> alone.

Fill-ins: `[[LEGAL ENTITY]]`, `[[REGISTERED ADDRESS]]`, `[[CONTACT EMAIL]]`,
`[[DPO OR PRIVACY CONTACT]]`, `[[EFFECTIVE DATE]]`.

---

## Privacy Notice

**Last updated: [[EFFECTIVE DATE]]**

This notice explains what personal data Octav Learning collects, why, who it is shared
with, how long it is kept, and what you can ask us to do with it.

### 1. Who is responsible for your data

[[LEGAL ENTITY]] ("we", "us", "our"), [[REGISTERED ADDRESS]], is the data controller —
the organisation that decides why and how your personal data is used — for the Service at
octavlearning.com and its subdomains.

Privacy questions, requests and complaints: **[[DPO OR PRIVACY CONTACT]]**
([[CONTACT EMAIL]]). We aim to answer any request within 30 days.

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

**5.4 Age of consent.** [[Decision required — see checklist item 1.]] Where GDPR applies,
the age at which a child can consent to an information-society service varies by country:
13 in the UK, and between 13 and 16 in EU member states. Our current sign-in flow does not
ask for an age and does not ask for verifiable parental consent, and neither GDPR Art 8
nor the UK's Age Appropriate Design Code is satisfied by that alone. The options — an age
gate at signup, a "parent's email" field for under-16s, or a documented decision to
restrict accounts to 13+ / 16+ and state it in the terms — must be settled with counsel
before this notice is published.

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
| **Stripe** | Payment processing, subscription billing, invoices, trial and renewal emails | Your email address, name, billing address, payment method details, subscription state. **Under Stripe's Managed Payments product Stripe is the merchant of record for tax and handles payment-related tax compliance — see checklist item 3.** |
| **AI marking provider** (configured as `openai-compatible`; currently DeepSeek) | Generates the feedback for "Mark with AI" | The question, markscheme/model answer and your answer text — never your identity |
| **Cloudflare Email Routing** | Forwards mail sent to our `info@` address | Sender address and message content |
| **GitHub** | Code hosting and automated deployment. No customer data is stored here. | Build and deployment metadata only |
| **IndexNow / search engines** | Tells search engines when pages change, so new content can be found | URLs only |

We may also disclose data if compelled by law, to enforce our Terms of Use, to protect
the rights and safety of users or the public, or as part of a reorganisation of the
business — in which case we would tell you and your data would remain subject to this
notice.

**We do not sell personal data, and we do not share it with advertising networks or data
brokers.**

### 8. Where your data goes (international transfers)

Our primary data store and application infrastructure are in **Hong Kong**
(AWS `ap-east-1`). Some of the providers in §7 are in the United States, the United
Kingdom, the EU or elsewhere, so using the Service can involve transferring your data
outside your country.

[[Decision required — see checklist item 4.]] Where UK/EU GDPR applies to a transfer to a
country without an adequacy decision (Hong Kong does not have one for the UK/EU), the
transfer needs a lawful mechanism: an adequacy regulation, the UK International Data
Transfer Agreement / EU Standard Contractual Clauses, or a valid derogation. Each
provider's standard terms in §7 need to be checked for which mechanism they rely on, and
that mechanism must be named here rather than described vaguely. The same exercise is
needed under HK PDPO s.33 — **not yet in force in Hong Kong, but the PCPD expects
equivalent safeguards and it could commence.**

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
| Billing and tax records | Held by Stripe, and by us as required by tax and accounting law |
| Rate-limit counters (including IP-keyed abuse counters) | Minutes to hours, expiring automatically |
| Backups | Replaced on a rolling basis [[confirm the actual window with counsel — do not state a number we cannot verify]] |

You can delete your account and its data yourself from your account page, or by asking
us at [[CONTACT EMAIL]]. Deleting an account removes profiles, progress, exam and
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
  you came to us first — write to [[CONTACT EMAIL]] — but you do not have to.

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

We use **one essential first-party cookie**: the session cookie that keeps you signed in.
It is set when you sign in (or when a one-time code is exchanged) and cleared when you
sign out. We do not use advertising cookies, third-party analytics cookies, or
cross-site tracking cookies, and there is no cookie consent banner because there is
nothing non-essential to consent to. **[[If Stripe's embedded checkout sets its own
cookies on our pages, or if any advertising or third-party analytics is ever introduced,
this section is no longer accurate and a consent mechanism becomes necessary — re-check
at every payments or analytics change.]]** Theme preference and offline progress use
`localStorage`, described in §3.3.

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

[[LEGAL ENTITY]]
[[REGISTERED ADDRESS]]
Privacy contact: [[DPO OR PRIVACY CONTACT]] — [[CONTACT EMAIL]]

---

## Before publication — review checklist

A privacy notice is only worth publishing if it is true. Work through these; items 1–4
are the ones that can fail an audit.

1. **Age and parental consent (§5.4).** Decide the model: age gate at signup, verifiable
   parental consent for under-16s, or restricted to 13+/16+ with that stated in the
   Terms. Today the flow does neither, and this is the single largest gap in the current
   design. This decision also feeds §5.2, §5.3 and the Terms §3.3.
2. **DPIA (data protection impact assessment).** Required here: children's data plus an
   AI feature that processes free text. It should cover the AI-marking data flow, the
   leaderboard's child-visibility question, and the analytics events. Keep the DPIA with
   this notice so the two can be read together.
3. **Who is the seller of record under Stripe Managed Payments** (also Terms checklist
   item 1). It decides whether Stripe is a processor of ours or an independent controller
   (or the merchant of record) for the payment transaction, and therefore what §7 must
   say. This is not a wording preference — it changes the legal analysis.
4. **Transfer mechanism (§8).** Name the actual mechanism per provider, and check each
   provider's DPA is signed and current. Do not publish "we use appropriate safeguards";
   name the instrument.
5. **Re-verify the whole field list against the code** before publishing, and again after
   any change to auth, progress, analytics, leaderboard, contact or subscriptions. The
   sources used for §3–§9 are: `src/lib/auth/types.ts`, `src/lib/progress/*`,
   `src/lib/analytics/http-handler.ts`, `src/lib/leaderboard/*`, `src/lib/contact/*`,
   `src/lib/subscriptions/*`, `terraform/modules/dynamodb/main.tf` (retention/TTLs),
   `src/lib/auth/session.ts` (cookie).
6. **Confirm the retention numbers (§9)** — in particular backups, and the interaction
   between deleting an account and Stripe's own record-keeping duties (tax law may
   require Stripe to keep invoice records; Stripe's notice, not ours, governs those).
7. **Decide whether the AI provider can be named.** This draft names DeepSeek because
   that is the configured provider (`OPENAI_COMPATIBLE_BASE_URL`); if the provider can
   change without notice, name it as "our AI marking provider" and keep a current list, or
   state that the provider is named in-app. Either way the user must be able to find out
   who receives their answer text.
8. **Publish route.** A `/privacy` page linked from the footer, the signup screen, the
   checkout screen and the account page; sitemap/indexable per the SEO conventions in
   `src/lib/seo/*`. Note `src/app/layout.tsx` currently links only `/terms` in the footer.
9. **Consistency sweep** against `docs/terms-of-use-draft.md`, `docs/entitlement-policy.md`
   and `src/app/pricing/page.tsx` — student-data wording, quota numbers, trial length and
   the premium split must match everywhere.
