# Round 5 — Admin Onboarding & Latency Fixes Test Walkthrough

This document tests the round-5 fixes for:
1. **Admin Onboarding (Step 0)** — Using the new `update_admin` RPC to bypass GoTrue email/session hangs.
2. **Setup Wizard Parallelization** — Testing the `Promise.all` concurrent user creation (managers/employees).
3. **Admin User Creation Polling** — Testing the shortened polling latency in `adminCreateUser`.

---

## Prerequisites

1. **Database State:**
   - Migrations `0001` through `0009` are applied.
   - Migration `0011_update_my_account_immediate.sql` is applied via Supabase SQL Editor.
2. **Environment:**
   - Dev server running (`npm run dev`) or test via Netlify live URL.
3. **Data Prep (Clean Slate Test):**
   - Head to Supabase SQL Editor and clear existing users to avoid "Already Registered" conflicts: 
     ```sql
     delete from auth.users;
     ```
   - Go to Auth → Add User and recreate the baseline admin (`admin@demo.com` / `Demo@1234`).
   - Open SQL Editor and assign the admin role:
     ```sql
     update public.profiles set role = 'ADMIN' where email = 'admin@demo.com';
     ```
   - Log into the app using `admin@demo.com` / `Demo@1234` to trigger the Step 0 wizard automatically.

---

## Section 37: Admin Profile Update (Step 0)

> Tests the transition from the old freezing behavior to the new instant RPC update.

**[Test 37.1] Initial Admin Profile View**
- **Action:** Open the "Create Team" wizard (Step 0: "Set up your admin account").
- **Expected:** The "Full name" and "Email" fields are pre-filled with the current admin's data.

**[Test 37.2] Instant Account Patch (No Hang)**
- **Action:** 
  1. Change the "Full name" to `Vaibhav Admin`.
  2. Change the "Email" to your real testing email: `vaibhavpardeshi190@gmail.com`.
  3. Enter a new "Password" (e.g., `NewDemo1234!`).
  4. Click `Next` (this triggers `updateMyAccount`).

- **Expected:** 
  - The loading button spins briefly (usually <300ms).
  - The UI transitions smoothly to Step 1 (Managers).
  - **No** email verification is sent by Supabase.
  - You do **not** get logged out (session stays active).
  - The top right header (if visible) updates instantly to `Vaibhav Admin`.

**[Test 37.3] Database Verification (Optional but recommended)**
- **Action:** Open Supabase SQL Editor and run `select email, raw_user_meta_data from auth.users where email = 'vaibhavpardeshi190@gmail.com';`
- **Expected:** The row is present. `raw_user_meta_data` contains `{"full_name": "Vaibhav Admin"}`.

---

## Section 38: Parallel Manager Creation (Step 1)

> Tests the new `Promise.all` speed up on user creation.

**[Test 38.1] Create Multiple Managers**
- **Action:** 
  - In Step 1, click "Add manager" twice to have 3 manager rows.
  - Fill them in with these exact emails so you can verify the welcome messages arrive:
    1. Manager 1: `vaibhav.pardeshi@atomberg.com`
    2. Manager 2: `vaibhavpardeshi2022.comp@mmcoe.edu.in`
    3. Manager 3: `cloneindia5771@gmail.com`
  - Enter names and passwords (e.g., `Manager123!`) for all three.
  - Click `Next`.
- **Expected:**
  - The loading state engages.
  - Creation finishes very quickly compared to old sequential creation (all 3 create essentially at the same time).
  - Progress jumps to 100%.
  - The UI advances to Step 2 (Employees) with a success toast saying `3 managers created`.

---

## Section 39: Parallel Employee Creation (Step 2)

> Tests employee parallel creation and manager associations.

**[Test 39.1] Create Multiple Employees**
- **Action:**
  - In Step 2, click "Add employee" to add 2 employee rows.
  - Fill out valid distinct information (you can use throwaway tags for your gmail like `vaibhavpardeshi190+emp1@gmail.com` or `cloneindia5771+emp2@gmail.com`).
  - Assign them randomly to the managers you created in Step 1 using the "Reports to" dropdown.
  - Click `Create Team`.
- **Expected:**
  - Similar to Step 1, creation happens quickly via `Promise.all`.
  - Progress toast confirms `2 employees created` almost instantly.
  - Advances smoothly to Step 3 (Summary).

---

## Section 40: End-to-End Success & Login Persistence

> Tests that the admin session remained un-disrupted throughout, and new generated users are valid.

**[Test 40.1] Copy Credentials & Sign Out**
- **Action:**
  - In the "Team created" summary step, verify all 5 users (3 managers, 2 employees) appear in the table.
  - Click `Copy to Clipboard`.
  - Close the dialog.
  - Click your profile name in the bottom left -> `Log out`.
- **Expected:**
  - You are logged out successfully and redirected to `/login`.

**[Test 40.2] Sign In with the Updated Admin Credentials**
- **Action:**
  - Using the credentials from Test 37.2 (`vaibhavpardeshi190@gmail.com` and `NewDemo1234!`), attempt a sign-in.
- **Expected:**
  - Sign-in works flawlessly (proving the password and email change RPC worked).

**[Test 40.3] Sign In as a Newly Created Manager**
- **Action:**
  - Log out again. 
  - Pick one of the real manager emails (`vaibhav.pardeshi@atomberg.com`, etc.) and sign in.
- **Expected:**
  - They log in successfully entirely bypassing Supabase's email confirm constraints. Plus, check that email inbox to confirm the Edge Function's welcome notification actually arrived! 

---
**END OF TEST PLAN**
