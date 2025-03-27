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
async function reportPhishingEmail(messageId) {
    try {
        // Send message to background script to handle the API call
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { 
                    action: "reportPhishing",
                    messageId: messageId
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve(response);
                }
            );
        });

        return response;
    } catch (error) {
        console.error('Error reporting phishing:', error);
        return { success: false, error: error.message };
    }
}

// Function to get current email message ID
function getCurrentEmailMessageId() {
    if (window.location.hostname.includes('mail.google.com')) {
        console.log('Current URL:', window.location.href);
        console.log('Current pathname:', window.location.pathname);
        console.log('Current hash:', window.location.hash);
        
        // Try different URL patterns
        const url = window.location.href;
        
        // Pattern 1: /mail/u/0/#inbox/[messageId]
        const inboxMatch = url.match(/\/mail\/u\/\d+\/#inbox\/([a-zA-Z0-9]+)/);
        if (inboxMatch) {
            const messageId = inboxMatch[1];
            console.log('Found inbox match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from inbox pattern:', messageId);
                return messageId;
            }
        }
        
        // Pattern 2: /mail/u/0/#search/[messageId]
        const searchMatch = url.match(/\/mail\/u\/\d+\/#search\/([a-zA-Z0-9]+)/);
        if (searchMatch) {
            const messageId = searchMatch[1];
            console.log('Found search match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from search pattern:', messageId);
                return messageId;
            }
        }

        // Pattern 3: /mail/u/0/#search/from%3A+email/CllgCJvnrrSWfJdQHhrcSgKKsbgdmhKvbdZcSQMbNSpKrZVKbBtjfqHgQCJMgcNhqKBFWgMGGVB
        const searchResultMatch = url.match(/\/mail\/u\/\d+\/#search\/[^/]+\/([a-zA-Z0-9]+)/);
        if (searchResultMatch) {
            const messageId = searchResultMatch[1];
            console.log('Found search result match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from search result pattern:', messageId);
                return messageId;
            }
        }
        
        // Pattern 4: /mail/u/0/#inbox/[messageId]?compose=
        const composeMatch = url.match(/\/mail\/u\/\d+\/#inbox\/([a-zA-Z0-9]+)\?compose=/);
        if (composeMatch) {
            const messageId = composeMatch[1];
            console.log('Found compose match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from compose pattern:', messageId);
                return messageId;
            }
        }
        
        // Pattern 5: URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const messageId = urlParams.get('messageid') || urlParams.get('id');
        if (messageId) {
            console.log('Found URL parameter match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from URL parameters:', messageId);
                return messageId;
            }
        }
        
        // Pattern 6: Try to get from the email view
        const emailView = document.querySelector('[data-message-id]');
        if (emailView) {
            const messageId = emailView.getAttribute('data-message-id');
            console.log('Found email view match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from email view:', messageId);
                return messageId;
            }
        }

        // Pattern 7: Try to get from the message thread
        const messageThread = document.querySelector('[data-thread-id]');
        if (messageThread) {
            const threadId = messageThread.getAttribute('data-thread-id');
            console.log('Found thread match:', threadId);
            if (isValidMessageId(threadId)) {
                console.log('Valid thread ID:', threadId);
                return threadId;
            }
        }

        // Pattern 8: Try to get from the message header
        const messageHeader = document.querySelector('.h7');
        if (messageHeader) {
            const messageId = messageHeader.getAttribute('data-message-id');
            console.log('Found header match:', messageId);
            if (messageId && isValidMessageId(messageId)) {
                console.log('Valid message ID from header:', messageId);
                return messageId;
            }
        }

        // Pattern 9: Try to get from the message container
        const messageContainer = document.querySelector('.a3s.aiL');
        if (messageContainer) {
            const messageId = messageContainer.closest('[data-message-id]')?.getAttribute('data-message-id');
            console.log('Found container match:', messageId);
            if (messageId && isValidMessageId(messageId)) {
                console.log('Valid message ID from container:', messageId);
                return messageId;
            }
        }

        // Pattern 10: Try to get from the message list item
        const messageListItem = document.querySelector('.UI table tr[data-thread-id]');
        if (messageListItem) {
            const messageId = messageListItem.getAttribute('data-thread-id');
            console.log('Found list item match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from list item:', messageId);
                return messageId;
            }
        }

        // Pattern 11: Try to get from the message view container
        const messageViewContainer = document.querySelector('.a3s.aiL').closest('[data-message-id]');
        if (messageViewContainer) {
            const messageId = messageViewContainer.getAttribute('data-message-id');
            console.log('Found view container match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from view container:', messageId);
                return messageId;
            }
        }

        // Pattern 12: Try to get from the search result container
        const searchResultContainer = document.querySelector('.UI table tr[data-thread-id]');
        if (searchResultContainer) {
            const messageId = searchResultContainer.getAttribute('data-thread-id');
            console.log('Found search result container match:', messageId);
            if (isValidMessageId(messageId)) {
                console.log('Valid message ID from search result container:', messageId);
                return messageId;
            }
        }

        // Log all data-message-id attributes found on the page
        const allMessageIds = document.querySelectorAll('[data-message-id]');
        console.log('All data-message-id elements found:', allMessageIds.length);
        allMessageIds.forEach((el, index) => {
            console.log(`Message ID ${index + 1}:`, el.getAttribute('data-message-id'));
        });
        
        console.log('Could not find valid message ID in any pattern');
        return null;
    }
    return null;
}

// Helper function to validate message ID
function isValidMessageId(messageId) {
    if (!messageId) {
        console.log('Message ID is null or undefined');
        return false;
    }
    
    // Gmail message IDs are typically long strings of alphanumeric characters
    // They don't contain special characters or spaces
    const validMessageIdPattern = /^[a-zA-Z0-9]+$/;
    
    const isValid = validMessageIdPattern.test(messageId) && messageId.length > 10;
    console.log('Message ID validation:', {
        messageId,
        matchesPattern: validMessageIdPattern.test(messageId),
        length: messageId.length,
        isValid
    });
    
    return isValid;
}

// Update message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
                const messageId = getCurrentEmailMessageId();
                if (!messageId) {
                    throw new Error('Could not find email message ID');
                }
                const result = await reportPhishingEmail(messageId);
                sendResponse(result);
            } catch (error) {
                console.error('Error reporting phishing:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    return true;
}); 