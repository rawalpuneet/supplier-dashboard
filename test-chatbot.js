const Database = require('./database');
const SupplierChatbot = require('./chatbot');

async function testChatbot() {
  console.log('Testing chatbot functionality...');
  
  try {
    // Initialize database
    const db = new Database();
    await db.loadData();
    console.log('✓ Database loaded');
    
    // Initialize chatbot
    const chatbot = new SupplierChatbot(db);
    await chatbot.initialize();
    console.log('✓ Chatbot initialized');
    
    // Test queries
    const testQueries = [
      'Who is the best supplier?',
      'Show me quality metrics',
      'Tell me about delivery performance',
      'What about QuickFab Industries?'
    ];
    
    for (const query of testQueries) {
      console.log(`\n--- Testing: "${query}" ---`);
      const response = await chatbot.processQuery(query);
      console.log('Response type:', response.type);
      console.log('Message:', response.message);
      if (response.data) {
        console.log('Data length:', Array.isArray(response.data) ? response.data.length : 'Not array');
      }
    }
    
    console.log('\n✓ All tests completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testChatbot();