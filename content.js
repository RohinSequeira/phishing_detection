// Function to extract email content based on the email provider
function extractEmailContent() {
    let emailContent = {
        subject: '',
        body: '',
        sender: '',
        links: []
    };

    console.log('Starting email content extraction...');
    console.log('Current hostname:', window.location.hostname);

    // Gmail
    if (window.location.hostname.includes('mail.google.com')) {
        // Get email subject
        const subjectElement = document.querySelector('h2.hP');
        console.log('Subject element found:', subjectElement);
        if (subjectElement) {
            emailContent.subject = subjectElement.textContent.trim();
            console.log('Extracted subject:', emailContent.subject);
        }

        // Get email body - try multiple selectors
        const bodySelectors = ['.a3s.aiL', '.a3s.aiL .ii.gt', '.ii.gt'];
        let bodyElement = null;
        
        for (const selector of bodySelectors) {
            bodyElement = document.querySelector(selector);
            if (bodyElement) {
                console.log('Found body element with selector:', selector);
                break;
            }
        }

        if (bodyElement) {
            emailContent.body = bodyElement.innerText.trim();
            console.log('Extracted body:', emailContent.body);
        } else {
            console.log('No body element found with any selector');
        }

        // Get sender - try multiple selectors
        const senderSelectors = ['.gD', '.go', '[email]', '.from'];
        let senderElement = null;

        for (const selector of senderSelectors) {
            senderElement = document.querySelector(selector);
            if (senderElement) {
                console.log('Found sender element with selector:', selector);
                break;
            }
        }

        if (senderElement) {
            emailContent.sender = senderElement.getAttribute('email') || senderElement.textContent.trim();
            console.log('Extracted sender:', emailContent.sender);
        } else {
            console.log('No sender element found with any selector');
        }

        // Get all links
        if (bodyElement) {
            const links = bodyElement.querySelectorAll('a');
            console.log('Found links:', links.length);
            links.forEach(link => {
                if (link.href && !link.href.startsWith('mailto:')) {
                    emailContent.links.push(link.href);
                    console.log('Added link:', link.href);
                }
            });
        }
    }

    return emailContent;
}

// New risk-based analysis
function analyzeEmail(emailContent) {
    let highRiskFactors = [];
    let warnings = [];
    let details = [];

    // Check for high-risk factors
    if (emailContent.subject) {
        const subjectLower = emailContent.subject.toLowerCase();
        const highRiskSubjectPatterns = [
            'account.*suspended',
            'security.*breach',
            'unauthorized.*access',
            'immediate.*action.*required',
            'verify.*account.*now'
        ];

        highRiskSubjectPatterns.forEach(pattern => {
            if (subjectLower.match(new RegExp(pattern))) {
                highRiskFactors.push({
                    type: 'urgency',
                    detail: `Urgent action demanded in subject: "${emailContent.subject}"`
                });
            }
        });
    }

    // Check for suspicious sender
    if (emailContent.sender) {
        const senderLower = emailContent.sender.toLowerCase();
        const suspiciousSenderPatterns = [
            '@.*\\.temp\\.',
            '@.*\\.fake\\.',
            '@.*\\.free\\.',
            'noreply@',
            'account@',
            'security@',
            'support@'
        ];

        suspiciousSenderPatterns.forEach(pattern => {
            if (senderLower.match(new RegExp(pattern))) {
                warnings.push({
                    type: 'spoofing',
                    detail: 'Potentially spoofed sender address'
                });
            }
        });
    }

    // Check body content
    if (emailContent.body) {
        const bodyLower = emailContent.body.toLowerCase();

        // Check for sensitive information requests
        const sensitiveInfoPatterns = [
            'password',
            'credit card',
            'social security',
            'bank account',
            'verify.*identity',
            'confirm.*account'
        ];

        sensitiveInfoPatterns.forEach(pattern => {
            if (bodyLower.match(new RegExp(pattern))) {
                highRiskFactors.push({
                    type: 'sensitive',
                    detail: 'Requests for sensitive information detected'
                });
            }
        });

        // Check for urgency/pressure tactics
        const pressurePatterns = [
            'within.*24 hours',
            'account.*suspended',
            'limited time',
            'immediate action',
            'urgent',
            'expires soon'
        ];

        pressurePatterns.forEach(pattern => {
            if (bodyLower.match(new RegExp(pattern))) {
                warnings.push({
                    type: 'pressure',
                    detail: 'Time pressure tactics detected'
                });
            }
        });

        // Check for generic greetings
        const genericGreetings = [
            'dear user',
            'dear customer',
            'dear account holder',
            'dear sir/madam'
        ];

        genericGreetings.forEach(greeting => {
            if (bodyLower.includes(greeting)) {
                warnings.push({
                    type: 'generic',
                    detail: 'Generic or impersonal greeting used'
                });
            }
        });
    }

    // Check links
    if (emailContent.links && emailContent.links.length > 0) {
        const suspiciousUrlPatterns = [
            'bit\\.ly',
            'tinyurl',
            'goo\\.gl',
            'tiny\\.cc',
            'click\\.here',
            'verify.*account',
            'login.*secure'
        ];

        emailContent.links.forEach(link => {
            const linkLower = link.toLowerCase();
            suspiciousUrlPatterns.forEach(pattern => {
                if (linkLower.match(new RegExp(pattern))) {
                    highRiskFactors.push({
                        type: 'links',
                        detail: `Suspicious URL pattern detected: ${link}`
                    });
                }
            });
        });
    }

    // Compile all details
    [...highRiskFactors, ...warnings].forEach(item => {
        details.push(item.detail);
    });

    return {
        highRiskFactors,
        warnings,
        details
    };
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    if (request.action === "getEmailContent") {
        try {
            console.log('Getting email content...');
            const emailContent = extractEmailContent();
            console.log('Analyzing email content...');
            const analysis = analyzeEmail(emailContent);
            console.log('Analysis complete:', analysis);
            sendResponse(analysis);
        } catch (error) {
            console.error('Error in content script:', error);
            sendResponse({ error: error.message });
        }
    }
    return true;
}); 