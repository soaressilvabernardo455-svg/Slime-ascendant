# Slime Ascendant — Unity Edition

Independent Unity project. The browser game and Render deployment remain in the repository root and are not modified.

## Target
- Unity 2022.3 LTS
- Android first, landscape
- Built-in Render Pipeline as a conservative mobile baseline
- Stylized 3D character with separate head, torso, arms and legs
- Low / Balanced / High quality presets

## Open on a computer
1. Install Unity Hub and Unity 2022.3 LTS with Android Build Support (SDK, NDK and OpenJDK).
2. In Unity Hub choose Add and select this `UnityProject` folder.
3. Create a scene named `Main`.
4. Add an empty GameObject named `GameBootstrap` and attach `GameBootstrap.cs`.
5. Add an empty GameObject named `MobileInput` and attach `MobileInput.cs`.
6. Press Play to generate a test arena, player, camera and enemies.

## Included prototype
- Separate humanoid body parts, basic arena and follow camera.
- Enemy chase/attack and close-range automatic attacks.
- Knight orbiting orbs and Necromancer skeleton summons.
- Starter class stat catalog, touch movement and quality preset code.

## Still to implement and test
This is a foundation, not a complete port. The existing game's WebSocket multiplayer protocol, account/progression, lobby, shop, chest drops, all class abilities, maps, boss phases, UI and server-authoritative combat still need integration and testing. Do not point Render at this folder and do not replace the web app.

## Android build target
Android; landscape left/right; IL2CPP; ARM64; minimum API 26. The APK can only be built and device-tested after opening the project in Unity on a compatible computer or build runner.
