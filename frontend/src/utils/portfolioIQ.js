/**
 * Portfolio IQ - Heuristic Analysis Engine 🧠
 * Analyzes portfolio data to generate "Smart Insights" and a Health Score.
 */

export const generatePortfolioInsights = (portfolio, amcData, assetData, sectorData) => {
    if (!portfolio || !portfolio.holdings) return null;

    const insights = [];
    let score = 50; // Base Score

    // --- 1. Performance Analysis (0-20 pts) ---
    const xirr = portfolio.portfolio_xirr || 0;
    const inflationRate = 6.0; // India avg est

    if (xirr > inflationRate) {
        const beatBy = xirr - inflationRate;
        score += Math.min(20, beatBy * 2); // Max 20 pts for beating inflation
        insights.push({
            type: 'success',
            icon: 'TrendingUp',
            title: 'Beating Inflation',
            message: `Your XIRR of ${xirr.toFixed(1)}% is crushing the estimated ${inflationRate}% inflation rate.`
        });
    } else if (xirr > 0) {
        score += 5;
        insights.push({
            type: 'neutral',
            icon: 'Clock',
            title: 'Moderate Growth',
            message: `Your portfolio is positive (${xirr.toFixed(1)}%) but barely beating inflation.`
        });
    } else {
        score -= 10;
        insights.push({
            type: 'warning',
            icon: 'AlertCircle',
            title: 'Underperformance',
            message: `Overall portfolio is generating negative returns. Review asset allocation.`
        });
    }

    // --- 2. Diversification Analysis (0-20 pts) ---
    // Check AMC Concentration
    const topAMC = amcData.length > 0 ? amcData[0] : null; // Already sorted
    if (topAMC && topAMC.value > 0) {
        const totalValue = portfolio.total_current_value;
        const concentration = (topAMC.value / totalValue) * 100;

        if (concentration > 40) {
            score -= 10;
            insights.push({
                type: 'warning',
                icon: 'PieChart',
                title: 'High AMC Concentration',
                message: `You have heavy exposure to ${topAMC.name.split('(')[0].trim()}. Consider diversifying across fund houses.`
            });
        } else {
            score += 10;
        }
    }

    // Check Asset Class Balance (Equity skew is fine, but warn if extreme)
    const equity = assetData.find(a => a.name.toLowerCase().includes('equity'));
    if (equity) {
        const equityPct = (equity.value / portfolio.total_current_value) * 100;
        if (equityPct > 90) {
            insights.push({
                type: 'info',
                icon: 'Zap',
                title: 'Aggressive Profile',
                message: 'Your portfolio is heavily equity-focused. Ensure this matches your risk appetite.'
            });
        }
        if (equityPct > 50 && equityPct < 90) score += 10; // Balanced growth
    }

    // --- 3. Fund Level Analysis ---
    // Star Performer

    const sortedByReturn = [...portfolio.holdings].map(h => ({
        ...h,
        absReturnPct: ((h.current_value - h.invested_amount) / h.invested_amount) * 100
    })).sort((a, b) => b.absReturnPct - a.absReturnPct);

    const star = sortedByReturn[0];
    if (star && star.absReturnPct > 20) {
        insights.push({
            type: 'star',
            icon: 'Award',
            title: 'Star Performer',
            message: `🚀 ${star.scheme_name.split(' - ')[0]} is leading with a stunning ${star.absReturnPct.toFixed(1)}% return.`
        });
    }

    // --- 4. Opportunity Checks ---
    // Buy the Dip (Current NAV < Avg NAV)
    // Find ALL opportunities, sort by discount (descending), pick the best one.
    const dipOpportunities = portfolio.holdings
        .filter(h => h.current_nav < h.average_nav)
        .map(h => ({
            ...h,
            discount: ((h.average_nav - h.current_nav) / h.average_nav) * 100
        }))
        .sort((a, b) => b.discount - a.discount);

    if (dipOpportunities.length > 0) {
        const bestDip = dipOpportunities[0];
        if (bestDip.discount > 1) { // Lowered to 1%
            insights.push({
                type: 'info',
                icon: 'TrendingDown',
                title: 'Buy the Dip',
                message: `📉 ${bestDip.scheme_name.split(' - ')[0]} is trading ${bestDip.discount.toFixed(1)}% below cost.`
            });
            score += 5;
        } else {
            insights.push({ type: 'ghost', icon: 'TrendingDown', title: 'Buy the Dip', message: 'No significant dip opportunities detected.' });
        }
    } else {
        insights.push({ type: 'ghost', icon: 'TrendingDown', title: 'Buy the Dip', message: 'All funds trading above average cost.' });
    }

    // --- 5. Composition Analysis ---
    // Passive/Index funds
    const indexFunds = portfolio.holdings.filter(h => h.scheme_name.toLowerCase().includes('index') || h.scheme_name.toLowerCase().includes('nifty'));
    const passiveValue = indexFunds.reduce((sum, h) => sum + h.current_value, 0);
    const passivePct = (passiveValue / portfolio.total_current_value) * 100;

    if (passivePct > 5) {
        insights.push({
            type: 'success',
            icon: 'Shield',
            title: 'Index Fund Strength',
            message: `🛡️ ${passivePct.toFixed(0)}% of your portfolio is in low-cost Index Funds/ETFs.`
        });
        score += 5;
    } else {
        insights.push({ type: 'ghost', icon: 'Shield', title: 'Index Fund Strength', message: 'Consider low-cost Index Funds for core stability.' });
    }

    // Safety Net (Debt)
    const debt = assetData.find(a => a.name.toLowerCase().includes('debt') || a.name.toLowerCase().includes('liquid'));
    if (!debt || debt.value === 0) {
        score -= 5;
        insights.push({
            type: 'warning',
            icon: 'Umbrella',
            title: 'No Safety Net',
            message: 'You have 0% allocation to Debt/Liquid funds. Consider an emergency cushion.'
        });
    } else {
        insights.push({ type: 'ghost', icon: 'Umbrella', title: 'Safety Net', message: 'Emergency cushion (Debt/Liquid) present.' });
    }

    // Sector/Category Bias
    if (sectorData && sectorData.length > 0) {
        const topSector = sectorData[0];
        if (topSector) {
            const sectorName = topSector.name.split('(')[0].trim();
            const sectorPct = (topSector.value / portfolio.total_current_value) * 100;

            if (sectorPct > 40) {
                insights.push({
                    type: 'info',
                    icon: 'Zap',
                    title: 'Sector Bias',
                    message: `🏗️ Your portfolio is heavily tilted towards ${sectorName} (${sectorPct.toFixed(0)}%).`
                });
            } else {
                score += 5;
                insights.push({ type: 'ghost', icon: 'Zap', title: 'Sector Bias', message: 'Sector allocation appears well-balanced.' });
            }
        }
    }

    return {
        score: Math.min(100, Math.max(0, Math.round(score))),
        items: insights
    };
};
