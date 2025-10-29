const fs = require('fs');
const path = require('path');

class NotesParser {
  constructor() {
    this.sentimentWords = {
      positive: [
        'excellent', 'perfect', 'outstanding', 'reliable', 'good', 'great', 'best', 
        'premium', 'quality', 'flawless', 'accurate', 'competitive', 'solid', 
        'dependable', 'trust', 'worth', 'amazing', 'spectacular', 'unmatched',
        'delivered early', 'zero defects', 'never missed', 'zero rework'
      ],
      negative: [
        'late', 'delayed', 'poor', 'terrible', 'bad', 'issues', 'problems', 
        'failed', 'rejected', 'defects', 'unacceptable', 'mediocre', 'disaster',
        'complained', 'leaked', 'wrong', 'unusable', 'gamble', 'regret',
        'weeks late', 'quality issues', 'delivery issues', 'not happy'
      ],
      neutral: [
        'standard', 'fair', 'acceptable', 'fine', 'okay', 'usual', 'normal',
        'consistent', 'default', 'average'
      ]
    };
  }

  parseNotesFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const notes = [];
    
    // Split content by supplier sections using the separator
    const sections = content.split('================================================================================');
    
    let currentSupplier = null;
    let currentSupplierStatus = null;
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      
      // Skip header and footer sections
      if (!section || section.includes('SUPPLIER PERFORMANCE NOTES') || section.includes('END OF NOTES')) {
        continue;
      }
      
      const lines = section.split('\n').filter(line => line.trim());
      if (lines.length === 0) continue;
      
