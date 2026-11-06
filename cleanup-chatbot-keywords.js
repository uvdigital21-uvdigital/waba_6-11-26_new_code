import { pool } from './backend/backend/src/config/db.js';

async function cleanupKeywords() {
  console.log('=== Cleaning up chatbot_keywords table ===');
  const connection = await pool.getConnection();
  try {
    const [flows] = await connection.query('SELECT id, name FROM chatbot_flows');
    console.log(`Found ${flows.length} flows to synchronize`);

    for (const flow of flows) {
      const [startNodes] = await connection.query(
        `SELECT data FROM chatbot_nodes WHERE flow_id = ? AND type = 'starting_keyword'`,
        [flow.id]
      );

      const realKeywords = new Set();
      for (const node of startNodes) {
        let d = {};
        try {
          d = typeof node.data === 'string' ? JSON.parse(node.data) : (node.data || {});
        } catch (e) {}

        if (Array.isArray(d.keywords)) {
          for (const kw of d.keywords) {
            if (kw && typeof kw === 'string' && kw.trim()) {
              realKeywords.add(kw.trim().toLowerCase());
            }
          }
        }
      }

      console.log(`Flow ID ${flow.id} ("${flow.name}") starting node keywords:`, Array.from(realKeywords));

      // Remove existing keywords for this flow
      await connection.execute(`DELETE FROM chatbot_keywords WHERE flow_id = ?`, [flow.id]);

      // Re-insert clean distinct keywords
      for (const kw of realKeywords) {
        await connection.execute(
          `INSERT INTO chatbot_keywords (flow_id, keyword) VALUES (?, ?)`,
          [flow.id, kw]
        );
      }
    }

    // Try to ensure unique key on (flow_id, keyword)
    try {
      await connection.query(
        `ALTER TABLE chatbot_keywords ADD UNIQUE KEY uq_flow_keyword (flow_id, keyword)`
      );
      console.log('✓ Added unique constraint uq_flow_keyword on chatbot_keywords');
    } catch (idxErr) {
      if (idxErr.message.includes('Duplicate key name') || idxErr.code === 'ER_DUP_KEYNAME') {
        console.log('✓ Unique constraint already exists on chatbot_keywords');
      } else {
        console.warn('Note on index creation:', idxErr.message);
      }
    }

    // Check final state
    const [finalKws] = await connection.query('SELECT * FROM chatbot_keywords ORDER BY flow_id ASC');
    console.log('Final clean chatbot_keywords:', finalKws);

    console.log('=== Cleanup completed successfully ===');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

cleanupKeywords();
