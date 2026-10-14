# ⏪ How to Restore Header Onboarding & Remove Google Form Footer Link

Follow these instructions to restore the main header "Join" button (directing to `/join`) and remove the temporary Google Form button from the footer.

---

## Step 1: Restore the Main Header "Join" Button
Open [PublicHeader.tsx](file:///z:/HR%20PORTAL/components/common/PublicHeader.tsx):

1. **Desktop View (Around Line 145):**
   Change:
   ```typescript
   className="hidden bg-blue-600 text-white px-4 py-2 ..."
   ```
   Back to:
   ```typescript
   className="bg-blue-600 text-white px-4 py-2 ..."
   ```
   *(Remove the `hidden` class name).*

2. **Mobile Drawer View (Around Line 219):**
   Change:
   ```typescript
   className="hidden w-full bg-blue-600 text-white text-center ..."
   ```
   Back to:
   ```typescript
   className="w-full bg-blue-600 text-white text-center ..."
   ```
   *(Remove the `hidden` class name).*

---

## Step 2: Remove the Google Form Button from the Footer
Open [PublicFooter.tsx](file:///z:/HR%20PORTAL/components/common/PublicFooter.tsx):

1. **Non-Homepage Area (Around Line 77):**
   Remove this `<a>` block:
   ```html
   <a
       href="https://forms.gle/f86UXjTiusatMUVd7"
       target="_blank"
       rel="noopener noreferrer"
       className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-center"
   >
       Join UDF (Apply Online)
   </a>
   ```

2. **Homepage Area (Around Line 89):**
   Remove this `<a>` block:
   ```html
   <a
       href="https://forms.gle/f86UXjTiusatMUVd7"
       target="_blank"
       rel="noopener noreferrer"
       className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-center block"
   >
       Join UDF (Apply Online)
   </a>
   ```
   And restore the Contact button's parent class wrapping if desired.

---

## Step 3: Recompile and Deploy
Run the standard build and deploy commands:
```bash
npm run build
firebase deploy --only hosting
```
Once deployed, the native onboarding flow at `udfonline.in/join` will be completely restored on your header menus, and the Google Form footer link will be removed.