      // Check if this section starts with a supplier header
      const firstLine = lines[0].trim();
      if (this.isSupplierHeader(firstLine)) {
        currentSupplier = this.extractSupplierName(firstLine);
        currentSupplierStatus = this.extractSupplierStatus(firstLine);
        
        // Process the rest of the lines as notes for this supplier
        const supplierNotes = this.parseNotesForSupplier(lines.slice(1), currentSupplier, currentSupplierStatus);
        notes.push(...supplierNotes);
      } else if (currentSupplier) {
        // This section contains notes for the current supplier
        const supplierNotes = this.parseNotesForSupplier(lines, currentSupplier, currentSupplierStatus);
        notes.push(...supplierNotes);
      }
    }
    
    return notes;
  }

  isSupplierHeader(line) {
    // Check if line looks like a supplier header (all caps with dashes)
    // Allow letters, spaces, slashes, ampersands, parentheses, commas, and other common business name characters
    return /^[A-Z][A-Z\s\/&\(\),]+\s*-\s*[A-Z\s\/\(\),&]+$/.test(line) || 
           /^[A-Z][A-Z\s\/&\(\),]+\s*$/.test(line.replace(/\s+/g, ' ').trim());
  }
  
  parseNotesForSupplier(lines, supplierName, supplierStatus) {
    const notes = [];
    let currentNote = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and special markers
      if (!trimmedLine || trimmedLine.startsWith('**NOTE:') || trimmedLine.startsWith('================')) {
        continue;
      }
      
      if (this.isNoteHeader(trimmedLine)) {
        // Save previous note if exists
        if (currentNote) {
          notes.push(this.finalizeNote(currentNote, supplierName, supplierStatus));
        }
        
        // Start new note
        currentNote = this.parseNoteHeader(trimmedLine);
      } else if (currentNote && trimmedLine) {
        // Add content to current note
        currentNote.content += (currentNote.content ? ' ' : '') + trimmedLine;
      }
    }
    
    // Save last note
    if (currentNote) {
      notes.push(this.finalizeNote(currentNote, supplierName, supplierStatus));
    }
    
    return notes;
  }

  extractSupplierName(headerLine) {
    // Extract supplier name from header like "QUICKFAB INDUSTRIES - CAUTION / HIGH RISK"
    
    // Try different patterns
    let match = headerLine.match(/^([A-Z][A-Z\s\/&]+?)\s*-\s*/);
    if (!match) {
      match = headerLine.match(/^([A-Z][A-Z\s\/&]+?)$/);
    }
    
    if (match) {
      return this.normalizeSupplierName(match[1].trim());
    }
    
    return 'Unknown Supplier';
  }

  normalizeSupplierName(name) {
    const nameMap = {
      'QUICKFAB INDUSTRIES': 'QuickFab Industries',
      'STELLAR METALWORKS': 'Stellar Metalworks',
      'APEX MANUFACTURING': 'Apex Manufacturing Inc',
      'APEX MFG': 'Apex Manufacturing Inc',
      'APEX MFG INC': 'Apex Manufacturing Inc',
      'APEX MANUFACTURING INC': 'Apex Manufacturing Inc',
      'APEX MANUFACTURING / APEX MFG / APEX MFG INC / APEX MANUFACTURING INC': 'Apex Manufacturing Inc',
      'TITANFORGE LLC': 'TitanForge LLC',
      'AEROFLOW SYSTEMS': 'AeroFlow Systems',
      'PRECISION THERMAL CO': 'Precision Thermal Co',
      'GENERAL PROCUREMENT ISSUES': 'General Notes'
    };
    
    return nameMap[name] || this.standardizeCompanyName(name);
  }
  
  standardizeCompanyName(name) {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  extractSupplierStatus(headerLine) {
    if (headerLine.includes('GOLD STANDARD')) return 'GOLD STANDARD';
    if (headerLine.includes('CAUTION') || headerLine.includes('HIGH RISK')) return 'CAUTION';
    if (headerLine.includes('SPECIALIST')) return 'SPECIALIST';
    if (headerLine.includes('NICHE SPECIALIST')) return 'NICHE SPECIALIST';
    if (headerLine.includes('EXPERT')) return 'EXPERT';
    return 'STANDARD';
  }

  isNoteHeader(line) {
    // Check if line is a note header (Email from X, Meeting notes, etc.)
    const patterns = [
      /^Email from \w+/i,
      /^Meeting notes/i,
      /^\w+'s note/i,
      /^\w+'s email/i,
      /^Note:/i
    ];
    
    return patterns.some(pattern => pattern.test(line));
  }

  parseNoteHeader(line) {
    const note = {
      type: 'NOTE',
      author: 'Unknown',
      date: null,
      content: ''
    };
    
    // Extract type
    if (line.toLowerCase().includes('email')) {
      note.type = 'EMAIL';
    } else if (line.toLowerCase().includes('meeting')) {
      note.type = 'MEETING';
    } else if (line.toLowerCase().includes('note')) {
      note.type = 'NOTE';
    }
    
    // Extract author
    const authorMatch = line.match(/(?:Email from|Meeting notes|Note from|email from)\s+(\w+)/i) || 
                       line.match(/(\w+)'s\s+(?:note|email)/i);
    if (authorMatch) {
      note.author = authorMatch[1];
    }
    
    // Extract date
    const dateMatch = line.match(/\(([^)]+)\)/);
    if (dateMatch) {
      note.date = this.parseDate(dateMatch[1]);
    }
    
    return note;
  }

  parseDate(dateStr) {
    // Parse dates like "11/30/2021", "3/5/2022", etc.
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, month, day, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  }

  finalizeNote(note, supplierName, supplierStatus) {
    return {
      ...note,
      supplier_name: supplierName,
      supplier_status: supplierStatus,
      sentiment: this.analyzeSentiment(note.content),
      sentiment_score: this.calculateSentimentScore(note.content),
      keywords: this.extractKeywords(note.content),
      created_at: new Date().toISOString()
    };
  }

  analyzeSentiment(text) {
    const lowerText = text.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    
    // Count positive words
    this.sentimentWords.positive.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) positiveScore += matches.length;
    });
    
    // Count negative words
    this.sentimentWords.negative.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) negativeScore += matches.length;
    });
    
    // Determine sentiment
    if (positiveScore > negativeScore) return 'POSITIVE';
    if (negativeScore > positiveScore) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  calculateSentimentScore(text) {
    const lowerText = text.toLowerCase();
    let score = 0;
    
    // Add points for positive words
    this.sentimentWords.positive.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) score += matches.length;
    });
    
    // Subtract points for negative words
    this.sentimentWords.negative.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) score -= matches.length;
    });
    
    // Normalize to -1 to 1 scale
    return Math.max(-1, Math.min(1, score / 10));
  }

  extractKeywords(text) {
    const keywords = [];
    const lowerText = text.toLowerCase();
    
    // Quality-related keywords
    const qualityKeywords = ['quality', 'defects', 'rework', 'rejection', 'perfect', 'excellent'];
    qualityKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) keywords.push(keyword);
    });
    
    // Delivery-related keywords
    const deliveryKeywords = ['late', 'early', 'delivery', 'deadline', 'on time', 'delayed'];
    deliveryKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) keywords.push(keyword);
    });
    
    // Pricing-related keywords
    const pricingKeywords = ['price', 'cost', 'expensive', 'cheap', 'premium', 'competitive'];
    pricingKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) keywords.push(keyword);
    });
    
    return keywords.slice(0, 5); // Limit to top 5 keywords
  }
}

module.exports = NotesParser;