/**
 * The Google API clients this product actually calls, imported one by one.
 *
 * `import { google } from 'googleapis'` pulls in every API Google publishes —
 * several hundred of them, Cloud Dataproc and Blogger included — because the
 * aggregate entry point builds a client for each. Measured on this codebase it
 * costs 69MB of heap and 112MB of RSS at require time, before a single request
 * is served. Importing the APIs actually used costs 6.5MB and 26MB.
 *
 * On a 512MB instance that difference is the whole argument. The app's
 * baseline RSS is what decides whether a browser can be launched beside it,
 * and 86MB is most of the headroom Chromium needs.
 *
 * Each API is its own `@googleapis/<name>` package rather than a deep import
 * into `googleapis`. The code is the same, but the `googleapis` package ships
 * all 335 APIs on disk, over 200MB of node_modules and Docker image for seven
 * clients.
 *
 * The cost of this file is that a new Google API has to be added here (and to
 * package.json) before it can be used. That is the intended trade: the
 * aggregate import is convenient precisely because it hides what it loads.
 */

import { analyticsadmin } from '@googleapis/analyticsadmin';
import { analyticsdata } from '@googleapis/analyticsdata';
import { businessprofileperformance } from '@googleapis/businessprofileperformance';
import { mybusinessaccountmanagement } from '@googleapis/mybusinessaccountmanagement';
import { mybusinessbusinessinformation } from '@googleapis/mybusinessbusinessinformation';
// `auth` rather than google-auth-library's own export. It is the AuthPlus
// from googleapis-common that the aggregate `google.auth` was, so an OAuth2
// client built from it is the type every client below accepts, by
// construction. Should googleapis-common ever nest its own copy of
// google-auth-library again, the top-level OAuth2Client would become a
// structurally identical but distinct type that the clients reject.
import { auth, searchconsole } from '@googleapis/searchconsole';
import { youtube } from '@googleapis/youtube';

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
