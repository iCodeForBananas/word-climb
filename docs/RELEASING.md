# Releasing

Day to day, releasing is one command:

```
git tag v1.1.0
git push origin v1.1.0
```

That runs [`.github/workflows/release.yml`](../.github/workflows/release.yml),
which:

- **Android**: builds a signed `.aab`, uploads it to Google Play's internal
  testing track, and attaches a signed `.apk` to a GitHub release.
- **iOS**: archives a signed build and uploads it to App Store Connect, where
  it appears in TestFlight.

You then promote the build to production from the Play Console and from App
Store Connect. That last click stays manual on purpose: store review, release
notes and screenshots live there.

Each half skips itself, with a warning, until its secrets are set. The rest of
this page is the one-time setup.

---

## Google Play (one-time)

### 1. Accounts

1. Create a [Google Play developer account](https://play.google.com/console/signup)
   ($25, once). Identity verification can take a few days.
2. In the Play Console, **Create app**: name "Word Climb", free, app.

### 2. Make the upload key

On any machine with a JDK (`keytool` comes with it):

```
keytool -genkeypair -v -keystore word-climb-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Keep the `.keystore` file and both passwords somewhere safe (a password
manager), **outside** this repo. Play App Signing holds the real app signing
key; this is only the upload key, and Google can reset it if it's lost.

### 3. GitHub secrets

Repo → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret                      | Value                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | the keystore, base64-encoded (see below)                    |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password                                           |
| `ANDROID_KEY_ALIAS`         | `upload`                                                    |
| `ANDROID_KEY_PASSWORD`      | key password (the same as the keystore's, if you kept that) |

To base64-encode on Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("word-climb-upload.keystore")) | Set-Clipboard
```

### 4. First upload is by hand

Google requires the very first bundle to be uploaded in the Console before
the API can upload. Push a tag (`v1.0.0`). The release run will warn that
Play credentials are missing and still build the signed `.aab`. Download it
from the run's summary (or build it locally), then in the Play Console:
**Testing → Internal testing → Create new release**, upload it, and opt in to
Play App Signing when asked.

### 5. Let CI upload from now on

1. Google Cloud Console → create a project → enable the **Google Play Android
   Developer API**.
2. Create a **service account**, then a JSON key for it.
3. Play Console → **Users and permissions** → invite the service account's
   email with the **Release apps to testing tracks** permission (add
   production too if you want CI to be able to ship there).
4. Add the whole JSON file's contents as the secret
   `PLAY_SERVICE_ACCOUNT_JSON`.

CI uploads releases as drafts until the app passes its first review. After
that, set the repository **variable** (not secret) `PLAY_RELEASE_STATUS` to
`completed` so uploads go straight to testers.

### 6. Store listing

The Play Console checklist walks you through it. For a kids' app:

- **Target audience**: ages 5 and under, 6-8. This puts the app under the
  Families policy, which Word Climb already meets: no ads, no data
  collection.
- **Data safety**: "No data collected" and "No data shared".
- **Privacy policy URL**:
  <https://icodeforbananas.github.io/word-climb/privacy.html>
- Screenshots: a phone and a tablet set. Run `npm run dev` in a browser at
  those sizes, or take them on a device.

---

## Apple App Store (one-time)

### 1. Accounts

1. Join the [Apple Developer Program](https://developer.apple.com/programs/enroll/)
   ($99/year).
2. In [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+** →
   New App: iOS, name "Word Climb", bundle ID
   `com.icodeforbananas.wordclimb` (register it under Certificates,
   Identifiers & Profiles first if it isn't offered), SKU `word-climb`.

### 2. API key for CI

App Store Connect → Users and Access → Integrations → **App Store Connect
API** → Team Keys → generate a key with the **Admin** role. Admin is needed
because CI lets Xcode create the signing certificate and provisioning
profile for you, so none of that is stored in the repo. Download the `.p8`
file; Apple only lets you download it once.

### 3. GitHub secrets

| Secret                         | Value                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| `APP_STORE_CONNECT_KEY_ID`     | the key's ID                                                             |
| `APP_STORE_CONNECT_ISSUER_ID`  | the Issuer ID shown above the keys list                                  |
| `APP_STORE_CONNECT_API_KEY_P8` | the full text of the `.p8` file, including the BEGIN/END lines           |
| `APPLE_TEAM_ID`                | your 10-character Team ID (developer.apple.com → Account → Membership)   |

The next tag uploads to App Store Connect. The build shows up in TestFlight
after Apple processes it, usually 10-30 minutes.

### 4. Store listing

- **Age rating**: answer "None" throughout. Put the app in the **Kids**
  category (ages 5 and under, or 6-8), which requires no ads, analytics or
  outside links, all already true.
- **App Privacy**: "Data Not Collected".
- **Privacy Policy URL**:
  <https://icodeforbananas.github.io/word-climb/privacy.html>
- Screenshots: the app runs on iPhone and iPad, so Apple asks for both a
  6.9" iPhone and a 13" iPad set.

---

## Version numbers

The tag sets the version people see (`v1.2.0` → 1.2.0). The build number
Android and Apple need to keep rising is the release workflow's run number,
so it climbs on its own.
