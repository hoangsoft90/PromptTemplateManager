## Purpose

Monetize the app with Google AdMob on Android and iOS through a low-frequency adaptive banner and an interstitial shown only after repeated copy actions, without disrupting the core Search → Fill → Copy loop.

## ADDED Requirements

### Requirement: Ads are native-only and non-personalized
The system SHALL display ads only on native platforms (Android/iOS). On web, no ad component SHALL render and no ad SDK SHALL be initialized. All ad requests SHALL use non-personalized ads only (`requestNonPersonalizedAdsOnly: true`), so no GDPR consent form is required.

#### Scenario: no ads on web
- **WHEN** the app runs on the web platform
- **THEN** no banner is rendered and the ad SDK is not initialized

#### Scenario: ads are non-personalized
- **WHEN** an ad is requested
- **THEN** the request is marked non-personalized only

### Requirement: Adaptive banner placements
The system SHALL display an adaptive banner ad at the bottom of the Home, Settings, and Detail screens on native platforms. Banners SHALL NOT cover interactive content (search bar, list, FAB, action buttons), and screens SHALL keep enough bottom padding that content is not hidden behind them.

#### Scenario: banner shown at bottom of Home
- **WHEN** the Home screen is displayed on a native platform
- **THEN** an adaptive banner ad is pinned to the bottom and list content is padded above it

#### Scenario: banner shown on Settings and Detail
- **WHEN** the Settings or a prompt Detail screen is displayed on a native platform
- **THEN** an adaptive banner ad is shown below the content and above the action buttons

### Requirement: Interstitial frequency gate
The system SHALL count copy actions (Fill & Copy and Quick Copy) in on-device storage and SHALL attempt to show an interstitial ad after every 10 copies. The interstitial SHALL only be shown if it is already loaded, SHALL never delay or block the copy action, and SHALL reset its counter after a show attempt. When the threshold is reached, the system SHALL first offer the user the choice to watch a rewarded ad instead.

#### Scenario: interstitial after threshold
- **WHEN** the 10th copy action since the last interstitial completes
- **THEN** the user is offered the rewarded-ad choice and, if declined, the interstitial is shown if loaded and the counter resets

#### Scenario: copy flow is never blocked by ads
- **WHEN** an interstitial is not yet loaded when the threshold is reached
- **THEN** the copy completes normally and no ad is shown

### Requirement: Rewarded ad grants a shield
When the user watches a rewarded ad to completion, the system SHALL grant a shield that skips interstitials for the next 20 copy actions. While shielded, copy actions SHALL NOT trigger the interstitial counter. The user SHALL also be able to watch a rewarded ad voluntarily from the Settings screen.

#### Scenario: rewarded ad skips next 20 interstitials
- **WHEN** the user watches a rewarded ad to completion
- **THEN** interstitials are skipped for the next 20 copy actions

#### Scenario: shielded copies bypass the counter
- **WHEN** a copy action completes while a shield is active
- **THEN** the interstitial counter is not incremented and no interstitial is attempted

#### Scenario: voluntary rewarded ad from Settings
- **WHEN** the user taps the rewarded ad action in Settings
- **THEN** the rewarded ad plays and, on completion, a 20-copy shield is granted

### Requirement: App Open ad
The system SHALL show an App Open ad (Google's highest-eCPM format) on background → foreground transitions on native platforms. The ad SHALL NOT appear on cold start (first 30 seconds), SHALL be throttled to at most once every 3 minutes, SHALL NOT stack on a recently shown interstitial, and SHALL only show if already loaded — never blocking or delaying app usage.

#### Scenario: app open ad on background return
- **WHEN** the user backgrounds the app and returns to it after the throttling window
- **THEN** the app open ad is shown if loaded, and the app remains fully usable if it is not

#### Scenario: no app open ad on cold start
- **WHEN** the app is launched fresh (within 30 seconds)
- **THEN** no app open ad is shown

### Requirement: Test-first ad configuration
The system SHALL ship with Google test ad unit IDs by default so the app runs and renders test ads without an AdMob account, and SHALL make the production unit IDs a simple one-place configuration change.

#### Scenario: test ads render in development
- **WHEN** the app runs in development with no real AdMob account configured
- **THEN** test banner and interstitial ads are used and render without errors

### Requirement: Ads never break the app
The system SHALL isolate all ad SDK calls in try/catch and initialize the SDK asynchronously so that any ad failure (network, configuration, platform) has no effect on app functionality.

#### Scenario: ad failure is silent
- **WHEN** the ad SDK fails to load or show an ad
- **THEN** the app continues to function normally with no crash and no user-facing error
