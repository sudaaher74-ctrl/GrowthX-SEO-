/**
 * The Google API clients this product actually calls, imported one by one.
 *
 * `import { google } from 'googleapis'` pulls in every API Google publishes —
 * several hundred of them, Cloud Dataproc and Blogger included — because the
 * aggregate entry point builds a client for each. Measured on this codebase it
 * costs 69MB of heap and 112MB of RSS at require time, before a single request
 * is served. Importing the six APIs actually used costs 6.5MB and 26MB.
 *
 * On a 512MB instance that difference is the whole argument. The app's
 * baseline RSS is what decides whether a browser can be launched beside it,
 * and 86MB is most of the headroom Chromium needs.
 *
 * The cost of this file is that a new Google API has to be added here before
 * it can be used. That is the intended trade: the aggregate import is
 * convenient precisely because it hides what it loads.
 */

import { analyticsadmin } from 'googleapis/build/src/apis/analyticsadmin';
import { analyticsdata } from 'googleapis/build/src/apis/analyticsdata';
import { businessprofileperformance } from 'googleapis/build/src/apis/businessprofileperformance';
import { mybusinessaccountmanagement } from 'googleapis/build/src/apis/mybusinessaccountmanagement';
import { mybusinessbusinessinformation } from 'googleapis/build/src/apis/mybusinessbusinessinformation';
// `auth` rather than google-auth-library's own export. googleapis-common
// depends on a nested copy of that package, so the top-level OAuth2Client is a
// structurally identical but distinct type, and every client built with one
// rejects it — the same mismatch google-oauth.service.ts already carries a
// comment about. This is the AuthPlus the aggregate `google.auth` is, so the
// types line up by construction.
import { auth, searchconsole } from 'googleapis/build/src/apis/searchconsole';
import { youtube } from 'googleapis/build/src/apis/youtube';

/**
 * Shaped to match the `google.<api>()` calls this replaced, so the call sites
 * read the same and a reviewer can see the import is the only thing that
 * changed.
 *
 * `auth.OAuth2` comes from google-auth-library directly. It is the same class
 * the aggregate re-exports — googleapis depends on that package for it — so
 * the clients built here accept it exactly as before.
 */
export const google = {
  auth,
  analyticsadmin,
  analyticsdata,
  businessprofileperformance,
  mybusinessaccountmanagement,
  mybusinessbusinessinformation,
  searchconsole,
  youtube,
};
