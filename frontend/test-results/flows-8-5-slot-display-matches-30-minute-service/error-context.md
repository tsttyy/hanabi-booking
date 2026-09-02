# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flows.spec.ts >> 8.5: slot display matches 30-minute service
- Location: e2e\flows.spec.ts:484:1

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED ::1:5173
Call log:
  - → POST http://localhost:5173/api/auth/login
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 54

```