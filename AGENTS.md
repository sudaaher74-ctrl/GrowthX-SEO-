<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deployment source of truth

Make application fixes and server configuration changes in this Git repository first. Test the change, commit it, and deploy the resulting commit or image on every host that needs it. Never leave a fix only in a running container, generated `dist` file, derived hotfix image, or host checkout. Keep deployment commands and any required non-secret settings in the repository.

Keep API keys, database passwords, encryption keys, OAuth secrets, and tunnel credentials outside Git. When replacing a host, restore the database and those secrets to the new host and point the stable API hostname to it. Follow [docs/operations/move-server.md](docs/operations/move-server.md).
