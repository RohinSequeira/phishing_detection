// Configuration template for the Phishing Detection Extension
// Copy this file to config.js and replace the placeholder with your actual API key

const config = {
    // Get your API key from https://console.cloud.google.com/
    GEMINI_API_KEY: 'your_api_key_here',
    
    // API endpoint (don't change unless specified by Google)
    GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
};

// Export the configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
} else {
    // For browser environment
    window.config = config;
} 