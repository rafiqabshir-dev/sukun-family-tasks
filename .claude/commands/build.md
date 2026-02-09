Build, archive, and upload the iOS app to App Store Connect (TestFlight).

Execute these steps in order, stopping on any failure:

## Step 1: Increment build number

Read `app.config.js` and increment the `ios.buildNumber` string by 1 (e.g. "2" → "3", "15" → "16"). Do NOT change the `version` field — only `buildNumber`.

## Step 2: Regenerate native project

```bash
cd ~/projects/sukun-family-tasks
npx expo prebuild --platform ios --clean
```

## Step 3: Build the archive

```bash
cd ~/projects/sukun-family-tasks
xcodebuild -project ios/Sukun.xcodeproj \
  -scheme Sukun \
  -configuration Release \
  -archivePath build/Sukun.xcarchive \
  archive \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=S27U77J83N
```

## Step 4: Export the IPA

```bash
cd ~/projects/sukun-family-tasks
xcodebuild -exportArchive \
  -archivePath build/Sukun.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/export \
  -allowProvisioningUpdates
```

## Step 5: Upload to App Store Connect

```bash
cd ~/projects/sukun-family-tasks
xcrun altool --upload-app \
  -f build/export/Sukun.ipa \
  -t ios \
  --apple-id "abshir.engineer@gmail.com" \
  --team-id "S27U77J83N" \
  -p "@keychain:AC_PASSWORD"
```

If the upload step fails due to missing keychain password, tell the user they need to:
1. Generate an app-specific password at https://appleid.apple.com/account/manage → Sign-In and Security → App-Specific Passwords
2. Store it: `security add-generic-password -s "AC_PASSWORD" -a "abshir.engineer@gmail.com" -w "THEIR_APP_SPECIFIC_PASSWORD" -T "" ~/Library/Keychains/login.keychain-db`

## Step 6: Report result

Print the new build number, confirm upload success, and remind the user that the build will appear in TestFlight after Apple's processing (usually 10-30 minutes).
