This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuration

`NEXT_PUBLIC_API_URL` is required, and points at the crawler API this frontend
talks to (for example `https://growthx-crawler-api.onrender.com`, or
`http://localhost:3000` when running the API locally).

It is read by `next build`, not at runtime — Next inlines `NEXT_PUBLIC_*` into
the bundle — so it has to be set wherever the build happens: the project's
environment variables on Vercel, or the `NEXT_PUBLIC_API_URL` build arg on the
Docker image. Setting it only as a container runtime variable has no effect on
an already built bundle.

The build fails naming this variable if it is missing. It used to fall back to
the hosted production API for any host that was not localhost, so a preview or
staging deploy that forgot it read and wrote real customer records without
saying so.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
