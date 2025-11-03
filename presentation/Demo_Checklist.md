# Demo Checklist for CADDi Presentation

## Pre-Demo Setup (15 minutes before)

### Technical Preparation
- [ ] Start the application: `npm start`
- [ ] Verify http://localhost:3000 loads correctly
- [ ] Test all dashboard charts render properly
- [ ] Verify chatbot responds to test queries
- [ ] Check mobile responsive view works
- [ ] Ensure stable internet connection
- [ ] Close unnecessary browser tabs/applications

### Browser Setup
- [ ] Open Chrome/Safari in presentation mode
- [ ] Bookmark key demo URLs:
  - Main dashboard: http://localhost:3000
  - Mobile view: http://localhost:3000 (with dev tools mobile view)
- [ ] Clear browser cache if needed
- [ ] Test screen sharing/projection

### Demo Data Verification
- [ ] Confirm supplier performance table shows:
  - Stellar Metalworks: A+ rating
  - QuickFab Industries: C- rating
  - Precision Thermal Co: A rating
  - Apex Manufacturing: B+ rating
- [ ] Verify charts display properly:
  - Quality trends over time
  - Delivery performance metrics
  - Pricing analysis

## Demo Flow Checklist

### 1. Opening Statement (30 seconds)
- [ ] "Let me show you exactly how this solves your $4M supplier decision problem"
- [ ] "This is your real data from the CSV files, running live"

### 2. Dashboard Overview (2 minutes)
- [ ] Point to supplier performance table
- [ ] Highlight Stellar Metalworks A+ rating
- [ ] Show QuickFab Industries C- rating and issues
- [ ] Mention "This is exactly the visibility you needed"

### 3. Interactive Charts (1 minute)
- [ ] Click on quality trends chart
- [ ] Show delivery performance over time
- [ ] Point out clear patterns in the data

### 4. AI Chatbot Demo (3 minutes)
- [ ] Type: "Who is the best supplier?"
- [ ] Show Stellar Metalworks recommendation
- [ ] Type: "Tell me about QuickFab Industries"
- [ ] Show warning about delivery issues
- [ ] Type: "Show me quality metrics"
- [ ] Display interactive charts
- [ ] Emphasize: "Natural language, instant answers"

### 5. Mobile Responsive Demo (1 minute)
- [ ] Open browser dev tools
- [ ] Switch to mobile view (iPhone/iPad)
- [ ] Show dashboard works on mobile
- [ ] Mention: "Your team can use this on the shop floor"

### 6. Closing Statement (30 seconds)
- [ ] "Ready to deploy today"
- [ ] "Use it for your 3-week sourcing decision"
- [ ] "Pays for itself by avoiding one bad supplier choice"

## Backup Demo Scenarios

### If Chatbot Doesn't Respond
- [ ] Refresh the page
- [ ] Try simpler query: "best supplier"
- [ ] Fall back to showing the supplier table directly

### If Charts Don't Load
- [ ] Refresh the page
- [ ] Show the raw data in the supplier table
- [ ] Explain what the charts would show

### If Mobile View Issues
- [ ] Use actual mobile device as backup
- [ ] Or explain responsive design without showing

## Key Talking Points During Demo

### Dashboard View
- "See how Stellar Metalworks has never missed a delivery"
- "QuickFab has been late on 8 out of 9 orders"
- "This data was scattered across Excel files before"

### Chatbot Interaction
- "No training needed - just ask in plain English"
- "It's using your actual order history and quality data"
- "Instant access to tribal knowledge"

### Mobile View
- "Works on any device - phone, tablet, laptop"
- "Your procurement team can check supplier history anywhere"
- "No more waiting to get back to the office"

## Technical Troubleshooting

### If Application Won't Start
- [ ] Check if port 3000 is in use: `lsof -i :3000`
- [ ] Kill conflicting process: `kill -9 <PID>`
- [ ] Restart: `npm start`

### If Database Issues
- [ ] Check if data files exist in `/data` directory
- [ ] Restart application to reinitialize database
- [ ] Verify CSV files are properly formatted

### If Charts Don't Render
- [ ] Check browser console for JavaScript errors
- [ ] Verify Chart.js library loaded correctly
- [ ] Refresh page to reload chart data

## Post-Demo Q&A Preparation

### Expected Questions & Answers

**Q: "What about data security?"**
A: "Built with security best practices - input validation, SQL injection prevention, HTTPS ready."

**Q: "How do we get our data in?"**
A: "Simple CSV import process. We can help migrate from Sarah's spreadsheets."

**Q: "What if we need changes?"**
A: "Designed for easy customization. We can add new metrics or modify scoring algorithms."

**Q: "How much will this cost to run?"**
A: "Minimal ongoing costs - just server hosting. Under $100/month for your usage."

## Success Metrics

### Demo Considered Successful If:
- [ ] Application runs smoothly throughout
- [ ] All key features demonstrated
- [ ] Audience asks technical questions (shows engagement)
- [ ] Clear connection made between solution and their $4M problem
- [ ] Timeline and budget constraints addressed

### Red Flags to Avoid:
- [ ] Technical failures during demo
- [ ] Focusing too much on technology vs business value
- [ ] Not addressing their specific supplier examples
- [ ] Going over time limit
- [ ] Not connecting to their 3-week deadline