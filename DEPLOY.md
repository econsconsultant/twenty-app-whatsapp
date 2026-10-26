# Upgrading to 0.1.3 on Twenty 2.44+

0.1.3 fixes the inbox refusing everyone on Twenty 2.44 and later with *"This action requires the
WhatsApp agent role"*. It ships as an **in-place upgrade** of the installed app: same universal
identifiers, same records, same settings. This guide is for an install that is already running
0.1.2 and whose server has been upgraded to Twenty 2.49.

**Already on 0.1.3?** 0.1.4 follows the same `plan` and `apply` steps (section 2). Its plan
changes logic function and front component code and one variable's description; it should
destroy nothing. If it does, stop.

> **Never uninstall the app.** Uninstalling deletes every WhatsApp account, thread, message,
> consent record and campaign. Nothing below requires it, and no step should be replaced by it.

## How the upgrade is applied

If the app was installed from the marketplace, its registration is an **npm** registration
(claimed by the workspace). That rules out the usual channels:

- **Settings → Upgrade** only offers versions published to npm under
  `@pixelinfinito/twenty-app-whatsapp`, and this build is not published there.
- **`twenty app:publish --private`** is refused by 2.49 for an npm registration
  (`SOURCE_CHANNEL_MISMATCH`). The workaround is to delete the registration first, but that also
  deletes the four Meta server variables (`META_APP_SECRET` and the rest) and briefly takes the
  webhook route down.

**`twenty apply`** syncs this source into the installed app as a diff. That is the same machinery
an upgrade uses, and it keeps:

- every record
- every application variable value
- the Meta server variables
- the registration and the webhook URL

You review the diff with **`twenty plan`** before anything changes.

## Before you start

- **Server.** Twenty 2.49.0 or later, with `LOGIC_FUNCTION_TYPE=LOCAL`.
- **Build machine.** Linux, macOS or WSL. **Not native Windows**: SDK 2.49 writes Windows
  backslashes into the manifest, and the server rejects the sync with *"Resource path must not
  contain backslashes"*. You need Node 24 (`.nvmrc`) and Corepack.
- **API key.** In the target workspace, go to **Settings → APIs & Webhooks** and create a key with
  the **Admin** role. The sync needs the Applications and Upload file permissions. Revoke the key
  afterwards.
- **Database backup.** Take a `pg_dump` of the server immediately before the upgrade. It is the
  rollback.
- **Agent roles.** A member holds one role, so members on a workspace role of your own (a sales
  role, say) cannot also be WhatsApp Agent. Decide which such roles should use the inbox. From
  0.1.4 you tick them by name in the app's Variables tab; on 0.1.3, open each role in Settings and
  copy its ID, the last part of the URL (`/settings/members/roles/<id>`).

## 1. Rehearse first

A test workspace on the same server cannot stand in for the real one, for two reasons:

- `twenty apply` only targets the workspace that owns the registration.
- 0.1.2 can no longer be installed fresh on 2.49.

Rehearse on a separate instance that reaches the real workspace's state the same way it did. The
most faithful option is a staging copy restored from the backup. The local recipe below
reproduces the same path with demo data (Docker, about 15 minutes):

1. Start Twenty 2.40 with its own volumes:

   ```bash
   docker run -d --name twa-rehearsal -p 2022:2022 \
     -e NODE_PORT=2022 -e SERVER_URL=http://localhost:2022 \
     -v twa-rehearsal-data:/data/postgres \
     -v twa-rehearsal-clickhouse:/data/clickhouse \
     -v twa-rehearsal-storage:/app/packages/twenty-server/.local-storage \
     twentycrm/twenty-app-dev:v2.40.0
   ```

2. Open http://localhost:2022 (`tim@apple.dev` / `tim@apple.dev`). Install WhatsApp 0.1.2 from
   **Settings → Applications**, then claim its registration (README step 1).
3. Add a few records and set a variable or two.
4. Recreate the container on `v2.49.0` with the same volumes. The image runs the 2.49 upgrade on
   boot. Stop it with `docker stop -t 120 twa-rehearsal`: Postgres needs the time to shut down
   cleanly.
5. Confirm the inbox now answers 403. That is the symptom this release fixes.
6. Run step 2 below against `http://localhost:2022`.

## 2. Upgrade

```bash
git clone https://github.com/econsconsultant/twenty-app-whatsapp.git
cd twenty-app-whatsapp
corepack enable
yarn install --immutable
yarn twenty remote:add --url https://crm.example.com --api-key <admin key> --as production
```

Replace `https://crm.example.com` with your server's URL.

### Preview the change

```bash
yarn twenty plan -r production
```

This changes nothing. On a 0.1.2 install the plan should end with roughly
**`Plan: 17 to add, 73 to change, 15 to destroy`**:

