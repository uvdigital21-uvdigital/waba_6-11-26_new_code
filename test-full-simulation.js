import { FlowExecutor } from './src/services/FlowExecutor.js';
import { pool } from './src/config/db.js';

async function runFullSimulation() {
  const targetPhone = '919913847423';
  console.log('====================================================');
  console.log('STARTING COMPLETE END-TO-END START-GATE SIMULATION');
  console.log('====================================================');

  // Step 0: Clear sessions
  await pool.execute('DELETE FROM chatbot_user_sessions WHERE phone = ?', [targetPhone]);

  // Test 1: User sends "hi" -> Should receive Start Gate button
  console.log('\n--- TEST 1: User types "hi" in chat ---');
  const res1 = await FlowExecutor.execute({
    wamid: 'test_hi_gate_' + Date.now(),
    phone: targetPhone,
    inputStr: 'hi'
  });
  console.log('Result 1 (Start Gate):', res1);

  // Check current session state
  const [s1] = await pool.execute('SELECT * FROM chatbot_user_sessions WHERE phone = ?', [targetPhone]);
  console.log('Session state after "hi":', s1);

  // Test 2: User clicks "▶ Start" button
  console.log('\n--- TEST 2: User clicks "▶ Start" button ---');
  const res2 = await FlowExecutor.execute({
    wamid: 'test_start_click_' + Date.now(),
    phone: targetPhone,
    inputStr: '▶ Start',
    buttonPayload: 'start_chat'
  });
  console.log('Result 2 (Flow Execution):', res2);

  // Check current session state
  const [s2] = await pool.execute('SELECT * FROM chatbot_user_sessions WHERE phone = ?', [targetPhone]);
  console.log('Session state after "▶ Start":', s2);

  // Test 3: User clicks "Yes" button (btn_1)
  console.log('\n--- TEST 3: User clicks "Yes" button ---');
  const res3 = await FlowExecutor.execute({
    wamid: 'test_yes_click_' + Date.now(),
    phone: targetPhone,
    inputStr: 'Yes',
    buttonPayload: 'btn_1'
  });
  console.log('Result 3 (Media + Services + URL Button):', res3);

  // Test 4: New message "anything" -> Starts Gate again
  await pool.execute('DELETE FROM chatbot_user_sessions WHERE phone = ?', [targetPhone]);
  console.log('\n--- TEST 4: User types "anything" in chat ---');
  const res4 = await FlowExecutor.execute({
    wamid: 'test_anything_' + Date.now(),
    phone: targetPhone,
    inputStr: 'anything'
  });
  console.log('Result 4 (Start Gate):', res4);

  // Test 5: Click "▶ Start" then "No"
  console.log('\n--- TEST 5: User clicks "▶ Start" then "No" ---');
  await FlowExecutor.execute({
    wamid: 'test_start_click2_' + Date.now(),
    phone: targetPhone,
    inputStr: '▶ Start',
    buttonPayload: 'start_chat'
  });

  const res5 = await FlowExecutor.execute({
    wamid: 'test_no_click_' + Date.now(),
    phone: targetPhone,
    inputStr: 'No',
    buttonPayload: 'btn_1785401624059'
  });
  console.log('Result 5 (No response):', res5);

  console.log('\n====================================================');
  console.log('ALL SIMULATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

runFullSimulation().catch(err => {
  console.error('Simulation Failed:', err);
  process.exit(1);
});
