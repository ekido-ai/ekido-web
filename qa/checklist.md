# Staging test checklist

Run this every evening on `https://ekido-staging.duckdns.org`, once on a phone-sized screen (375 px wide, or a real phone) and once on desktop. Mark each line pass or fail in the daily summary comment on the week-1 QA issue. File every failure as an issue in `ekido-ai/Ekido`, using the bug template with the labels `bug` and `week-1`.

New lines are added as features land. A line marked *(from day N)* applies only from that day.

## Every page
- [ ] Loads within 3 seconds, with no error screen.
- [ ] No horizontal scroll on a phone.
- [ ] Text is readable in light and dark mode.
- [ ] No provider's name, wallet address, GPU model, provider list or provider count is visible anywhere. *(Expected to fail until "hide providers" lands.)*
- [ ] Links in the header and footer go somewhere real.

## Site
- [ ] Home, Provide, Help, Status, Privacy and Terms pages open.
- [ ] The provider kit downloads, and its SHA-256 matches the one shown on the page.

## Accounts *(from day 2)*
- [ ] Sign up with email: the magic link arrives and signs you in.
- [ ] Sign in with Google.
- [ ] Create a team and invite a member.
- [ ] Create an API key, see it once, revoke it; a revoked key is refused.
- [ ] Sign out, then press back: you're still signed out.

## Customer journey *(from day 3 to 5)*
- [ ] Pick a recipe; the example data downloads.
- [ ] Upload a CSV with names and phone numbers in it: the preview shows what was removed before anything is sent.
- [ ] The quote shows rupees, GST, an estimated time and the quality bar in plain words.
- [ ] Pay with the Razorpay test UPI ID; the job starts.
- [ ] Progress updates without a refresh and never names a provider.
- [ ] Result: the endpoint answers with the API key, the download works, and the savings report opens.
- [ ] A forced quality failure shows the refund.
- [ ] The assistant turns a plain-words request into a job, and refuses a banned request politely.

## Provider *(from day 5)*
- [ ] The provider portal shows only your own device's status and earnings.
