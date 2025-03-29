// Function to extract email content based on the email provider
function extractEmailContent() {
    let emailContent = {
        subject: '',
        body: '',
        sender: '',
        links: []
    };

    console.log('Starting email content extraction...');

    // Gmail
    if (window.location.hostname.includes('mail.google.com')) {
        // Get email subject
        const subjectElement = document.querySelector('h2.hP');
        if (subjectElement) {
            emailContent.subject = subjectElement.textContent.trim();
        }

        // Get email body
        const bodySelectors = ['.a3s.aiL', '.a3s.aiL .ii.gt', '.ii.gt'];
        let bodyElement = null;
        
        for (const selector of bodySelectors) {
            bodyElement = document.querySelector(selector);
            if (bodyElement) break;
        }

        if (bodyElement) {
            emailContent.body = bodyElement.innerText.trim();
            
            // Get all links
            const links = bodyElement.querySelectorAll('a');
            links.forEach(link => {
                if (link.href && !link.href.startsWith('mailto:')) {
                    emailContent.links.push({
                        url: link.href,
                        text: link.textContent.trim()
                    });
                }
            });
        }

        // Get sender
        const senderSelectors = ['.gD', '.go', '[email]', '.from'];
        let senderElement = null;

        for (const selector of senderSelectors) {
            senderElement = document.querySelector(selector);
            if (senderElement) break;
        }

        if (senderElement) {
            emailContent.sender = senderElement.getAttribute('email') || senderElement.textContent.trim();
        }
    }

    return emailContent;
}

