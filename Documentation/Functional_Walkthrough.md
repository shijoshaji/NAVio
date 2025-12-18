# Functional Walkthrough

## Overview
**NAViō** is designed to be a "Set and Forget" mutual fund tracker. Unlike generic apps, it focuses on entry timing, target analysis, and offline-first privacy.

---

## 🌟 Key Features

### 1. Dashboard
-   **Portfolio Summary**: Total Invested, Current Value, and Day's Change.
-   **Performance Metrics**: XIRR and Absolute Returns.
-   **Trend Analysis**: Visual graphs of your portfolio growth.

### 2. Watchlist (Smart Analysis)
The Watchlist is the power-tool for picking funds.

-   **Live NAV**: Latest price synced from AMFI.
-   **Target Tracking**: Set a "Target Price" and visualize how close you are.
-   **Entry Quality Metrics**:
    -   **vs 52W High**: Shows if you are buying at a discount (Green) or at a peak (Red).
    -   **vs 52W Low**: Shows how far the fund has rallied from its bottom.
-   **Smart Indicators**:
    -   💎 **Diamond**: Indicates a "Value Buy" (deeply below peak).
    -   🎯 **Sniper**: Indicates a "Sniper Entry" (near local bottom).
    -   ⚠️ **Warning**: Indicates "FOMO" risks (buying at All-Time Highs).
-   **Historical Context**: View High/Low dates (e.g., `₹150 (12 Jan)`) to understand seasonality.

### 3. Portfolio Management
-   **Unified View**: See all your SIPs and Lumpsums in one place.
-   **Transaction History**: Edit or Delete individual transaction records.
-   **Add Fund**:
    -   Search by Name (e.g., "HDFC Top 100").
    -   Search by AMC.
    -   Lookup by Scheme Code (for precise addition).

---

## 🛠️ User Workflows

### How to Track a New Fund
1.  Go to **Find Funds**.
2.  Search for the fund name.
3.  Click **"Add to Watchlist"**.
4.  (Optional) Go to Watchlist and set a **Target Price**.

### How to Record an Investment
1.  Go to **Portfolio**.
2.  Click **"Add Transaction"**.
3.  Select the Fund, Enter Amount, Units, and Date.
4.  Click **Save**. The dashboard will instantly update.

### How to Sync NAVs
1.  Click the **"Sync NAV"** button in the top navigation.
2.  Wait for the progress bar.
    -   **Phase 1**: Downloads latest prices.
    -   **Phase 2**: "Self-Healing" runs to fetch missing history for your new funds.
3.  Refresh the page to see updated values.

### How to Manage History (Advanced)
If you started tracking a fund recently but want to analyze it as if you bought it last year:
1.  Go to **Watchlist**.
2.  Click **Edit** (Pencil Icon) on the fund card.
3.  Change the **"Track Start Date"**.
4.  The "Since Tracking" High/Low metrics will now recalculate based on this new start date.
