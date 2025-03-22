# Email Phishing Detection Extension

A Chrome extension that uses AI-powered analysis to detect potential phishing attempts in emails.

## Features

- Real-time email analysis using Google's Gemini AI
- Pattern-based detection of suspicious elements
- Contextual analysis of email content
- Risk level assessment (High, Suspicious, Low)
- Detailed analysis of suspicious elements
- Actionable security recommendations

## How It Works

1. **Email Analysis**: The extension analyzes:
   - Email subject
   - Email body content
   - Sender information
   - Links in the email

2. **Risk Assessment**: Provides a clear risk level indicator:
   - 🔴 High Risk - Likely Phishing Attempt
   - 🟡 Suspicious - Exercise Caution
   - 🟢 Low Risk - No Obvious Red Flags

3. **Detailed Analysis**: Shows:
   - Comprehensive breakdown of detected issues
   - Clear explanations of suspicious elements
   - Analysis of potentially malicious links

4. **Security Recommendations**: Provides actionable advice based on risk level

## Supported Email Providers
- Gmail
- Outlook
- Yahoo Mail

## Setup

1. Clone the repository:
```bash
git clone https://github.com/RohinSequeira/phishing_detection.git
```

2. Configure your API key:
   - Copy `config.template.js` to `config.js`
   - Add your Gemini API key to `config.js`
   - Keep `config.js` in `.gitignore` to protect your API key

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## Usage

1. Open an email in your supported email provider
2. Click the extension icon
3. Click "Scan Email" to analyze
4. Review the risk assessment and recommendations
5. Check detailed analysis of any detected issues

## Security Notes

- The extension requires a Gemini API key
- API keys are stored locally and never shared
- No email content is stored or transmitted except for analysis
- All analysis is performed in real-time

## Dependencies

- Google Gemini API for AI analysis
- Chrome Extension APIs
- Modern browser with JavaScript enabled

## Privacy

The extension:
- Only accesses email content when scanning is initiated
- Does not store or transmit email content
- Uses secure API calls for analysis
- Respects user privacy and data security

## Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.

## Technical Details

### Files Structure
- `manifest.json` - Extension configuration
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality and UI handling
- `content.js` - Email analysis and content processing
- `images/` - Extension icons

### Detection Methods
1. Pattern-based Detection:
   - Suspicious sender domains
   - Urgency keywords in subject
   - Suspicious URL patterns
   - Common phishing phrases
   - Generic greetings
   - Time pressure tactics
   - Requests for sensitive information

2. AI-Powered Contextual Analysis:
   - Uses Google Gemini Flash 2.0 for advanced text analysis
   - Evaluates context and intent of suspicious content
   - Provides confidence scores for detected threats
   - Identifies subtle manipulation tactics
   - Reduces false positives from legitimate urgent communications

### API Configuration
To use the Gemini API integration:

1. Obtain a Gemini API key from the [Google Cloud Console](https://console.cloud.google.com/)
2. In your extension directory:
   - Copy the template configuration file:
     ```bash
     cp config.template.js config.js
     ```
   - Edit `config.js` and replace `'your_api_key_here'` with your actual API key
3. The extension will automatically use the API key for contextual analysis

⚠️ **Security Note**: 
- Never commit your `config.js` file to version control
- The file is already listed in `.gitignore`
- Always use `config.template.js` as a reference for the required structure

## Security Considerations

- The extension runs entirely in your browser
- No email content is sent to external servers
- All analysis is performed locally
- No sensitive information is collected or stored

## Future Enhancements

- [x] AI-powered contextual analysis using Google Gemini
- [ ] Support for more email providers
- [ ] Custom rules configuration
- [ ] Historical analysis tracking
- [ ] Bulk email scanning
- [ ] Integration with known phishing databases
- [ ] Export and reporting features

 
