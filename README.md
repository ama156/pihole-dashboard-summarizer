# Pi-hole Dashboard Summarizer

A modern, client-side dashboard for analyzing Pi-hole DNS queries with automatic app/service identification using Netify's domain database. Transform your Pi-hole logs into actionable insights - no server required!

![Dashboard Preview](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow) ![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple)

## 🚀 Features

### 📊 **DNS Query Summarization**
- Aggregate Pi-hole queries by user IP and time range (5 minutes to 24 hours)
- Real-time statistics with live updates every 10 seconds
- Comprehensive blocked vs allowed query visualization
- Smart domain grouping and traffic pattern analysis

### 🔍 **Intelligent App Detection**
- **Automatic app/service identification** using Netify's domain database
- **Custom app mapping** - define your own domain-to-app relationships
- **Smart caching system** - domains cached locally for instant subsequent lookups
- **Bulk import** - add multiple domains for custom apps via text input

### 🎛️ **Advanced Filtering & Summarization**
- **Text search** - filter summaries by app/service name
- **Status filtering** - show only blocked or allowed queries
- **Include/Exclude filters** - multi-select dropdown for precise control
- **Apps-only mode** - group domains by application for cleaner analysis
- **Real-time filtering** - instant results as you type

### 📈 **Rich Data Visualizations**
- **Interactive pie chart** - app/service distribution summary
- **Bar chart** - blocked vs allowed requests overview
- **Responsive design** - works on desktop, tablet, and mobile
- **Dark/Light theme** - automatic theme persistence

### ⚡ **Performance & Reliability**
- **Client-side only** - no server dependencies, pure browser-based
- **Smart caching** - 7-day cache with LRU cleanup for optimal performance
- **CORS proxy support** - works with any Pi-hole instance
- **Offline functionality** - cached domains work without internet
- **Progressive loading** - cached domains load instantly, new ones fetch in background

## 🛠️ Installation & Setup

### **Option 1: Download and Run Locally**
```bash
# Clone the repository
git clone https://github.com/ama156/pihole-dashboard-summarizer.git
cd pihole-dashboard-summarizer

# Open in browser (no build step required!)
open index.html
# OR serve with any static file server
python -m http.server 8000
