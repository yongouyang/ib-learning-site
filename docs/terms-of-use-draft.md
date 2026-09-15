# Terms of Use — DRAFT (subscription-ready)

> **Status: PUBLISHED 15 September 2026** (DEV and PROD). `src/app/terms/page.tsx` renders the
> document body below **verbatim**; this preamble and the review checklist at the end are
> internal notes and are **not** part of the published page.
>
> **Not legal advice.** Engineering-authored, with every remaining open point marked `[[ ]]`.
> A HK-qualified lawyer (with a look at UK/EU consumer law) must still review §11.3 (the
> liability cap), §14 (governing law) and §5.5 (how the withdrawal-right consent is actually
> collected) before publication — those cannot be self-drafted.
>
> **Decisions taken 2026-09-15** (this is why the text below reads as it does):
> 1. **Contracting party: a sole proprietorship.** The individual trading as "Octav
>    Learning", established in Hong Kong, replacing this with a HK limited company once
>    revenue justifies incorporation. §15.3 already permits the transfer; checklist item 9
>    is the swap procedure.
> 2. **Refunds (§5.4):** refund on request within 14 days of a renewal charge.
> 3. **Age (§3.3):** accounts are held by someone 16+ or by a parent/guardian for a younger
>    student. No signup age gate — see the privacy notice, checklist item 1.
> 4. **Withdrawal right (§5.5): we do NOT ask for consent — revised 2026-09-15 for
>    publication.** The original decision was to require an express acknowledgment at checkout,
>    but nothing collects one, so publishing that clause would have stated a step the Service
>    does not perform. §5.5 now **honours the 14-day right in full** and says so; because every
>    subscription opens with a 14-day free trial, the withdrawal window effectively ends with
>    the trial, before any charge. Revisit only if a consent step is actually built (Terms
>    checklist item 4).
> 5. **Seller of record (§4.5, §9): documented, not inferred.** Managed Payments is on, so
>    the customer transacts with **Link** and sees "Sold through Link"
>    (<https://docs.stripe.com/payments/managed-payments/how-it-works>, read 2026-09-15).
>    Counsel should still confirm how a consumer contract characterises that.
>
> On publication the published copy replaces `src/app/terms/page.tsx`, and the same text is
> linked from the checkout flow and the confirmation email so it is pre-contractual
> information, not a footer link nobody reads.

Operator details filled in, as supplied: the name is **Octav Learning** and the address is
**Central, Hong Kong**. Two caveats to settle before publication, both flagged in the
checklists rather than left implicit: (1) **a sole proprietorship has no separate legal
personality** — strictly the contracting party is the individual behind it, so naming the
trading name leaves the counterparty ambiguous if it ever has to be enforced, which is one
more argument for incorporating sooner rather than later; and (2) **"Central, Hong Kong" is
not a deliverable postal address** — a legal notice address and any consumer-law or Art 27
correspondence need a full one.

Effective **15 September 2026**. Hong Kong is taken as the country of establishment (it sets
§14's governing law) — **still to be confirmed in writing**, and it changes the governing-law
clause if it is wrong.

---

## Terms of Use

**Last updated: 15 September 2026**

### 1. Who we are and what these terms cover

Octav Learning ("we", "us", "our") is the trading name of a sole proprietorship established
in Hong Kong, with a business address at Central, Hong Kong. You can contact us
at info@octavlearning.com.

We intend to bring the Service into a Hong Kong limited company as it grows. If that
happens we will tell you by email or in-app before it does, the company will take over these
terms unchanged, and this paragraph and §16 will name it. See §15.3.

These terms are a legal agreement between you and us. They apply to the website at
octavlearning.com, every subdomain of it (including dev.octavlearning.com), the
installable web app, and every note, flashcard, quiz, practice paper, markscheme,
illustration and AI-marking feature we provide (together, the "Service").

By using the Service you accept these terms. If you do not accept them, do not use the
Service. **If you are under the age at which you can enter a contract in your country,
a parent or guardian must accept these terms for you** (see §3.3).

Our handling of personal data is described separately in our [Privacy Notice](/privacy),
which forms part of these terms.

### 2. Accounts

**2.1** Most of the Service works without an account. An account is needed for
cross-device progress sync, exam and ladder history, the leaderboard, and AI marking.

**2.2** We sign you in with a one-time code emailed to the address you give us. You must
give us an email address you actually control. You are responsible for everything done
through your account, and you must tell us promptly at info@octavlearning.com if you believe
someone else has access to it.

**2.3 Parent and student accounts; child profiles.** One account may hold several
"child profiles" (a name and a stage). A parent/guardian account holder is responsible
for every child profile on the account, for the accuracy of the information entered
into it, and for the child's use of the Service. Child profiles are not separate
accounts and cannot be signed into on their own.

**2.4** Accounts are for a single family/household. You may not sell, rent, share or
transfer an account.

**2.5** We may suspend or close an account that breaches these terms, that we reasonably
believe is being used to attack or overload the Service, or as required by law. Where it
is reasonable to do so we will tell you why. §11 and §12 explain what happens to your
data if an account is closed.

### 3. Free and Premium

**3.1 What is free.** Every study note, flashcard, topic quiz and diagnostic, across all
subjects and stages, is free and needs no payment. With a free account you also get
cross-device progress sync, mixed review, exam and ladder history, the leaderboard, and
**30 AI-marked answers per calendar month per account**.

**3.2 What Premium adds.** Premium is a paid subscription that adds: (a) unlimited
AI marking, subject to a fair-use safety cap; and (b) the full practice-exam tier —
every paper set after the first free set per course, the upper revision-ladder levels,
and timed mock mode. The current feature split is described on the pricing page; we may
change *what is included in which tier* as described in §3.4.

**3.3 Age, and who may hold an account.** The Service is designed for secondary-school
students. **An account must be held by someone aged 16 or over, or by a parent or legal
guardian on a younger student's behalf.** A student under 16 uses the Service through a
child profile inside an adult's account, not through an account of their own.

By creating an account you confirm that you are 16 or over, or that you are the parent or
legal guardian of every child profile you add and that you accept these terms for that
child. **We do not currently verify age or ask for proof of parental consent at signup** — we
rely on that confirmation, and we may ask for evidence and suspend an account if a
confirmation turns out to be untrue. **You may only start a Premium subscription if you are
old enough to enter a binding contract where you live**: a purchase by an under-16 is
voidable by their parent or guardian, so buy it on the adult account.

**3.4 Changes to the free and Premium split.** We may add, remove or move features
between the free and Premium tiers. We will not move a feature you are paying for out of
Premium during a period you have already paid for. Material changes are announced as
described in §13.

### 4. Premium subscriptions, and what you are charged

**4.1 Plans.** Premium is offered as a **monthly** or **annual** subscription, at the
prices shown on the pricing page at the moment you order. The list price is in US dollars;
**the checkout may show it in your local currency and with tax added or included depending
on where you are** — the amount shown immediately before you confirm is the amount you are
charged. Taxes on the sale are calculated, collected, filed and remitted by Stripe as
merchant of record (§4.5).

**4.2 Free trial.** New subscriptions may start with a **14-day free trial**. **No
charge is made during the trial**, but a payment method is collected when the trial
starts and is stored by our payment processor. You can cancel at any time during the
trial and you will not be charged; see §5.

**4.3 Automatic renewal.** **Your subscription renews automatically** at the end of each
billing period — monthly, or yearly for an annual plan — at the price in force, using the
payment method on file, until you cancel. A renewal charge is taken on the day after the
current period ends. **Stripe sends the reminder emails** — a trial-ending reminder (for any
trial longer than 7 days, so our 14-day trial always gets one) and the upcoming-renewal
notice — from Link, to the address on your subscription; for customers in the UK and
Australia it sends those notices before the 6- and 12-month anniversaries even when the
optional reminders are switched off. **It is your responsibility to keep that email address
current.** We do not send a second, competing reminder.

**4.4 Price changes.** We may change subscription prices. **We will give you at least 30 days'
notice by email before a price change takes effect for you**, and the change applies from your
next renewal after that notice. If you do not accept a price change, cancel before that
renewal — the change does not affect a period you have already paid for.

**4.5 Who you are buying from, and payment processing.** Payments are handled by **Stripe**,
and we never see or store your card number.

**Managed Payments is enabled, which makes Stripe the merchant of record for the sale.** In
practice that means:

- at checkout, and on receipts, invoices and refund notices, the customer deals with
  **Link** (Stripe's consumer product), and a purchase appears as **"Sold through Link"**;
- the charge on your statement appears as `LINK.COM*` followed by our statement descriptor;
- **Stripe**, not us, handles payment- and subscription-related customer support, fraud
  prevention, disputes and chargebacks, and it can issue a refund without our approval in
  some cases (see §5.4);
- you can view and manage orders, cancel or change a subscription and update your card at
  <https://link.com> as well as through your account page with us (§5.1);
- the transaction is acquired by Stripe Payments Company or Stripe Technology Europe,
  Limited.

The consequence for you: **the payment is handled by Stripe under its own terms and privacy
policy** — in practice Link's — while this agreement governs the study Service we provide.
Indirect taxes on the sale (sales tax, VAT, GST) are calculated, collected, filed and remitted
by Stripe as merchant of record.

**4.6 Failed payments.** If a renewal payment fails we will email you and retry. Premium
features may be suspended while a payment is outstanding and restored once it succeeds.
If a payment remains outstanding we may cancel the subscription.

**4.7 Billing period.** "Monthly" is one calendar month from the start date; "annual" is
one year from the start date. Where a period starts on a date that does not exist in a
later month, it ends on the last day of that month.

### 5. Cancelling and refunds

**5.1 How to cancel.** You can cancel at any time, yourself, from the billing section of your
account page — no email, no phone call, no reason required; Stripe's customer portal confirms
it. Because Stripe is the merchant of record (§4.5) you can also manage or cancel the
subscription directly at <https://link.com> using the same email address. **We do not require
you to contact us to cancel**, and cancelling by either route stops the next renewal.

**5.2 What cancelling does.** Cancelling **stops the next renewal**. It does not
immediately end the subscription: Premium features stay available until the end of the
period you are already in (including the remainder of a free trial), and then the
subscription ends and the account returns to the free tier. **A cancelled subscription is
never charged again.**

**5.3 Cancelling during the free trial.** Cancel at any point during the 14-day trial and
no charge is made at all. The trial simply ends; Premium features stay available until
the trial's original end date.

**5.4 Refunds.** **Our policy: cancel at any time, and ask us for a refund within 14 days of a
renewal charge and we will refund it** — we would rather refund a renewal than argue about
it. That is a minimum on top of, not a replacement for, your statutory rights (§5.5).

Because Stripe is the merchant of record, refund requests also reach Stripe: a customer can
ask [Link support](https://support.link.com/topics/sold-through-link) for a refund, Stripe may
issue one without our approval, and it can refund a transaction up to 60 days old in certain
cases. When a refund is issued the indirect tax the customer paid is included in it, although
Stripe may be required to remit the original tax in some jurisdictions and will reduce our
balance accordingly. **A refund does not by itself cancel a subscription** — cancel as
described in §5.1 as well, or it will renew.

**5.5 Your statutory cancellation rights.** If you are a consumer in the UK, the EU/EEA,
or another jurisdiction that grants a cooling-off right for distance purchases, you have
a legal right to cancel within 14 days of a distance contract, and **we do not ask you to give
that right up**. Where it applies to you, you may cancel within 14 days of the order and we will
refund what you have paid, by the route in §5.1 — including when the subscription has already
started and the 14 days run past the start of a trial.

**In practice there is usually nothing to refund:** a new subscription begins with the 14-day
free trial (§4.2), so the withdrawal period ends at about the same time as the trial, before any
charge is made. Nothing in these terms limits any right to a refund you have under the mandatory
consumer law of your country of residence.

**5.6 Our fault.** If we withdraw a Premium feature during a paid period and do not
replace it with an equivalent, you may ask for a refund of the unused part of that
period and we will give it.

### 6. Acceptable use

You may use the Service for your own personal study, or for teaching a class you
personally teach. You may not, and may not help anyone else to:

1. **copy, download in bulk, republish, redistribute, sublicense or sell** any part of
   the content, in whole or in part, including in translated, paraphrased, summarised or
   reformatted form;
2. **scrape, crawl, harvest, index or systematically extract** content from the Service,
   whether by hand, by script, by automated agent, by browser extension, by "AI agent",
   or by any other means;
3. use any part of the Service as **input to train, fine-tune, distil, evaluate or
   otherwise develop a machine-learning model or AI system**, including a retrieval
   corpus for one;
4. **circumvent, disable or evade any paywall, entitlement check, quota, rate limit,
   access control or usage limit** on the Service, or access Premium features without
   paying for them;
5. **impose an unreasonable load** on the Service, including by automated request
   patterns, or interfere with its normal operation or security;
6. **resell or provide the Service to third parties** as part of a paid product,
   including as a study platform, tutoring service or dataset;
7. reverse-engineer, decompile, disassemble or attempt to derive the source code,
   content pipeline or content beyond what is displayed to you;
8. misrepresent yourself or the Service, or use it in a way that infringes anyone's
   rights or breaks any law.

We may use technical measures — including rate limits, access controls and content
delivered only to authorised sessions — to enforce this section, and we may investigate
and take action against accounts and sources that breach it. Breaching this section is a
material breach of these terms and may also be a breach of copyright law, database
rights, and contract law.

### 7. Intellectual property

**7.1 Our content.** All study notes, flashcards, questions, practice papers,
markschemes, explanations, illustrations, diagrams, on-page text, selection and
arrangement, and the software that delivers them, are **original works created for the
Service and are protected by copyright and other intellectual property rights. All
rights are reserved.**

**7.2 What you may do.** We grant you a personal, non-exclusive, non-transferable,
revocable licence to access and use the Service for your own non-commercial study while
your access lasts. This licence is the only right to the content that these terms give
you, and it does not include any right to copy, adapt, distribute, publish or
commercially exploit it.

**7.3 Printing and personal copies.** You may print or save portions for your own study,
provided they remain unmodified and are not given to anyone else or posted anywhere. This
does not permit creating a copy of the Service, or of a set of content large enough to
substitute for it.

**7.4 No AI training.** The content is not licensed — expressly or by implication — for
use in training, fine-tuning, evaluating or developing any AI system. Crawling the
Service for that purpose is prohibited and is a breach of these terms.

**7.5 Your content and feedback.** You keep ownership of anything you write — answers you
submit for marking, contact form messages, profile names. You grant us the licence we
need to store it, transmit it and process it in order to run the Service; that licence
ends when you delete the content or your account, except where we must keep a record for
legal, tax or security reasons. If you send us a suggestion, we may use it without
obligation to you.

**7.6 Names and marks.** "Octav Learning" and our logo are our marks. IB, Cambridge
IGCSE and other curriculum names are trademarks of their owners; see §8.2. Nothing in
these terms gives you rights in any of them.

### 8. What the Service is, and what it is not

**8.1 Educational resource only.** The Service is a study aid. It is not a school, not a
tutor, and not affiliated with any examination body. Using it does not enter you for any
exam and does not guarantee any grade or result.

**8.2 No affiliation.** Octav Learning is an independent resource and is **not endorsed
by, affiliated with, or connected to the International Baccalaureate Organization (IBO),
Cambridge Assessment International Education (CAIE), or any other examination board or
curriculum authority.** Any references to their syllabuses, stages or courses are
descriptive, to say what the material is intended to help you study.

**8.3 AI marking is automated and approximate.** Answers marked by our AI feature are
assessed by an automated system against a markscheme. It can be wrong, it is not a
teacher, and **its marks carry no official standing** — they are a study aid. Do not rely
on them as an indicator of an examination result.

**8.4 Availability.** We work to keep the Service available, but we do not promise
uninterrupted or error-free operation, and we do not offer a service-level guarantee.
Features may be changed, added, suspended or withdrawn, including for maintenance,
security or legal reasons. Interactive features that depend on an external service (AI
marking, email sign-in, payment) can be unavailable if that service is.

**8.5 Beta features.** Features marked as beta, preview or experimental are provided as
they are, may change or disappear, and may be less reliable than the rest of the Service.

### 9. Third-party services

The Service relies on third parties, including cloud hosting and databases, an email
delivery provider, our payment processor, and an AI provider for the marking feature. We
choose them carefully and describe them in the Privacy Notice.

**Which part you contract with whom:** the **payment and subscription** side of a Premium
purchase — checkout, the charge, receipts and invoices, refunds, disputes and payment support
— is contracted with **Stripe**, not with us (§4.5 explains how that appears to you).
Everything else — the notes, quizzes, practice papers, AI marking and your account — is
contracted with us under these terms. The acts and omissions of our providers are outside our
control, and their own terms and privacy policies apply to their parts of the Service.

### 10. Disclaimers

To the fullest extent the law allows, and except where we have said otherwise in these
terms, the Service and all content are provided **"as is" and "as available"**, without
warranties of any kind, whether express or implied, including implied warranties of
merchantability, fitness for a particular purpose, accuracy, or non-infringement. We do
not warrant that the content is complete, current, error-free, or aligned with the
current version of any syllabus, or that it will produce any particular study outcome.

**Nothing in these terms excludes or limits any warranty, right or remedy you have under
mandatory law, including consumer law, that cannot lawfully be excluded.**

### 11. Liability

**11.1** Nothing in these terms excludes or limits our liability for death or personal
injury caused by our negligence, for fraud or fraudulent misrepresentation, or for
anything else that cannot lawfully be excluded or limited.

**11.2** Subject to §11.1, we are not liable for loss that was not reasonably
foreseeable, for loss of profit, business, revenue, opportunity or goodwill, for loss of
or corruption of data beyond our reasonable control, for any interruption of the Service,
or for the acts or omissions of the third parties in §9.

**11.3** Subject to §11.1, if you are a consumer, our total liability to you arising out
of or in connection with the Service is limited to **the greater of (a) the amount you
have paid us in the 12 months before the event giving rise to the claim, and (b) USD
100**.

**11.4** If you are using the Service for or in a business, we exclude the implied terms
of satisfactory quality, fitness for purpose and correspondence with description to the
fullest extent permitted.

**11.5** Each provision of this section operates separately. If a court finds any part of
it unenforceable, the rest stands.

### 12. Suspension and termination

**12.1 By you.** You may stop using the Service at any time and may close your account
from your account page. Closing the account cancels any subscription as described in §5
and deletes your data as described in the Privacy Notice. If you have a subscription,
close it after you have used any part of a paid period you do not want to lose.

**12.2 By us.** We may suspend or terminate your access if you materially breach these
terms (including §6), if we are required to by law, or if we reasonably believe your
account is being used to attack, overload, defraud or scrape the Service. Except where
the breach is serious or urgent, we will warn you first and give you an opportunity to
put it right. If we terminate for a breach you caused, we will not refund amounts
already paid for the current period.

**12.3 Discontinuation.** If we decide to discontinue the Service, we will give
reasonable notice by email to account holders. If you have paid for a period that will
not run its course, we will refund the unused part.

**12.4 Survival.** Sections 6, 7, 10, 11, 13 and 14 survive termination.

### 13. Changes to these terms

We may update these terms to reflect changes in the Service, the law, or how we operate.
The current version is always at [octavlearning.com/terms](/terms). If a change materially
affects your rights or your subscription, we will tell you by email or in-app before it takes
effect, and if you
do not accept it you may cancel as described in §5 — the change will not apply to a
period you have already paid for. Continuing to use the Service after a change takes
effect means you accept the updated terms.

### 14. Governing law and disputes

These terms are governed by the laws of **Hong Kong**, and the courts of Hong Kong have
exclusive jurisdiction,
**except that (a) if you are a consumer resident elsewhere, you may also bring
proceedings in the courts of your own country, and (b) nothing in this section deprives
you of the protection of the mandatory consumer law of your country of residence.**

Before starting formal proceedings, please write to info@octavlearning.com — most problems are
ordinary bugs and we would rather fix them.

### 15. General

**15.1** If any provision of these terms is found unenforceable, the rest remains in
force.

**15.2** Our failure to enforce a provision is not a waiver of it.

**15.3** You may not transfer your rights under these terms. We may transfer ours to another
business — **including to a company we incorporate to carry on the Service, which we intend to
do as it grows** — and will tell you by email or in-app before it happens. Your rights are not
reduced by the transfer, the new operator takes these terms on unchanged, and the Privacy
Notice will name it.

**15.4** These terms, together with the Privacy Notice and the pricing information shown
at checkout, are the entire agreement between us about the Service.

**15.5** We are not liable for failure to perform caused by events outside our reasonable
control.

**15.6** Nothing in these terms gives any third party any right to enforce them, except
that our group companies and contractors may rely on §11.

**15.7** This agreement is in English only.

### 16. Contact

Octav Learning
Central, Hong Kong

Contact: info@octavlearning.com

---

## Before publication — review checklist

Work through these in order. Items 1–3 were settled on 2026-09-15 (the decisions are at
the top of this file); items 4–10 are what is left before publication.

1. ~~Who is the seller of record?~~ **Answered 2026-09-15, from Stripe's documentation
   rather than inference** (`docs.stripe.com/payments/managed-payments/how-it-works`):
   the customer sees **Link** as the merchant of record and purchases as "Sold through
   Link", the statement reads `LINK.COM* …`, and Stripe owns payment support, refunds,
   disputes and the tax filing. §4.5, §9 and §11 were rewritten from that. **Still open:**
   counsel to confirm how a consumer contract characterises it ("the payment is a contract
   with Stripe" is our reading, not a lawyer's), which is also what decides whether Link's
   standardised checkout terms already carry the withdrawal-right consent — see item 4.
2. ~~Refund policy~~ **Decided: refund on request within 14 days of a renewal charge**
   (§5.4). Must be mirrored in `/pricing` and the `/account` billing copy.
3. ~~Age model~~ **Decided: accounts 16+, or parent/guardian-held for younger students**
   (§3.3). No signup age gate, and §3.3 says so plainly rather than implying a check we do
   not perform. The matching privacy-notice clause is its checklist item 1.
4. **Withdrawal-right consent (§5.5) — the one clause that is not yet true of the live
   Service.** The decision is to collect express consent + acknowledgment at checkout, but
   nothing collects it today, so §5.5 describes a step that does not happen. Two candidate
   mechanisms: Stripe Checkout **`consent_collection` + `custom_text`** in
   `src/lib/subscriptions/stripe-rest.ts`, or the **custom terms-of-service URL in
   Dashboard → Settings → Checkout** (the checkout footer already displays standardised
   payment terms and accepts our own ToS/privacy links — a Dashboard setting, no code).
   Resolve with counsel *and* implement before publishing this clause; until then the
   honest wording is standing item 1 in the parity list below.
5. **Price-change notice period (§4.4)** and **renewal-reminder wording** — now that §4.3
   states that Stripe/Link sends the reminders, §4.4 must not promise that *we* will, and
   the notice period still needs a number (30 days is the safe default).
6. **Liability cap (§11.3)** — the bigger question now that the contracting party is a
   **sole proprietor**: the cap protects an individual's personal assets, so counsel should
   confirm the number is enforceable against UK/EU consumers *and* whether incorporating
   should be pulled forward before any real volume (see item 9).
7. **Governing law (§14)** — Hong Kong law and exclusive HK jurisdiction plus the consumer
   carve-out. Counsel to confirm this is appropriate for a UK/EU-majority customer base,
   and whether an EU/UK consumer is better served by a closer forum.
8. **Publish it in the right places.** Replacing `/terms` is necessary but not sufficient:
   the terms must also be reachable from the signup screen, the checkout screen and the
   receipt email. The checkout link is a Dashboard setting (item 4); the receipt/invoice
   emails are sent by Link, so confirm whether they carry our ToS link at all — if they do
   not, the pre-contractual-information argument rests on the checkout page alone.
9. **Incorporation is a planned event, not a hypothetical — prepare for the swap.** The
   Terms must name the operator, so incorporating means editing §1, §15.3 and §16, the
   Privacy Notice's controller clause, the Stripe account's business details, the AWS/domain
   ownership, and the effective date. Decide the revenue threshold in advance, and enter the
   company details in §16 on the day it happens rather than leaving the sole-proprietor
   wording to drift.
10. **Versioning.** Record an effective date and keep prior versions; a paywalled product
    needs to be able to show which terms a given subscription was sold under. Prior versions
    matter more than usual here precisely because the operator entity is expected to change.
11. **Consistency sweep** after publication: `docs/entitlement-policy.md` (tier split),
    `src/app/pricing/page.tsx` (what is free, trial length), the Privacy Notice (processors,
    retention), and this file must not disagree about prices, quota numbers (30/month free,
    1000/month safety cap) or trial length (14 days).
12. **Copy hygiene for the published slice — the defect class that blocked the first
    publication attempt (2026-09-15).** Everything between the document heading and
    `## Before publication` is shipped to users verbatim, so it must read as user-facing prose:
    no `(link)` placeholders (use a real markdown link), no `checklist item N`, no `DPIA`/`TODO`,
    no instructions to maintainers ("re-run the script", "see the method note below"), and no
    `[[ … ]]`. `tests/unit/legal-pages.test.tsx` now fails on this whole class — if it fails,
    fix the *document*, never the assertion.

**Parity list — sentences that are currently aspirational, i.e. the Service does not do what
the clause says.** Keep this list empty or keep the clause honest:

1. ~~§5.5 — no consent is collected at checkout~~ — **resolved 2026-09-15 by rewriting the
   clause, not by building the step.** §5.5 no longer claims a recorded acknowledgment; it
   honours the 14-day withdrawal right in full. Accepted consequence: a customer who cancels
   inside 14 days gets a refund, which with a 14-day free trial is close to nil exposure. If a
   consent step is ever built, switch §5.5 back to the waiver wording *and* check it is really
   collected before publishing that claim.
2. §11.3 / §11.4 — the cap and the business-use exclusions have not been reviewed by a
   lawyer. **They are published as drafted**, which was a conscious decision on 2026-09-15, not
   an oversight.
3. ~~§13 "the current version is always at …"~~ — linked to `/terms`. Superseded: before
   publication this said there was no published version to point at.
4. ~~§4.4 — no price-change notice period is stated~~ — **now states 30 days' email notice.**
