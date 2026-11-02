# Building a phone body scan: legal notes

Not legal advice. Have a startup or IP lawyer review this before launch (Berkeley Law's clinics are a good free start).

## What's fine

- **Building your own scan from published science and open-source tools.** Rise's scan uses Google's MediaPipe pose model (Apache 2.0 license), the U.S. Navy circumference equations (published in 1984, public domain) and standard geometry. Nothing is copied from Prism Labs, Spren or any other company.
- **Doing the same job as a competitor.** Estimating body composition from photos is not owned by anyone; specific methods can be.

## What to avoid

- **Copying their code, models or app.** Decompiling or reverse-engineering their apps or SDKs, scraping their outputs to train a model, or reusing their assets breaks their terms of service and can infringe copyright or trade secrets.
- **Patented methods.** 3D body scanning companies hold patents on specific techniques (for example, building a 3D body model from phone images and predicting composition from it). Before launch, get a **freedom-to-operate** search on the specific method you ship. Rise's current method (2D outline → circumferences → published equation) is a long-established approach, but a lawyer should confirm.
- **Claims you can't back up.** Don't say the scan is "as accurate as DEXA" or "clinically validated" until you've run a validation study. Rise labels it an estimate.

## Regulation and privacy

- Body composition tracking for general wellness is usually low risk under the FDA's general wellness guidance. Flagging patients for clinical follow-up may move the product toward a medical device; ask a regulatory advisor.
- Body photos are sensitive. Rise measures them on the phone and discards them; keep it that way, or get explicit consent and HIPAA-grade storage before keeping any image.

## The licensing alternative

Prism Labs and Spren both sell SDKs and APIs with published validation against DEXA. Licensing one is the fastest legal path to their accuracy. Rise's scan step is built so a licensed SDK can replace the photo estimate without changing the rest of the app.
