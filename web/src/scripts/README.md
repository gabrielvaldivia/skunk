# Game Population Scripts

This directory contains scripts for populating the database with classic games.

## Files

- **`generate-top-100-games.ts`** - Generates game data for 300 classic games matching the Skunk `Game` type
- **`populate-universal-games.ts`** - Populates the database with 300 universal classic games (accessible to all users)
- **`import-top-100-games.ts`** - Legacy import script (creates games with user ID - not recommended for universal games)

## Populating Universal Games (One-Time Setup)

To populate the database with 300 classic games that are accessible to all users:

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Open the app in your browser and sign in as admin** (`valdivia.gabriel@gmail.com`)

3. **Open the browser console** (F12 or Cmd+Option+I)

4. **Run the populate script:**
   ```javascript
   const { populateUniversalGames } = await import('./src/scripts/populate-universal-games');
   await populateUniversalGames((progress) => {
     console.log(`Progress: ${progress.completed}/${progress.total} (${progress.skipped} skipped, ${progress.failed} failed)`);
   });
   ```

5. **Wait for completion** - The script will:
   - Check which games already exist (skips duplicates)
   - Create all 300 classic games without `createdByID` (making them universal)
   - Show progress in the console
   - Report any errors

## Important Notes

- **Universal Games**: Games created by `populateUniversalGames()` have no `createdByID`, making them accessible to all users
- **Admin Only**: Only the admin can run this script
- **Idempotent**: Safe to run multiple times - it will skip games that already exist
- **One-Time Setup**: This should be run once to populate the database with the classic games

## Game Access

- **Universal Games** (no `createdByID`): Accessible to all users
- **User-Created Games** (with `createdByID`): Only visible to the creator (if filtering is implemented)

## Admin Game Creation

Only admins can create new games through the UI. The "Add Game" button is only visible to admins on the Games page.
