# NoUTube Scrape

A simple lambda to scrape some data from YouTube missing from the payloads we receive.

## Deploy

1. Install `pulumi`.
2. Configure `aws-cli` credentials.
3. Run `yarn` inside `src/`.
4. Run `yarn` inside `pulumi/`.
4. Run `pulumi up` inside `pulumi/` to deploy.
5. Manually create CNAME records as specified in `pulumi/index.js`.
