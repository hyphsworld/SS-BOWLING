# Super Strike Bowling — Apple Release Setup

## App Store Connect record

Create the iOS app record with these values:

- **App name:** Super Strike Bowling
- **Primary language:** English (U.S.)
- **Bundle ID:** `com.amswest.superstrike`
- **SKU:** `SUPERSTRIKE-IOS-001`
- **Platform:** iOS
- **Version:** `1.0.0`
- **Developer / seller:** AMS WEST ENTERPRISE LLC, if that is the legal Apple Developer organization name on the enrolled account

Apple requires the App Store Connect record to exist before the first build is uploaded.

## EAS / Expo setup

From `frontend/`:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform ios --profile production
```

When prompted for Apple credentials/signing, use the Apple Developer account that owns the `com.amswest.superstrike` identifier. EAS can create or reuse the distribution certificate and provisioning profile.

After the production build completes:

```bash
npx eas-cli@latest submit --platform ios --profile production
```

Select the Super Strike Bowling App Store Connect record. The build should then appear in TestFlight after Apple finishes processing it.

## Before public App Review

Test on a real iPhone/iPad and verify:

- launch / splash / icon
- login and HYPHSWORLD ID session
- Supabase connectivity
- solo bowling
- 4-digit multiplayer room create/join
- realtime opponent updates
- tenth-frame completion
- strike celebration / haptics / audio
- server-owned Cool Points
- reconnect / interruption behavior
- privacy policy and support links

Do not submit publicly until the TestFlight build passes real-device multiplayer testing.