// Function to analyze text context using Gemini
async function analyzeTextContext(text, type, patterns = [], emailContent = null) {
    const apiKey = window.config?.GEMINI_API_KEY;
    const apiUrl = window.config?.GEMINI_URL;

    if (!apiKey || apiKey === 'your_api_key_here') {
        console.error('Gemini API key not configured');
        return null;
    }

    const prompt = {
        text: `You are a cybersecurity expert analyzing an email ${type} for phishing attempts. This is a critical security task.

Suspicious patterns found: ${patterns.join(', ')}

Analyze the following aspects and respond ONLY with a JSON object (no markdown formatting, no backticks):

1. SENDER LEGITIMACY:
- Is the sender's domain consistent with the claimed organization?
- Are there subtle misspellings or unusual characters?

2. CONTENT ANALYSIS:
- Does it request sensitive information (passwords, financial details)?
- Are there unexpected account warnings or threats?
- Is there artificial urgency or pressure?
- Does the tone match legitimate business communication?

3. LINK ANALYSIS:
- Are URLs consistent with the claimed organization?
- Are there shortened or obscured links?

4. RED FLAGS:
- Grammatical errors or inconsistent formatting
- Generic greetings or unusual personalization
- Mismatched sender names and email addresses
- Requests to verify accounts or provide credentials
- Threats about account suspension or closure
- Unrealistic offers or rewards

5. LEGITIMATE BUSINESS CONTEXT:
- Is this a standard business notification?
- Are sensitive terms used in appropriate context?
- Is any urgency justified by real business needs?

Required JSON response format (no additional text or formatting):
{
    "isPotentialPhishing": boolean,
    "confidence": number between 0 and 1,
    "reasoning": "detailed explanation string",
    "contextualFlags": ["list", "of", "flags"],
    "legitimateContext": boolean,
    "legitimateReason": "explanation if legitimate",
    "riskLevel": "high/medium/low",
    "suspiciousElements": ["list", "of", "suspicious", "elements"]
}

Text to analyze: "${text}"
${emailContent ? `\nAdditional context - Sender: ${emailContent.sender}, Subject: ${emailContent.subject}` : ''}`
    };

    try {
        const response = await fetch(`${apiUrl}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt.text }] }]
            })
        });

        if (!response.ok) throw new Error('Gemini API request failed');

        const data = await response.json();
        let responseText = data.candidates[0].content.parts[0].text;
        responseText = responseText.replace(/```json\s*|\s*```/g, '').trim();
        responseText = responseText.replace(/^[`\s]+|[`\s]+$/g, '');

        const analysisResult = JSON.parse(responseText);
        const requiredFields = ['isPotentialPhishing', 'confidence', 'reasoning', 'contextualFlags', 'riskLevel'];
        
        if (requiredFields.some(field => !(field in analysisResult))) {
            console.error('Missing required fields in analysis result');
            return null;
        }

        return analysisResult;
    } catch (error) {
        console.error('Error analyzing context with Gemini:', error);
        return null;
    }
}

// Function to analyze email content
async function analyzeEmail(emailContent) {
    let highRiskFactors = [];
    let warnings = [];
    let contextualAnalysis = [];

    // Function to get surrounding context
    function getContext(text, matchIndex, matchLength) {
        const contextLength = 50;
        const start = Math.max(0, matchIndex - contextLength);
        const end = Math.min(text.length, matchIndex + matchLength + contextLength);
        return text.substring(start, end).trim();
    }

    // Check subject patterns
    if (emailContent.subject) {
        const subjectLower = emailContent.subject.toLowerCase();
        const highRiskSubjectPatterns = [
            'account.*suspended', 'security.*breach', 'unauthorized.*access',
            'immediate.*action.*required', 'verify.*account.*now', 'urgent.*update',
            'account.*blocked', 'unusual.*activity'
        ];

        const subjectPatternMatches = highRiskSubjectPatterns
            .map(pattern => {
                const match = subjectLower.match(new RegExp(pattern, 'i'));
                return match ? {
                    pattern,
                    matched: match[0],
                    context: emailContent.subject
                } : null;
            })
            .filter(Boolean);

        if (subjectPatternMatches.length > 0) {
            const subjectAnalysis = await analyzeTextContext(
                emailContent.subject, 
                'subject',
                subjectPatternMatches.map(m => m.matched),
                emailContent
            );

            if (subjectAnalysis?.riskLevel === 'high' || 
                (subjectAnalysis?.isPotentialPhishing && subjectAnalysis?.confidence > 0.6)) {
                highRiskFactors.push({
                    type: 'subject',
                    detail: `Suspicious subject: "${emailContent.subject}"`,
                    reason: subjectAnalysis.reasoning,
                    confidence: subjectAnalysis.confidence,
                    patterns: subjectPatternMatches
                });
            }
        }
    }

    // Check body patterns
    if (emailContent.body) {
        const bodyLower = emailContent.body.toLowerCase();
        const patterns = [
            // Sensitive info patterns
            'password', 'credit card', 'social security', 'bank account',
            'verify.*identity', 'confirm.*account', 'ssn', 'login.*credentials',
            // Pressure patterns
            'within.*24 hours', 'account.*suspended', 'limited time',
            'immediate action', 'urgent', 'expires soon', 'act now',
            'failure to respond', 'account.*terminated'
        ];

        const bodyPatternMatches = patterns
            .map(pattern => {
                const match = bodyLower.match(new RegExp(pattern, 'i'));
                return match ? {
                    pattern,
                    matched: match[0],
                    context: getContext(emailContent.body, match.index, match[0].length)
                } : null;
            })
            .filter(Boolean);

        if (bodyPatternMatches.length > 0) {
            const bodyAnalysis = await analyzeTextContext(
                emailContent.body,
                'body',
                bodyPatternMatches.map(m => m.matched),
                emailContent
            );

            if (bodyAnalysis?.riskLevel === 'high' || 
                (bodyAnalysis?.isPotentialPhishing && bodyAnalysis?.confidence > 0.6)) {
                highRiskFactors.push({
                    type: 'content',
                    detail: 'Suspicious content detected',
                    reason: bodyAnalysis.reasoning,
                    confidence: bodyAnalysis.confidence,
                    patterns: bodyPatternMatches
                });
            } else if (bodyAnalysis?.riskLevel === 'medium' || 
                      (bodyAnalysis?.isPotentialPhishing && bodyAnalysis?.confidence > 0.4)) {
                warnings.push({
                    type: 'content',
                    detail: 'Potentially suspicious content',
                    reason: bodyAnalysis.reasoning,
                    confidence: bodyAnalysis.confidence,
                    patterns: bodyPatternMatches
                });
            }
        }
    }

    // Check links
    if (emailContent.links.length > 0) {
        const suspiciousUrlPatterns = [
            'bit\\.ly', 'tinyurl', 'goo\\.gl', 'tiny\\.cc',
            'click\\.here', 'verify.*account', 'login.*secure',
            '\\.xyz/', '\\.info/', 'account.*verify', 'secure.*login'
        ];

        const suspiciousLinks = emailContent.links
            .map(link => {
                const linkLower = link.url.toLowerCase();
                const matchedPattern = suspiciousUrlPatterns.find(pattern => 
                    linkLower.match(new RegExp(pattern)));
                return matchedPattern ? {
                    url: link.url,
                    pattern: matchedPattern,
                    text: link.text
                } : null;
            })
            .filter(Boolean);

        if (suspiciousLinks.length > 0) {
            highRiskFactors.push({
                type: 'links',
                detail: 'Suspicious links detected',
                links: suspiciousLinks
            });
        }
    }

    return { highRiskFactors, warnings, contextualAnalysis };
}

// Function to report phishing email
async function reportPhishing() {
    try {
        // Create a modal dialog to guide the user
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 400px;
            text-align: center;
        `;

        content.innerHTML = `
            <h3 style="color: #d93025; margin-bottom: 15px;">Report Phishing Email</h3>
            <p style="margin-bottom: 20px;">To report this email as phishing:</p>
            <ol style="text-align: left; margin-bottom: 20px;">
                <li>Click the three dots (⋮) menu in the top-right corner of the email</li>
                <li>Select "Report phishing" from the menu</li>
                <li>Confirm the report in the popup window</li>
            </ol>
            <p style="margin-bottom: 20px;">This will help Gmail protect you and others from similar phishing attempts.</p>
            <button id="closeModalBtn" style="
                background: #d93025;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
            ">Close</button>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Add click handlers
        const closeBtn = content.querySelector('#closeModalBtn');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        // Close when clicking outside the modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

    } catch (error) {
        console.error('Error reporting phishing:', error);
        alert('Error reporting phishing: ' + error.message);
    }
}

// Update message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractEmailContent") {
        try {
            const emailContent = extractEmailContent();
            console.log('Content script: Extracted email content:', emailContent);
            sendResponse(emailContent);  // Make sure we send the response
        } catch (error) {
            console.error('Content script: Error extracting email content:', error);
            sendResponse({ error: error.message });
        }
        return true;  // This is crucial - it tells Chrome to keep the message channel open
    }
    
    if (request.action === "getEmailContent") {
        (async () => {
            try {
                const emailContent = extractEmailContent();
                const analysis = await analyzeEmail(emailContent);
                sendResponse(analysis);
            } catch (error) {
                console.error('Error in content script:', error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }
    if (request.action === "reportPhishing") {
        (async () => {
            try {
                await reportPhishing();
                sendResponse({ success: true });
            } catch (error) {
                console.error('Error reporting phishing:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    if (request.action === "analyzeEmail") {
        (async () => {
            try {
                console.log('Content script: Received analyzeEmail request with:', request.emailContent);
                if (!request.emailContent) {
                    console.error('Content script: No email content provided');
                    sendResponse({ error: 'No email content provided' });
                    return;
                }
                const analysis = await analyzeEmail(request.emailContent);
                console.log('Content script: Analysis complete:', analysis);
                sendResponse(analysis);
            } catch (error) {
                console.error('Content script: Error in analyzeEmail:', error);
                sendResponse({ error: error.message });
            }
        })();
        return true;  // This is crucial - it tells Chrome to keep the message channel open
    }
    return true;
}); 

