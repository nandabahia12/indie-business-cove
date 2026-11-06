<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Multi-tenant: every org-owned table has `organization_id` FK to `organizations` and RLS via `is_org_member`/`has_org_role`/`has_org_permission` (security definer) — prevents cross-tenant leaks.
- Migration history is empty after the remix while the database already holds the full schema — new migrations must be additive and must never recreate existing tables or roles.
- Roles live in `organization_member_roles`, never on profiles — avoids privilege escalation.
- Business modules live in `src/modules/<module>/` with `*.functions.ts` server functions; they share data only via core entities — keeps modules decoupled.
- DB errors go through `fromDbError` and logs through `logger` (redacts sensitive keys) — never expose internals.
- Files go in private bucket `org-files` under `{organizationId}/...` — storage policies depend on the first folder.
- Permissions are `<module>.<read|create|update|delete|manage>` and require the module enabled for the org; membership/role writes happen only through security-definer RPCs (create_invitation, accept_invitation, set_member_role, remove_member) that also write audit logs.
- Client-linked rows (e.g. `files.client_user_id`) are visible to that client and to staff with `crm.read` only — clients have no module permissions.
- `src/test/tenant-isolation.integration.test.ts` proves cross-tenant isolation against the real DB; extend it for every new org-owned table.
- Active organization in localStorage is only a UI preference; never trusted for access.
- Profession-specific behavior is data, not code: `segment_templates` drive onboarding suggestions; `organization_presets` (service-role only, linked to one org) hold platform-prepared settings readable only via `get_org_preset` — keeps the core universal.
- Onboarding completion goes only through the `complete_onboarding` RPC (owner/admin, closes module dependencies, whitelisted setting keys, audit) — AI suggestions are filtered to catalog keys and never activate anything without user confirmation.