- **Destroys.** All 15 must be `objectPermission` entries, meaning the WhatsApp roles' access to the
  WhatsApp objects. 2.40 stored them under ids it derived itself. The plan re-creates the same
  permissions under the manifest's ids in the same apply, and they hold no records.
- **Adds.** Those 15 permissions plus the two new variables, `WA_ALLOW_AGENT_ROLES` and
  `WA_TIME_ZONE`.
- **Changes.**
  - Logic function code.
  - The routes losing their `forwardedRequestHeaders`.
  - Variables gaining a `defaultValue`. Their current values are not compared, so they are kept.

**Stop** if the plan destroys anything other than `objectPermission`, such as an object, field,
view or role. Do not apply it.

### Apply

```bash
yarn twenty apply -r production
```

It shows the same plan, asks you to confirm the destroys, then syncs.

If the upload step fails with `connect ETIMEDOUT` next to `ENETUNREACH` on an IPv6 address
(common on WSL, which has no IPv6 route), Node's dual-stack fallback is giving up on IPv4 too
early under 80-odd parallel uploads. Nothing was synced; run it again with IPv4 forced:

```bash
NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" yarn twenty apply
``` Do **not** use `yarn twenty
dev` against a live workspace: it is a watch mode meant for development.

### Configure

Go to **Settings → Applications → WhatsApp** and set these variables:

| Variable | Set to |
| --- | --- |
| `WA_ALLOW_AGENT_ROLES` | The agent roles from *Before you start*: ticked by name from 0.1.4, or their IDs on 0.1.3. Members of a listed role use the inbox as agents: they can read and send, but not manage templates, campaigns or settings. Leave it empty if everyone who uses the inbox is on a WhatsApp role or is a workspace admin. |
| `WA_TIME_ZONE` | Your customers' IANA zone, such as `Europe/Lisbon`. Defaults to `Africa/Luanda`, the zone earlier versions hardcoded. |
| `WA_DEFAULT_COUNTRY_CALLING_CODE` | Check it is your country's code. If it still shows the shipped `+244`, numbers stored without a country code are being sent to Angola. |

Workspace admins need no setting: a role that can update all settings now counts as WhatsApp
admin.

### Clean up

```bash
yarn twenty remote:remove production
```

Then revoke the API key in Settings.

## 3. Verify

1. **Version.** **Settings → Applications → WhatsApp** shows version **0.1.3**.
2. **Admin.** As a workspace admin, the inbox loads, and templates and campaigns are available.
   In the browser's network tab, `GET /s/whatsapp/feed` returns **200**.
3. **Agent role.** As a member of a role listed in `WA_ALLOW_AGENT_ROLES`, the inbox loads and
   threads open. Admin-only actions answer *"This action requires the WhatsApp admin role"*, which
   is expected. If the inbox still says "requires the WhatsApp agent role", check the role ID.
4. **Webhook.** Two checks:
   - The health panel's **Webhook route (POST)** row is green. For an unsigned probe,
     `401 invalid signature` is the correct answer.
   - Send a WhatsApp message to the business number from a phone. It should appear in its thread
     within about 20 seconds.
5. **Settings.** Earlier variable values are unchanged, and the Meta credentials still show as set.

## Rollback

- **0.1.2 cannot be put back on Twenty 2.49.** The server refuses its manifest ("Route triggers
  cannot forward credential headers"), and Twenty blocks installing a lower version anyway.
- **Fix forward.** Commit the fix, bump to 0.1.4, then run `plan` and `apply` again.
- **Full rollback.** Restore the pre-upgrade database backup and run the Twenty image the server
  ran before (2.40.0, where 0.1.2 works). Anything written since the backup is lost.
- **A failed `apply`** reports its validation errors and does not uninstall anything. Run `plan`
  again to see where the app stands.

## Afterwards

- **The registration is still the upstream npm one.** Settings may offer a future upstream
  release as an upgrade. Accept it only once that release contains these fixes, because it
  replaces this build. Automatic upgrades are off by default.
- **Rehearsal record, 2026-10-21.** The recipe above was run end to end:
  - 0.1.2 installed on 2.40, with records, a non-default calling code and the Meta server
    variables set.
  - Server upgraded to 2.49: the admin got 403.
  - `plan` gave 17 / 73 / 15, with only `objectPermission` destroyed.
  - After `apply`:
    - App id unchanged, version 0.1.3.
    - Records and variable values intact. The new variables were created at their defaults.
    - Meta server variables still set.
    - Admin feed returned 200.
    - A member of a custom sales role got 403 until the role was listed in
      `WA_ALLOW_AGENT_ROLES`, then 200, with admin actions still refused.
    - A signed webhook delivery was processed into the existing thread.
