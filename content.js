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

// Enhanced phishing detection rules
function analyzeEmail(emailContent) {
    let score = 100;
    let details = [];

    console.log('Starting analysis with score:', score);

    // Check for suspicious sender domains
    if (emailContent.sender) {
        const senderDomain = emailContent.sender.split('@')[1];
        const suspiciousDomains = ['free', 'temp', 'disposable', 'fake', 'temporary'];
        if (senderDomain) {
            for (const domain of suspiciousDomains) {
                if (senderDomain.toLowerCase().includes(domain)) {
                    score -= 20;
                    details.push("Suspicious sender domain detected");
                    console.log('Suspicious domain detected, new score:', score);
                    break;
                }
            }
        }
    }

    // Check for urgency keywords in subject
    const urgencyKeywords = [
        'urgent', 'immediate', 'action required', 'account suspended', 'suspicious activity',
        'security alert', 'unauthorized', 'compromised', 'blocked', 'limited', 'verify',
        'suspended', 'unusual activity', 'security notice', 'important notice'
    ];

    if (emailContent.subject) {
        const subjectLower = emailContent.subject.toLowerCase();
        console.log('Checking subject:', subjectLower);
        
        urgencyKeywords.forEach(keyword => {
            if (subjectLower.includes(keyword.toLowerCase())) {
                score -= 15;
                details.push(`Urgency language detected in subject: "${keyword}"`);
                console.log(`Urgency keyword "${keyword}" found, new score:`, score);
            }
        });
    }

    // Check for suspicious links
    if (emailContent.links && emailContent.links.length > 0) {
        console.log('Checking links:', emailContent.links);
        const suspiciousUrlPatterns = [
            'bit.ly', 'tinyurl', 'goo.gl', 'ow.ly', 't.co',
            'click.here', 'secure.login', 'account.verify',
            'signin.verify', 'security.check', 'verify'
        ];

        emailContent.links.forEach(link => {
            const linkLower = link.toLowerCase();
            suspiciousUrlPatterns.forEach(pattern => {
                if (linkLower.includes(pattern)) {
                    score -= 10;
                    details.push(`Suspicious URL pattern detected: "${pattern}"`);
                    console.log(`Suspicious URL pattern "${pattern}" found, new score:`, score);
                }
            });
        });
    }

    // Check for common phishing phrases in body
    const phishingPhrases = [
        'verify your account',
        'update your payment',
        'confirm your identity',
        'account has been compromised',
        'suspicious activity',
        'click here to verify',
        'password expired',
        'account will be suspended',
        'unauthorized access',
        'security breach',
        'verify your identity',
        'immediate action required',
        'failure to comply',
        'account suspension',
        'limited time offer',
        'won a prize',
        'click here to claim',
        'enter your credentials',
        'confirm your password',
        'unusual login attempt'
    ];

    if (emailContent.body) {
        const bodyLower = emailContent.body.toLowerCase();
        console.log('Checking body:', bodyLower);
        
        phishingPhrases.forEach(phrase => {
            if (bodyLower.includes(phrase.toLowerCase())) {
                score -= 15;
                details.push(`Suspicious phrase detected: "${phrase}"`);
                console.log(`Suspicious phrase "${phrase}" found, new score:`, score);
            }
        });

        // Additional checks for urgency indicators in body
        const timePatterns = ['24 hours', 'immediately', 'urgent action', 'right now', 'as soon as possible'];
        timePatterns.forEach(pattern => {
            if (bodyLower.includes(pattern.toLowerCase())) {
                score -= 10;
                details.push(`Time pressure tactic detected: "${pattern}"`);
                console.log(`Time pressure pattern "${pattern}" found, new score:`, score);
            }
        });

        // Check for poor grammar or generic greetings
        const genericGreetings = ['dear user', 'dear customer', 'dear account holder', 'dear sir/madam'];
        genericGreetings.forEach(greeting => {
            if (bodyLower.includes(greeting.toLowerCase())) {
                score -= 10;
                details.push(`Generic greeting detected: "${greeting}"`);
                console.log(`Generic greeting "${greeting}" found, new score:`, score);
            }
        });
    }

    // Ensure score stays within 0-100 range
    score = Math.max(0, Math.min(100, score));
    console.log('Final score:', score);
    console.log('Final details:', details);

    return {
        score: score,
        details: details
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
    return true; // Keep the message channel open for async response
}); 