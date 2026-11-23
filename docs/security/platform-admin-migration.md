# Platform-Admin Migration & Operator Provisioning Runbook

Platform-operator access (`/api/admin/*`, `/api/admin/organizations/:orgId/tokens/*`, `POST /api/ai/mammouth/config`, and cross-tenant `DELETE /api/projects/:id`) is enforced exclusively by `PlatformAdminService` using immutable, verified `User.id` records.

- Hard-coded owner emails and `PLATFORM_ADMIN_EMAILS` are no longer trusted.
- Public password signup (`POST /auth/register`) always creates an unverified, non-operator user (`emailVerifiedAt = null`, `isPlatformAdmin = false`).
- All environments fail closed until at least one legitimate operator is explicitly verified and provisioned.

## Safe Migration Procedure for Existing Operators

1. **Deploy schema migration** (`prisma migrate deploy` runs `20261124000200_user_verified_platform_admin`).
2. **Audit existing accounts** matching former `PLATFORM_ADMIN_EMAILS` entries in PostgreSQL:
   - Confirm creation timestamp, authentication history (`RefreshSession`, `AuditLog`), and out-of-band ownership of the mailbox/account before granting access.
   - If an unknown party registered an operator address, revoke its sessions (`manage-platform-admins.js revoke`), reset/delete the account, and audit `AuditLog` / queue history.
3. **Provision each verified operator by immutable User ID:**
   ```bash
   docker compose exec api node scripts/manage-platform-admins.js grant \
     --user-id "<verified-user-uuid>" \
     --confirm-ownership "Verified operator identity out-of-band on YYYY-MM-DD"
   ```
4. **Update deployment `.env`** (never commit to Git):
   - Remove `PLATFORM_ADMIN_EMAILS`.
   - Optionally set `PLATFORM_ADMIN_USER_IDS=<uuid1>,<uuid2>` (verified users only).
5. **Verify effective operator list:**
   ```bash
   docker compose exec api node scripts/manage-platform-admins.js list
   ```

## Revoking an Operator

```bash
docker compose exec api node scripts/manage-platform-admins.js revoke \
  --user-id "<operator-uuid>" \
  --reason "Offboarding / key rotation"
```

Revocation takes effect immediately on the next request (even before a 15-minute access JWT expires), overrides `PLATFORM_ADMIN_USER_IDS`, and terminates all active refresh sessions.
