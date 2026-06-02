import dotenv from 'dotenv';
dotenv.config();
import { query } from './config/database.js';

async function test() {
  try {
    const days = 30;
    const regionalData = await query(`
      SELECT 
        COALESCE(s.region, 'Unknown') as region,
        SUM(s.total_amount) as revenue,
        COUNT(*) as orders,
        SUM(s.quantity) as units_sold
      FROM sales s
      WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY s.region
      ORDER BY revenue DESC
    `, [days]);

    console.log('Raw DB query result:', regionalData);

    const totalRevenue = regionalData.reduce((sum, r) => sum + Number(r.revenue || 0), 0);
    console.log('Calculated totalRevenue:', totalRevenue);

    const formatted = (regionalData || []).map(reg => {
      const revenue = Number(reg.revenue) || 0;
      const pct = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;
      return {
        name: reg.region || 'Unknown',
        value: pct,
        revenue: revenue,
        growth: 0,
        orders: reg.orders || 0
      };
    });

    console.log('Formatted regional data:', formatted);
  } catch (err) {
    console.error(err);
  }
  process.exit();
}

test();
